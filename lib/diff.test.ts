import { describe, expect, it } from "vitest";
import {
  diffAdvisories,
  type AdvisoryChange,
  type AdvisorySnapshotLite,
} from "./diff";

// July 2026 weekdays used throughout, verified against the calendar:
//   2026-07-20 Monday, 07-22 Wednesday, 07-23 Thursday, 07-24 Friday,
//   07-25 Saturday, 07-26 Sunday. These are wall-clock dates with no offset.

/** A snapshot with an optional drying and/or spray window. */
function snap(
  parts: Partial<AdvisorySnapshotLite> = {},
): AdvisorySnapshotLite {
  return { drying: null, spray: null, ...parts };
}

function drying(
  over: Partial<NonNullable<AdvisorySnapshotLite["drying"]>> = {},
): NonNullable<AdvisorySnapshotLite["drying"]> {
  return {
    startDate: "2026-07-23",
    endDate: "2026-07-25",
    days: 3,
    verdict: "good",
    sufficient: true,
    ...over,
  };
}

function spray(
  over: Partial<NonNullable<AdvisorySnapshotLite["spray"]>> = {},
): NonNullable<AdvisorySnapshotLite["spray"]> {
  return { time: "2026-07-23T09:00", verdict: "good", rainNext24hMm: 0, ...over };
}

const only = (changes: AdvisoryChange[]): AdvisoryChange => {
  expect(changes).toHaveLength(1);
  return changes[0];
};

describe("diffAdvisories — no history", () => {
  it("returns an empty array when previous is null, never fabricates 'new'", () => {
    const current = snap({ drying: drying(), spray: spray() });
    expect(diffAdvisories(null, current, "2026-07-20")).toEqual([]);
  });

  it("does emit 'new' when there was a prior snapshot but the slot was empty", () => {
    const previous = snap(); // yesterday existed, had no windows
    const current = snap({ drying: drying() });
    const change = only(diffAdvisories(previous, current, "2026-07-20"));
    expect(change.kind).toBe("new");
    expect(change.summary).toMatch(/Thursday/);
  });
});

describe("diffAdvisories — retraction (the highest-signal case)", () => {
  it("reports a future drying window that disappeared as retracted, and names rain", () => {
    const previous = snap({ drying: drying() }); // Thursday 07-23 window
    const current = snap({ drying: null });
    const change = only(diffAdvisories(previous, current, "2026-07-20"));
    expect(change.kind).toBe("retracted");
    expect(change.summary).toMatch(/Thursday/);
    expect(change.summary).toMatch(/gone/i);
    expect(change.summary).toMatch(/rain now forecast/i);
  });

  it("reports a disappeared future spray window as retracted", () => {
    const previous = snap({ spray: spray() });
    const current = snap({ spray: null });
    const change = only(diffAdvisories(previous, current, "2026-07-20"));
    expect(change.kind).toBe("retracted");
    expect(change.summary).toMatch(/rain now forecast/i);
  });
});

describe("diffAdvisories — elapsed windows are not retractions", () => {
  it("does not report a wholly past drying window as retracted", () => {
    // Window ended 07-19; today is 07-20. It happened and the clock moved on.
    const previous = snap({
      drying: drying({ startDate: "2026-07-17", endDate: "2026-07-19" }),
    });
    const current = snap({ drying: null });
    expect(diffAdvisories(previous, current, "2026-07-20")).toEqual([]);
  });

  it("still retracts a run underway whose remaining days lose their forecast", () => {
    // Window 07-19..07-25; today is 07-22. It started, but 07-22..07-25 were
    // dry yesterday and are gone today — a real, actionable retraction.
    const previous = snap({
      drying: drying({ startDate: "2026-07-19", endDate: "2026-07-25" }),
    });
    const current = snap({ drying: null });
    const change = only(diffAdvisories(previous, current, "2026-07-22"));
    expect(change.kind).toBe("retracted");
  });

  it("treats endDate exactly equal to today as still retractable, not elapsed", () => {
    const previous = snap({
      drying: drying({ startDate: "2026-07-18", endDate: "2026-07-20" }),
    });
    const current = snap({ drying: null });
    const change = only(diffAdvisories(previous, current, "2026-07-20"));
    expect(change.kind).toBe("retracted");
  });

  it("does not report a spray window from a past day as retracted", () => {
    const previous = snap({ spray: spray({ time: "2026-07-19T09:00" }) });
    const current = snap({ spray: null });
    expect(diffAdvisories(previous, current, "2026-07-20")).toEqual([]);
  });
});

