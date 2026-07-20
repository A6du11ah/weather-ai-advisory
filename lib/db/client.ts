/**
 * Database connection.
 *
 * Returns null when DATABASE_URL is unset, and every caller is expected to
 * handle that. This is not defensive padding — it is the property that keeps
 * `main` deployable throughout the migration to Postgres. The app runs on the
 * in-memory cache with no database configured, gains persistence when one is,
 * and never has a half-migrated state where the site is broken because an
 * environment variable has not been set yet.
 *
 * Uses Neon's HTTP driver rather than a TCP pool: serverless functions are
 * short-lived and would otherwise exhaust connection limits.
 */

import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

type Db = ReturnType<typeof drizzle<typeof schema>>;

let cached: Db | null = null;

export function getDb(): Db | null {
  const url = process.env.DATABASE_URL;
  if (!url) return null;

  if (!cached) {
    cached = drizzle(neon(url), { schema });
  }
  return cached;
}

export function isDbConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL);
}
