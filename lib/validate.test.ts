import { describe, expect, it } from "vitest";

import {
  formatIssues,
  forecastPayloadSchema,
  validateForecastPayload,
  type RawForecastPayload,
} from "./validate";

/**
 * A minimal but complete valid payload. Tests mutate a fresh clone so one
 * case cannot leak state into another. One daily and one hourly entry is
 * enough to exercise the `.min(1)` boundary from the valid side.
 */
function validPayload(): Record<string, unknown> {
  return {
    lat: -1.28,
    lon: 36.82,
    units: "metric",
    days: 7,
    current: {
      time: "2026-07-20T14:00",
      interval: 900,
      temperature: 24.1,
      windspeed: 8.3,
      winddirection: 210,
      is_day: 1,
      weathercode: 2,
    },
    daily: [
      {
        date: "2026-07-20",
        temp_max: 27.4,
        temp_min: 15.2,
        precipitation: 0.3,
        weathercode: 1,
      },
    ],
    hourly: [
      {
        time: "2026-07-20T00:00",
        temp: 18.5,
        precipitation: 0,
        weathercode: 0,
      },
    ],
    ai_summary: null,
  };
}

describe("happy path", () => {
  it("accepts a fully valid payload and returns typed data", () => {
    const input = validPayload();
    const out: RawForecastPayload = validateForecastPayload(input);
    expect(out.daily[0].temp_max).toBe(27.4);
    expect(out.current.is_day).toBe(1);
    expect(out.ai_summary).toBeNull();
  });

  it("accepts ai_summary as a string", () => {
    const input = { ...validPayload(), ai_summary: "Dry and settled." };
    expect(validateForecastPayload(input).ai_summary).toBe("Dry and settled.");
  });

  it("accepts an absent ai_summary key", () => {
    const input = validPayload();
    delete input.ai_summary;
    expect(() => validateForecastPayload(input)).not.toThrow();
  });

  it("accepts a wall-clock timestamp carrying seconds", () => {
    const input = validPayload();
    (input.hourly as Array<Record<string, unknown>>)[0].time =
      "2026-07-20T00:00:00";
    expect(() => validateForecastPayload(input)).not.toThrow();
  });
});

describe("leniency for vendor additions", () => {
  it("admits and preserves unknown keys at the root", () => {
    const input = { ...validPayload(), timezone: "Africa/Nairobi" };
    const out = validateForecastPayload(input) as Record<string, unknown>;
    expect(out.timezone).toBe("Africa/Nairobi");
  });

  it("admits unknown keys inside daily entries", () => {
    const input = validPayload();
    (input.daily as Array<Record<string, unknown>>)[0].sunshine_hours = 6.2;
    const out = validateForecastPayload(input);
    expect(
      (out.daily[0] as Record<string, unknown>).sunshine_hours,
    ).toBe(6.2);
  });

  it("does not reject on unknown keys (not .strict())", () => {
    const input = { ...validPayload(), future_field: { nested: true } };
    expect(() => validateForecastPayload(input)).not.toThrow();
  });
});

describe("the core hazard: silent NaN in scoring fields", () => {
  it("rejects null temp_max and names the path", () => {
    const input = validPayload();
    (input.daily as Array<Record<string, unknown>>)[0].temp_max = null;
    expect(() => validateForecastPayload(input)).toThrow(/daily\[0\]\.temp_max/);
  });

  it("rejects a missing temp_max", () => {
    const input = validPayload();
    delete (input.daily as Array<Record<string, unknown>>)[0].temp_max;
    expect(() => validateForecastPayload(input)).toThrow(/daily\[0\]\.temp_max/);
  });

  it("rejects NaN temp_max", () => {
    const input = validPayload();
    (input.daily as Array<Record<string, unknown>>)[0].temp_max = NaN;
    expect(() => validateForecastPayload(input)).toThrow(/daily\[0\]\.temp_max/);
  });

  it("rejects Infinity in an hourly temp", () => {
    const input = validPayload();
    (input.hourly as Array<Record<string, unknown>>)[0].temp = Infinity;
    expect(() => validateForecastPayload(input)).toThrow(/hourly\[0\]\.temp/);
  });

  it("rejects null precipitation rather than defaulting it to zero", () => {
    // weatherai.ts coalesces this to 0, which can mark a wet day dry; the gate
    // must surface the missing reading instead of letting it pass.
    const input = validPayload();
    (input.daily as Array<Record<string, unknown>>)[0].precipitation = null;
    expect(() => validateForecastPayload(input)).toThrow(
      /daily\[0\]\.precipitation/,
    );
  });

  it("rejects a string where a number is required", () => {
    const input = validPayload();
    (input.daily as Array<Record<string, unknown>>)[0].temp_min = "15.2";
    expect(() => validateForecastPayload(input)).toThrow(/daily\[0\]\.temp_min/);
  });
});

