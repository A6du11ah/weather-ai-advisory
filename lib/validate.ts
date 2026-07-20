/**
 * Runtime validation of the upstream WeatherAI payload.
 *
 * lib/weatherai.ts casts the parsed JSON straight to a TypeScript interface,
 * which is a compile-time fiction: at runtime a null or missing `temp_max`
 * passes the cast untouched, becomes NaN in the scoring maths, and yields
 * verdictFromScore(NaN) === "poor" — a confident wrong answer on every card
 * with no error logged anywhere.
 *
 * This module is the gate that turns that silent corruption into a loud,
 * diagnosable failure. It is deliberately strict on the numbers that feed
 * scoring and lenient on structure the vendor may extend, so a benign added
 * field never fails an otherwise-good forecast.
 *
 * Verified against the live free tier on 2026-07-20; the shape here follows
 * the observed response, not the published docs.
 */

import { z } from "zod/v3";

/**
 * A finite number: the schema for every value that flows into scoring maths.
 *
 * Plain `z.number()` is not enough. The base type already rejects NaN, null,
 * and missing keys — but it *accepts* +/-Infinity. `.finite()` is what closes
 * that last gap; without it an Infinity reading reaches verdictFromScore() and
 * produces a confident "poor" with no error anywhere. (Corrected after review
 * misread which layer rejects what: NaN is caught by the base type, Infinity
 * only by `.finite()`.)
 */
const scoringNumber = z.number().finite();

/**
 * A WMO weather code.
 *
 * describeCode() treats this as a map key and falls back to "Unknown" for
 * codes it does not recognise, so the numeric range is left open — the vendor
 * may add codes and the fallback handles them. It must still be an integer:
 * a null or NaN code would otherwise ride that same fallback and disguise a
 * broken payload as a merely unrecognised one.
 */
const weatherCode = z.number().int();

// The upstream sends naive local wall-clock timestamps with no zone, e.g.
// "2026-07-20T14:00", and the rules engine feeds them straight into
// `new Date(...)`, which reads a naive string as local time. If the vendor
// ever appended a "Z" or a numeric offset, that same call would reinterpret
// the instant and shift every spray window by the UTC delta with no error.
// Reject the zoned form loudly instead. This is also why the schema does not
// use z.string().datetime(): its default demands the very offset we forbid,
// so it would reject every valid naive timestamp.
const WALL_CLOCK_DATETIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/;
const CALENDAR_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Does a "YYYY-MM-DD[Thh:mm[:ss]]" string name a real instant?
 *
 * The regex alone is not enough. "2026-02-30" and "2026-07-20T25:00" match its
 * shape, but `new Date(...)` silently *rolls them over* — Feb 30 becomes Mar 2,
 * hour 25 becomes the next day — rather than erroring. That is the exact
 * silent-corruption failure this module exists to prevent, only in the time
 * dimension: a rolled-over date maps a day's rain onto the wrong calendar slot
 * and can stack on a genuine entry, inflating washoff into a false "poor" with
 * no error logged. So the parsed fields must round-trip through the Date to
 * confirm nothing rolled over. (Adversarial review found this gap; it is why
 * checking only for `Invalid Date` is insufficient — the rollover cases parse.)
 */
function isRealWallClock(s: string): boolean {
  const [datePart, timePart] = s.split("T");
  const [y, mo, d] = datePart.split("-").map(Number);
  let hh = 0;
  let mi = 0;
  if (timePart) {
    const [h, m] = timePart.split(":").map(Number);
    hh = h;
    mi = m;
  }
  const dt = new Date(y, mo - 1, d, hh, mi);
  return (
    dt.getFullYear() === y &&
    dt.getMonth() === mo - 1 &&
    dt.getDate() === d &&
    dt.getHours() === hh &&
    dt.getMinutes() === mi
  );
}

const wallClockDateTime = z
  .string()
  .regex(
    WALL_CLOCK_DATETIME,
    "expected a local wall-clock timestamp with no timezone, e.g. 2026-07-20T14:00",
  )
  .refine(isRealWallClock, {
    message: "timestamp is well-formed but not a real instant (e.g. month 13, day 30 of February, hour 25)",
  });

const calendarDate = z
  .string()
  .regex(CALENDAR_DATE, "expected a calendar date, YYYY-MM-DD")
  .refine(isRealWallClock, {
    message: "date is well-formed but not a real calendar date (e.g. 2026-02-30)",
  });

