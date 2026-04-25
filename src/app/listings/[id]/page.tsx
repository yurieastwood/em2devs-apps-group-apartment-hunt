import { asc, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db } from "@/db/client";
import { listingPhotos, listings } from "@/db/schema";
import { urlFor } from "@/lib/storage/r2";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = Promise<{ id: string }>;

function fmtPrice(n: number | null): string | null {
  return n == null ? null : `$${n.toLocaleString("en-US")}/mo`;
}

function fmtSqft(n: number | null): string | null {
  return n == null ? null : `${n.toLocaleString("en-US")} sq ft`;
}

export default async function ListingDetailPage({ params }: { params: Params }) {
  const { id } = await params;

  const [listing] = await db
    .select()
    .from(listings)
    .where(eq(listings.id, id))
    .limit(1);

  if (!listing) notFound();

  const photos = await db
    .select()
    .from(listingPhotos)
    .where(eq(listingPhotos.listingId, id))
    .orderBy(asc(listingPhotos.sortOrder));

  const photoUrls = await Promise.all(photos.map((p) => urlFor(p.r2Key)));

  return (
    <main className="flex-1 max-w-4xl mx-auto p-8 w-full">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold">
          {listing.title ?? listing.address ?? "Untitled listing"}
        </h1>
        {listing.address && listing.address !== listing.title ? (
          <p className="text-muted-foreground">{listing.address}</p>
        ) : null}
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

      {photos.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-6">
          {photos.map((photo, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={photo.id}
              src={photoUrls[i]}
              alt={`${listing.address ?? "Listing"} photo ${photo.sortOrder + 1}`}
              className="w-full h-64 object-cover rounded border border-border"
              loading="lazy"
            />
          ))}
        </div>
      ) : null}

      {listing.description ? (
        <section className="mb-6">
          <h2 className="text-lg font-medium mb-2">Description</h2>
          <p className="whitespace-pre-line text-sm">{listing.description}</p>
        </section>
      ) : null}

      <a
        href={listing.sourceUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-block text-primary hover:underline"
      >
        View original listing on {listing.sourceHost} →
      </a>
    </main>
  );
}
