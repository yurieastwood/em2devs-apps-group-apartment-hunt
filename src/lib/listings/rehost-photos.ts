import { fetchUrlBinary } from "../extract/fetch-listing";
import { putObject } from "../storage/r2";
import type { ListingPhoto } from "../extract/types";

export type RehostedPhoto = {
  sortOrder: number;
  r2Key: string;
  contentType: string;
  originalUrl: string;
  width?: number;
  height?: number;
};

const EXT_BY_CONTENT_TYPE: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/gif": ".gif",
};

// Some image CDNs (e.g. Akamai-fronted images1.apartments.com) reject plain
// requests from datacenter IPs and only accept TLS-impersonated traffic.
// Try plain fetch first for speed, then fall back to a small set of
// curl-impersonate profiles we've seen pass.
const FALLBACK_PROFILES = ["firefox147", "chrome145", "safari260"];

const PHOTO_CONCURRENCY = 4;

type Downloaded = { buffer: Buffer; contentType: string };

async function downloadPhoto(url: string): Promise<Downloaded | null> {
  try {
    const res = await fetch(url);
    if (res.ok) {
      const buffer = Buffer.from(await res.arrayBuffer());
      const contentType =
        res.headers.get("content-type")?.split(";")[0]?.trim() ?? "image/jpeg";
      return { buffer, contentType };
    }
  } catch {
    // fall through
  }

  const referer = (() => {
    try {
      return new URL(url).origin;
    } catch {
      return undefined;
    }
  })();

  for (const profile of FALLBACK_PROFILES) {
    try {
      const res = await fetchUrlBinary(url, { profile, referer });
      if (res.status === 200) {
        return {
          buffer: res.buffer,
          contentType: res.contentType ?? "image/jpeg",
        };
      }
    } catch {
      // try next
    }
  }

  return null;
}

async function rehostOne(
  listingId: string,
  photo: ListingPhoto,
  sortOrder: number,
): Promise<RehostedPhoto | null> {
  try {
    const dl = await downloadPhoto(photo.url);
    if (!dl) return null;
    const ext = EXT_BY_CONTENT_TYPE[dl.contentType] ?? ".jpg";
    const key = `listings/${listingId}/${String(sortOrder).padStart(3, "0")}${ext}`;
    await putObject(key, dl.buffer, dl.contentType);
    return {
      sortOrder,
      r2Key: key,
      contentType: dl.contentType,
      originalUrl: photo.url,
      width: photo.width,
      height: photo.height,
    };
  } catch (err) {
    console.error(`photo rehost failed for ${photo.url}:`, err);
    return null;
  }
}

export async function rehostListingPhotos(
  listingId: string,
  photos: ListingPhoto[],
): Promise<RehostedPhoto[]> {
  const out: RehostedPhoto[] = [];
  for (let i = 0; i < photos.length; i += PHOTO_CONCURRENCY) {
    const batch = photos.slice(i, i + PHOTO_CONCURRENCY);
    const results = await Promise.all(
      batch.map((p, j) => rehostOne(listingId, p, i + j)),
    );
    for (const r of results) if (r) out.push(r);
  }
  return out;
}
