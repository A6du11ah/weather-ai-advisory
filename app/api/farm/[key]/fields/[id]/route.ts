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
    return Response.json({
      ...view,
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
