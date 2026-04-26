import Link from "next/link";
import { cookies } from "next/headers";
import { desc, eq } from "drizzle-orm";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db/client";
import { listingPhotos, listings } from "@/db/schema";
import type { Listing } from "@/db/schema";
import { urlFor } from "@/lib/storage/r2";
import { VIEW_MODE_COOKIE, type ViewMode } from "@/lib/view-mode";
import { SHOW_SCHOOLS_COOKIE } from "@/lib/show-schools";
import { getUserHome } from "@/lib/user-settings";
import { fetchPreschoolsAround } from "@/lib/places/overpass";
import { ViewModeToggle } from "@/components/view-mode-toggle";
import { ListingListRow } from "@/components/listing-list-row";
import { HomeMap, type HomeMapProps } from "@/components/home-map";
import { HomeSettingsForm } from "@/components/home-settings-form";
import { ShowSchoolsToggle } from "@/components/show-schools-toggle";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Card = {
  listing: Listing;
  coverUrl: string | null;
};

function fmtPrice(n: number | null): string | null {
  return n == null ? null : `$${n.toLocaleString("en-US")}/mo`;
}

async function getViewMode(): Promise<ViewMode> {
  const c = await cookies();
  return c.get(VIEW_MODE_COOKIE)?.value === "list" ? "list" : "cards";
}

async function getShowSchools(): Promise<boolean> {
  const c = await cookies();
  return c.get(SHOW_SCHOOLS_COOKIE)?.value === "true";
}

function pickSchoolSearchCenter(
  home: HomeMapProps["home"],
  pins: HomeMapProps["pins"],
): { lat: number; lng: number } | null {
  if (home) return { lat: home.lat, lng: home.lng };
  if (pins.length === 0) return null;
  const sumLat = pins.reduce((s, p) => s + p.lat, 0);
  const sumLng = pins.reduce((s, p) => s + p.lng, 0);
  return { lat: sumLat / pins.length, lng: sumLng / pins.length };
}

function buildMapData(
  home: { homeLat: string | null; homeLng: string | null; homeAddress: string | null } | null,
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

export default async function HomePage() {
  const { userId } = await auth();
  const viewMode = await getViewMode();
  const showSchools = await getShowSchools();

  const [allListings, userHome] = await Promise.all([
    db.select().from(listings).orderBy(desc(listings.createdAt)),
    userId ? getUserHome(userId) : Promise.resolve(null),
  ]);

  const coverRows =
    allListings.length === 0
      ? []
      : await db
          .select({
            listingId: listingPhotos.listingId,
            r2Key: listingPhotos.r2Key,
          })
          .from(listingPhotos)
          .where(eq(listingPhotos.sortOrder, 0));

  const coverMap = new Map(coverRows.map((r) => [r.listingId, r.r2Key]));

  const cards: Card[] = await Promise.all(
    allListings.map(async (l) => ({
      listing: l,
      coverUrl: coverMap.has(l.id)
        ? await urlFor(coverMap.get(l.id) as string)
        : null,
    })),
  );

  const mapData = buildMapData(userHome, allListings);

  let schools: HomeMapProps["schools"] = [];
  if (showSchools) {
    const center = pickSchoolSearchCenter(mapData.home, mapData.pins);
    if (center) {
      const found = await fetchPreschoolsAround(center.lat, center.lng, 5000);
      schools = found.map((s) => ({
        id: s.id,
        lat: s.lat,
        lng: s.lng,
        name: s.name,
        address: s.address,
      }));
    }
  }

  return (
    <main className="flex-1 max-w-5xl mx-auto p-8 w-full">
      <section className="mb-8">
        <HomeSettingsForm
          key={userHome?.homeAddress ?? "no-home"}
          currentAddress={userHome?.homeAddress ?? null}
        />
        <HomeMap
          home={mapData.home}
          pins={mapData.pins}
          schools={schools}
        />
        <div className="flex items-center gap-3 mt-2">
          <ShowSchoolsToggle enabled={showSchools} />
          {showSchools && schools && schools.length > 0 ? (
            <span className="text-xs text-muted-foreground">
              {schools.length} pre-K school{schools.length === 1 ? "" : "s"} within 5 km
            </span>
          ) : null}
        </div>
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

      {cards.length === 0 ? (
        <p className="text-muted-foreground">
          No listings yet.{" "}
          <Link href="/listings/new" className="text-primary underline">
            Add the first one
          </Link>
          .
        </p>
      ) : viewMode === "cards" ? (
        <CardsView cards={cards} />
      ) : (
        <ListView cards={cards} />
      )}
    </main>
  );
}

function CardsView({ cards }: { cards: Card[] }) {
  return (
    <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {cards.map(({ listing, coverUrl }) => (
        <li key={listing.id}>
          <Link
            href={`/listings/${listing.id}`}
            className="block rounded-lg overflow-hidden border border-border bg-muted hover:opacity-95 transition"
          >
            <div className="aspect-[4/3] bg-muted">
              {coverUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={coverUrl}
                  alt={listing.address ?? "Listing"}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-muted-foreground text-sm">
                  No photo
                </div>
              )}
            </div>
            <div className="p-4">
              <p className="font-medium line-clamp-1">
                {listing.address ?? "Unknown address"}
              </p>
              <p className="text-sm text-muted-foreground mt-1 flex flex-wrap gap-x-3">
                {listing.bedrooms ? <span>{listing.bedrooms} BR</span> : null}
                {listing.bathrooms ? (
                  <span>{listing.bathrooms} BA</span>
                ) : null}
                {listing.priceUsd ? (
                  <span className="font-semibold text-foreground">
                    {fmtPrice(listing.priceUsd)}
                  </span>
                ) : null}
              </p>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}

function ListView({ cards }: { cards: Card[] }) {
  return (
    <ul className="border border-border rounded divide-y divide-border">
      {cards.map(({ listing, coverUrl }) => (
        <ListingListRow
          key={listing.id}
          listingId={listing.id}
          address={listing.address ?? listing.title ?? "Unknown address"}
          bedrooms={listing.bedrooms}
          bathrooms={listing.bathrooms}
          priceUsd={listing.priceUsd}
          coverUrl={coverUrl}
        />
      ))}
    </ul>
  );
}
