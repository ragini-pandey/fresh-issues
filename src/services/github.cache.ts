import { CACHE_DURATION } from './github.constants';
import { queueRequest } from './github.throttle';

export interface CacheEntry<T = unknown> {
  data: T;
  timestamp: number;
  etag: string | null;
}

export interface MakeRequestResult<T> {
  data: T | null;
  etag: string | null;
  notModified: boolean;
}

// ─── In-memory cache ──────────────────────────────────────────────────────────
export const CACHE = new Map<string, CacheEntry>();

// ─── GraphQL cursor store ─────────────────────────────────────────────────────
export const CURSOR_MAP = new Map<string, Record<number, string>>();

/**
 * Serve from the TTL cache when fresh; otherwise fetch through the throttle
 * queue using a conditional GET (If-None-Match / ETag) to save quota.
 */
export function getCached<T>(
  cacheKey: string,
  makeRequest: (etag: string | null) => Promise<MakeRequestResult<T>>,
): Promise<T> {
  const cached = CACHE.get(cacheKey) as CacheEntry<T> | undefined;

  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return Promise.resolve(cached.data);
  }

  const existingEtag = cached?.etag ?? null;

  return queueRequest(() => makeRequest(existingEtag)).then(
    ({ data, etag, notModified }) => {
      if (notModified && cached) {
        CACHE.set(cacheKey, { ...cached, timestamp: Date.now() });
        return cached.data;
      }
      const fresh: CacheEntry<T> = {
        data: data as T,
        timestamp: Date.now(),
        etag: etag ?? null,
      };
      CACHE.set(cacheKey, fresh);
      return fresh.data;
    },
  );
}
