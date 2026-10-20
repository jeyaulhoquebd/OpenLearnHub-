/**
 * Legal / safety blocklist for resource sources.
 *
 * OpenLearn Hub only links to lawful, free material. This file is deliberately
 * a plain list so it can be extended without touching route logic.
 *
 * - `PIRACY_DOMAINS`   hosts that distribute pirated or cracked material.
 * - `PIRACY_KEYWORDS`  words in a title/description/source name that indicate
 *                      piracy ("crack", "keygen", "torrent", …).
 * - `SOFTWARE_MIRRORS` third-party download portals. Software must link to the
 *                      official vendor page, so these are rejected for
 *                      `type: "software"` only.
 *
 * Matching is case-insensitive and applies to the registrable host (including
 * subdomains). Keep entries lower-case, without "www." or a trailing slash.
 */

export const PIRACY_DOMAINS = [
  'thepiratebay.org',
  '1337x.to',
  'rarbg.to',
  'kickasstorrents.to',
  'yts.mx',
  'torrentz2.eu',
  'limetorrents.lol',
  'fitgirl-repacks.site',
  'igg-games.com',
  'steamunlocked.net',
  'oceanofgames.com',
  'cracked-games.org',
  'gamestorrents.org',
  'getintopc.com',
  'filecr.com',
  'karanpc.com',
  'sadeempc.com',
  'repack-games.com',
  'apkmody.io',
  'rexdl.com',
  'nulled.to',
  'crackwatch.com'
];

export const PIRACY_KEYWORDS = [
  'cracked',
  'cracking',
  'keygen',
  'serial key',
  'license key generator',
  'activation crack',
  'pirated',
  'piracy download',
  'torrent',
  'warez',
  'nulled',
  'repack',
  'pre-activated',
  'full version free download'
];

export const SOFTWARE_MIRRORS = [
  'softonic.com',
  'filehippo.com',
  'filehorse.com',
  'download.cnet.com',
  'apkpure.com',
  'apkmirror.com',
  'uptodown.com',
  'malavida.com'
];

/** Normalises a hostname for comparison (lower-case, no "www."). */
export function normalizeHost(hostname = '') {
  return String(hostname).toLowerCase().replace(/^www\./, '').replace(/\.$/, '');
}

/** True when `hostname` is, or is a subdomain of, `domain`. */
export function hostMatches(hostname, domain) {
  const host = normalizeHost(hostname);
  const base = normalizeHost(domain);
  return host === base || host.endsWith(`.${base}`);
}

function findDomain(hostname, domains) {
  return domains.find((domain) => hostMatches(hostname, domain)) || null;
}

function findKeyword(text, keywords) {
  const haystack = String(text || '');
  return (
    keywords.find((keyword) => {
      const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      // Word-ish boundaries so "cracker" does not trigger "crack".
      const pattern = new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`, 'i');
      return pattern.test(haystack);
    }) || null
  );
}

/**
 * Inspects a normalised resource payload.
 *
 * @param {object} resource
 * @param {string} resource.sourceUrl
 * @param {string} resource.type
 * @param {string} [resource.sourceName]
 * @param {{en?: string, bn?: string, ur?: string}} [resource.title]
 * @param {{en?: string, bn?: string, ur?: string}} [resource.description]
 * @returns {{code: string, match: string, message: string} | null}
 */
export function findBlockedSource(resource = {}) {
  let hostname = '';
  try {
    hostname = new URL(resource.sourceUrl || '').hostname;
  } catch {
    hostname = '';
  }

  const blockedDomain = findDomain(hostname, PIRACY_DOMAINS);
  if (blockedDomain) {
    return {
      code: 'blocked_domain',
      match: blockedDomain,
      message: `The source domain "${blockedDomain}" is on the piracy blocklist.`
    };
  }

  const text = [
    resource.sourceName,
    resource.title?.en,
    resource.title?.bn,
    resource.title?.ur,
    resource.description?.en,
    resource.description?.bn,
    resource.description?.ur
  ]
    .filter(Boolean)
    .join(' ');

  const keyword = findKeyword(text, PIRACY_KEYWORDS);
  if (keyword) {
    return {
      code: 'piracy_keyword',
      match: keyword,
      message: `The listing mentions "${keyword}", which indicates pirated or cracked material.`
    };
  }

  if (resource.type === 'software') {
    const mirror = findDomain(hostname, SOFTWARE_MIRRORS);
    if (mirror) {
      return {
        code: 'unofficial_software_source',
        match: mirror,
        message: `Software must link to the official vendor page. "${mirror}" is a third-party download portal.`
      };
    }
  }

  return null;
}
