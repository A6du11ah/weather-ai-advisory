import { describe, expect, it } from "vitest";
import { buildFieldContext } from "./field-context";
import type { AdvisoryPayload } from "./advisory";
import type { ActivityRow } from "./db/schema";

/** Minimal advisory payload carrying only what buildFieldContext reads. */
function advisory(opts: {
  cropName?: string;
  maxTemp?: number;
  spray?: { time: string; verdict: "good" | "marginal" | "poor" } | null;
  drying?: { startDate: string; days: number } | null;
}): AdvisoryPayload {
  const maxTemp = opts.maxTemp ?? 26;
  return {
    place: { lat: 0, lon: 0 },
    placeName: "Test",
    stationId: "test",
    crop: { id: "maize", name: opts.cropName ?? "Maize", note: "", minRunDays: 3, storageMoisturePct: 13.5 },
    headline: "",
    headlineKey: "",
    headlineParams: {},
    current: { time: "2026-07-20T12:00", tempC: 20, windKph: 8, windDirDeg: 0, isDay: true, code: 1 },
    days: [
      { date: "2026-07-20", tempMinC: 15, tempMaxC: maxTemp, precipMm: 0, code: 1 },
    ],
    aiSummary: null,
    advisories: {
      drying: {
        best: opts.drying
          ? {
              startDate: opts.drying.startDate,
              endDate: opts.drying.startDate,
              days: opts.drying.days,
              verdict: "good",
              score: 80,
              sufficient: true,
              evidence: [],
            }
          : null,
        closest: null,
        alternatives: [],
        minRunDays: 3,
        source: { label: "", note: "", url: "" },
      },
      spray: {
        best: opts.spray
          ? {
              time: opts.spray.time,
              verdict: opts.spray.verdict,
              score: 80,
              rainNext24hMm: 0,
              effectiveWashMm: 0,
              estimated: false,
              evidence: [],
            }
          : null,
        byDay: [],
        windCheck: { windKph: 8, ok: true, note: "" },
        sources: [],
      },
    },
    conditions: { frost: null, heat: null, work: null },
  };
}

function act(kind: string, occurredOn: string, label: string | null = null): ActivityRow {
  return {
    id: 1,
    fieldId: 1,
    kind,
    label,
    occurredOn,
    notes: null,
    createdAt: new Date("2026-07-20T00:00:00Z"),
  };
}

describe("buildFieldContext", () => {
  const today = "2026-07-20";

  it("reports the growth stage when a planting date is known", () => {
    const ctx = buildFieldContext(
      { cropId: "maize", plantingDate: "2026-06-20" },
      [],
      advisory({}),
      today,
    );
    expect(ctx.growth.hasCalendar).toBe(true);
    expect(ctx.notes.some((n) => /vegetative/i.test(n.text))).toBe(true);
  });

  it("warns when flowering coincides with a hot spell", () => {
    const ctx = buildFieldContext(
      { cropId: "maize", plantingDate: "2026-05-15" }, // 66 days -> flowering (60..79)
      [],
      advisory({ maxTemp: 36 }),
      today,
    );
    expect(ctx.growth.stage?.key).toBe("flowering");
    expect(ctx.notes.some((n) => n.tone === "warning" && /flowering/i.test(n.text))).toBe(true);
  });

  it("surfaces the last spray and how long ago it was", () => {
    const ctx = buildFieldContext(
      { cropId: "maize", plantingDate: null },
      [act("spray", "2026-07-14", "mancozeb"), act("spray", "2026-07-01")],
      advisory({}),
      today,
    );
    expect(ctx.lastSpray?.daysAgo).toBe(6);
    expect(ctx.lastSpray?.label).toBe("mancozeb");
  });

  it("flags a just-sprayed field to stay off the crop", () => {
    const ctx = buildFieldContext(
      { cropId: "maize", plantingDate: null },
      [act("spray", "2026-07-20", "copper")],
      advisory({}),
      today,
    );
    expect(ctx.notes.some((n) => /rainfast|re-entry/i.test(n.text))).toBe(true);
  });

  it("warns about the pre-harvest interval when harvest is near", () => {
    // planted 105 days ago -> 15 days to harvest, inside the 21-day PHI.
    const ctx = buildFieldContext(
      { cropId: "maize", plantingDate: "2026-04-06" },
      [],
      advisory({}),
      "2026-07-20",
    );
    expect(ctx.notes.some((n) => n.tone === "warning" && /pre-harvest/i.test(n.text))).toBe(true);
  });

  it("turns advisory windows into dated, sorted tasks", () => {
    const ctx = buildFieldContext(
      { cropId: "maize", plantingDate: null },
      [],
      advisory({
        spray: { time: "2026-07-22T09:00", verdict: "good" },
        drying: { startDate: "2026-07-21", days: 3 },
      }),
      today,
    );
    expect(ctx.tasks.length).toBeGreaterThanOrEqual(2);
    // sorted ascending by date
    const dates = ctx.tasks.map((t) => t.date);
    expect([...dates].sort()).toEqual(dates);
  });

  it("does not create a spray task for a poor window", () => {
    const ctx = buildFieldContext(
      { cropId: "maize", plantingDate: null },
      [],
      advisory({ spray: { time: "2026-07-22T09:00", verdict: "poor" } }),
      today,
    );
    expect(ctx.tasks.some((t) => t.kind === "spray")).toBe(false);
  });
});
