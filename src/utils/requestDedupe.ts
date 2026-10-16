// src/utils/requestDedupe.ts

type PendingRequest<T> = {
  promise: Promise<T>;
  timestamp: number;
  cooldownMs: number;
};

const inflight = new Map<string, PendingRequest<any>>();

/**
 * Dedupe wrapper for async request functions.
 * - If an identical key is already in-flight, returns the same promise.
 * - Optionally keeps the resolved promise cached for `cooldownMs` so rapid
 *   duplicate calls (e.g. TabNav prefetch + screen mount) are absorbed.
 */
export function dedupeRequest<T>(
  key: string,
  task: () => Promise<T>,
  cooldownMs: number = 0
): Promise<T> {
  const existing = inflight.get(key);

  if (existing) {
    const age = Date.now() - existing.timestamp;
    if (cooldownMs === 0 || age < existing.cooldownMs) {
      return existing.promise;
    }
    inflight.delete(key);
  }

  const promise = task()
    .then((result) => {
      if (cooldownMs > 0) {
        inflight.set(key, {
          promise: Promise.resolve(result),
          timestamp: Date.now(),
          cooldownMs,
        });
        setTimeout(() => {
          const entry = inflight.get(key);
          if (entry && entry.cooldownMs === cooldownMs) {
            inflight.delete(key);
          }
        }, cooldownMs);
      } else {
        inflight.delete(key);
      }
      return result;
    })
    .catch((err) => {
      inflight.delete(key);
      throw err;
    });

  inflight.set(key, { promise, timestamp: Date.now(), cooldownMs });
  return promise;
}

export function clearDedupeKey(key: string) {
  inflight.delete(key);
}

export function clearAllDedupe() {
  inflight.clear();
}