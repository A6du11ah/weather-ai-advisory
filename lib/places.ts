/**
 * Demo locations.
 *
 * Deliberately spread across three continents. The advisory logic is
 * physics, not geography — grain spoils in Iowa for the same reason it
 * spoils in Bomet — and a preset row spanning Kenya, the US Midwest and
 * the Punjab makes that legible in a single screenshot.
 *
 * These are also the warm-cache paths: a reviewer clicking presets costs
 * far fewer upstream requests than arbitrary coordinates would.
 */

export interface Preset {
  id: string;
  name: string;
  country: string;
  lat: number;
  lon: number;
  /** Why this location is interesting for the advisory use case. */
  context: string;
}

export const PRESETS: Preset[] = [
  {
    id: "bomet",
    name: "Bomet",
    country: "Kenya",
    lat: -0.7813,
    lon: 35.3416,
    context: "Maize and tea smallholdings; long rains drive aflatoxin risk at harvest.",
  },
  {
    id: "ames",
    name: "Ames, Iowa",
    country: "United States",
    lat: 42.0347,
    lon: -93.62,
    context: "US Corn Belt; large-scale maize drying and tight spray schedules.",
  },
  {
    id: "ludhiana",
    name: "Ludhiana, Punjab",
    country: "India",
    lat: 30.901,
    lon: 75.8573,
    context: "Wheat and rice; post-monsoon drying windows are narrow.",
  },
  {
    id: "kumasi",
    name: "Kumasi",
    country: "Ghana",
    lat: 6.6885,
    lon: -1.6244,
    context: "Humid forest zone; drying is the binding constraint, not rainfall.",
  },
  {
    id: "campinas",
    name: "Campinas",
    country: "Brazil",
    lat: -22.9099,
    lon: -47.0626,
    context: "Coffee and maize; spray drift management in a windy dry season.",
  },
];

export function findPreset(id: string): Preset | undefined {
  return PRESETS.find((p) => p.id === id);
}

/**
 * Resolve arbitrary coordinates to a known preset, or reject them.
 *
 * Coordinate rounding alone does not bound quota: a caller looping over
 * latitudes produces a fresh cache key every 0.1°, so every request becomes an
 * upstream call and a public URL can drain a 1,000-request monthly allowance
 * in minutes. Only allowlisted locations are fetchable.
 *
 * The tolerance absorbs float formatting differences between client and
 * server without widening the surface meaningfully — 0.05° is roughly 5km,
 * far below the spacing between presets.
 */
export function matchPreset(lat: number, lon: number): Preset | undefined {
  const TOLERANCE_DEG = 0.05;
  return PRESETS.find(
    (p) =>
      Math.abs(p.lat - lat) <= TOLERANCE_DEG &&
      Math.abs(p.lon - lon) <= TOLERANCE_DEG,
  );
}
