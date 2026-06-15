// One-time baseline so an EXISTING database can start using drizzle migrations
// without re-creating its tables. Marks the first generated migration (0000) as
// already applied by recording its journal timestamp in drizzle's bookkeeping
// table — drizzle-kit migrate skips any migration whose timestamp is <= the
// last recorded one, so 0000 is skipped and only NEW migrations run.
//
// Safe + idempotent: only inserts when the bookkeeping table is empty.
//
// Targets the DB in DRIZZLE_ENV_FILE (default .env.local):
//   npm run db:baseline           # dev branch (.env.local)
//   npm run db:baseline:prod      # production (.env.production.local)
//
// Run it against the DEV branch first and confirm `npm run db:migrate` then
// reports nothing to apply, before baselining prod.

import { readFileSync } from "node:fs";
import { config } from "dotenv";
import { neon } from "@neondatabase/serverless";

const envFile = process.env.DRIZZLE_ENV_FILE ?? ".env.local";
config({ path: envFile });

const url = process.env.DATABASE_URL;
if (!url) {
  console.error(`DATABASE_URL is required (looked in ${envFile})`);
  process.exit(1);
}

const journal = JSON.parse(
  readFileSync(new URL("../drizzle/meta/_journal.json", import.meta.url), "utf8"),
);
const first = journal.entries?.[0];
if (!first) {
  console.error("No migrations found — run `npm run db:generate` first.");
  process.exit(1);
}

const sql = neon(url);
await sql`CREATE SCHEMA IF NOT EXISTS drizzle`;
await sql`CREATE TABLE IF NOT EXISTS drizzle."__drizzle_migrations" (id SERIAL PRIMARY KEY, hash text NOT NULL, created_at bigint)`;

const [{ c }] = await sql`SELECT count(*)::int AS c FROM drizzle."__drizzle_migrations"`;
if (c > 0) {
  console.log("Baseline already present — nothing to do.");
  process.exit(0);
}

await sql`INSERT INTO drizzle."__drizzle_migrations" (hash, created_at) VALUES (${"baseline-" + first.tag}, ${first.when})`;
console.log(
  `Baselined ${envFile}: marked ${first.tag} as applied (created_at=${first.when}). ` +
    `Future migrations will apply on top.`,
);
