/**
 * Place search endpoint. Proxies Open-Meteo geocoding so the client gets a
 * clean, consistent result shape and we keep one place to swap providers.
 */

import type { NextRequest } from "next/server";
import { searchPlaces } from "@/lib/geocode";

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q") ?? "";
  if (q.trim().length < 2) {
    return Response.json({ results: [] });
  }
  const results = await searchPlaces(q);
  return Response.json(
    { results },
    { headers: { "Cache-Control": "public, s-maxage=3600" } },
  );
}
