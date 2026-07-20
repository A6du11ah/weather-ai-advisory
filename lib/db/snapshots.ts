/**
 * Snapshot persistence and retrieval.
 *
 * The read path (getLatestSnapshot / getPreviousSnapshot) is what serves the
 * site once a database is configured: page loads cost a Postgres query, not an
 * upstream API call, so traffic no longer consumes quota. Only the cron writer
 * spends the API budget.
 */

import { and, desc, eq, lt, sql } from "drizzle-orm";
import { getDb } from "./client";
import { quotaLedger, snapshots, type SnapshotRow } from "./schema";
import type { Forecast } from "../types";

/**
 * Store a forecast, keyed on (station, forecast's own first day).
 *
 * Upsert rather than insert: several refreshes on the same day overwrite one
 * row, so the table holds one snapshot per station per calendar day. Today's
 * row and yesterday's row are exactly what the diff compares.
 */
export async function saveSnapshot(
  stationId: string,
  forecast: Forecast,
): Promise<void> {
  const db = getDb();
  if (!db) return;

  const localDate = forecast.days[0]?.date;
  if (!localDate) return;

  await db
    .insert(snapshots)
    .values({ stationId, localDate, forecast, fetchedAt: new Date() })
    .onConflictDoUpdate({
      target: [snapshots.stationId, snapshots.localDate],
      set: { forecast, fetchedAt: new Date() },
    });
}

/** Most recent snapshot for a station, or null if none stored yet. */
export async function getLatestSnapshot(
  stationId: string,
): Promise<SnapshotRow | null> {
  const db = getDb();
  if (!db) return null;

  const rows = await db
    .select()
    .from(snapshots)
    .where(eq(snapshots.stationId, stationId))
    .orderBy(desc(snapshots.localDate))
    .limit(1);

  return rows[0] ?? null;
}

/**
 * The most recent snapshot from a strictly earlier local date.
 *
 * "Earlier date", not "second-most-recent row": several writes can land on the
 * same day, and the diff must compare across days, not across intraday
 * refreshes of the same forecast.
 */
export async function getPreviousSnapshot(
  stationId: string,
  beforeLocalDate: string,
): Promise<SnapshotRow | null> {
  const db = getDb();
  if (!db) return null;

  const rows = await db
    .select()
    .from(snapshots)
    .where(
      and(
        eq(snapshots.stationId, stationId),
        lt(snapshots.localDate, beforeLocalDate),
      ),
    )
    .orderBy(desc(snapshots.localDate))
    .limit(1);

  return rows[0] ?? null;
}

/**
 * Reserve quota for `count` upcoming API calls, atomically.
 *
 * Returns true if the reservation fit under `ceiling`, false if it would
 * exceed it. The increment and the check happen in one statement so two
 * concurrent cron runs cannot both slip past the limit. The ceiling is set
 * below the real 1,000 so manual testing and /v1/usage calls keep headroom.
 */
export async function reserveQuota(
  count: number,
  ceiling: number,
): Promise<boolean> {
  const db = getDb();
  if (!db) return true; // no ledger without a db; the caller's own guards apply

  const month = new Date().toISOString().slice(0, 7);

  const rows = await db
    .insert(quotaLedger)
    .values({ month, used: count })
    .onConflictDoUpdate({
      target: quotaLedger.month,
      set: { used: sql`${quotaLedger.used} + ${count}` },
    })
    .returning({ used: quotaLedger.used });

  const usedAfter = rows[0]?.used ?? count;
  if (usedAfter > ceiling) {
    // Roll the reservation back so a refused batch does not permanently burn
    // the ledger and starve later runs in the same month.
    await db
      .update(quotaLedger)
      .set({ used: sql`${quotaLedger.used} - ${count}` })
      .where(eq(quotaLedger.month, month));
    return false;
  }
  return true;
}

/** Current month's recorded usage, for display. */
export async function getMonthlyUsage(): Promise<number | null> {
  const db = getDb();
  if (!db) return null;

  const month = new Date().toISOString().slice(0, 7);
  const rows = await db
    .select()
    .from(quotaLedger)
    .where(eq(quotaLedger.month, month))
    .limit(1);

  return rows[0]?.used ?? 0;
}
