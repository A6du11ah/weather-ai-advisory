import { describe, expect, it } from "vitest";
import {
  bestSprayWindowPerDay,
  findDryingWindows,
  findSprayWindows,
  todayHeadline,
} from "./rules";
import { matchPreset } from "./places";
import type { DayPoint, HourPoint } from "./types";

/** Build a day, defaulting to warm and clear. */
function day(
  date: string,
  precipMm: number,
  code = 0,
  tempMaxC = 30,
): DayPoint {
  return { date, tempMinC: 15, tempMaxC, precipMm, code };
}

/** Build `count` hourly points from a start time, dry and mild by default. */
function hours(
  startISO: string,
  count: number,
  precipAt: Record<number, number> = {},
): HourPoint[] {
  const start = new Date(startISO);
  return Array.from({ length: count }, (_, i) => {
    const t = new Date(start.getTime() + i * 3_600_000);
    const pad = (n: number) => String(n).padStart(2, "0");
    return {
      time: `${t.getFullYear()}-${pad(t.getMonth() + 1)}-${pad(t.getDate())}T${pad(t.getHours())}:00`,
      tempC: 20,
      precipMm: precipAt[i] ?? 0,
      code: (precipAt[i] ?? 0) > 0 ? 61 : 0,
    };
  });
}

describe("findDryingWindows", () => {
  it("treats trace rain under the threshold as a dry day even when coded as drizzle", () => {
    // Regression: weathercode 51 previously vetoed the day outright, which
    // split an otherwise usable run and produced a false "no window".
    const days = [
      day("2026-07-20", 0.4, 51),
      day("2026-07-21", 0.3, 51),
      day("2026-07-22", 0, 3),
      day("2026-07-23", 0, 3),
    ];
    const [best] = findDryingWindows(days);
    expect(best.days).toBe(4);
    expect(best.sufficient).toBe(true);
  });

  it("breaks a run on genuine rain", () => {
    const days = [
      day("2026-07-20", 0),
      day("2026-07-21", 0),
      day("2026-07-22", 8), // washout
      day("2026-07-23", 0),
      day("2026-07-24", 0),
      day("2026-07-25", 0),
    ];
    const windows = findDryingWindows(days);
    const sufficient = windows.filter((w) => w.sufficient);
    expect(sufficient).toHaveLength(1);
    expect(sufficient[0].startDate).toBe("2026-07-23");
    expect(sufficient[0].days).toBe(3);
  });

  it("reports a two-day spell as a near-miss rather than nothing", () => {
    const days = [day("2026-07-20", 0), day("2026-07-21", 0), day("2026-07-22", 9)];
    const [best] = findDryingWindows(days);
    expect(best.days).toBe(2);
    expect(best.sufficient).toBe(false);
    expect(best.verdict).toBe("poor");
  });

  it("never rates a run 'good' on sunshine alone if it is too short", () => {
    const days = [day("2026-07-20", 0, 0, 35), day("2026-07-21", 12)];
    const [best] = findDryingWindows(days);
    expect(best.sufficient).toBe(false);
    expect(best.score).toBeLessThan(40);
  });

  it("returns nothing usable when every day is wet", () => {
    const days = Array.from({ length: 7 }, (_, i) =>
      day(`2026-07-2${i}`, 6, 61),
    );
    expect(findDryingWindows(days).some((w) => w.sufficient)).toBe(false);
  });
});

describe("spray rainfastness is time-weighted", () => {
  const now = new Date("2026-07-20T00:00");
  const days = [day("2026-07-20", 10, 61), day("2026-07-21", 0)];

  it("penalises rain soon after application far more than rain a day later", () => {
    // Same 10mm, different timing. Before the fix these scored identically.
    const early = findSprayWindows(hours("2026-07-20T06:00", 48, { 1: 10 }), days, now);
    const late = findSprayWindows(hours("2026-07-20T06:00", 48, { 22: 10 }), days, now);

    const earlyFirst = early.find((w) => w.time === "2026-07-20T06:00")!;
    const lateFirst = late.find((w) => w.time === "2026-07-20T06:00")!;

    expect(earlyFirst.effectiveWashMm).toBeGreaterThan(lateFirst.effectiveWashMm * 3);
    expect(earlyFirst.score).toBeLessThan(lateFirst.score);
  });

  it("reports the raw rainfall total unchanged for display", () => {
    const w = findSprayWindows(hours("2026-07-20T06:00", 48, { 1: 10 }), days, now)
      .find((x) => x.time === "2026-07-20T06:00")!;
    expect(w.rainNext24hMm).toBeCloseTo(10, 1);
    expect(w.effectiveWashMm).toBeLessThan(w.rainNext24hMm);
  });

  it("excludes hours already in the past", () => {
    const later = new Date("2026-07-20T12:00");
    const windows = findSprayWindows(hours("2026-07-20T06:00", 48), days, later);
    expect(windows.every((w) => new Date(w.time) > later)).toBe(true);
  });

  it("never returns an hour whose rainfast window falls outside available data", () => {
    const windows = findSprayWindows(hours("2026-07-20T06:00", 6), [], now);
    expect(windows).toHaveLength(0);
  });

  it("returns at most one window per calendar day", () => {
    const byDay = bestSprayWindowPerDay(hours("2026-07-20T06:00", 48), days, now);
    const dates = byDay.map((w) => w.time.slice(0, 10));
    expect(new Set(dates).size).toBe(dates.length);
  });
});

describe("todayHeadline", () => {
  const dryToday = {
    startDate: "2026-07-20",
    endDate: "2026-07-23",
    days: 4,
    verdict: "good" as const,
    score: 80,
    sufficient: true,
    evidence: [],
  };
  const sprayToday = {
    time: "2026-07-20T09:00",
    verdict: "good" as const,
    score: 85,
    rainNext24hMm: 0,
    effectiveWashMm: 0,
    estimated: false,
    evidence: [],
  };

  it("leads with drying when both are available today", () => {
    expect(todayHeadline(dryToday, sprayToday, "2026-07-20")).toMatch(/Spread grain/);
  });

  it("points forward when nothing is actionable today", () => {
    const later = { ...dryToday, startDate: "2026-07-24" };
    expect(todayHeadline(later, null, "2026-07-20")).toMatch(/next drying window opens 2026-07-24/i);
  });

  it("is explicit when the whole outlook is unusable", () => {
    expect(todayHeadline(null, null, "2026-07-20")).toMatch(/Keep the harvest covered/);
  });

  it("does not claim a spray window when the best one is poor", () => {
    const poor = { ...sprayToday, verdict: "poor" as const };
    expect(todayHeadline(null, poor, "2026-07-20")).toMatch(/nothing viable/i);
  });
});

describe("matchPreset guards the API quota", () => {
  it("accepts a known preset", () => {
    expect(matchPreset(-0.7813, 35.3416)?.id).toBe("bomet");
  });

  it("tolerates minor float drift", () => {
    expect(matchPreset(-0.79, 35.35)?.id).toBe("bomet");
  });

  it("rejects arbitrary coordinates that would mint fresh cache keys", () => {
    expect(matchPreset(51.5074, -0.1278)).toBeUndefined();
    expect(matchPreset(-0.9, 35.9)).toBeUndefined();
  });
});
