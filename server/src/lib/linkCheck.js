import dns from 'node:dns/promises';
import http from 'node:http';
import https from 'node:https';
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

// Every address range a public link must never resolve to. IPv4-mapped IPv6
// addresses (::ffff:127.0.0.1, ::ffff:7f00:1) are checked against the IPv4
// rules by BlockList itself.
const BLOCKED = new net.BlockList();
[
  ['0.0.0.0', 8],
  ['10.0.0.0', 8],
  ['100.64.0.0', 10], // CGNAT
  ['127.0.0.0', 8],
  ['169.254.0.0', 16], // link-local + cloud metadata
  ['172.16.0.0', 12],
  ['192.0.0.0', 24],
  ['192.0.2.0', 24],
  ['192.168.0.0', 16],
  ['198.18.0.0', 15],
  ['198.51.100.0', 24],
  ['203.0.113.0', 24],
  ['224.0.0.0', 3] // multicast + reserved + broadcast
].forEach(([address, prefix]) => BLOCKED.addSubnet(address, prefix, 'ipv4'));
[
  ['::', 128],
  ['::1', 128],
  ['64:ff9b::', 96], // NAT64 (embeds an IPv4 address)
  ['64:ff9b:1::', 48],
  ['100::', 64],
  ['2001:db8::', 32],
  ['2002::', 16], // 6to4 (embeds an IPv4 address)
  ['fc00::', 7], // unique local
  ['fe80::', 10], // link-local
  ['fec0::', 10],
  ['ff00::', 8] // multicast
].forEach(([address, prefix]) => BLOCKED.addSubnet(address, prefix, 'ipv6'));

function stripBrackets(host) {
  return String(host || '').trim().toLowerCase().replace(/^\[|\]$/g, '');
}

export function isPrivateIp(address) {
  const value = stripBrackets(address);
  const family = net.isIP(value);
  if (family === 4) return BLOCKED.check(value, 'ipv4');
  if (family === 6) return BLOCKED.check(value, 'ipv6');
  // Not an IP literal: treat as unsafe here; hostnames are resolved first.
  return true;
}

function assertAllowedHostname(hostname) {
  const host = stripBrackets(hostname).replace(/\.$/, '');
  if (!host) throw badRequest('invalid_url', 'The URL is missing a hostname.');
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') || host.endsWith('.internal')) {
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
    const records = await dns.lookup(stripBrackets(url.hostname), { all: true });
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

/**
 * DNS lookup used for the actual connection. It re-validates every resolved
 * address, so a DNS-rebinding host cannot pass the pre-check with a public IP
 * and then connect to a private one.
 */
function safeLookup(hostname, options, callback) {
  dns
    .lookup(hostname, { all: true, family: options?.family || 0 })
    .then((records) => {
      const allowed = records.filter((record) => !isPrivateIp(record.address));
      if (!records.length || allowed.length !== records.length) {
        callback(badRequest('unsafe_url', 'That host resolves to a private network address.'));
        return;
      }
      if (options?.all) callback(null, allowed);
      else callback(null, allowed[0].address, allowed[0].family);
    })
    .catch((error) => callback(error));
}

function requestOnce(url, method, timeoutMs) {
  const target = new URL(url);
  const client = target.protocol === 'https:' ? https : http;

  return new Promise((resolve, reject) => {
    const request = client.request(
      target,
      {
        method,
        lookup: safeLookup,
        timeout: Math.max(250, timeoutMs),
        headers: {
          'User-Agent': USER_AGENT,
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
        }
      },
      (response) => {
        const status = Number(response.statusCode) || 0;
        const location = response.headers.location;
        const contentType = String(response.headers['content-type'] || '');
        // Never read the body: we only need the status line and headers.
        response.destroy();

        if (REDIRECT_STATUSES.has(status) && location) {
          resolve({ redirect: new URL(location, target).href });
          return;
        }
        resolve({ status, ok: status >= 200 && status < 300, contentType });
      }
    );

    const timer = setTimeout(() => {
      request.destroy(Object.assign(new Error('Request timed out'), { name: 'TimeoutError' }));
    }, Math.max(250, timeoutMs));

    request.on('timeout', () => {
      request.destroy(Object.assign(new Error('Request timed out'), { name: 'TimeoutError' }));
    });
    request.on('error', (error) => {
      clearTimeout(timer);
      reject(error);
    });
    request.on('close', () => clearTimeout(timer));
    request.end();
  });
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
