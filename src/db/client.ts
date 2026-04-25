import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

type Db = ReturnType<typeof drizzle<typeof schema>>;

let cached: Db | null = null;

function getDb(): Db {
  if (cached) return cached;
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  cached = drizzle(neon(url), { schema });
  return cached;
}

// Proxy lets callers `import { db }` and use it directly while deferring
// initialization to first access. This keeps build-time module evaluation
// (which doesn't have DATABASE_URL in env) from throwing.
export const db = new Proxy({} as Db, {
  get(_, prop) {
    const target = getDb() as unknown as Record<string | symbol, unknown>;
    const value = target[prop as string];
    return typeof value === "function" ? value.bind(target) : value;
  },
}) as Db;
