import { MIN_REQUEST_INTERVAL } from './github.constants.js';

// ─── Tiny async helper ────────────────────────────────────────────────────────
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ─── Back-off deadline ────────────────────────────────────────────────────────
// Module-private; mutated by setRetryAfterUntil() when GitHub signals throttling.
let _retryAfterUntil = 0; // epoch ms

/** Returns the current back-off deadline (epoch ms). */
export const getRetryAfterUntil = () => _retryAfterUntil;

/**
 * Set a back-off deadline.  The queue will sleep until this time before
 * dispatching the next request.
 *
 * @param {number} epochMs  - Absolute time (Date.now() + delay) to wait until.
 */
export function setRetryAfterUntil(epochMs) {
  _retryAfterUntil = epochMs;
}

// ─── Request queue ────────────────────────────────────────────────────────────
const REQUEST_QUEUE   = [];
let lastRequestTime   = 0;
let isProcessingQueue = false;

/**
 * Drain the queue one entry at a time, enforcing:
 *   ① a global back-off when Retry-After / secondary RL fires
 *   ② a minimum gap of MIN_REQUEST_INTERVAL between every pair of requests
 */
async function processQueue() {
  if (isProcessingQueue || REQUEST_QUEUE.length === 0) return;
  isProcessingQueue = true;

  while (REQUEST_QUEUE.length > 0) {
    // ① Honour Retry-After / secondary rate-limit back-off
    const backoffMs = _retryAfterUntil - Date.now();
    if (backoffMs > 0) await sleep(backoffMs);

    // ② Enforce minimum spacing between consecutive requests
    const sinceLastReq = Date.now() - lastRequestTime;
    if (sinceLastReq < MIN_REQUEST_INTERVAL) {
      await sleep(MIN_REQUEST_INTERVAL - sinceLastReq);
    }

    const { resolver, request } = REQUEST_QUEUE.shift();
    lastRequestTime = Date.now();

    try {
      resolver.resolve(await request());
    } catch (err) {
      resolver.reject(err);
    }
  }

  isProcessingQueue = false;
}

/**
 * Push a request onto the throttle queue and return a Promise that resolves
 * (or rejects) when the request eventually runs.
 *
 * @param {() => Promise<any>} request - Async function that performs the fetch.
 * @returns {Promise<any>}
 */
export function queueRequest(request) {
  return new Promise((resolve, reject) => {
    REQUEST_QUEUE.push({ resolver: { resolve, reject }, request });
    processQueue();
  });
}
