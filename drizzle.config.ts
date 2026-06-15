import { config } from "dotenv";
import type { Config } from "drizzle-kit";

// Which env file to load. Defaults to .env.local (dev branch). The :prod
// scripts set DRIZZLE_ENV_FILE=.env.production.local to target production.
// On Vercel there's no env file; DATABASE_URL is already in process.env, and
// dotenv won't overwrite it.
const envFile = process.env.DRIZZLE_ENV_FILE ?? ".env.local";
config({ path: envFile });

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error(
    `DATABASE_URL is required for drizzle-kit; set it in ${envFile}`,
  );
}

export default {
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: { url: databaseUrl },
  // Pin the migrations bookkeeping location so it matches the baseline marker
  // in scripts/baseline-migrations.mjs.
  migrations: { schema: "drizzle", table: "__drizzle_migrations" },
} satisfies Config;
