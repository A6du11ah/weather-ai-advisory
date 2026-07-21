import { describe, expect, it } from "vitest";
import { fieldWorkWindow, frostWatch, heatStress } from "./conditions";
import { findCrop } from "./crops";
import type { DayPoint } from "./types";

function day(date: string, min: number, max: number, precip = 0): DayPoint {
  return { date, tempMinC: min, tempMaxC: max, precipMm: precip, code: 0 };
}

const maize = findCrop("maize"); // frost 2, heat 35

describe("frostWatch", () => {
  it("flags the nearest night at or below the frost threshold", () => {
    const days = [day("2026-07-20", 8, 20), day("2026-07-21", 1, 18)];
    const f = frostWatch(days, maize);
    expect(f?.severity).toBe("frost");
    expect(f?.date).toBe("2026-07-21");
    expect(f?.leadDays).toBe(1);
  });

  it("flags a near-frost night within 2°C above the threshold", () => {
    const days = [day("2026-07-20", 3.5, 20)];
    expect(frostWatch(days, maize)?.severity).toBe("near");
  });

  it("returns null when all nights are mild", () => {
    const days = [day("2026-07-20", 12, 24), day("2026-07-21", 13, 25)];
    expect(frostWatch(days, maize)).toBeNull();
  });

  it("returns the earliest cold night, not a later colder one", () => {
    const days = [day("2026-07-20", 2, 20), day("2026-07-21", -2, 18)];
    expect(frostWatch(days, maize)?.date).toBe("2026-07-20");
  });
});

describe("heatStress", () => {
  it("flags the first hot day and counts all hot days", () => {
    const days = [day("2026-07-20", 15, 30), day("2026-07-21", 16, 36), day("2026-07-22", 16, 38)];
    const h = heatStress(days, maize);
    expect(h?.date).toBe("2026-07-21");
    expect(h?.maxC).toBe(36);
    expect(h?.count).toBe(2);
  });

  it("returns null when nothing reaches the heat threshold", () => {
    const days = [day("2026-07-20", 15, 31)];
    expect(heatStress(days, maize)).toBeNull();
  });
});

describe("fieldWorkWindow", () => {
  it("finds the next run of at least two dry days", () => {
    const days = [
      day("2026-07-20", 12, 24, 5),
      day("2026-07-21", 12, 24, 0),
      day("2026-07-22", 12, 24, 0.2),
      day("2026-07-23", 12, 24, 8),
    ];
    const w = fieldWorkWindow(days);
    expect(w?.startDate).toBe("2026-07-21");
    expect(w?.endDate).toBe("2026-07-22");
    expect(w?.days).toBe(2);
  });

  it("ignores a single isolated dry day", () => {
    const days = [day("2026-07-20", 12, 24, 0), day("2026-07-21", 12, 24, 9)];
    expect(fieldWorkWindow(days)).toBeNull();
  });

  it("handles a dry run that reaches the end of the forecast", () => {
    const days = [
      day("2026-07-20", 12, 24, 6),
      day("2026-07-21", 12, 24, 0),
      day("2026-07-22", 12, 24, 0),
    ];
    expect(fieldWorkWindow(days)?.days).toBe(2);
  });
});
