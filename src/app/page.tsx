import Link from "next/link";
import { cookies } from "next/headers";
import { and, desc, eq, inArray } from "drizzle-orm";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db/client";
import {
  listingPhotos,
  listingPoiDistances,
  listingSchools,
  listings,
} from "@/db/schema";
import type { Label, Listing } from "@/db/schema";
import { urlFor } from "@/lib/storage/r2";
import { VIEW_MODE_COOKIE, type ViewMode } from "@/lib/view-mode";
import { getUserHome } from "@/lib/user-settings";
import { getUserPois } from "@/lib/points-of-interest";
import { listingScope } from "@/lib/listings/access";
import {
  getLabelsForListings,
  listLabelsInScope,
} from "@/lib/listings/labels";
import { ViewModeToggle } from "@/components/view-mode-toggle";
import { HomeMap, type HomeMapProps } from "@/components/home-map";
import { HomeSettingsForm } from "@/components/home-settings-form";
import { PoisSection } from "@/components/pois-section";
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

// Per listing, find the nearest school whose grade range covers PK and
// return its GreatSchools rating. Ties broken by the school's stored
// sort_order (parsers preserve source-page order, which is itself a
// distance-ordered list for sites that don't expose a numeric distance).
function buildNearestPkRatingMap(
  schoolRows: {
    listingId: string;
    gradeRange: string | null;
    rating: number | null;
    distanceMiles: string | null;
    sortOrder: number;
  }[],
): Map<string, number> {
  type Entry = { distance: number; sortOrder: number; rating: number };
  const closest = new Map<string, Entry>();
  for (const s of schoolRows) {
    if (s.rating == null) continue;
    if (!s.gradeRange) continue;
    if (!s.gradeRange.toUpperCase().startsWith("PK")) continue;
    const parsed = s.distanceMiles ? parseFloat(s.distanceMiles) : NaN;
    const distance = Number.isFinite(parsed)
      ? parsed
      : Number.POSITIVE_INFINITY;
    const cur = closest.get(s.listingId);
    if (
      !cur ||
      distance < cur.distance ||
      (distance === cur.distance && s.sortOrder < cur.sortOrder)
    ) {
      closest.set(s.listingId, {
        distance,
        sortOrder: s.sortOrder,
        rating: s.rating,
      });
    }
  }
  const out = new Map<string, number>();
  for (const [listingId, entry] of closest) out.set(listingId, entry.rating);
  return out;
}

export default async function HomePage() {
  const { userId, orgId } = await auth();
  const viewMode = await getViewMode();

  const scope = listingScope({ userId, orgId });

  const [allListings, userHome, userPois, scopeLabels] = await Promise.all([
    scope
      ? db.select().from(listings).where(scope).orderBy(desc(listings.createdAt))
      : Promise.resolve([]),
    userId ? getUserHome(userId) : Promise.resolve(null),
    userId ? getUserPois(userId) : Promise.resolve([]),
    userId ? listLabelsInScope({ userId, orgId }) : Promise.resolve([]),
  ]);

  const ids = allListings.map((l) => l.id);

  const [coverRows, schoolRows, distanceRows] =
    ids.length === 0
      ? [[], [], []]
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
              distanceMiles: listingSchools.distanceMiles,
              sortOrder: listingSchools.sortOrder,
            })
            .from(listingSchools)
            .where(inArray(listingSchools.listingId, ids)),
          userPois.length > 0
            ? db
                .select({
                  listingId: listingPoiDistances.listingId,
                  poiId: listingPoiDistances.poiId,
                  durationSeconds: listingPoiDistances.durationSeconds,
                  distanceMeters: listingPoiDistances.distanceMeters,
                })
                .from(listingPoiDistances)
                .where(
                  and(
                    inArray(listingPoiDistances.listingId, ids),
                    inArray(
                      listingPoiDistances.poiId,
                      userPois.map((p) => p.id),
                    ),
                  ),
                )
            : Promise.resolve([]),
        ]);

  const coverMap = new Map(coverRows.map((r) => [r.listingId, r.r2Key]));
  const nearestPkRatingMap = buildNearestPkRatingMap(schoolRows);
  const labelsByListing: Map<string, Label[]> =
    ids.length === 0 ? new Map() : await getLabelsForListings(ids);

  const poiLabelMap = new Map(userPois.map((p) => [p.id, p.label]));
  const distMap = new Map<
    string,
    Array<{
      poiId: string;
      label: string;
      durationSeconds: number | null;
      distanceMeters: number | null;
    }>
  >();
  for (const r of distanceRows) {
    const arr = distMap.get(r.listingId) ?? [];
    arr.push({
      poiId: r.poiId,
      label: poiLabelMap.get(r.poiId) ?? "POI",
      durationSeconds: r.durationSeconds,
      distanceMeters: r.distanceMeters,
    });
    distMap.set(r.listingId, arr);
  }

  const items: HomeListingItem[] = await Promise.all(
    allListings.map(async (l) => ({
      id: l.id,
      title: l.title,
      address: l.address,
      bedrooms: l.bedrooms,
      bathrooms: l.bathrooms,
      squareFeet: l.squareFeet,
      priceUsd: l.priceUsd,
      nearestPkRating: nearestPkRatingMap.get(l.id) ?? null,
      poiDistances: distMap.get(l.id) ?? [],
      labels: (labelsByListing.get(l.id) ?? []).map((lbl) => ({
        id: lbl.id,
        name: lbl.name,
        color: lbl.color,
      })),
      coverUrl: coverMap.has(l.id)
        ? await urlFor(coverMap.get(l.id) as string)
        : null,
      isOwner: !!userId && l.ownerClerkUserId === userId,
      createdAt: l.createdAt.toISOString(),
    })),
  );

  const mapData = buildMapData(userHome, allListings);
  const poiPins: HomeMapProps["pois"] = userPois.map((p) => ({
    id: p.id,
    lat: parseFloat(p.lat),
    lng: parseFloat(p.lng),
    label: p.label,
    address: p.address,
  }));

  return (
    <main className="flex-1 max-w-5xl mx-auto p-8 w-full">
      <section className="mb-8">
        <HomeSettingsForm
          key={userHome?.homeAddress ?? "no-home"}
          currentAddress={userHome?.homeAddress ?? null}
        />
        <PoisSection />
        <HomeMap home={mapData.home} pins={mapData.pins} pois={poiPins} />
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
        <ListingsBrowser
          listings={items}
          viewMode={viewMode}
          scopeLabels={scopeLabels.map((l) => ({
            id: l.id,
            name: l.name,
            color: l.color,
          }))}
        />
      )}
    </main>
  );
}
