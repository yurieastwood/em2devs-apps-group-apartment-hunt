import sharp from "sharp";
import { putObject } from "../storage/r2";
import type { listingPhotos } from "@/db/schema";

// Shared image pipeline for listing photos (manual upload + add-from-URL):
// auto-orient from EXIF, resize + re-encode to WebP, generate a small
// thumbnail, store both in R2, and return the listing_photos row data.
// sharp lives ONLY in this module so render routes never pull it in.

const MAX_DIMENSION = 1600;
const THUMB_DIMENSION = 500;
const MAIN_QUALITY = 80;
const THUMB_QUALITY = 70;

export const ALLOWED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);
export const MAX_PHOTO_BYTES = 15 * 1024 * 1024;

export async function storeOptimizedImage(
  listingId: string,
  sortOrder: number,
  input: Buffer,
  originalUrl: string,
): Promise<typeof listingPhotos.$inferInsert | null> {
  const prefix = `listings/${listingId}/${String(sortOrder).padStart(3, "0")}`;
  const key = `${prefix}.webp`;
  const thumbKey = `${prefix}_thumb.webp`;
  try {
    const base = sharp(input).rotate(); // bake EXIF orientation before strip
    const { data: main, info } = await base
      .clone()
      .resize(MAX_DIMENSION, MAX_DIMENSION, {
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality: MAIN_QUALITY })
      .toBuffer({ resolveWithObject: true });
    const thumb = await base
      .clone()
      .resize(THUMB_DIMENSION, THUMB_DIMENSION, {
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality: THUMB_QUALITY })
      .toBuffer();

    await putObject(key, main, "image/webp");
    await putObject(thumbKey, thumb, "image/webp");

    return {
      listingId,
      sortOrder,
      r2Key: key,
      thumbR2Key: thumbKey,
      originalUrl,
      contentType: "image/webp",
      width: info.width ?? null,
      height: info.height ?? null,
    };
  } catch {
    return null; // corrupt/non-image input — caller skips it
  }
}
