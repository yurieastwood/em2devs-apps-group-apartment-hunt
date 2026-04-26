import type { ListingPhoto, ParsedListing, ParsedSchool } from "../types";
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

// Apartments.com renders schools as HTML cards (no JSON), each with:
// - a <a title="..."> with the school name
// - a "subtitle" div like "Public Elementary & Middle School"
// - a "Grades PK-8" line
// - an enrollment line like "327 Students"
// - a rating image whose filename encodes the rating (summary-rating-N-large.png)
// - a greatschools.org link
// - "Attendance Zone" indicator instead of explicit distance
function extractApartmentsSchools(html: string): ParsedSchool[] {
  // Each school card includes a link to apartments.com/schools and another to
  // greatschools.org. Anchor on the title link, then capture the surrounding
  // card content up to the next greatschools.org link.
  const re =
    /<a[^>]+href="https:\/\/www\.apartments\.com\/schools\/[^"]+"[^>]*title="([^"]+)"[^>]*>[\s\S]*?<div class="subtitle">([^<]+)<\/div>([\s\S]*?)https:\/\/www\.greatschools\.org\/([^"]+)"[\s\S]*?summary-rating-(\d+)-large/g;

  const out: ParsedSchool[] = [];
  for (const m of html.matchAll(re)) {
    const name = m[1].trim();
    const subtitle = m[2].trim();
    const cardBody = m[3];
    const greatSchoolsPath = m[4];
    const ratingStr = m[5];

    const grades = cardBody.match(/Grades\s+([A-Z0-9-]+)/);
    const enrollMatch = cardBody.match(/(\d+)\s+Students/);
    const isAssigned = /Attendance Zone/.test(cardBody);

    const lower = subtitle.toLowerCase();
    let schoolType: string | null = null;
    if (lower.includes("public")) schoolType = "Public";
    else if (lower.includes("private")) schoolType = "Private";
    else if (lower.includes("charter")) schoolType = "Charter";
    else if (lower.includes("magnet")) schoolType = "Magnet";

    let level: string | null = null;
    if (lower.includes("elementary")) level = "Elementary";
    else if (lower.includes("middle")) level = "Middle";
    else if (lower.includes("high")) level = "High";

    out.push({
      name,
      schoolType,
      level,
      gradeRange: grades ? grades[1] : null,
      rating: Number(ratingStr),
      enrollment: enrollMatch ? Number(enrollMatch[1]) : null,
      isAssigned,
      greatSchoolsUrl: `https://www.greatschools.org/${greatSchoolsPath}`,
    });
  }
  return out;
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
    schools: extractApartmentsSchools(html),
    raw: { jsonLd: ld, rental: firstRental },
  };
}
