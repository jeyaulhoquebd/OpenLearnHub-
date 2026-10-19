import { fetchPublishedResources } from './data';

let cachedResources = null;
let inflight = null;
let cachedAt = 0;
const TTL_MS = 60 * 1000;

export async function loadResources({ force = false } = {}) {
  const now = Date.now();
  if (!force && cachedResources && now - cachedAt < TTL_MS) {
    return cachedResources;
  }
  if (!force && inflight) return inflight;

  inflight = fetchPublishedResources()
    .then((resources) => {
      cachedResources = resources;
      cachedAt = Date.now();
      return resources;
    })
    .finally(() => {
      inflight = null;
    });

  return inflight;
}

export function invalidateResourceCache() {
  cachedResources = null;
  cachedAt = 0;
  inflight = null;
}
