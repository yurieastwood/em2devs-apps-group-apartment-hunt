import { and, asc, eq, isNull, sql } from "drizzle-orm";
import { notFound } from "next/navigation";
import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db/client";
import { listingPhotos, listings } from "@/db/schema";
import { urlFor } from "@/lib/storage/r2";
import { PhotoCarousel } from "@/components/photo-carousel";
import { DeleteListingButton } from "@/components/delete-listing-button";
import { CommentsSection } from "./comments-section";
import { ReactionsBar } from "./reactions-bar";
import { NearbySchools } from "./nearby-schools";
import { ListingPoiDistances } from "@/components/listing-poi-distances";
import { HomeMap } from "@/components/home-map";
import { PriorityEditor } from "@/components/priority-editor";
import { RefreshListingButton } from "@/components/refresh-listing-button";
import { ListingChangesLog } from "@/components/listing-changes-log";
import { ListingSafetySection } from "@/components/listing-safety-section";
import { ListingUnitsSection } from "@/components/listing-units-section";
import { getPois } from "@/lib/points-of-interest";

import { ListingLabelsSection } from "@/components/listing-labels";
import { isOrgAdmin } from "@/lib/auth/roles";
import { userCanAccessListing } from "@/lib/listings/access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = Promise<{ id: string }>;

function readSafetyRaw(breakdown: unknown): number | null {
  if (!breakdown || typeof breakdown !== "object") return null;
  const raw = (breakdown as { raw?: unknown }).raw;
  return typeof raw === "number" && Number.isFinite(raw) ? raw : null;
}

// Min-max library-relative score for a single listing. Mirrors the home
// page logic but queries the scope's min/max raw on its own. Returns null
// when the listing has no safety data; 50 when the listing is alone.
async function computeRelativeSafetyScore(
  breakdown: unknown,
  ctx: { userId: string | null; orgId: string | null | undefined },
): Promise<number | null> {
  const raw = readSafetyRaw(breakdown);
  if (raw == null) return null;
  if (!ctx.userId) return null;

  const scope = ctx.orgId
    ? eq(listings.orgId, ctx.orgId)
    : and(
        eq(listings.ownerClerkUserId, ctx.userId),
        isNull(listings.orgId),
      );

  const [stats] = await db
    .select({
      minRaw: sql<number | null>`min((safety_breakdown->>'raw')::numeric)`,
      maxRaw: sql<number | null>`max((safety_breakdown->>'raw')::numeric)`,
    })
    .from(listings)
    .where(
      and(scope!, isNull(listings.deletedAt), sql`safety_breakdown IS NOT NULL`),
    );

  const min = stats?.minRaw != null ? Number(stats.minRaw) : null;
  const max = stats?.maxRaw != null ? Number(stats.maxRaw) : null;
  if (min == null || max == null || max === min) return 50;
  const score = (100 * (max - raw)) / (max - min);
  return Math.round(Math.max(0, Math.min(100, score)));
}
type SearchParams = Promise<{ duplicate?: string }>;

function fmtPrice(n: number | null): string | null {
  return n == null ? null : `$${n.toLocaleString("en-US")}/mo`;
}

function fmtSqft(n: number | null): string | null {
  return n == null ? null : `${n.toLocaleString("en-US")} sq ft`;
}

function fmtLastChecked(d: Date | null): string {
  if (!d) return "Never checked";
  return `Last checked ${d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })}`;
}

function AvailabilityBadge({ value }: { value: string }) {
  if (value === "unavailable") {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-destructive/10 text-destructive border border-destructive/30 text-xs font-medium">
        Unavailable
      </span>
    );
  }
  if (value === "available") {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30 text-xs font-medium">
        Available
      </span>
    );
  }
  return null;
}

function PhotoErrorsSection({ raw }: { raw: unknown }) {
  if (!raw || typeof raw !== "object") return null;
  const errs = (raw as { photoErrors?: { url: string; reason: string }[] })
    .photoErrors;
  if (!Array.isArray(errs) || errs.length === 0) return null;
  return (
    <details className="mb-6 text-sm">
      <summary className="cursor-pointer text-destructive">
        {errs.length} photo{errs.length === 1 ? "" : "s"} couldn&apos;t be saved
      </summary>
      <ul className="mt-2 space-y-2 text-muted-foreground">
        {errs.map((e, i) => (
          <li key={i} className="break-all">
            <code className="font-mono">{e.url}</code>
            <br />→ {e.reason}
          </li>
        ))}
      </ul>
    </details>
  );
}

