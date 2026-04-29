import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('./github.throttle', () => ({
  queueRequest: (fn) => fn(),
}));

import { CACHE, getCached } from './github.cache';

describe('getCached', () => {
  beforeEach(() => {
    CACHE.clear();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-01T00:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('fetches and stores fresh data when cache is empty', async () => {
    const makeRequest = vi.fn().mockResolvedValue({
      data: { hello: 'world' },
      etag: 'W/"abc"',
      notModified: false,
    });

    const result = await getCached('k1', makeRequest);

    expect(result).toEqual({ hello: 'world' });
    expect(makeRequest).toHaveBeenCalledWith(null);
    expect(CACHE.get('k1')).toMatchObject({
      data: { hello: 'world' },
      etag: 'W/"abc"',
    });
  });

  it('serves from memory when within TTL without calling makeRequest', async () => {
    CACHE.set('k', { data: { x: 1 }, timestamp: Date.now(), etag: 'e' });
    const makeRequest = vi.fn();

    const result = await getCached('k', makeRequest);

    expect(result).toEqual({ x: 1 });
    expect(makeRequest).not.toHaveBeenCalled();
  });

  it('forwards stored ETag and refreshes TTL on 304 Not Modified', async () => {
    const original = { items: [1, 2] };
    CACHE.set('k', { data: original, timestamp: Date.now() - 5 * 60_000, etag: 'old-etag' });

    const makeRequest = vi.fn().mockResolvedValue({
      data: null,
      etag: null,
      notModified: true,
    });

    const result = await getCached('k', makeRequest);

    expect(makeRequest).toHaveBeenCalledWith('old-etag');
    expect(result).toBe(original);
    const stored = CACHE.get('k');
    expect(stored.data).toBe(original);
    expect(stored.etag).toBe('old-etag');
    expect(stored.timestamp).toBe(Date.now());
  });

  it('replaces stale data with fresh response', async () => {
    CACHE.set('k', { data: { old: true }, timestamp: Date.now() - 10 * 60_000, etag: 'old' });

    const makeRequest = vi.fn().mockResolvedValue({
      data: { fresh: true },
      etag: 'new',
      notModified: false,
    });

    const result = await getCached('k', makeRequest);

    expect(result).toEqual({ fresh: true });
    expect(CACHE.get('k')).toMatchObject({ data: { fresh: true }, etag: 'new' });
  });

  it('stores null etag when response has none', async () => {
    const makeRequest = vi.fn().mockResolvedValue({
      data: { ok: true },
      etag: undefined,
      notModified: false,
    });

    await getCached('k', makeRequest);
    expect(CACHE.get('k').etag).toBeNull();
  });
});
