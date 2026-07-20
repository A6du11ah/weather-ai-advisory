/**
 * Database schema.
 *
 * Two tables, deliberately. There is no `station` table: the locations live in
 * `lib/places.ts` as static configuration, and copying them into Postgres would
 * add a migration and a seed step to store values that only ever change when
 * the code changes.
 *
 * The unique constraint on (station_id, local_date) is what makes the whole
 * day-over-day diff possible. Refreshing several times a day upserts the same
 * row, so each station keeps exactly one snapshot per calendar day: today's
 * view of the future, and yesterday's view of the same future. Comparing those
 * two is the only thing this product does that a weather app structurally
 * cannot.
 */

import {
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import type { Forecast } from "../types";

export const snapshots = pgTable(
  "snapshots",
  {
    id: serial("id").primaryKey(),
    /** Preset id from lib/places.ts. */
    stationId: text("station_id").notNull(),
    /**
     * The forecast's own first day, not the server date. The server runs in
     * UTC while the stations span five time zones, so a server-derived date
     * would roll over at the wrong moment for most of them.
     */
    localDate: text("local_date").notNull(),
    fetchedAt: timestamp("fetched_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    forecast: jsonb("forecast").$type<Forecast>().notNull(),
  },
  (t) => [uniqueIndex("snapshots_station_local_date").on(t.stationId, t.localDate)],
);

/**
 * Monthly API call ledger.
 *
 * The upstream sends no rate-limit headers and /v1/usage is itself a request,
 * so the only way to refuse work *before* spending quota is to count locally.
 * The cron job hard-stops above a ceiling rather than discovering exhaustion
 * by receiving a 429.
 */
export const quotaLedger = pgTable("quota_ledger", {
  /** YYYY-MM in UTC. Billing periods are coarse enough that drift is irrelevant. */
  month: text("month").primaryKey(),
  used: integer("used").notNull().default(0),
});

export type SnapshotRow = typeof snapshots.$inferSelect;
