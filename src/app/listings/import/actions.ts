"use server";

import { auth } from "@clerk/nextjs/server";
import {
  createListingFromUrl,
  type CreateListingError,
} from "@/lib/listings/create-listing-from-url";

export type ImportResult =
  | { ok: true; id: string }
  | { ok: false; reason: string };

function reasonFor(err: CreateListingError): string {
  switch (err.kind) {
    case "invalid_url":
      return "Invalid URL";
    case "unsupported_host":
      return `Host not supported: ${err.host}`;
    case "fetch_failed":
      return `Fetch failed (HTTP ${err.status})`;
    case "duplicate":
      return "Already added";
    case "unknown":
      return err.message;
  }
}

export async function importListingAction(
  url: string,
): Promise<ImportResult> {
  const { userId } = await auth();
  if (!userId) return { ok: false, reason: "Not signed in" };

  const result = await createListingFromUrl(url, userId);
  if (result.ok) return { ok: true, id: result.id };
  return { ok: false, reason: reasonFor(result.error) };
}
