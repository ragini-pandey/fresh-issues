import { MIN_REQUEST_INTERVAL } from './github.constants';

// ─── Tiny async helper ────────────────────────────────────────────────────────
export const sleep = (ms: number): Promise<void> =>
  new Promise((r) => setTimeout(r, ms));

// ─── Back-off deadline ────────────────────────────────────────────────────────
let _retryAfterUntil = 0; // epoch ms

export const getRetryAfterUntil = (): number => _retryAfterUntil;

export function setRetryAfterUntil(epochMs: number): void {
  _retryAfterUntil = epochMs;
}

// ─── Request queue ────────────────────────────────────────────────────────────
interface QueueEntry<T = unknown> {
  resolver: { resolve: (v: T) => void; reject: (e: unknown) => void };
  request: () => Promise<T>;
}

const REQUEST_QUEUE: QueueEntry[] = [];
let lastRequestTime = 0;
let isProcessingQueue = false;

async function processQueue(): Promise<void> {
  if (isProcessingQueue || REQUEST_QUEUE.length === 0) return;
  isProcessingQueue = true;

  while (REQUEST_QUEUE.length > 0) {
    const backoffMs = _retryAfterUntil - Date.now();
    if (backoffMs > 0) await sleep(backoffMs);

    const sinceLastReq = Date.now() - lastRequestTime;
    if (sinceLastReq < MIN_REQUEST_INTERVAL) {
      await sleep(MIN_REQUEST_INTERVAL - sinceLastReq);
    }

    const entry = REQUEST_QUEUE.shift()!;
    lastRequestTime = Date.now();

    try {
      entry.resolver.resolve(await entry.request());
    } catch (err) {
      entry.resolver.reject(err);
    }
  }

  isProcessingQueue = false;
}

export function queueRequest<T>(request: () => Promise<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    REQUEST_QUEUE.push({
      resolver: { resolve: resolve as (v: unknown) => void, reject },
      request: request as () => Promise<unknown>,
    });
    void processQueue();
  });
}
