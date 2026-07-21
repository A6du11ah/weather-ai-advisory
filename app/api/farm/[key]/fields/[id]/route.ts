/**
 * A single field: full personalised advisory (GET) or removal (DELETE).
 */

import type { NextRequest } from "next/server";
import {
  deleteField,
  getFarmByKey,
  getField,
  listActivities,
} from "@/lib/db/farms";
import { composeField } from "@/lib/farm-view";
import { seasonTimeline } from "@/lib/growth";
import { gddSincePlanting } from "@/lib/gdd";
import { findCrop } from "@/lib/crops";

export async function GET(
  _request: NextRequest,
  ctx: { params: Promise<{ key: string; id: string }> },
) {
  const { key, id } = await ctx.params;
  const farm = await getFarmByKey(key);
  if (!farm) return Response.json({ error: "Farm not found." }, { status: 404 });

  const field = await getField(farm.id, Number(id));
  if (!field) return Response.json({ error: "Field not found." }, { status: 404 });

  const activities = await listActivities(field.id);
  const withAi = process.env.ENABLE_AI_SUMMARY !== "false";

  try {
    const view = await composeField(field, activities, { withAi });
    const today = view.advisory.days[0]?.date ?? "";

    // GDD needs a temperature history since planting, which the forecast API
    // does not carry — pull it from the free Open-Meteo archive. Only when a
    // planting date is known; never blocks the page if it fails.
    const crop = findCrop(field.cropId);
    const gdd = field.plantingDate
      ? await gddSincePlanting({
          lat: field.lat,
          lon: field.lon,
          plantingDate: field.plantingDate,
          baseC: crop.gddBaseC,
          today,
        }).catch(() => null)
      : null;

    return Response.json({
      ...view,
      season: seasonTimeline(field.cropId, field.plantingDate, today),
      gdd: gdd ? { gdd: gdd.gdd, throughDate: gdd.throughDate } : null,
      activities: activities.map((a) => ({
        id: a.id,
        kind: a.kind,
        label: a.label,
        occurredOn: a.occurredOn,
        notes: a.notes,
      })),
    });
  } catch {
    return Response.json(
      { error: "Could not resolve a forecast for this field right now." },
      { status: 503 },
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  ctx: { params: Promise<{ key: string; id: string }> },
) {
  const { key, id } = await ctx.params;
  const farm = await getFarmByKey(key);
  if (!farm) return Response.json({ error: "Farm not found." }, { status: 404 });

  const ok = await deleteField(farm.id, Number(id));
  if (!ok) return Response.json({ error: "Field not found." }, { status: 404 });
  return Response.json({ deleted: true });
}
