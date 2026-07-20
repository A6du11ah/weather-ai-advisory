/**
 * Farm / field / activity data access.
 *
 * Every function returns null or an empty result when no database is
 * configured, so the surrounding routes can 503 cleanly rather than throw —
 * the farm feature simply requires persistence, where the demo does not.
 */

import { randomBytes } from "node:crypto";
import { and, asc, desc, eq } from "drizzle-orm";
import { getDb } from "./client";
import {
  activities,
  farms,
  fields,
  type ActivityRow,
  type FarmRow,
  type FieldRow,
} from "./schema";

/** Hard cap on fields per farm — a crude but real bound on quota abuse. */
export const MAX_FIELDS_PER_FARM = 12;

/**
 * A url-safe, unguessable farm key. This is the credential, so it must be long
 * enough that it cannot be walked: 18 bytes → 24 base64url chars.
 */
function newKey(): string {
  return randomBytes(18).toString("base64url");
}

export async function createFarm(name: string): Promise<FarmRow | null> {
  const db = getDb();
  if (!db) return null;
  const key = newKey();
  const rows = await db
    .insert(farms)
    .values({ key, name: name.trim() || "My farm" })
    .returning();
  return rows[0] ?? null;
}

export async function getFarmByKey(key: string): Promise<FarmRow | null> {
  const db = getDb();
  if (!db) return null;
  const rows = await db.select().from(farms).where(eq(farms.key, key)).limit(1);
  return rows[0] ?? null;
}

export async function listFields(farmId: number): Promise<FieldRow[]> {
  const db = getDb();
  if (!db) return [];
  return db
    .select()
    .from(fields)
    .where(eq(fields.farmId, farmId))
    .orderBy(asc(fields.createdAt));
}

export async function getField(
  farmId: number,
  fieldId: number,
): Promise<FieldRow | null> {
  const db = getDb();
  if (!db) return null;
  const rows = await db
    .select()
    .from(fields)
    .where(and(eq(fields.id, fieldId), eq(fields.farmId, farmId)))
    .limit(1);
  return rows[0] ?? null;
}

export async function addField(
  farmId: number,
  input: {
    name: string;
    lat: number;
    lon: number;
    cropId: string;
    plantingDate: string | null;
  },
): Promise<FieldRow | { error: string } | null> {
  const db = getDb();
  if (!db) return null;

  const existing = await listFields(farmId);
  if (existing.length >= MAX_FIELDS_PER_FARM) {
    return { error: `A farm is limited to ${MAX_FIELDS_PER_FARM} fields on this deployment.` };
  }

  const rows = await db
    .insert(fields)
    .values({
      farmId,
      name: input.name.trim() || "Field",
      lat: input.lat,
      lon: input.lon,
      cropId: input.cropId,
      plantingDate: input.plantingDate,
    })
    .returning();
  return rows[0] ?? null;
}

export async function deleteField(farmId: number, fieldId: number): Promise<boolean> {
  const db = getDb();
  if (!db) return false;
  const rows = await db
    .delete(fields)
    .where(and(eq(fields.id, fieldId), eq(fields.farmId, farmId)))
    .returning({ id: fields.id });
  return rows.length > 0;
}

export async function listActivities(fieldId: number): Promise<ActivityRow[]> {
  const db = getDb();
  if (!db) return [];
  return db
    .select()
    .from(activities)
    .where(eq(activities.fieldId, fieldId))
    .orderBy(desc(activities.occurredOn), desc(activities.createdAt));
}

export async function addActivity(
  fieldId: number,
  input: { kind: string; label: string | null; occurredOn: string; notes: string | null },
): Promise<ActivityRow | null> {
  const db = getDb();
  if (!db) return null;
  const rows = await db
    .insert(activities)
    .values({
      fieldId,
      kind: input.kind,
      label: input.label?.trim() || null,
      occurredOn: input.occurredOn,
      notes: input.notes?.trim() || null,
    })
    .returning();
  return rows[0] ?? null;
}