describe("weather codes", () => {
  it("rejects a non-integer weathercode", () => {
    const input = validPayload();
    (input.daily as Array<Record<string, unknown>>)[0].weathercode = 1.5;
    expect(() => validateForecastPayload(input)).toThrow(
      /daily\[0\]\.weathercode/,
    );
  });

  it("rejects a null weathercode", () => {
    const input = validPayload();
    (input.hourly as Array<Record<string, unknown>>)[0].weathercode = null;
    expect(() => validateForecastPayload(input)).toThrow(
      /hourly\[0\]\.weathercode/,
    );
  });

  it("accepts an unrecognised but integer code (describeCode handles it)", () => {
    const input = validPayload();
    (input.daily as Array<Record<string, unknown>>)[0].weathercode = 123;
    expect(() => validateForecastPayload(input)).not.toThrow();
  });
});

describe("is_day flag", () => {
  it("rejects a value outside {0, 1}", () => {
    const input = validPayload();
    (input.current as Record<string, unknown>).is_day = 2;
    expect(() => validateForecastPayload(input)).toThrow(/current\.is_day/);
  });

  it("rejects a null is_day", () => {
    const input = validPayload();
    (input.current as Record<string, unknown>).is_day = null;
    expect(() => validateForecastPayload(input)).toThrow(/current\.is_day/);
  });
});

describe("non-empty arrays the app depends on", () => {
  it("rejects an empty daily array", () => {
    const input = { ...validPayload(), daily: [] };
    expect(() => validateForecastPayload(input)).toThrow(/daily/);
  });

  it("rejects an empty hourly array", () => {
    const input = { ...validPayload(), hourly: [] };
    expect(() => validateForecastPayload(input)).toThrow(/hourly/);
  });
});

describe("the timezone hazard", () => {
  it("rejects a Z-suffixed hourly timestamp", () => {
    // "...T14:00Z" would be read by new Date() as UTC and shift the timeline.
    const input = validPayload();
    (input.hourly as Array<Record<string, unknown>>)[0].time =
      "2026-07-20T14:00Z";
    expect(() => validateForecastPayload(input)).toThrow(/hourly\[0\]\.time/);
  });

  it("rejects a timestamp carrying a numeric offset", () => {
    const input = validPayload();
    (input.current as Record<string, unknown>).time = "2026-07-20T14:00+02:00";
    expect(() => validateForecastPayload(input)).toThrow(/current\.time/);
  });

  it("rejects a daily date that carries a time component", () => {
    const input = validPayload();
    (input.daily as Array<Record<string, unknown>>)[0].date =
      "2026-07-20T00:00";
    expect(() => validateForecastPayload(input)).toThrow(/daily\[0\]\.date/);
  });
});

describe("top-level type errors", () => {
  it("rejects a non-object input at the root path", () => {
    expect(() => validateForecastPayload("not json")).toThrow(/\(root\)/);
  });

  it("rejects null input", () => {
    expect(() => validateForecastPayload(null)).toThrow(
      /Invalid WeatherAI payload/,
    );
  });
});

