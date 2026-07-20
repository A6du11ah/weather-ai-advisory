/**
 * Add a field to a farm.
 */

import type { NextRequest } from "next/server";
import { addField, getFarmByKey } from "@/lib/db/farms";
import { findCrop } from "@/lib/crops";
import { reverseGeocode } from "@/lib/geocode";

export async function POST(
  request: NextRequest,
  ctx: { params: Promise<{ key: string }> },
) {
  const { key } = await ctx.params;
  const farm = await getFarmByKey(key);
  if (!farm) return Response.json({ error: "Farm not found." }, { status: 404 });

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const lat = Number(body.lat);
  const lon = Number(body.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) {
    return Response.json({ error: "Valid lat and lon are required." }, { status: 400 });
  }

  const name = typeof body.name === "string" ? body.name : "Field";
  const cropId = findCrop(typeof body.cropId === "string" ? body.cropId : null).id;
  const plantingDate =
    typeof body.plantingDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.plantingDate)
      ? body.plantingDate
      : null;

  // Prefer a client-supplied label (from the search pick); otherwise resolve
  // one from the coordinates so a map-dropped pin still gets a readable place.
  let placeName =
    typeof body.placeName === "string" && body.placeName.trim()
      ? body.placeName.trim()
      : null;
  if (!placeName) {
    placeName = await reverseGeocode(lat, lon);
  }

  const result = await addField(farm.id, { name, lat, lon, placeName, cropId, plantingDate });
  if (result && "error" in result) {
    return Response.json({ error: result.error }, { status: 409 });
  }
  if (!result) {
    return Response.json({ error: "Could not add field." }, { status: 500 });
  }
  return Response.json({ id: result.id }, { status: 201 });
}
