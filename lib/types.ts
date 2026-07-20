/**
 * Normalized weather model.
 *
 * These types mirror what the WeatherAI free tier *actually* returns, which
 * is narrower than the published docs suggest. Verified against the live API
 * on 2026-07-20:
 *
 *   daily[7]   date, temp_max, temp_min, precipitation, weathercode
 *   hourly[48] time, temp, precipitation, weathercode
 *   current    temperature, windspeed, winddirection, is_day, weathercode
 *
 * Notably absent: humidity anywhere, and wind outside the current
 * observation. The rules engine is built around these constraints rather
 * than around the documented-but-unavailable fields.
 */

export interface HourPoint {
  /** Local ISO timestamp, e.g. "2026-07-20T14:00" */
  time: string;
  tempC: number;
  /** precipitation for this hour, millimetres */
  precipMm: number;
  /** WMO weather code */
  code: number;
}

export interface DayPoint {
  /** ISO date, YYYY-MM-DD */
  date: string;
  tempMinC: number;
  tempMaxC: number;
  /** total precipitation for the day, millimetres */
  precipMm: number;
  /** WMO weather code */
  code: number;
}

export interface CurrentPoint {
  time: string;
  tempC: number;
  windKph: number;
  windDirDeg: number;
  isDay: boolean;
  code: number;
}

export interface Place {
  lat: number;
  lon: number;
}

export interface Forecast {
  place: Place;
  current: CurrentPoint;
  days: DayPoint[];
  hours: HourPoint[];
  /**
   * AI narrative. The free tier returns null here even with `ai=true`, but
   * the field is carried through so a paid key lights it up with no code
   * change.
   */
  aiSummary: string | null;
  fetchedAt: string;
}

/** Account usage, from /v1/usage. */
export interface Usage {
  plan: string;
  used: number;
  limit: number;
  remaining: number;
  unlimited: boolean;
}
