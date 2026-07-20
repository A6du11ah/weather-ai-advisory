/**
 * In-process response cache.
 *
 * The free plan allows 1,000 requests per month, which a publicly reachable
 * deployment can burn through in a day. Two things protect the quota:
 *
 *  1. Coordinates are rounded before they become part of the key, so everyone
 *     within roughly 10km of each other shares one upstream call.
 *  2. Entries are kept after they expire. If upstream then fails or returns
 *     429, we serve the expired copy flagged `stale` rather than an error —
 *     a demo that degrades to slightly-old data beats one that shows a
 *     stack trace.
 *
 * This is per-instance memory, so a serverless deployment gets one cache per
 * warm lambda rather than a shared one. That is fine at this scale; a
 * production version would use Redis or Vercel KV. Noted in the README.
 */

interface Entry<T> {
  value: T;
  expiresAt: number;
}

const store = new Map<string, Entry<unknown>>();

/** Cap entries so a long-lived instance cannot grow without bound. */
const MAX_ENTRIES = 200;

export function cacheKey(parts: (string | number)[]): string {
  return parts.join("|");
}

/** Round to ~10km so nearby requests share an upstream call. */
export function roundCoord(n: number): number {
  return Math.round(n * 10) / 10;
}

export function getFresh<T>(key: string): T | null {
  const hit = store.get(key);
  if (!hit) return null;
  if (hit.expiresAt < Date.now()) return null;
  return hit.value as T;
}

/** Retrieve an entry even if expired — used as a fallback when upstream fails. */
export function getStale<T>(key: string): T | null {
  const hit = store.get(key);
  return hit ? (hit.value as T) : null;
}

export function set<T>(key: string, value: T, ttlSeconds: number): void {
  if (store.size >= MAX_ENTRIES) {
    // Drop the oldest insertion; Map preserves insertion order.
    const oldest = store.keys().next();
    if (!oldest.done) store.delete(oldest.value);
  }
  store.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
}

export const TTL = {
  /** Raw forecast. Upstream models do not update more often than hourly. */
  forecast: 60 * 60,
  /** Account usage. Cheap, but there is no reason to re-check it every hit. */
  usage: 5 * 60,
} as const;
