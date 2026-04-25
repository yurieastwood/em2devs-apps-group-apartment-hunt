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

export type PhotoError = {
  url: string;
  reason: string;
};

export type RehostResult = {
  photos: RehostedPhoto[];
  errors: PhotoError[];
};

const EXT_BY_CONTENT_TYPE: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/gif": ".gif",
};

const FALLBACK_PROFILES = ["firefox147", "chrome145", "safari260"];
const PHOTO_CONCURRENCY = 4;

type Downloaded = { buffer: Buffer; contentType: string };
type DownloadResult =
  | { ok: true; data: Downloaded }
  | { ok: false; reason: string };

async function downloadPhoto(url: string): Promise<DownloadResult> {
  const tries: string[] = [];

  try {
    const res = await fetch(url);
    if (res.ok) {
      const buffer = Buffer.from(await res.arrayBuffer());
      const contentType =
        res.headers.get("content-type")?.split(";")[0]?.trim() ?? "image/jpeg";
      return { ok: true, data: { buffer, contentType } };
    }
    tries.push(`plain HTTP ${res.status}`);
  } catch (err) {
    tries.push(
      `plain error: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  let referer: string | undefined;
  try {
    referer = new URL(url).origin;
  } catch {
    // ignore
  }

  for (const profile of FALLBACK_PROFILES) {
    try {
      const res = await fetchUrlBinary(url, { profile, referer });
      if (res.status === 200) {
        return {
          ok: true,
          data: {
            buffer: res.buffer,
            contentType: res.contentType ?? "image/jpeg",
          },
        };
      }
      tries.push(`${profile} HTTP ${res.status}`);
    } catch (err) {
      tries.push(
        `${profile}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  return { ok: false, reason: tries.join(" | ") };
}

type RehostOneResult =
  | { ok: true; photo: RehostedPhoto }
  | { ok: false; url: string; reason: string };

async function rehostOne(
  listingId: string,
  photo: ListingPhoto,
  sortOrder: number,
): Promise<RehostOneResult> {
  const dl = await downloadPhoto(photo.url);
  if (!dl.ok) {
    return { ok: false, url: photo.url, reason: `download: ${dl.reason}` };
  }
  const ext = EXT_BY_CONTENT_TYPE[dl.data.contentType] ?? ".jpg";
  const key = `listings/${listingId}/${String(sortOrder).padStart(3, "0")}${ext}`;
  try {
    await putObject(key, dl.data.buffer, dl.data.contentType);
  } catch (err) {
    return {
      ok: false,
      url: photo.url,
      reason: `r2 put: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
  return {
    ok: true,
    photo: {
      sortOrder,
      r2Key: key,
      contentType: dl.data.contentType,
      originalUrl: photo.url,
      width: photo.width,
      height: photo.height,
    },
  };
}

export async function rehostListingPhotos(
  listingId: string,
  photos: ListingPhoto[],
): Promise<RehostResult> {
  const successes: RehostedPhoto[] = [];
  const errors: PhotoError[] = [];

  for (let i = 0; i < photos.length; i += PHOTO_CONCURRENCY) {
    const batch = photos.slice(i, i + PHOTO_CONCURRENCY);
    const results = await Promise.all(
      batch.map((p, j) => rehostOne(listingId, p, i + j)),
    );
    for (const result of results) {
      if (result.ok) successes.push(result.photo);
      else errors.push({ url: result.url, reason: result.reason });
    }
  }

  return { photos: successes, errors };
}
