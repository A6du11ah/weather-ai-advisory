/**
 * Day-over-day advisory change detection.
 *
 * The one thing this product does that a weather app structurally cannot: it
 * recorded a recommendation yesterday and can say what changed today. "The
 * Thursday drying window is gone — rain now forecast" needs a memory of the
 * prior forecast, which a stateless weather lookup never has.
 *
 * Everything here is pure: two snapshots in, a list of changes out. The only
 * clock read is the default value of `today`, which the caller should override
 * with the field's local date (see diffAdvisories).
 *
 * Timezone hazard. Upstream timestamps are local wall-clock strings with no
 * offset, and `today` is likewise a plain "YYYY-MM-DD" calendar date, not an
 * instant. Date reasoning is done by lexical comparison of those strings and by
 * parsing as UTC midnight for weekday naming. That is deliberate: it stops the
 * host server's timezone from shifting a date across midnight.
 */

import type { Verdict } from "./rules";

export type ChangeKind =
  | "new"
  | "retracted"
  | "improved"
  | "degraded"
  | "shifted"
  | "unchanged";

export interface AdvisoryChange {
  kind: ChangeKind;
  /** One short human sentence, ready to show. */
  summary: string;
  /** Optional supporting numbers, or null when the summary stands alone. */
  detail: string | null;
}

/**
 * The subset of an advisory snapshot needed to detect change, persisted from
 * one day to the next. Kept small on purpose: it is the storage contract, so it
 * carries only the fields a diff actually reads.
 */
export interface AdvisorySnapshotLite {
  drying: {
    startDate: string;
    endDate: string;
    days: number;
    verdict: Verdict;
    sufficient: boolean;
  } | null;
  spray: {
    time: string;
    verdict: Verdict;
    rainNext24hMm: number;
  } | null;
}

type DryingLite = NonNullable<AdvisorySnapshotLite["drying"]>;
type SprayLite = NonNullable<AdvisorySnapshotLite["spray"]>;

// Ordinal ranking of a verdict, so improvement versus degradation is a numeric
// comparison rather than a table of string pairs.
const VERDICT_RANK: Record<Verdict, number> = { poor: 0, marginal: 1, good: 2 };

// Order the output most-decision-relevant first. A retraction cancels a plan
// the user may already be acting on, so it leads; a degradation is next most
// likely to change today's actions; an improvement is least urgent. "unchanged"
// is never emitted (see diffAdvisories) but is ranked here for totality.
const KIND_PRIORITY: Record<ChangeKind, number> = {
  retracted: 0,
  degraded: 1,
  new: 2,
  shifted: 3,
  improved: 4,
  unchanged: 5,
};

const WEEKDAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

/**
 * Name the weekday of a "YYYY-MM-DD" (or "YYYY-MM-DDThh:mm") calendar date.
 *
 * Parsed as UTC midnight on purpose. These strings are the field's local date
 * with no offset; parsing them in the host's local zone would let a server west
 * or east of the field roll the date and print the wrong weekday. UTC parsing
 * reads the date exactly as written, and avoids depending on the runtime's Intl
 * locale data.
 */
