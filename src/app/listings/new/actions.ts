"use server";

import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import {
  createListingFromUrl,
  type CreateListingError,
} from "@/lib/listings/create-listing-from-url";

export type ActionState = { kind: "idle" } | { kind: "error"; message: string };

function messageFor(err: CreateListingError): string {
  switch (err.kind) {
    case "invalid_url":
      return "That doesn't look like a valid URL.";
    case "unsupported_host":
      return `We don't support ${err.host} yet — try Zillow, Apartments.com, or ApartmentList.com.`;
    case "fetch_failed":
      return `Could not fetch the listing (HTTP ${err.status}). The site may have updated its bot detection — try again later.`;
    case "duplicate":
      return "This listing was already added.";
    case "unknown":
      return err.message;
  }
}

export async function createListingAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { userId, orgId } = await auth();
  if (!userId) return { kind: "error", message: "You're not signed in." };

  const url = String(formData.get("url") ?? "").trim();
  if (!url) return { kind: "error", message: "Paste a listing URL first." };

  const result = await createListingFromUrl(url, userId, orgId ?? null);

  if (result.ok) {
    redirect(`/listings/${result.id}`);
  }
  if (result.error.kind === "duplicate") {
    redirect(`/listings/${result.error.existingId}`);
  }
  return { kind: "error", message: messageFor(result.error) };
}

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
  const { userId, orgId } = await auth();
  if (!userId) return { ok: false, reason: "Not signed in" };

  const result = await createListingFromUrl(url, userId, orgId ?? null);
  if (result.ok) return { ok: true, id: result.id };
  return { ok: false, reason: reasonFor(result.error) };
}
