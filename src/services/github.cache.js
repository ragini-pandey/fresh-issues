import { CACHE_DURATION } from './github.constants.js';
import { queueRequest }   from './github.throttle.js';

// ─── In-memory cache ──────────────────────────────────────────────────────────
// Entry shape: { data: any, timestamp: number, etag: string | null }
export const CACHE = new Map();

// ─── GraphQL cursor store ─────────────────────────────────────────────────────
// Shape: baseKey → { [pageNum]: endCursor }
// Lets "load more" pass the correct `after` cursor for each successive page.
export const CURSOR_MAP = new Map();

/**
 * Serve from the TTL cache when fresh; otherwise fetch through the throttle
 * queue using a conditional GET (If-None-Match / ETag) to save quota.
 *
 * The `makeRequest` callback receives the cached ETag (or null) and must
 * return `{ data, etag, notModified }`:
 *   - notModified: true  → GitHub returned 304; reuse existing data, refresh TTL
 *   - notModified: false → fresh response; store new data and etag
 *
 * @param {string}   cacheKey
 * @param {(etag: string | null) => Promise<{data: any, etag: string | null, notModified: boolean}>} makeRequest
 * @returns {Promise<any>}
 */
export function getCached(cacheKey, makeRequest) {
  const cached = CACHE.get(cacheKey);

  // Serve from memory while the entry is still within its TTL
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return Promise.resolve(cached.data);
  }

  // Forward any stored ETag so GitHub can return 304 Not Modified
  const existingEtag = cached?.etag ?? null;

  return queueRequest(() => makeRequest(existingEtag)).then(({ data, etag, notModified }) => {
    if (notModified && cached) {
      // 304 – content unchanged; refresh TTL, keep existing data and ETag
      CACHE.set(cacheKey, { ...cached, timestamp: Date.now() });
      return cached.data;
    }
    CACHE.set(cacheKey, { data, timestamp: Date.now(), etag: etag ?? null });
    return data;
  });
}