function weekday(dateOrTime: string): string {
  const d = new Date(`${dateOrTime.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return dateOrTime.slice(0, 10);
  return WEEKDAYS[d.getUTCDay()];
}

function plural(n: number): string {
  return n === 1 ? "day" : "days";
}

/**
 * Compare the drying advisory across two runs.
 *
 * The subtle rule lives here. When a window that existed yesterday is absent
 * today, that is a *retraction* only if the window still reaches into today or
 * the future. A window whose end date is already behind us was not pulled by
 * the forecaster — the clock simply moved past it. Reporting "the Tuesday window
 * was retracted" on Wednesday is noise: it names nothing the user can act on and
 * it falsely implies the forecast changed its mind when only time advanced. The
 * suppression test is the window's *end* date, not its start: a run already
 * underway whose remaining dry days have now been rained out is a real, still
 * actionable retraction ("the rest of your drying window is wet"), whereas a run
 * that has wholly finished is merely history.
 *
 * Both snapshots holding a window is treated as one window that moved, never as
 * a retraction plus a fresh window, so a change of dates surfaces as "shifted".
 */
function diffDrying(
  prev: DryingLite | null,
  cur: DryingLite | null,
  today: string,
): AdvisoryChange | null {
  if (!prev && !cur) return null;

  if (!cur) {
    // prev is non-null in this branch.
    if (prev!.endDate < today) return null; // wholly elapsed, not retracted
    // A dry run only breaks on rainfall above the threshold, so a drying window
    // vanishing means rain has moved into the forecast. Naming that is honest
    // and is the most actionable thing we can say.
    return {
      kind: "retracted",
      summary: `The ${weekday(prev!.startDate)} drying window is gone — rain now forecast.`,
      detail: `Yesterday: ${prev!.days} dry ${plural(prev!.days)} from ${prev!.startDate} to ${prev!.endDate}. The latest run no longer holds a dry run there.`,
    };
  }

  if (!prev) {
    const short = cur.sufficient ? "" : " (still short of the run needed)";
    return {
      kind: "new",
      summary: `A ${cur.days}-${plural(cur.days)} drying window opened, starting ${weekday(cur.startDate)}${short}.`,
      detail: `${cur.startDate} to ${cur.endDate}, rated ${cur.verdict}.`,
    };
  }

  // Both windows present: a change of dates is a shift, not a retraction.
  if (prev.startDate !== cur.startDate || prev.endDate !== cur.endDate) {
    return {
      kind: "shifted",
      summary: `The drying window moved to ${weekday(cur.startDate)} (was ${weekday(prev.startDate)}).`,
      detail: `Now ${cur.days} ${plural(cur.days)} from ${cur.startDate}; was ${prev.days} from ${prev.startDate}.`,
    };
  }

  // Same dates: report a change of verdict, then a change of sufficiency.
  const rankDelta = VERDICT_RANK[cur.verdict] - VERDICT_RANK[prev.verdict];
  if (rankDelta !== 0) {
    const improved = rankDelta > 0;
    return {
      kind: improved ? "improved" : "degraded",
      summary: `The ${weekday(cur.startDate)} drying window ${improved ? "improved" : "worsened"} to ${cur.verdict}.`,
      detail: `Was ${prev.verdict}; now ${cur.verdict}.`,
    };
  }
  if (prev.sufficient !== cur.sufficient) {
    // Verdict can hold steady while the run crosses the minimum length: a run
    // can stay "poor" yet finally be long enough to finish drying, a real
    // improvement worth surfacing on its own.
    const improved = cur.sufficient;
    return {
      kind: improved ? "improved" : "degraded",
      summary: improved
        ? "The drying window is now long enough to finish drying."
        : "The drying window is no longer long enough to finish drying.",
      detail: `Was ${prev.days} ${plural(prev.days)}; now ${cur.days} ${plural(cur.days)}.`,
    };
  }

  return null; // genuinely unchanged
}

/**
 * Compare the spray advisory across two runs.
 *
 * Mirrors diffDrying, including the elapsed-versus-retracted distinction. A
 * spray window is compared at date granularity: if its calendar date is before
 * today it has elapsed and cannot be a retraction. A window earlier *today*
 * cannot be told from a still-upcoming one without a wall clock, which the pure
 * date-string model deliberately does not consult (see the module limitations).
 */
function diffSpray(
  prev: SprayLite | null,
  cur: SprayLite | null,
  today: string,
): AdvisoryChange | null {
  if (!prev && !cur) return null;

  if (!cur) {
    const date = prev!.time.slice(0, 10);
    if (date < today) return null; // elapsed, not retracted
    // A spray window is only dropped when rain enters its rainfast window, so
    // rain is the cause worth naming.
    return {
      kind: "retracted",
      summary: `The ${weekday(date)} spray window is gone — rain now forecast within the rainfast window.`,
      detail: `Yesterday: ${prev!.time}, ${prev!.rainNext24hMm.toFixed(1)} mm rain in the next 24h.`,
    };
  }

  if (!prev) {
    return {
      kind: "new",
      summary: `A ${cur.verdict} spray window opened on ${weekday(cur.time.slice(0, 10))}.`,
      detail: `${cur.time}, ${cur.rainNext24hMm.toFixed(1)} mm rain in the next 24h.`,
    };
  }

  if (prev.time !== cur.time) {
    return {
      kind: "shifted",
      summary: `The spray window moved to ${weekday(cur.time.slice(0, 10))} ${cur.time.slice(11, 16)} (was ${weekday(prev.time.slice(0, 10))} ${prev.time.slice(11, 16)}).`,
      detail: `Was ${prev.time}; now ${cur.time}.`,
    };
  }

  const rankDelta = VERDICT_RANK[cur.verdict] - VERDICT_RANK[prev.verdict];
  if (rankDelta !== 0) {
    const improved = rankDelta > 0;
    return {
      kind: improved ? "improved" : "degraded",
      summary: `The ${weekday(cur.time.slice(0, 10))} spray window ${improved ? "improved" : "worsened"} to ${cur.verdict}.`,
      detail: `Was ${prev.verdict}; now ${cur.verdict}. Rain in next 24h ${prev.rainNext24hMm.toFixed(1)} → ${cur.rainNext24hMm.toFixed(1)} mm.`,
    };
  }

  return null; // genuinely unchanged
}

/**
 * Diff yesterday's advisory snapshot against today's.
 *
 * Returns the changes worth telling the user about, most decision-relevant
 * first (a retraction always leads). The list is empty when nothing changed, so
 * callers can treat `length === 0` as "no news" — this function never emits an
 * "unchanged" entry; that kind exists only to complete the vocabulary.
 *
 * @param previous Yesterday's snapshot, or null when there is no prior run. A
 *   null previous yields an empty array: the first run for a place has nothing
 *   to compare against and must not fabricate a "new" event, which would then
 *   fire on every place the first time it was ever viewed.
 * @param current Today's snapshot.
 * @param today The field's local calendar date as "YYYY-MM-DD", used to tell a
 *   retracted window from one that merely elapsed. Defaults to the host's local
 *   date, but callers should pass the forecast location's date: the server can
 *   sit on the far side of midnight from the field.
 */
export function diffAdvisories(
  previous: AdvisorySnapshotLite | null,
  current: AdvisorySnapshotLite,
  today: string = hostLocalDate(),
): AdvisoryChange[] {
  if (previous === null) return [];

  const changes: AdvisoryChange[] = [];

  const drying = diffDrying(previous.drying, current.drying, today);
  if (drying) changes.push(drying);

  const spray = diffSpray(previous.spray, current.spray, today);
  if (spray) changes.push(spray);

  // Stable sort: Array.prototype.sort keeps insertion order among equal keys,
  // so drying stays ahead of spray when both share a priority.
  return changes.sort((a, b) => KIND_PRIORITY[a.kind] - KIND_PRIORITY[b.kind]);
}

// Host-local calendar date as "YYYY-MM-DD". Only the default for `today`. Built
// from local getters, not toISOString(), which would report the UTC date and
// can land a day off.
function hostLocalDate(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}
