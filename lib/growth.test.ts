import { describe, expect, it } from "vitest";
import { growthState, hasCalendar } from "./growth";

describe("growthState", () => {
  it("returns no calendar when planting date is missing", () => {
    const g = growthState("maize", null, "2026-07-20");
    expect(g.hasCalendar).toBe(false);
    expect(g.stage).toBeNull();
    expect(g.daysToHarvest).toBeNull();
  });

  it("returns no calendar for an unknown crop", () => {
    expect(hasCalendar("dragonfruit")).toBe(false);
    const g = growthState("dragonfruit", "2026-05-01", "2026-07-20");
    expect(g.hasCalendar).toBe(false);
  });

  it("places maize in the vegetative stage ~30 days after planting", () => {
    const g = growthState("maize", "2026-06-20", "2026-07-20");
    expect(g.hasCalendar).toBe(true);
    expect(g.daysAfterPlanting).toBe(30);
    expect(g.stage?.key).toBe("vegetative");
  });

  it("selects the latest stage whose start day has been reached", () => {
    // 65 days after planting -> flowering starts at 60, grainfill at 80.
    const g = growthState("maize", "2026-05-01", "2026-07-05");
    expect(g.stage?.key).toBe("flowering");
  });

  it("clamps to the first stage on planting day", () => {
    const g = growthState("maize", "2026-07-20", "2026-07-20");
    expect(g.daysAfterPlanting).toBe(0);
    expect(g.stage?.key).toBe("emergence");
  });

  it("computes days-to-harvest and an estimated harvest date", () => {
    const g = growthState("maize", "2026-04-01", "2026-05-01");
    expect(g.daysAfterPlanting).toBe(30);
    expect(g.daysToHarvest).toBe(90); // 120 - 30
    expect(g.estimatedHarvest).toBe("2026-07-30"); // 2026-04-01 + 120 days
  });

  it("reports negative days-to-harvest once past maturity", () => {
    const g = growthState("wheat", "2026-01-01", "2026-06-01");
    expect(g.daysToHarvest).toBeLessThan(0);
  });
});