const currentSchema = z
  .object({
    time: wallClockDateTime,
    // Echoed back by the API but consumed nowhere downstream. `.nullish()`, not
    // `.optional()`: the field must tolerate a vendor that omits it *or* sends
    // an explicit null, matching ai_summary's leniency — rejecting a null on an
    // entirely unused field would fail an otherwise-good forecast.
    interval: z.number().nullish(),
    temperature: scoringNumber,
    windspeed: scoringNumber,
    winddirection: scoringNumber,
    // is_day is a flag, not a measurement, and normalizeCurrent reads it as
    // `=== 1`. Any other value would silently collapse to "night" rather than
    // erroring, so the two valid states are pinned explicitly.
    is_day: z.union([z.literal(0), z.literal(1)]),
    weathercode: weatherCode,
  })
  .passthrough();

const dailySchema = z
  .object({
    date: calendarDate,
    temp_max: scoringNumber,
    temp_min: scoringNumber,
    // precipitation drives isDryDay() and the washoff model. weatherai.ts
    // currently coalesces a missing value to 0, which turns "no reading" into
    // "it did not rain" — the more dangerous default, since it can mark a wet
    // day dry. Require a real number so the absence surfaces instead.
    precipitation: scoringNumber,
    weathercode: weatherCode,
  })
  .passthrough();

const hourlySchema = z
  .object({
    time: wallClockDateTime,
    temp: scoringNumber,
    precipitation: scoringNumber,
    weathercode: weatherCode,
  })
  .passthrough();

/**
 * The full upstream forecast payload.
 *
 * `.passthrough()` at every level admits and preserves unknown keys, so a
 * vendor addition is carried through rather than rejected. The arrays the app
 * cannot function without are held to `.min(1)`: an empty `daily` is a corrupt
 * payload, not a valid "no data" state, and an empty `hourly` would let the
 * spray card silently degrade to fully estimated data while presenting it as a
 * real forecast. `ai_summary` accepts a string, null, or an absent key alike —
 * the free tier always returns null, but a paid key populates it.
 */
export const forecastPayloadSchema = z
  .object({
    lat: scoringNumber,
    lon: scoringNumber,
    units: z.string(),
    days: scoringNumber,
    current: currentSchema,
    daily: z.array(dailySchema).min(1),
    hourly: z.array(hourlySchema).min(1),
    ai_summary: z.string().nullish(),
  })
  .passthrough();

export type RawForecastPayload = z.infer<typeof forecastPayloadSchema>;

/** Beyond this many issues the message stops naming fields and reports a count. */
const MAX_REPORTED_ISSUES = 5;

/**
 * Render an issue path as a dotted, bracketed field reference.
 *
 * `["daily", 0, "temp_max"]` becomes `daily[0].temp_max`; the empty path of a
 * top-level type mismatch becomes `(root)`. The point is that whoever reads
 * the log sees the offending field, not a JSON blob.
 */
function formatPath(path: z.ZodIssue["path"]): string {
  if (path.length === 0) return "(root)";
  return path.reduce<string>((acc, segment) => {
    if (typeof segment === "number") return `${acc}[${segment}]`;
    return acc.length === 0 ? String(segment) : `${acc}.${String(segment)}`;
  }, "");
}

/**
 * Collapse zod issues into a single log-friendly line.
 *
 * This message is logged from a server route, so it has to survive a log
 * aggregator: one line, field-path first so the fault is obvious at a glance,
 * and capped so a wholesale schema mismatch cannot emit hundreds of clauses.
 */
export function formatIssues(issues: z.ZodIssue[]): string {
  const shown = issues
    .slice(0, MAX_REPORTED_ISSUES)
    .map((issue) => `${formatPath(issue.path)}: ${issue.message}`)
    .join("; ");
  const overflow = issues.length - MAX_REPORTED_ISSUES;
  return overflow > 0 ? `${shown}; (+${overflow} more)` : shown;
}

/**
 * Validate an untrusted WeatherAI payload, or throw.
 *
 * The upstream response is `unknown` until it clears this gate. On failure the
 * thrown Error names the offending path(s), so the cause is legible from one
 * log line rather than resurfacing downstream as a NaN-driven wrong verdict.
 */
export function validateForecastPayload(input: unknown): RawForecastPayload {
  const result = forecastPayloadSchema.safeParse(input);
  if (!result.success) {
    throw new Error(
      `Invalid WeatherAI payload: ${formatIssues(result.error.issues)}`,
    );
  }
  return result.data;
}
