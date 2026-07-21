/**
 * Growing-degree-day accumulation since planting.
 *
 * GDD needs a daily temperature history from the planting date to today — data
 * the forecast API does not carry. Rather than fake it, this pulls real daily
 * min/max from Open-Meteo's free historical archive (ERA5, no key), which is
 * exactly the "use more than the weather API where it genuinely helps" case.
 *
 * GDD for a day = max(0, (Tmax_capped + Tmin) / 2 − base), where Tmax is capped
 * at 30°C (the standard modified method — development does not speed up above
 * it). The archive lags real time by a few days; the result is labelled with
 * the date it is accurate through so the estimate is honest.
 */

import * as cache from "./cache";

export interface GddResult {
  gdd: number;
  /** Number of days summed. */
  days: number;
  /** Last date included (archive lags ~5 days). */
  throughDate: string;
}

const CAP_C = 30;

interface ArchiveResponse {
  daily?: {
    time: string[];
    temperature_2m_max: (number | null)[];
    temperature_2m_min: (number | null)[];
  };
}

/**
 * Accumulated GDD from `plantingDate` to as recently as the archive allows.
 * Returns null when planting is in the future or the archive is unreachable.
 * Cached for 12h — GDD moves slowly and the archive updates daily at most.
 */
export async function gddSincePlanting(opts: {
  lat: number;
  lon: number;
  plantingDate: string;
  baseC: number;
  today: string;
}): Promise<GddResult | null> {
  const { lat, lon, plantingDate, baseC, today } = opts;
  if (plantingDate >= today) return null;

  const key = cache.cacheKey([
    "gdd",
    cache.roundCoord(lat),
    cache.roundCoord(lon),
    plantingDate,
    baseC,
  ]);
  const cached = cache.getFresh<GddResult>(key);
  if (cached) return cached;

  const url =
    `https://archive-api.open-meteo.com/v1/archive?latitude=${lat}&longitude=${lon}` +
    `&start_date=${plantingDate}&end_date=${today}` +
    `&daily=temperature_2m_max,temperature_2m_min&timezone=auto`;

  try {
    const res = await fetch(url, {
      headers: { Accept: "application/json" },
      next: { revalidate: 43200 },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as ArchiveResponse;
    const d = data.daily;
    if (!d || !d.time?.length) return null;

    let gdd = 0;
    let days = 0;
    let throughDate = plantingDate;
    for (let i = 0; i < d.time.length; i++) {
      const max = d.temperature_2m_max[i];
      const min = d.temperature_2m_min[i];
      if (max == null || min == null) continue;
      const mean = (Math.min(max, CAP_C) + min) / 2;
      gdd += Math.max(0, mean - baseC);
      days += 1;
      throughDate = d.time[i];
    }
    if (days === 0) return null;

    const result: GddResult = { gdd: Math.round(gdd), days, throughDate };
    cache.set(key, result, 12 * 60 * 60);
    return result;
  } catch {
    return null;
  }
}
