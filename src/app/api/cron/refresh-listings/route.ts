import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { db } from "@/db/client";
import { listings } from "@/db/schema";
import { refreshListingsBatch } from "@/lib/listings/refresh";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

function checkCronAuth(req: Request): boolean {
  const expected = process.env.CRON_SECRET;
  if (!expected) return false;
  const header = req.headers.get("authorization");
  if (!header) return false;
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match) return false;
  const provided = Buffer.from(match[1]);
  const expectedBuf = Buffer.from(expected);
  if (provided.length !== expectedBuf.length) return false;
  return timingSafeEqual(provided, expectedBuf);
}

export async function GET(req: Request) {
  if (!checkCronAuth(req)) {
    return new NextResponse("Unauthorized", {
      status: 401,
      headers: { "WWW-Authenticate": 'Bearer realm="cron"' },
    });
  }

  const started = Date.now();
  const rows = await db.select({ id: listings.id }).from(listings);

  // ~10–15s per scrape with 4 in parallel ~= 12 listings/min. The 300s
  // function ceiling caps a single invocation at roughly 100 listings before
  // we'd need to chunk across cron firings.
  const outcomes = await refreshListingsBatch(
    rows.map((r) => r.id),
    "cron",
  );

  let changed = 0;
  let failed = 0;
  for (const o of outcomes) {
    if (o.kind === "ok") {
      if (o.changes > 0) changed += 1;
    } else if (o.kind === "fetch_failed") {
      failed += 1;
    }
  }

  return NextResponse.json({
    ok: true,
    totalMs: Date.now() - started,
    total: rows.length,
    changed,
    failed,
  });
}
