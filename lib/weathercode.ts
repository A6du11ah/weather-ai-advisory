/**
 * WMO weather code interpretation.
 *
 * The API exposes no humidity or sunshine-hours field, so `weathercode` is
 * the only signal available for how *effectively* a dry day will actually
 * dry grain. A clear 25°C day removes far more moisture than an overcast
 * 25°C day, and this is the only way to tell them apart.
 */

export interface CodeInfo {
  label: string;
  /**
   * Drying effectiveness multiplier, 0–1. Clear skies dry grain; overcast
   * and fog barely do, even when no rain falls.
   */
  dryingFactor: number;
  /** Does this code imply falling precipitation? */
  wet: boolean;
}

const CODES: Record<number, CodeInfo> = {
  0: { label: "Clear", dryingFactor: 1.0, wet: false },
  1: { label: "Mainly clear", dryingFactor: 0.9, wet: false },
  2: { label: "Partly cloudy", dryingFactor: 0.7, wet: false },
  3: { label: "Overcast", dryingFactor: 0.45, wet: false },
  45: { label: "Fog", dryingFactor: 0.15, wet: false },
  48: { label: "Rime fog", dryingFactor: 0.15, wet: false },
  51: { label: "Light drizzle", dryingFactor: 0.05, wet: true },
  53: { label: "Drizzle", dryingFactor: 0.05, wet: true },
  55: { label: "Heavy drizzle", dryingFactor: 0, wet: true },
  56: { label: "Freezing drizzle", dryingFactor: 0, wet: true },
  57: { label: "Freezing drizzle", dryingFactor: 0, wet: true },
  61: { label: "Light rain", dryingFactor: 0, wet: true },
  63: { label: "Rain", dryingFactor: 0, wet: true },
  65: { label: "Heavy rain", dryingFactor: 0, wet: true },
  66: { label: "Freezing rain", dryingFactor: 0, wet: true },
  67: { label: "Freezing rain", dryingFactor: 0, wet: true },
  71: { label: "Light snow", dryingFactor: 0, wet: true },
  73: { label: "Snow", dryingFactor: 0, wet: true },
  75: { label: "Heavy snow", dryingFactor: 0, wet: true },
  77: { label: "Snow grains", dryingFactor: 0, wet: true },
  80: { label: "Rain showers", dryingFactor: 0, wet: true },
  81: { label: "Rain showers", dryingFactor: 0, wet: true },
  82: { label: "Violent showers", dryingFactor: 0, wet: true },
  85: { label: "Snow showers", dryingFactor: 0, wet: true },
  86: { label: "Snow showers", dryingFactor: 0, wet: true },
  95: { label: "Thunderstorm", dryingFactor: 0, wet: true },
  96: { label: "Thunderstorm, hail", dryingFactor: 0, wet: true },
  99: { label: "Thunderstorm, hail", dryingFactor: 0, wet: true },
};

const UNKNOWN: CodeInfo = { label: "Unknown", dryingFactor: 0.5, wet: false };

export function describeCode(code: number): CodeInfo {
  return CODES[code] ?? UNKNOWN;
}
