import type { ListingPhoto, ParsedListing } from "../types";
import {
  asNum,
  asString,
  extractFirstJsonLd,
  get,
  safeJsonParse,
  type Json,
} from "./util";

function extractListingId(url: string): string | null {
  try {
    const parts = new URL(url).pathname.split("/").filter(Boolean);
    return parts[parts.length - 1] ?? null;
  } catch {
    return null;
  }
}

// Apartments.com inlines listing details inside a ProfileStartup.init({...})
// call. The 'rentals' value is JSON (not a JS object literal), so we capture
// the array and JSON-parse it.
function extractRentals(html: string): Json[] {
  const m = html.match(/rentals:\s*(\[[\s\S]*?\])\s*,\s*\n/);
  if (!m) return [];
  const arr = safeJsonParse(m[1]);
  return Array.isArray(arr) ? arr : [];
}

function extractPhotos(graphItem: Json): ListingPhoto[] {
  const images = get(graphItem, "mainEntity", "image");
  if (!Array.isArray(images)) return [];
  const photos: ListingPhoto[] = [];
  for (const img of images) {
    const url = asString(get(img, "url"));
    if (url) photos.push({ url });
  }
  return photos;
}

function joinAddress(
  street: string | null,
  city: string | null,
  state: string | null,
  zip: string | null,
): string | null {
  const cityState = [city, state].filter(Boolean).join(", ");
  const parts = [street, cityState, zip].filter((p) => p && p.length > 0);
  return parts.length > 0 ? parts.join(", ") : null;
}

export function parseApartments(
  sourceUrl: string,
  html: string,
): ParsedListing {
  const sourceListingId = extractListingId(sourceUrl);
  const ld = extractFirstJsonLd(html);
  const graph0 = get(ld, "@graph", 0);
  const main = get(graph0, "mainEntity");
  const addr = get(main, "address");
  const geo = get(main, "geo");

  const rentals = extractRentals(html);
  const firstRental = rentals[0] ?? null;

  const streetAddress = asString(get(addr, "streetAddress"));
  const city = asString(get(addr, "addressLocality"));
  const state = asString(get(addr, "addressRegion"));
  const zipCode = asString(get(addr, "postalCode"));

  return {
    sourceUrl,
    sourceHost: "apartments.com",
    sourceListingId,
    title: asString(get(graph0, "name")) ?? asString(get(main, "name")),
    address: joinAddress(streetAddress, city, state, zipCode),
    streetAddress,
    city,
    state,
    zipCode,
    latitude: asNum(get(geo, "latitude")),
    longitude: asNum(get(geo, "longitude")),
    bedrooms: asNum(get(firstRental, "Beds")),
    bathrooms: asNum(get(firstRental, "Baths")),
    squareFeet: asNum(get(firstRental, "SquareFeet")),
    priceUsd:
      asNum(get(graph0, "offers", "price")) ??
      asNum(get(firstRental, "Rent")),
    description:
      asString(get(graph0, "description")) ??
      asString(get(firstRental, "Description")),
    photos: extractPhotos(graph0),
    raw: { jsonLd: ld, rental: firstRental },
  };
}
