import { sql } from "drizzle-orm";
import { db } from "@/db/client";
import { listingChanges } from "@/db/schema";

const WARN_THRESHOLD = 5_000;

export async function AuditSizeWarning() {
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(listingChanges);
  const count = row?.count ?? 0;
  if (count < WARN_THRESHOLD) return null;
  return (
    <p className="mb-4 rounded border border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400 p-3 text-sm">
      The change-history log has {count.toLocaleString("en-US")} rows. Consider
      trimming it (e.g. delete entries older than 90 days) to keep the database
      lean.
    </p>
  );
}
