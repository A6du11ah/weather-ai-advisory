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
  real,
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

/**
 * A farm — the account, deliberately without a password.
 *
 * `key` is a long unguessable token that doubles as identity and access: the
 * farm lives at /farm/{key}, and holding the key is holding the account. This
 * is a share-link auth model, chosen over email/password because the target
 * user is on a cheap phone with no appetite for a signup wall, and because it
 * is honest about what this is — a worthy assignment, not a hardened SaaS. A
 * real deployment would layer proper auth on top; the data model does not
 * change when it does.
 */
export const farms = pgTable("farms", {
  id: serial("id").primaryKey(),
  key: text("key").notNull().unique(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * A field within a farm.
 *
 * Location is free lat/lon, not a preset — this is the point at which the app
 * stops being a demo over five fixed stations and becomes a tool for a user's
 * actual ground. Weather for an arbitrary field is resolved live and cached
 * rather than pre-fetched by cron; that is the scalability trade the brief
 * explicitly accepted.
 */
export const fields = pgTable("fields", {
  id: serial("id").primaryKey(),
  farmId: integer("farm_id")
    .notNull()
    .references(() => farms.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  lat: real("lat").notNull(),
  lon: real("lon").notNull(),
  cropId: text("crop_id").notNull(),
  /** ISO date the crop was planted; drives growth-stage reasoning. Nullable — a user may not know it. */
  plantingDate: text("planting_date"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * A logged field operation.
 *
 * This is the record that turns a read-only viewer into a product: the user
 * did something, and the advisory can now reason about it — days since a spray
 * (re-entry and rainfast history), days since planting, progress toward
 * harvest. Without this table the app can only ever describe the sky.
 */
export const activities = pgTable("activities", {
  id: serial("id").primaryKey(),
  fieldId: integer("field_id")
    .notNull()
    .references(() => fields.id, { onDelete: "cascade" }),
  /** spray | fertilize | plant | harvest | irrigate | other */
  kind: text("kind").notNull(),
  /** Free label, e.g. the product name for a spray. */
  label: text("label"),
  /** ISO date the operation happened. */
  occurredOn: text("occurred_on").notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type FarmRow = typeof farms.$inferSelect;
export type FieldRow = typeof fields.$inferSelect;
export type ActivityRow = typeof activities.$inferSelect;
