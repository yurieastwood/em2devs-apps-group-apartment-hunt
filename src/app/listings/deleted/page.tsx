import Link from "next/link";
import { redirect } from "next/navigation";
import { and, desc, eq, inArray } from "drizzle-orm";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db/client";
import { listingPhotos, listings } from "@/db/schema";
import { isOrgAdmin } from "@/lib/auth/roles";
import { deletedListingScope } from "@/lib/listings/access";
import { urlFor } from "@/lib/storage/r2";
import { TrashRow } from "./trash-row";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function DeletedListingsPage() {
  const { userId, orgId } = await auth();
  if (!userId) redirect("/sign-in");
  if (!(await isOrgAdmin())) redirect("/");

  const scope = deletedListingScope({ userId, orgId });
  if (!scope) redirect("/");

  const rows = await db
    .select()
    .from(listings)
    .where(scope)
    .orderBy(desc(listings.deletedAt));

  const ids = rows.map((r) => r.id);
  const coverRows =
    ids.length === 0
      ? []
      : await db
          .select({
            listingId: listingPhotos.listingId,
            r2Key: listingPhotos.r2Key,
          })
          .from(listingPhotos)
          .where(
            and(
              eq(listingPhotos.sortOrder, 0),
              inArray(listingPhotos.listingId, ids),
            ),
          );
  const coverByListing = new Map(coverRows.map((c) => [c.listingId, c.r2Key]));

  const items = await Promise.all(
    rows.map(async (r) => ({
      listingId: r.id,
      title: r.title ?? r.address ?? "Untitled listing",
      address: r.address,
      bedrooms: r.bedrooms,
      bathrooms: r.bathrooms,
      priceUsd: r.priceUsd,
      neighborhood: r.neighborhood,
      deletedAt: (r.deletedAt as Date).toISOString(),
      coverUrl: coverByListing.has(r.id)
        ? await urlFor(coverByListing.get(r.id) as string)
        : null,
    })),
  );

  return (
    <main className="flex-1 max-w-4xl mx-auto p-8 w-full">
      <div className="mb-6 flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold">Deleted listings</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Soft-deleted entries — still updated by the daily refresh and
            on-demand actions. Restore to bring back, or delete forever to
            purge photos and audit history.
          </p>
        </div>
        <Link href="/" className="text-sm text-muted-foreground hover:underline">
          ← Back to listings
        </Link>
      </div>

      {items.length === 0 ? (
        <p className="text-muted-foreground">Trash is empty.</p>
      ) : (
        <ul className="border border-border rounded divide-y divide-border">
          {items.map((it) => (
            <TrashRow key={it.listingId} {...it} />
          ))}
        </ul>
      )}
    </main>
  );
}
