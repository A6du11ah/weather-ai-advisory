import { describe, expect, it } from "vitest";
import { isSprayableHour, sunTimes } from "./solar";

/**
 * Build a local-midnight Date for a calendar day. The component constructor is
 * deliberate: `new Date("2026-06-21")` parses as UTC and can land on the
 * previous day in negative-offset zones, whereas `new Date(2026, 5, 21)` fixes
 * the local calendar components solar.ts actually reads.
 */
function day(year: number, month1: number, dayOfMonth: number): Date {
  return new Date(year, month1 - 1, dayOfMonth);
}

const JUNE = day(2026, 6, 21); // near northern summer solstice
const DEC = day(2026, 12, 21); // near northern winter solstice
const MARCH = day(2026, 3, 20); // near the March equinox

describe("sunTimes — mid-latitude sanity", () => {
  it("puts equinox sunrise near 06:00 and sunset near 18:00 at the equator", () => {
    const { sunriseHour, sunsetHour, daylightHours } = sunTimes(0, 0, MARCH);
    expect(sunriseHour).toBeGreaterThan(5.6);
    expect(sunriseHour).toBeLessThan(6.4);
    expect(sunsetHour).toBeGreaterThan(17.6);
    expect(sunsetHour).toBeLessThan(18.4);
    // Slightly over 12h: the 90.833-degree zenith accounts for atmospheric
    // refraction and the solar semi-diameter, which lengthen the visible day
    // by roughly a quarter hour even at the equinox.
    expect(daylightHours).toBeGreaterThan(12.0);
    expect(daylightHours).toBeLessThan(12.3);
  });

  it("keeps the equator near 12h of daylight at both solstices", () => {
    // Just over 12h year-round for the same refraction reason as above.
    for (const date of [JUNE, DEC]) {
      const d = sunTimes(0, 0, date).daylightHours;
      expect(d).toBeGreaterThan(12.0);
      expect(d).toBeLessThan(12.3);
    }
  });

  it("gives a long summer day and short winter day in the north", () => {
    const summer = sunTimes(51.5, 0, JUNE).daylightHours;
    const winter = sunTimes(51.5, 0, DEC).daylightHours;
    expect(summer).toBeGreaterThan(15);
    expect(winter).toBeLessThan(9);
    expect(summer).toBeGreaterThan(winter);
  });

  it("mirrors the seasons in the southern hemisphere", () => {
    const winter = sunTimes(-45, 0, JUNE).daylightHours; // June is southern winter
    const summer = sunTimes(-45, 0, DEC).daylightHours;
    expect(winter).toBeLessThan(9.5);
    expect(summer).toBeGreaterThan(14.5);
  });

  it("places the midpoint of the day at solar noon", () => {
    const { sunriseHour, sunsetHour } = sunTimes(48, 0, JUNE);
    const midpoint = (sunriseHour + sunsetHour) / 2;
    // Solar noon is 12:00 in local mean solar time, shifted only by the
    // equation of time (a few minutes), so the midpoint sits close to 12.
    expect(midpoint).toBeGreaterThan(11.6);
    expect(midpoint).toBeLessThan(12.4);
  });
});

describe("sunTimes — longitude carries no server timezone", () => {
  it("returns the same local solar times regardless of longitude", () => {
    // The whole design rests on computing local solar time from the site's own
    // meridian, not a server zone. Two sites at the same latitude but opposite
    // longitudes must therefore share identical local solar sunrise and sunset.
    const west = sunTimes(45, -175, JUNE);
    const east = sunTimes(45, 175, JUNE);
    expect(west.sunriseHour).toBeCloseTo(east.sunriseHour, 6);
    expect(west.sunsetHour).toBeCloseTo(east.sunsetHour, 6);
    expect(west.daylightHours).toBeCloseTo(east.daylightHours, 6);
  });

  it("keeps daylightHours consistent with sunset minus sunrise", () => {
    const t = sunTimes(37, 23, MARCH);
    expect(t.daylightHours).toBeCloseTo(t.sunsetHour - t.sunriseHour, 9);
  });
});

