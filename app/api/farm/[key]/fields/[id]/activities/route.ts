/**
 * Log an activity against a field.
 */

import type { NextRequest } from "next/server";
import { addActivity, getFarmByKey, getField } from "@/lib/db/farms";

const KINDS = new Set(["spray", "fertilize", "plant", "harvest", "irrigate", "other"]);

export async function POST(
  request: NextRequest,
  ctx: { params: Promise<{ key: string; id: string }> },
) {
  const { key, id } = await ctx.params;
  const farm = await getFarmByKey(key);
  if (!farm) return Response.json({ error: "Farm not found." }, { status: 404 });

  const field = await getField(farm.id, Number(id));
  if (!field) return Response.json({ error: "Field not found." }, { status: 404 });

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const kind = typeof body.kind === "string" && KINDS.has(body.kind) ? body.kind : null;
  const occurredOn =
    typeof body.occurredOn === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.occurredOn)
      ? body.occurredOn
      : null;
  if (!kind || !occurredOn) {
    return Response.json(
      { error: "kind (spray|fertilize|plant|harvest|irrigate|other) and occurredOn (YYYY-MM-DD) are required." },
      { status: 400 },
    );
  }

  const label = typeof body.label === "string" ? body.label : null;
  const notes = typeof body.notes === "string" ? body.notes : null;

  const row = await addActivity(field.id, { kind, label, occurredOn, notes });
  if (!row) return Response.json({ error: "Could not log activity." }, { status: 500 });
  return Response.json({ id: row.id }, { status: 201 });
}
