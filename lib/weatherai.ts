/**
 * WeatherAI API client.
 *
 * The only file that knows the upstream payload shape. Everything downstream
 * consumes the normalized model in `lib/types.ts`.
 *
 * Response shape was verified against the live API rather than taken from
 * the docs — see the note in `lib/types.ts` for where the two diverge.
 */

import type { CurrentPoint, DayPoint, Forecast, HourPoint, Usage } from "./types";
import { validateForecastPayload } from "./validate";

const BASE_URL =
  process.env.WEATHERAI_BASE_URL?.replace(/\/$/, "") ?? "https://api.weather-ai.co";

export class WeatherAIError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly retryable: boolean,
  ) {
    super(message);
    this.name = "WeatherAIError";
  }
}

interface RawDay {
  date: string;
  temp_max: number;
  temp_min: number;
  precipitation: number;
  weathercode: number;
}

interface RawHour {
  time: string;
  temp: number;
  precipitation: number;
  weathercode: number;
}

interface RawCurrent {
  time: string;
  temperature: number;
  windspeed: number;
  winddirection: number;
  is_day: number;
  weathercode: number;
}

interface RawForecast {
  lat: number;
  lon: number;
  units: string;
  days: number;
  current: RawCurrent;
  daily: RawDay[];
  hourly: RawHour[];
  ai_summary: string | null;
}

function apiKey(): string {
  const key = process.env.WEATHERAI_API_KEY;
  if (!key) {
    throw new WeatherAIError(
      "WEATHERAI_API_KEY is not set. Copy .env.example to .env.local and add your key.",
      500,
      false,
    );
  }
  return key;
}

async function call<T>(path: string, signal?: AbortSignal): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      headers: {
        Authorization: `Bearer ${apiKey()}`,
        Accept: "application/json",
      },
      signal,
      // Caching is handled in lib/cache.ts, keyed on rounded coordinates.
      cache: "no-store",
    });
  } catch (cause) {
    throw new WeatherAIError(`Could not reach WeatherAI: ${String(cause)}`, 503, true);
  }

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    const message =
      res.status === 401
        ? "WeatherAI rejected the API key (401)."
        : res.status === 403
          ? "Not available on this plan (403)."
          : res.status === 429
            ? "WeatherAI monthly quota exhausted (429)."
            : `WeatherAI returned ${res.status}. ${body.slice(0, 200)}`;
    throw new WeatherAIError(message, res.status, res.status === 429 || res.status >= 500);
  }

  return (await res.json()) as T;
}

function normalizeDay(d: RawDay): DayPoint {
  return {
    date: d.date,
    tempMinC: d.temp_min,
    tempMaxC: d.temp_max,
    precipMm: d.precipitation ?? 0,
    code: d.weathercode,
  };
}

function normalizeHour(h: RawHour): HourPoint {
  return {
    time: h.time,
    tempC: h.temp,
    precipMm: h.precipitation ?? 0,
    code: h.weathercode,
  };
}

function normalizeCurrent(c: RawCurrent): CurrentPoint {
  return {
    time: c.time,
    tempC: c.temperature,
    windKph: c.windspeed,
    windDirDeg: c.winddirection,
    isDay: c.is_day === 1,
    code: c.weathercode,
  };
}

/**
 * Fetch a forecast.
 *
 * `days` is capped at 7 — the free-plan ceiling. The API silently clamps
 * rather than erroring, so we clamp explicitly to keep the request honest.
 */
export async function fetchForecast(opts: {
  lat: number;
  lon: number;
  days?: number;
  withAi?: boolean;
  signal?: AbortSignal;
}): Promise<Forecast> {
  const params = new URLSearchParams({
    lat: String(opts.lat),
    lon: String(opts.lon),
    days: String(Math.min(opts.days ?? 7, 7)),
    units: "metric",
  });
  if (opts.withAi) params.set("ai", "true");

  const json = await call<unknown>(`/v1/weather?${params}`, opts.signal);

  // Validate before normalising. A null or missing numeric field would
  // otherwise pass the cast, become NaN in the scoring maths, and surface as a
  // confident "poor" verdict with no error anywhere. The gate turns that
  // silent corruption into a diagnosable failure naming the offending field.
  let raw: RawForecast;
  try {
    raw = validateForecastPayload(json) as unknown as RawForecast;
  } catch (err) {
    throw new WeatherAIError(
      err instanceof Error ? err.message : "Invalid WeatherAI payload.",
      502,
      false,
    );
  }

  return {
    place: { lat: raw.lat, lon: raw.lon },
    current: normalizeCurrent(raw.current),
    days: raw.daily.map(normalizeDay),
    hours: raw.hourly.map(normalizeHour),
    aiSummary: raw.ai_summary?.trim() || null,
    fetchedAt: new Date().toISOString(),
  };
}

/** Account usage. Cheap, and the only reliable quota signal — the API sends no rate-limit headers. */
export async function fetchUsage(signal?: AbortSignal): Promise<Usage> {
  return call<Usage>("/v1/usage", signal);
}