export default async function ListingDetailPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}) {
  const { id } = await params;
  const { duplicate } = await searchParams;
  const { userId, orgId } = await auth();

  const [listing] = await db
    .select()
    .from(listings)
    .where(eq(listings.id, id))
    .limit(1);

  if (!listing) notFound();
  if (!userCanAccessListing(listing, { userId, orgId })) notFound();

  const isOwner = userId === listing.ownerClerkUserId;
  const isAdmin = await isOrgAdmin();
  // Trashed listings are visible only to admins (so they can preview before
  // restoring or purging from the /listings/deleted page).
  if (listing.deletedAt && !isAdmin) notFound();
  const canEdit = isAdmin && !listing.deletedAt;
  const canDelete = !listing.deletedAt && (isAdmin || isOwner);

  const userPois = userId ? await getPois({ userId, orgId }) : [];

  const listingHasCoords = !!(listing.latitude && listing.longitude);

  const photos = await db
    .select()
    .from(listingPhotos)
    .where(eq(listingPhotos.listingId, id))
    .orderBy(asc(listingPhotos.sortOrder));

  const photoUrls = await Promise.all(photos.map((p) => urlFor(p.r2Key)));

  // Library-relative safety score — same min-max approach as the home page.
  // We need this listing's raw value plus the min/max raw across the user's
  // scope (org or personal). The result spans 0–100 across the library;
  // standalone (only one listing in scope) returns 50.
  const relativeSafetyScore = await computeRelativeSafetyScore(
    listing.safetyBreakdown,
    { userId, orgId },
  );

  return (
    <main className="flex-1 max-w-4xl mx-auto p-8 w-full">
      {duplicate === "1" ? (
        <div className="mb-4 rounded border border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400 p-3 text-sm">
          This listing was already in your library. You&apos;re looking at the
          existing entry.
        </div>
      ) : null}
      {listing.deletedAt ? (
        <div className="mb-4 rounded border border-destructive/40 bg-destructive/10 text-destructive p-3 text-sm flex items-center justify-between gap-3 flex-wrap">
          <span>
            <strong>In trash.</strong> Deleted{" "}
            {new Date(listing.deletedAt).toLocaleString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
              hour: "numeric",
              minute: "2-digit",
            })}
            . Restore from the{" "}
            <Link href="/listings/deleted" className="underline">
              Trash page
            </Link>
            .
          </span>
        </div>
      ) : null}
      <header className="mb-6">
        <h1 className="text-2xl font-semibold">
          {listing.title ?? listing.address ?? "Untitled listing"}
        </h1>
        {listing.address && listing.address !== listing.title ? (
          <p className="text-muted-foreground">{listing.address}</p>
        ) : null}
        {listing.neighborhood || listing.district ? (
          <p className="text-sm text-muted-foreground mt-1">
            📍{" "}
            {[listing.neighborhood, listing.district]
              .filter(Boolean)
              .join(" · ")}
          </p>
        ) : null}
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
          <span className="flex items-center gap-2">
            <span>Priority</span>
            <PriorityEditor
              key={`pri-${listing.id}-${listing.priority ?? "null"}`}
              listingId={listing.id}
              current={listing.priority}
            />
          </span>
          <AvailabilityBadge value={listing.availability} />
          <span className="text-xs">{fmtLastChecked(listing.lastCheckedAt)}</span>
          <RefreshListingButton listingId={listing.id} />
        </div>
      </header>

      <ul className="flex flex-wrap gap-x-6 gap-y-2 mb-6 text-sm text-muted-foreground">
        {listing.bedrooms ? (
          <li>
            <strong className="text-foreground">{listing.bedrooms}</strong> BR
          </li>
        ) : null}
        {listing.bathrooms ? (
          <li>
            <strong className="text-foreground">{listing.bathrooms}</strong> BA
          </li>
        ) : null}
        {listing.squareFeet ? <li>{fmtSqft(listing.squareFeet)}</li> : null}
        {listing.priceUsd ? (
          <li className="font-semibold text-foreground">
            {fmtPrice(listing.priceUsd)}
          </li>
        ) : null}
      </ul>

      <PhotoCarousel
        photos={photos.map((photo, i) => ({
          url: photoUrls[i],
          alt: `${listing.address ?? "Listing"} photo ${photo.sortOrder + 1}`,
        }))}
      />


      <PhotoErrorsSection raw={listing.raw} />

      {listingHasCoords ? (
        <section className="my-6 border-t border-border pt-6">
          <h2 className="text-lg font-semibold mb-3">Location</h2>
          <HomeMap
            home={null}
            pins={[
              {
                id: listing.id,
                lat: parseFloat(listing.latitude as string),
                lng: parseFloat(listing.longitude as string),
                label: listing.address ?? listing.title ?? "Listing",
              },
            ]}
            pois={userPois.map((p) => ({
              id: p.id,
              lat: parseFloat(p.lat),
              lng: parseFloat(p.lng),
              label: p.label,
              address: p.address,
              color: p.color,
            }))}
          />
        </section>
      ) : null}

      <ListingUnitsSection
        listingId={listing.id}
        units={listing.units}
        headlineBeds={listing.bedrooms != null ? parseFloat(listing.bedrooms) : null}
        headlineBaths={
          listing.bathrooms != null ? parseFloat(listing.bathrooms) : null
        }
        headlineSqft={listing.squareFeet}
        headlinePrice={listing.priceUsd}
      />

      {listing.description ? (
        <section className="mb-6">
          <h2 className="text-lg font-medium mb-2">Description</h2>
          <p className="whitespace-pre-line text-sm">{listing.description}</p>
        </section>
      ) : null}

      <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
        <a
          href={listing.sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary hover:underline"
        >
          View original listing on {listing.sourceHost} →
        </a>
        {canEdit ? (
          <Link
            href={`/listings/${listing.id}/edit`}
            className="text-sm text-muted-foreground hover:text-foreground hover:underline"
          >
            Edit
          </Link>
        ) : null}
        {canDelete ? (
          <DeleteListingButton listingId={listing.id} navigateTo="/" />
        ) : null}
      </div>

      <ListingLabelsSection listingId={listing.id} />

      <div className="mt-6">
        <ReactionsBar listingId={listing.id} />
      </div>

      <ListingPoiDistances
        listingId={listing.id}
        listingLat={listing.latitude ? parseFloat(listing.latitude) : null}
        listingLng={listing.longitude ? parseFloat(listing.longitude) : null}
      />

      <NearbySchools listingId={listing.id} />

      <ListingSafetySection
        score={relativeSafetyScore}
        breakdown={listing.safetyBreakdown}
      />

      <ListingChangesLog listingId={listing.id} />

      <CommentsSection listingId={listing.id} />
    </main>
  );
}
