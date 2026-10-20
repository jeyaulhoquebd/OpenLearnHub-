import dns from 'node:dns/promises';
import net from 'node:net';

/**
 * Safe outbound link checker.
 *
 * The admin panel can ask the server to test a URL (or check every resource).
 * That turns the API into a request proxy, so every hop is validated against
 * SSRF: only http/https, no loopback/private/link-local addresses (checked both
 * in the literal host and after DNS resolution), and every redirect is
 * re-validated.
 *
 * The defaults (3 redirects / 7 s) are used by the resource form's "Test link"
 * button; the bulk checker passes 5 redirects / 10 s.
 */

const MAX_REDIRECTS = 3;
const TIMEOUT_MS = 7000;
const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);
const USER_AGENT = 'OpenLearnHub-LinkChecker/1.0 (+https://openlearnhub.org)';

function isPrivateIPv4(address) {
  const parts = address.split('.').map(Number);
  if (parts.length !== 4 || parts.some((part) => Number.isNaN(part))) return true;
  const [a, b] = parts;

  if (a === 0 || a === 10 || a === 127) return true;
  if (a === 169 && b === 254) return true; // link-local + cloud metadata
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
  if (a === 198 && (b === 18 || b === 19)) return true;
  if (a >= 224) return true; // multicast + reserved
  return false;
}

function isPrivateIp(address) {
  const value = String(address || '').trim().toLowerCase();
  if (!value) return true;

  if (net.isIPv4(value)) return isPrivateIPv4(value);

  if (net.isIPv6(value)) {
    if (value === '::1' || value === '::') return true;
    if (value.startsWith('fc') || value.startsWith('fd')) return true; // unique local
    if (value.startsWith('fe8') || value.startsWith('fe9') || value.startsWith('fea') || value.startsWith('feb')) {
      return true; // link-local
    }
    // IPv4-mapped address (::ffff:127.0.0.1)
    const mapped = value.match(/::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped) return isPrivateIPv4(mapped[1]);
    return false;
  }

  // Not an IP literal: handled by the hostname allow-list below.
  return true;
}

function assertAllowedHostname(hostname) {
  const host = String(hostname || '').toLowerCase().replace(/\.$/, '');
  if (!host) throw badRequest('invalid_url', 'The URL is missing a hostname.');
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local')) {
    throw badRequest('unsafe_url', 'Local addresses cannot be checked.');
  }
  if (net.isIP(host) && isPrivateIp(host)) {
    throw badRequest('unsafe_url', 'Private network addresses cannot be checked.');
  }
}

function badRequest(code, message) {
  const error = new Error(message);
  error.status = 400;
  error.code = code;
  return error;
}

/**
 * Parses and validates a URL, including DNS resolution of the host.
 *
 * @param {string} value
 * @returns {Promise<URL>}
 */
export async function assertPublicHttpUrl(value) {
  let url;
  try {
    url = new URL(String(value || '').trim());
  } catch {
    throw badRequest('invalid_url', 'That is not a valid URL.');
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw badRequest('invalid_url', 'Only http:// and https:// links can be checked.');
  }
  if (url.username || url.password) {
    throw badRequest('unsafe_url', 'Links with embedded credentials are not allowed.');
  }

  assertAllowedHostname(url.hostname);

  // Resolve the hostname so DNS tricks cannot point at a private address.
  try {
    const records = await dns.lookup(url.hostname, { all: true });
    if (!records.length) throw new Error('no records');
    if (records.some((record) => isPrivateIp(record.address))) {
      throw badRequest('unsafe_url', 'That host resolves to a private network address.');
    }
  } catch (error) {
    if (error.code === 'unsafe_url') throw error;
    // Unknown host: not unsafe, just unreachable. The caller still gets a
    // useful "could not resolve" result instead of a 500.
    const dnsError = new Error('Could not resolve the hostname.');
    dnsError.code = 'dns_error';
    throw dnsError;
  }

  return url;
}

async function requestOnce(url, method, timeoutMs) {
  const response = await fetch(url, {
    method,
    redirect: 'manual',
    signal: AbortSignal.timeout(Math.max(250, timeoutMs)),
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
    }
  });

  if (REDIRECT_STATUSES.has(response.status)) {
    const location = response.headers.get('location');
    if (location) {
      // Drain the body so the socket can be reused.
      await response.body?.cancel?.().catch(() => {});
      return { redirect: new URL(location, url).href };
    }
  }

  const contentType = response.headers.get('content-type') || '';
  await response.body?.cancel?.().catch(() => {});

  return { status: response.status, ok: response.ok, contentType };
}

function timeoutResult(finalUrl, redirects) {
  return {
    ok: false,
    status: 0,
    finalUrl,
    contentType: '',
    error: 'timeout',
    redirects
  };
}

/**
 * Checks that a URL responds. Follows redirects (default 3), validating each
 * target with the same SSRF rules, within one overall timeout.
 *
 * Never throws for unreachable hosts: the result carries `ok: false` and an
 * `error` code. Invalid or unsafe URLs still throw (HTTP 400 upstream).
 *
 * @param {string} value
 * @param {{ maxRedirects?: number, timeoutMs?: number }} [options]
 * @returns {Promise<{ok: boolean, status: number, finalUrl: string, contentType: string, error: string|null, redirects: number}>}
 */
export async function checkUrl(value, { maxRedirects = MAX_REDIRECTS, timeoutMs = TIMEOUT_MS } = {}) {
  const deadline = Date.now() + timeoutMs;
  let current = await assertPublicHttpUrl(value);
  let redirects = 0;

  for (let hop = 0; hop <= maxRedirects; hop += 1) {
    const remaining = deadline - Date.now();
    if (remaining < 250) return timeoutResult(current.href, redirects);

    let result;
    try {
      result = await requestOnce(current.href, 'HEAD', remaining);
      // Some hosts reject HEAD; retry with GET before calling it broken.
      if (typeof result.status === 'number' && result.status >= 400) {
        const retryBudget = deadline - Date.now();
        if (retryBudget < 250) return timeoutResult(current.href, redirects);
        result = await requestOnce(current.href, 'GET', retryBudget);
      }
    } catch (error) {
      if (error?.code === 'unsafe_url') throw error;
      const timedOut = error?.name === 'TimeoutError' || error?.name === 'AbortError';
      return {
        ok: false,
        status: 0,
        finalUrl: current.href,
        contentType: '',
        error: timedOut ? 'timeout' : 'unreachable',
        redirects
      };
    }

    if (result.redirect) {
      redirects += 1;
      try {
        current = await assertPublicHttpUrl(result.redirect);
      } catch (error) {
        if (error.code === 'unsafe_url' || error.code === 'invalid_url') throw error;
        return {
          ok: false,
          status: 0,
          finalUrl: result.redirect,
          contentType: '',
          error: 'dns_error',
          redirects
        };
      }
      continue;
    }

    return {
      ok: Boolean(result.ok),
      status: Number(result.status) || 0,
      finalUrl: current.href,
      contentType: result.contentType || '',
      error: null,
      redirects
    };
  }

  return {
    ok: false,
    status: 0,
    finalUrl: current.href,
    contentType: '',
    error: 'too_many_redirects',
    redirects
  };
}
