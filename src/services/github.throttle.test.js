import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  queueRequest,
  setRetryAfterUntil,
  getRetryAfterUntil,
  sleep,
} from './github.throttle';

describe('sleep', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('resolves after the given delay', async () => {
    const p = sleep(100);
    vi.advanceTimersByTime(100);
    await expect(p).resolves.toBeUndefined();
  });
});

describe('retry-after deadline', () => {
  it('roundtrips through setter/getter', () => {
    setRetryAfterUntil(123456);
    expect(getRetryAfterUntil()).toBe(123456);
    setRetryAfterUntil(0);
    expect(getRetryAfterUntil()).toBe(0);
  });
});

describe('queueRequest', () => {
  beforeEach(() => {
    setRetryAfterUntil(0);
  });

  it('resolves with the request result', async () => {
    const result = await queueRequest(() => Promise.resolve('ok'));
    expect(result).toBe('ok');
  });

  it('rejects when the request throws', async () => {
    await expect(
      queueRequest(() => Promise.reject(new Error('nope'))),
    ).rejects.toThrow('nope');
  });

  it('runs queued requests sequentially', async () => {
    const order = [];
    const a = queueRequest(async () => {
      order.push('a-start');
      await Promise.resolve();
      order.push('a-end');
      return 'a';
    });
    const b = queueRequest(async () => {
      order.push('b-start');
      return 'b';
    });

    const [resA, resB] = await Promise.all([a, b]);
    expect(resA).toBe('a');
    expect(resB).toBe('b');
    // 'a' must finish before 'b' starts
    expect(order.indexOf('a-end')).toBeLessThan(order.indexOf('b-start'));
  });
});
