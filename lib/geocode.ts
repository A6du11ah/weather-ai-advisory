/**
 * Geocoding — turning place names into coordinates and back.
 *
 * Both directions use free, no-key services so the app stays on free infra:
 *   - Forward search: Open-Meteo's geocoding API (generous, CORS-friendly, no
 *     key, structured admin/country fields).
 *   - Reverse (coords → name): OpenStreetMap Nominatim, which is free but has a
 *     strict usage policy (≤1 req/s, a real User-Agent required). It is only
 *     ever called server-side, from a cached route, and never in a hot path —
 *     a field is reverse-geocoded once, when it is created.
 *
 * Weather still comes from WeatherAI; this only adds location intelligence.
 */

export interface GeoResult {
  name: string;
  /** "City, Region, Country" style label for display. */
  label: string;
  lat: number;
  lon: number;
  country: string | null;
}

interface OpenMeteoHit {
  name: string;
  latitude: number;
  longitude: number;
  country?: string;
  admin1?: string;
}

/**
 * Search places by name. Returns up to `count` matches, best first.
 */
export async function searchPlaces(
  query: string,
  count = 6,
): Promise<GeoResult[]> {
  const q = query.trim();
  if (q.length < 2) return [];

  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=${count}&language=en&format=json`;

  const res = await fetch(url, {
    headers: { Accept: "application/json" },
    // Neighbouring searches for the same term can share a short cache.
    next: { revalidate: 3600 },
  });
  if (!res.ok) return [];

  const data = (await res.json()) as { results?: OpenMeteoHit[] };
  if (!data.results) return [];

  return data.results.map((r) => ({
    name: r.name,
    label: [r.name, r.admin1, r.country].filter(Boolean).join(", "),
    lat: r.latitude,
    lon: r.longitude,
    country: r.country ?? null,
  }));
}

/**
 * Reverse-geocode a coordinate to a short place label, or null.
 *
 * Server-only. Nominatim's policy requires an identifying User-Agent and rate
 * limiting; callers must not invoke this per request, only on field creation.
 */
export async function reverseGeocode(
  lat: number,
  lon: number,
): Promise<string | null> {
  const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&zoom=10&addressdetails=1`;
  try {
    const res = await fetch(url, {
      headers: {
        Accept: "application/json",
        // Nominatim requires a descriptive UA identifying the application.
        "User-Agent": "FieldWindow/1.0 (agricultural advisory demo)",
      },
      next: { revalidate: 86400 },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      address?: Record<string, string>;
      display_name?: string;
    };
    const a = data.address ?? {};
    const place =
      a.village || a.town || a.city || a.county || a.state || a.region;
    const country = a.country;
    if (place && country) return `${place}, ${country}`;
    if (place) return place;
    return data.display_name?.split(",").slice(0, 2).join(",").trim() ?? null;
  } catch {
    return null;
  }
}
