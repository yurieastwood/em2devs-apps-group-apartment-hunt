import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { listingPhotos, listings } from "@/db/schema";
import { urlFor } from "@/lib/storage/r2";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function fmtPrice(n: number | null): string | null {
  return n == null ? null : `$${n.toLocaleString("en-US")}/mo`;
}

export default async function HomePage() {
  const allListings = await db
    .select()
    .from(listings)
    .orderBy(desc(listings.createdAt));

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

  const cards = await Promise.all(
    allListings.map(async (l) => ({
      listing: l,
      coverUrl: coverMap.has(l.id)
        ? await urlFor(coverMap.get(l.id) as string)
        : null,
    })),
  );

  return (
    <main className="flex-1 max-w-5xl mx-auto p-8 w-full">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold">Listings</h1>
        <Link
          href="/listings/new"
          className="bg-primary hover:opacity-90 text-primary-foreground px-4 py-2 rounded text-sm"
        >
          Add a listing
        </Link>
      </div>

      {cards.length === 0 ? (
        <p className="text-muted-foreground">
          No listings yet.{" "}
          <Link href="/listings/new" className="text-primary underline">
            Add the first one
          </Link>
          .
        </p>
      ) : (
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
      )}
    </main>
  );
}
