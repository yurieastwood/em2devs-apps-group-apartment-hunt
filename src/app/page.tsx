import Link from "next/link";
import { cookies } from "next/headers";
import { desc, eq, inArray } from "drizzle-orm";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db/client";
import { listingPhotos, listingSchools, listings } from "@/db/schema";
import type { Listing } from "@/db/schema";
import { urlFor } from "@/lib/storage/r2";
import { VIEW_MODE_COOKIE, type ViewMode } from "@/lib/view-mode";
import { getUserHome } from "@/lib/user-settings";
import { ViewModeToggle } from "@/components/view-mode-toggle";
import { HomeMap, type HomeMapProps } from "@/components/home-map";
import { HomeSettingsForm } from "@/components/home-settings-form";
import {
  ListingsBrowser,
  type HomeListingItem,
} from "@/components/listings-browser";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function getViewMode(): Promise<ViewMode> {
  const c = await cookies();
  return c.get(VIEW_MODE_COOKIE)?.value === "list" ? "list" : "cards";
}

function buildMapData(
  home: {
    homeLat: string | null;
    homeLng: string | null;
    homeAddress: string | null;
  } | null,
  rows: Listing[],
): HomeMapProps {
  const homePin =
    home?.homeLat && home.homeLng && home.homeAddress
      ? {
          lat: parseFloat(home.homeLat),
          lng: parseFloat(home.homeLng),
          label: home.homeAddress,
        }
      : null;

  const pins = rows
    .filter((l) => l.latitude && l.longitude)
    .map((l) => ({
      id: l.id,
      lat: parseFloat(l.latitude as string),
      lng: parseFloat(l.longitude as string),
      label: l.address ?? l.title ?? "Listing",
      href: `/listings/${l.id}`,
    }));

  return { home: homePin, pins };
}

function buildBestPkRatingMap(
  schoolRows: { listingId: string; gradeRange: string | null; rating: number | null }[],
): Map<string, number> {
  const best = new Map<string, number>();
  for (const s of schoolRows) {
    if (s.rating == null) continue;
    if (!s.gradeRange) continue;
    if (!s.gradeRange.toUpperCase().startsWith("PK")) continue;
    const cur = best.get(s.listingId);
    if (cur == null || s.rating > cur) best.set(s.listingId, s.rating);
  }
  return best;
}

export default async function HomePage() {
  const { userId } = await auth();
  const viewMode = await getViewMode();

  const [allListings, userHome] = await Promise.all([
    db.select().from(listings).orderBy(desc(listings.createdAt)),
    userId ? getUserHome(userId) : Promise.resolve(null),
  ]);

  const ids = allListings.map((l) => l.id);

  const [coverRows, schoolRows] =
    ids.length === 0
      ? [[], []]
      : await Promise.all([
          db
            .select({
              listingId: listingPhotos.listingId,
              r2Key: listingPhotos.r2Key,
            })
            .from(listingPhotos)
            .where(eq(listingPhotos.sortOrder, 0)),
          db
            .select({
              listingId: listingSchools.listingId,
              gradeRange: listingSchools.gradeRange,
              rating: listingSchools.rating,
            })
            .from(listingSchools)
            .where(inArray(listingSchools.listingId, ids)),
        ]);

  const coverMap = new Map(coverRows.map((r) => [r.listingId, r.r2Key]));
  const bestPkRatingMap = buildBestPkRatingMap(schoolRows);

  const items: HomeListingItem[] = await Promise.all(
    allListings.map(async (l) => ({
      id: l.id,
      title: l.title,
      address: l.address,
      bedrooms: l.bedrooms,
      bathrooms: l.bathrooms,
      priceUsd: l.priceUsd,
      bestPkRating: bestPkRatingMap.get(l.id) ?? null,
      coverUrl: coverMap.has(l.id)
        ? await urlFor(coverMap.get(l.id) as string)
        : null,
      isOwner: !!userId && l.ownerClerkUserId === userId,
      createdAt: l.createdAt.toISOString(),
    })),
  );

  const mapData = buildMapData(userHome, allListings);

  return (
    <main className="flex-1 max-w-5xl mx-auto p-8 w-full">
      <section className="mb-8">
        <HomeSettingsForm
          key={userHome?.homeAddress ?? "no-home"}
          currentAddress={userHome?.homeAddress ?? null}
        />
        <HomeMap home={mapData.home} pins={mapData.pins} />
      </section>

      <div className="flex items-center justify-between mb-6 gap-3 flex-wrap">
        <h1 className="text-2xl font-semibold">Listings</h1>
        <div className="flex items-center gap-3">
          <ViewModeToggle current={viewMode} />
          <Link
            href="/listings/new"
            className="bg-primary hover:opacity-90 text-primary-foreground px-4 py-2 rounded text-sm"
          >
            Add a listing
          </Link>
        </div>
      </div>

      {items.length === 0 ? (
        <p className="text-muted-foreground">
          No listings yet.{" "}
          <Link href="/listings/new" className="text-primary underline">
            Add the first one
          </Link>
          .
        </p>
      ) : (
        <ListingsBrowser listings={items} viewMode={viewMode} />
      )}
    </main>
  );
}
