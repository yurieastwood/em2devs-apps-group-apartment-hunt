import { asc, eq } from "drizzle-orm";
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
import { ListingUnitsSection } from "@/components/listing-units-section";
import { getPois } from "@/lib/points-of-interest";

import { ListingLabelsSection } from "@/components/listing-labels";
import { isOrgAdmin } from "@/lib/auth/roles";
import { userCanAccessListing } from "@/lib/listings/access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = Promise<{ id: string }>;
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
        {listing.neighborhood ? (
          <p className="text-sm text-muted-foreground mt-1">
            📍 {listing.neighborhood}
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

      <ListingPoiDistances listingId={listing.id} />

      <NearbySchools listingId={listing.id} />

      <ListingChangesLog listingId={listing.id} />

      <CommentsSection listingId={listing.id} />
    </main>
  );
}