describe("diffAdvisories — a moved window is a shift, not retract-plus-new", () => {
  it("emits a single 'shifted' change when the drying dates move", () => {
    const previous = snap({
      drying: drying({ startDate: "2026-07-23", endDate: "2026-07-25" }),
    });
    const current = snap({
      drying: drying({ startDate: "2026-07-24", endDate: "2026-07-26" }),
    });
    const change = only(diffAdvisories(previous, current, "2026-07-20"));
    expect(change.kind).toBe("shifted");
    expect(change.summary).toMatch(/Friday/); // new start 07-24
    expect(change.summary).toMatch(/was Thursday/i); // old start 07-23
  });

  it("emits a single 'shifted' change when the spray time moves", () => {
    const previous = snap({ spray: spray({ time: "2026-07-23T09:00" }) });
    const current = snap({ spray: spray({ time: "2026-07-24T11:00" }) });
    const change = only(diffAdvisories(previous, current, "2026-07-20"));
    expect(change.kind).toBe("shifted");
  });
});

describe("diffAdvisories — verdict transitions", () => {
  it("reports a drying verdict drop as degraded", () => {
    const previous = snap({ drying: drying({ verdict: "good" }) });
    const current = snap({ drying: drying({ verdict: "marginal" }) });
    const change = only(diffAdvisories(previous, current, "2026-07-20"));
    expect(change.kind).toBe("degraded");
    expect(change.detail).toMatch(/good.*marginal/);
  });

  it("reports a spray verdict rise as improved", () => {
    const previous = snap({ spray: spray({ verdict: "poor" }) });
    const current = snap({ spray: spray({ verdict: "good" }) });
    const change = only(diffAdvisories(previous, current, "2026-07-20"));
    expect(change.kind).toBe("improved");
  });

  it("reports a sufficiency gain even when the verdict is unchanged", () => {
    // A run can stay "poor" yet cross the minimum length — still an improvement.
    const previous = snap({
      drying: drying({ verdict: "poor", sufficient: false, days: 2 }),
    });
    const current = snap({
      drying: drying({ verdict: "poor", sufficient: true, days: 3 }),
    });
    const change = only(diffAdvisories(previous, current, "2026-07-20"));
    expect(change.kind).toBe("improved");
    expect(change.summary).toMatch(/long enough/i);
  });
});

describe("diffAdvisories — no news", () => {
  it("returns an empty array (no 'unchanged' entry) when nothing changed", () => {
    const previous = snap({ drying: drying(), spray: spray() });
    const current = snap({ drying: drying(), spray: spray() });
    const changes = diffAdvisories(previous, current, "2026-07-20");
    expect(changes).toEqual([]);
    expect(changes.every((c) => c.kind !== "unchanged")).toBe(true);
  });
});

describe("diffAdvisories — ordering and combination", () => {
  it("surfaces both advisories' changes with the retraction first", () => {
    const previous = snap({
      drying: drying(), // future window, about to be retracted
      spray: spray({ verdict: "good" }),
    });
    const current = snap({
      drying: null, // retracted
      spray: spray({ verdict: "marginal" }), // degraded
    });
    const changes = diffAdvisories(previous, current, "2026-07-20");
    expect(changes).toHaveLength(2);
    expect(changes[0].kind).toBe("retracted");
    expect(changes[1].kind).toBe("degraded");
  });

  it("defaults 'today' to the host date when the argument is omitted", () => {
    // Two-argument call must type-check and run; a far-future window can never
    // have elapsed, so its disappearance is always a retraction regardless of
    // the host clock. This pins the required (previous, current) signature.
    const previous = snap({
      drying: drying({ startDate: "2999-01-01", endDate: "2999-01-03" }),
    });
    const current = snap({ drying: null });
    const change = only(diffAdvisories(previous, current));
    expect(change.kind).toBe("retracted");
  });
});
