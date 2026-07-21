/**
 * Read a farm and its fields, each with a compact advisory summary.
 *
 * The key in the path is the credential — holding it is holding the farm — so
 * there is no separate auth check beyond resolving it.
 */

import type { NextRequest } from "next/server";
import { getFarmByKey, listActivities, listFields, renameFarm } from "@/lib/db/farms";
import { composeField } from "@/lib/farm-view";
import type { FieldTask } from "@/lib/field-context";

export async function GET(
  _request: NextRequest,
  ctx: { params: Promise<{ key: string }> },
) {
  const { key } = await ctx.params;
  const farm = await getFarmByKey(key);
  if (!farm) {
    return Response.json({ error: "Farm not found." }, { status: 404 });
  }

  const withAi = process.env.ENABLE_AI_SUMMARY !== "false";
  const fields = await listFields(farm.id);

  // Compose each field. One forecast per field, cached — bounded by the
  // per-farm field cap. Failures degrade to a stub so one bad field does not
  // blank the whole dashboard.
  const views = await Promise.all(
    fields.map(async (f) => {
      try {
        const activities = await listActivities(f.id);
        const view = await composeField(f, activities, { withAi });
        const g = view.context.growth;
        const progress =
          g.hasCalendar && g.daysAfterPlanting !== null && g.daysToHarvest !== null
            ? Math.max(0, Math.min(1, g.daysAfterPlanting / (g.daysAfterPlanting + g.daysToHarvest)))
            : null;
        return {
          id: f.id,
          name: f.name,
          cropName: view.field.cropName,
          headline: view.advisory.headline,
          drying: view.advisory.advisories.drying.best?.verdict ?? "poor",
          spray: view.advisory.advisories.spray.best?.verdict ?? "poor",
          stage: view.context.growth.stage?.label ?? null,
          progress,
          daysToHarvest: g.daysToHarvest,
          nextTask: view.context.tasks[0] ?? null,
        };
      } catch {
        return {
          id: f.id,
          name: f.name,
          cropName: f.cropId,
          headline: "Forecast unavailable — try again shortly.",
          drying: "poor" as const,
          spray: "poor" as const,
          stage: null,
          nextTask: null as FieldTask | null,
        };
      }
    }),
  );

  // Aggregate this-week tasks across all fields.
  const tasks = views
    .map((v) => (v.nextTask ? { field: v.name, ...v.nextTask } : null))
    .filter(Boolean)
    .sort((a, b) => a!.date.localeCompare(b!.date));

  return Response.json({
    farm: { name: farm.name, key: farm.key },
    fields: views,
    tasks,
  });
}

/** Rename a farm. The key in the path is the credential, as with GET. */
export async function PATCH(
  request: NextRequest,
  ctx: { params: Promise<{ key: string }> },
) {
  const { key } = await ctx.params;

  let name = "";
  try {
    const body = await request.json();
    if (typeof body?.name === "string") name = body.name;
  } catch {
    // No body — falls through to the empty-name guard below.
  }
  if (!name.trim()) {
    return Response.json({ error: "A name is required." }, { status: 400 });
  }

  const farm = await renameFarm(key, name);
  if (!farm) {
    return Response.json({ error: "Farm not found." }, { status: 404 });
  }
  return Response.json({ farm: { name: farm.name, key: farm.key } });
}
