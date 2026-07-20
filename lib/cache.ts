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
  /** Retained so getStale() can report how old an expired entry is. */
  ttlSeconds: number;
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

/**
 * Retrieve an entry even if expired — the fallback when upstream fails.
 *
 * Returns the age alongside the value so the caller can decide whether the
 * data is still worth showing, and so the UI can say how old it is.
 * Entries beyond MAX_STALE_SECONDS are refused outright.
 */
export function getStale<T>(key: string): { value: T; ageSeconds: number } | null {
  const hit = store.get(key);
  if (!hit) return null;

  const ageSeconds = Math.max(
    0,
    Math.round((Date.now() - (hit.expiresAt - hit.ttlSeconds * 1000)) / 1000),
  );
  if (ageSeconds > MAX_STALE_SECONDS) return null;

  return { value: hit.value as T, ageSeconds };
}

export function set<T>(key: string, value: T, ttlSeconds: number): void {
  if (store.size >= MAX_ENTRIES) {
    // Drop the oldest insertion; Map preserves insertion order.
    const oldest = store.keys().next();
    if (!oldest.done) store.delete(oldest.value);
  }
  store.set(key, {
    value,
    expiresAt: Date.now() + ttlSeconds * 1000,
    ttlSeconds,
  });
}

/**
 * Cache lifetimes, sized against the quota rather than against freshness.
 *
 * The free plan allows 1,000 requests/month — about 33 per day for everything
 * combined. An earlier version used a 1-hour forecast TTL and a 5-minute usage
 * TTL, which under steady traffic works out to ~3,600 forecast calls and up to
 * ~8,640 usage calls per month. Both individually exceed the entire monthly
 * allowance.
 *
 * At 6 hours, the five presets cost 5 x 4 x 30 = 600 calls/month, and usage at
 * 12 hours adds ~60. That leaves headroom inside 1,000 with the request path
 * unable to exceed it, because only allowlisted coordinates are fetchable.
 *
 * Forecast models do not update often enough for 6 hours to cost accuracy on a
 * 7-day outlook.
 */
export const TTL = {
  forecast: 6 * 60 * 60,
  usage: 12 * 60 * 60,
} as const;

/**
 * Refuse to serve stale data indefinitely.
 *
 * Stale-on-failure keeps the page useful through an outage, but a forecast
 * old enough that its early days have already elapsed is worse than an honest
 * error — it would recommend a drying window that started yesterday.
 */
export const MAX_STALE_SECONDS = 36 * 60 * 60;
