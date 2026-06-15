import { and, asc, eq, gte, isNull } from "drizzle-orm";
import { db } from "@/db/client";
import { listingChanges, listings } from "@/db/schema";
import type { HealthIssue } from "./health";

export const DIGEST_WINDOW_HOURS = 24;

// Cap how many listings we enumerate so the message stays within WhatsApp's
// ~1600-char body limit. Overflow is summarized as "+N more".
const MAX_LISTINGS_IN_MESSAGE = 25;

export type DigestChange = {
  field: string;
  oldValue: string | null;
  newValue: string | null;
};

export type DigestListing = {
  listingId: string;
  label: string;
  changes: DigestChange[];
};

export type DailyDigest = {
  totalChanges: number;
  listings: DigestListing[];
};

// All changes across the workspace in the window, grouped by listing. This is
// a single shared digest (not split per org/owner) — appropriate for the
// private, single-workspace deployments this app targets. Deleted listings
// are excluded via the inner join + deletedAt filter.
export async function buildDailyDigest(
  windowHours: number = DIGEST_WINDOW_HOURS,
): Promise<DailyDigest> {
  const since = new Date(Date.now() - windowHours * 60 * 60 * 1000);
  const rows = await db
    .select({
      listingId: listingChanges.listingId,
      field: listingChanges.field,
      oldValue: listingChanges.oldValue,
      newValue: listingChanges.newValue,
      address: listings.address,
      title: listings.title,
    })
    .from(listingChanges)
    .innerJoin(listings, eq(listings.id, listingChanges.listingId))
    .where(
      and(gte(listingChanges.changedAt, since), isNull(listings.deletedAt)),
    )
    .orderBy(asc(listingChanges.changedAt));

  // Collapse repeated changes to the same field into a single net change:
  // earliest oldValue → latest newValue (rows are oldest-first).
  type Entry = { label: string; fields: Map<string, DigestChange> };
  const byListing = new Map<string, Entry>();
  for (const r of rows) {
    let entry = byListing.get(r.listingId);
    if (!entry) {
      entry = {
        label: r.address ?? r.title ?? "Listing",
        fields: new Map(),
      };
      byListing.set(r.listingId, entry);
    }
    const existing = entry.fields.get(r.field);
    if (existing) {
      existing.newValue = r.newValue;
    } else {
      entry.fields.set(r.field, {
        field: r.field,
        oldValue: r.oldValue,
        newValue: r.newValue,
      });
    }
  }

  const digestListings: DigestListing[] = [];
  let totalChanges = 0;
  for (const [listingId, entry] of byListing) {
    const changes = Array.from(entry.fields.values()).filter(
      (c) => c.oldValue !== c.newValue,
    );
    if (changes.length === 0) continue;
    totalChanges += changes.length;
    digestListings.push({ listingId, label: entry.label, changes });
  }

  return { totalChanges, listings: digestListings };
}

function fmtPrice(value: string | null): string {
  if (value == null) return "—";
  const n = Number(value);
  if (!Number.isFinite(n)) return value;
  return `$${n.toLocaleString("en-US")}/mo`;
}

function fieldLabel(field: string): string {
  if (field === "safetyScore") return "Safety";
  if (field === "price") return "Price";
  if (field === "availability") return "Availability";
  return field;
}

function fmtChange(c: DigestChange): string {
  if (c.field === "price") {
    return `${fmtPrice(c.oldValue)} → ${fmtPrice(c.newValue)}`;
  }
  return `${c.oldValue ?? "—"} → ${c.newValue ?? "—"}`;
}

const MAX_ISSUES_IN_MESSAGE = 15;

// Plain-text summary shared across channels (Telegram and WhatsApp both render
// plain text fine). Includes the change digest plus a scrape-health section
// flagging listings that failed to refresh. appUrl, when set, links back.
export function formatDigestText(
  digest: DailyDigest,
  issues: HealthIssue[],
  appUrl?: string | null,
): string {
  const lines: string[] = [
    `🏠 Apartment Hunt — ${digest.totalChanges} change${
      digest.totalChanges === 1 ? "" : "s"
    } in the last ${DIGEST_WINDOW_HOURS}h`,
    "",
  ];

  const shown = digest.listings.slice(0, MAX_LISTINGS_IN_MESSAGE);
  for (const l of shown) {
    lines.push(`📍 ${l.label}`);
    for (const c of l.changes) {
      lines.push(`   • ${fieldLabel(c.field)}: ${fmtChange(c)}`);
    }
  }

  const overflow = digest.listings.length - shown.length;
  if (overflow > 0) {
    lines.push("", `…and ${overflow} more listing${overflow === 1 ? "" : "s"}`);
  }

  if (issues.length > 0) {
    lines.push(
      "",
      `⚠️ ${issues.length} listing${
        issues.length === 1 ? "" : "s"
      } failed to refresh:`,
    );
    for (const i of issues.slice(0, MAX_ISSUES_IN_MESSAGE)) {
      lines.push(`   • ${i.label}: ${i.error}`);
    }
    const issueOverflow = issues.length - MAX_ISSUES_IN_MESSAGE;
    if (issueOverflow > 0) {
      lines.push(`   …and ${issueOverflow} more`);
    }
  }

  if (appUrl) {
    lines.push("", `See details: ${appUrl.replace(/\/$/, "")}`);
  }

  return lines.join("\n");
}
