"use server";

import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { isOrgAdmin } from "@/lib/auth/roles";
import {
  createListingFromUrl,
  type CreateListingError,
} from "@/lib/listings/create-listing-from-url";
import { createListingManually } from "@/lib/listings/create-listing-manually";
import { reverseGeocodeToAddress } from "@/lib/geocode";

export type ActionState = { kind: "idle" } | { kind: "error"; message: string };

function messageFor(err: CreateListingError): string {
  switch (err.kind) {
    case "invalid_url":
      return "That doesn't look like a valid URL.";
    case "unsupported_host":
      return `We don't support ${err.host} yet — try Zillow, Apartments.com, ApartmentList.com, or FultonGrace.com.`;
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
  if (!(await isOrgAdmin())) {
    return { kind: "error", message: "Admins only — ask an admin to add this." };
  }

  const url = String(formData.get("url") ?? "").trim();
  if (!url) return { kind: "error", message: "Paste a listing URL first." };

  const result = await createListingFromUrl(url, userId, orgId ?? null);

  if (result.ok) {
    redirect(`/listings/${result.id}`);
  }
  if (result.error.kind === "duplicate") {
    redirect(`/listings/${result.error.existingId}?duplicate=1`);
  }
  return { kind: "error", message: messageFor(result.error) };
}

function readString(formData: FormData, name: string): string | null {
  const v = formData.get(name);
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t.length > 0 ? t : null;
}

function readNumber(formData: FormData, name: string): number | null {
  const s = readString(formData, name);
  if (s == null) return null;
  const n = Number(s.replace(/[$,\s]/g, ""));
  return Number.isFinite(n) ? n : null;
}

function readInt(formData: FormData, name: string): number | null {
  const n = readNumber(formData, name);
  return n == null ? null : Math.trunc(n);
}

export type ReverseGeocodeActionResult =
  | {
      ok: true;
      streetAddress: string | null;
      city: string | null;
      state: string | null;
      zipCode: string | null;
      displayName: string | null;
    }
  | { ok: false; reason: string };

export async function reverseGeocodeAction(
  lat: number,
  lng: number,
): Promise<ReverseGeocodeActionResult> {
  const { userId } = await auth();
  if (!userId) return { ok: false, reason: "Not signed in" };
  if (!(await isOrgAdmin())) return { ok: false, reason: "Admins only" };
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return { ok: false, reason: "Invalid coordinates" };
  }

  const r = await reverseGeocodeToAddress(lat, lng);
  if (!r) return { ok: false, reason: "Couldn't look up that location" };
  return { ok: true, ...r };
}

export async function createListingManuallyAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { userId, orgId } = await auth();
  if (!userId) return { kind: "error", message: "You're not signed in." };
  if (!(await isOrgAdmin())) {
    return { kind: "error", message: "Admins only — ask an admin to add this." };
  }

  const address = readString(formData, "address");
  if (!address) {
    return { kind: "error", message: "Enter a street address." };
  }

  const photos = formData
    .getAll("photos")
    .filter((f): f is File => f instanceof File && f.size > 0);

  const result = await createListingManually(
    {
      title: readString(formData, "title"),
      address,
      city: readString(formData, "city"),
      state: readString(formData, "state"),
      zipCode: readString(formData, "zipCode"),
      bedrooms: readNumber(formData, "bedrooms"),
      bathrooms: readNumber(formData, "bathrooms"),
      squareFeet: readInt(formData, "squareFeet"),
      priceUsd: readInt(formData, "priceUsd"),
      description: readString(formData, "description"),
      latitude: readNumber(formData, "latitude"),
      longitude: readNumber(formData, "longitude"),
      photos,
    },
    userId,
    orgId ?? null,
  );

  if (result.ok) {
    redirect(`/listings/${result.id}`);
  }
  return { kind: "error", message: result.error };
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
  if (!(await isOrgAdmin())) return { ok: false, reason: "Admins only" };

  const result = await createListingFromUrl(url, userId, orgId ?? null);
  if (result.ok) return { ok: true, id: result.id };
  return { ok: false, reason: reasonFor(result.error) };
}