describe("error message shape", () => {
  it("prefixes the message and stays on a single line", () => {
    const input = validPayload();
    (input.daily as Array<Record<string, unknown>>)[0].temp_max = null;
    try {
      validateForecastPayload(input);
      expect.unreachable("should have thrown");
    } catch (err) {
      const message = (err as Error).message;
      expect(message).toMatch(/^Invalid WeatherAI payload: /);
      expect(message).not.toContain("\n");
    }
  });

  it("names each of several offending fields", () => {
    const input = validPayload();
    const day = (input.daily as Array<Record<string, unknown>>)[0];
    day.temp_max = null;
    day.temp_min = null;
    const message = (() => {
      try {
        validateForecastPayload(input);
        return "";
      } catch (err) {
        return (err as Error).message;
      }
    })();
    expect(message).toContain("daily[0].temp_max");
    expect(message).toContain("daily[0].temp_min");
  });
});

describe("formatIssues", () => {
  it("caps the number of named issues and reports the remainder", () => {
    // Six null numerics on current -> six issues, one over the cap of five.
    const input = validPayload();
    Object.assign(input.current as Record<string, unknown>, {
      temperature: null,
      windspeed: null,
      winddirection: null,
      is_day: null,
      weathercode: null,
      time: null,
    });
    const result = forecastPayloadSchema.safeParse(input);
    expect(result.success).toBe(false);
    if (result.success) return;
    const line = formatIssues(result.error.issues);
    expect(result.error.issues.length).toBeGreaterThan(5);
    expect(line).toMatch(/\(\+\d+ more\)$/);
  });

  it("renders a root-level issue path as (root)", () => {
    const result = forecastPayloadSchema.safeParse(42);
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(formatIssues(result.error.issues)).toMatch(/^\(root\):/);
  });

  it("returns a single line for multiple issues", () => {
    const result = forecastPayloadSchema.safeParse({});
    expect(result.success).toBe(false);
    if (result.success) return;
    const line = formatIssues(result.error.issues);
    expect(line).not.toContain("\n");
    expect(line.length).toBeGreaterThan(0);
  });
});

describe("regression: gaps found by adversarial review", () => {
  it("rejects a well-formed but impossible calendar date (Feb 30)", () => {
    const p = validPayload();
    (p.daily as { date: string }[])[0].date = "2026-02-30";
    expect(() => validateForecastPayload(p)).toThrow(/daily/);
  });

  it("rejects a well-formed but impossible hour (25:00)", () => {
    const p = validPayload();
    (p.hourly as { time: string }[])[0].time = "2026-07-20T25:00";
    expect(() => validateForecastPayload(p)).toThrow(/hourly/);
  });

  it("accepts a real leap-day date", () => {
    const p = validPayload();
    (p.daily as { date: string }[])[0].date = "2028-02-29";
    expect(() => validateForecastPayload(p)).not.toThrow();
  });

  it("accepts is_day = 0 (night), the normal nighttime state", () => {
    const p = validPayload();
    (p.current as { is_day: number }).is_day = 0;
    const out = validateForecastPayload(p);
    expect(out.current.is_day).toBe(0);
  });

  it("accepts an absent or null interval on current", () => {
    const p1 = validPayload();
    delete (p1.current as Record<string, unknown>).interval;
    expect(() => validateForecastPayload(p1)).not.toThrow();
    const p2 = validPayload();
    (p2.current as Record<string, unknown>).interval = null;
    expect(() => validateForecastPayload(p2)).not.toThrow();
  });

  it("preserves unknown vendor keys at current and hourly levels", () => {
    const p = validPayload();
    (p.current as Record<string, unknown>).apparent_temperature = 25.9;
    (p.hourly as Record<string, unknown>[])[0].humidity = 71;
    const out = validateForecastPayload(p) as unknown as {
      current: Record<string, unknown>;
      hourly: Record<string, unknown>[];
    };
    expect(out.current.apparent_temperature).toBe(25.9);
    expect(out.hourly[0].humidity).toBe(71);
  });

  it("rejects a non-string, non-null ai_summary", () => {
    const p = validPayload();
    (p as Record<string, unknown>).ai_summary = 42;
    expect(() => validateForecastPayload(p)).toThrow(/ai_summary/);
  });

  it("rejects Infinity in a scoring field (the .finite() job)", () => {
    const p = validPayload();
    (p.daily as { temp_max: number }[])[0].temp_max = Infinity;
    expect(() => validateForecastPayload(p)).toThrow(/daily/);
  });
});
