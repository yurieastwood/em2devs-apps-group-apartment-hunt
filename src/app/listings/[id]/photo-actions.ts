"use server";

import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { eq, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { listingPhotos, listings } from "@/db/schema";
import { isOrgAdmin } from "@/lib/auth/roles";
import { userCanAccessListing } from "@/lib/listings/access";
import {
  storeOptimizedImage,
  ALLOWED_IMAGE_TYPES,
  MAX_PHOTO_BYTES,
} from "@/lib/listings/photo-store";
import { downloadPhoto } from "@/lib/listings/rehost-photos";

const MAX_ADD = 24;

export type AddPhotosState =
  | { status: "idle" }
  | { status: "done"; added: number; failed: number }
  | { status: "error"; message: string };

function parseUrls(raw: unknown): string[] {
  if (typeof raw !== "string") return [];
  return raw
    .split(/[\s,]+/)
    .map((s) => s.trim())
    .filter((s) => /^https?:\/\//i.test(s));
}

export async function addListingPhotosAction(
  listingId: string,
  _prev: AddPhotosState,
  formData: FormData,
): Promise<AddPhotosState> {
  const { userId, orgId } = await auth();
  if (!userId) return { status: "error", message: "You're not signed in." };

  const [listing] = await db
    .select({
      id: listings.id,
      orgId: listings.orgId,
      ownerClerkUserId: listings.ownerClerkUserId,
      deletedAt: listings.deletedAt,
    })
    .from(listings)
    .where(eq(listings.id, listingId))
    .limit(1);

  if (!listing || !userCanAccessListing(listing, { userId, orgId })) {
    return { status: "error", message: "Listing not found." };
  }
  if (listing.deletedAt) {
    return { status: "error", message: "Can't add photos to a trashed listing." };
  }
  const isOwner = listing.ownerClerkUserId === userId;
  if (!isOwner && !(await isOrgAdmin())) {
    return { status: "error", message: "Admins only." };
  }

  const files = formData
    .getAll("photos")
    .filter((f): f is File => f instanceof File && f.size > 0);
  const urls = parseUrls(formData.get("urls"));

  if (files.length === 0 && urls.length === 0) {
    return { status: "error", message: "Add a photo file or an image URL." };
  }

  // Append after existing photos.
  const [{ maxOrder }] = await db
    .select({
      maxOrder: sql<number | null>`max(${listingPhotos.sortOrder})`,
    })
    .from(listingPhotos)
    .where(eq(listingPhotos.listingId, listingId));
  let sortOrder = (maxOrder ?? -1) + 1;

  const rows: (typeof listingPhotos.$inferInsert)[] = [];
  let failed = 0;
  let processed = 0;

  for (const file of files) {
    if (processed >= MAX_ADD) break;
    processed += 1;
    const contentType = file.type.split(";")[0]?.trim().toLowerCase() ?? "";
    if (!ALLOWED_IMAGE_TYPES.has(contentType) || file.size > MAX_PHOTO_BYTES) {
      failed += 1;
      continue;
    }
    const buffer = Buffer.from(await file.arrayBuffer());
    const row = await storeOptimizedImage(
      listingId,
      sortOrder,
      buffer,
      `upload://${file.name || `photo-${sortOrder}`}`,
    );
    if (row) {
      rows.push(row);
      sortOrder += 1;
    } else {
      failed += 1;
    }
  }

  for (const url of urls) {
    if (processed >= MAX_ADD) break;
    processed += 1;
    const dl = await downloadPhoto(url);
    if (!dl.ok) {
      failed += 1;
      continue;
    }
    const row = await storeOptimizedImage(listingId, sortOrder, dl.data.buffer, url);
    if (row) {
      rows.push(row);
      sortOrder += 1;
    } else {
      failed += 1;
    }
  }

  if (rows.length > 0) {
    await db.insert(listingPhotos).values(rows);
    revalidatePath(`/listings/${listingId}`);
    revalidatePath("/");
  }

  return { status: "done", added: rows.length, failed };
}