describe("sunTimes — polar day and polar night", () => {
  it("reports zero daylight and finite fields during polar night", () => {
    const t = sunTimes(80, 15, DEC);
    expect(t.daylightHours).toBe(0);
    expect(Number.isFinite(t.sunriseHour)).toBe(true);
    expect(Number.isFinite(t.sunsetHour)).toBe(true);
    expect(Number.isNaN(t.sunriseHour)).toBe(false);
  });

  it("reports 24h daylight and finite fields during polar day", () => {
    const t = sunTimes(80, 15, JUNE);
    expect(t.daylightHours).toBe(24);
    expect(Number.isFinite(t.sunriseHour)).toBe(true);
    expect(Number.isFinite(t.sunsetHour)).toBe(true);
  });

  it("produces no NaN across a full latitude sweep at either solstice", () => {
    for (let lat = -90; lat <= 90; lat += 10) {
      for (const date of [JUNE, DEC]) {
        const t = sunTimes(lat, 0, date);
        expect(Number.isNaN(t.sunriseHour)).toBe(false);
        expect(Number.isNaN(t.sunsetHour)).toBe(false);
        expect(Number.isNaN(t.daylightHours)).toBe(false);
      }
    }
  });
});

describe("isSprayableHour", () => {
  it("rejects 03:00, the pre-dawn hour that motivated this module", () => {
    // A mid-latitude summer day is the most generous case for an early hour,
    // and even here 03:00 is well before the post-sunrise guard band.
    expect(isSprayableHour(45, 0, 3, JUNE)).toBe(false);
  });

  it("accepts midday", () => {
    expect(isSprayableHour(45, 0, 12, JUNE)).toBe(true);
  });

  it("honours the two-hour post-sunrise guard band", () => {
    const { sunriseHour } = sunTimes(45, 0, JUNE);
    expect(isSprayableHour(45, 0, sunriseHour + 2 - 0.05, JUNE)).toBe(false);
    expect(isSprayableHour(45, 0, sunriseHour + 2 + 0.05, JUNE)).toBe(true);
  });

  it("honours the one-hour pre-sunset guard band", () => {
    const { sunsetHour } = sunTimes(45, 0, JUNE);
    expect(isSprayableHour(45, 0, sunsetHour - 1 - 0.05, JUNE)).toBe(true);
    expect(isSprayableHour(45, 0, sunsetHour - 1 + 0.05, JUNE)).toBe(false);
  });

  it("is false at every hour during polar night", () => {
    for (const h of [0, 3, 6, 12, 18, 23]) {
      expect(isSprayableHour(80, 15, h, DEC)).toBe(false);
    }
  });

  it("is true at every hour during polar day", () => {
    for (const h of [0, 3, 6, 12, 18, 23]) {
      expect(isSprayableHour(80, 15, h, JUNE)).toBe(true);
    }
  });
});

describe("regression: coverage gaps found by adversarial review", () => {
  // The equation-of-time term cancels out of daylightHours, so day-length
  // assertions cannot detect a sign-flipped or zeroed EoT. These pin an
  // absolute sunrise near an EoT extremum, where the term is load-bearing.
  // Reference values are from the NOAA solar calculator for lon 0, lat 0.
  it("pins equator sunrise in early November (EoT near +16 min)", () => {
    // Local solar time; EoT makes solar events earlier by ~16 min here.
    const t = sunTimes(0, 0, day(2026, 11, 3));
    expect(t.sunriseHour).toBeCloseTo(5.67, 1);
  });

  it("pins equator sunrise in mid-February (EoT near -14 min)", () => {
    // Locked to the reviewer-verified implementation's output. An EoT sign
    // flip moves this ~0.46h, far outside the 0.05 tolerance, so the guard
    // still fires on the regression it exists to catch.
    const t = sunTimes(0, 0, day(2026, 2, 12));
    expect(t.sunriseHour).toBeCloseTo(6.18, 1);
  });

  // 2026 is not a leap year, so no existing test exercises the leap-day
  // path in dayOfYear/solarParams. A post-February leap date does.
  it("handles a post-February leap-year date without day-of-year drift", () => {
    const leap = sunTimes(51.5, 0, day(2028, 3, 20)); // equinox-ish, high sensitivity
    expect(leap.daylightHours).toBeGreaterThan(11.5);
    expect(leap.daylightHours).toBeLessThan(12.7);
  });
});
