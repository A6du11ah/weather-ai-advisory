import type { Config } from "drizzle-kit";

/**
 * Drizzle Kit configuration for schema push and migration generation.
 *
 * DATABASE_URL is read from the environment; with none set, `npm run db:push`
 * simply has nothing to connect to, which is the same fail-open posture the
 * runtime takes.
 */
export default {
  schema: "./lib/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "",
  },
} satisfies Config;
