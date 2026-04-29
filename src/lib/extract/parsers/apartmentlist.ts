import type {
  Availability,
  ListingPhoto,
  ParsedListing,
  ParsedSchool,
  ParsedUnit,
} from "../types";
import {
  asNum,
  asString,
  dedupUnits,
  extractFirstJsonLd,
  get,
  pickHeadlineUnit,
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

function extractNextData(html: string): Json {
  const m = html.match(
    /<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/,
  );
  return m ? safeJsonParse(m[1]) : null;
}

// JSON-LD's Apartment block describes one specific unit on the page (often
// not the unit whose price ApartmentList shows in headers), so we don't
// rely on it for beds / baths. Kept as a defensive fallback only.
function findApartmentLd(html: string): Json {
  const blocks = [
    ...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g),
  ];
  for (const m of blocks) {
    const obj = safeJsonParse(m[1]);
    const t = get(obj, "@type");
    if (t === "Apartment") return obj;
    if (Array.isArray(t) && t.includes("Apartment")) return obj;
  }
  return null;
}

function buildPhotoUrl(id: string): string {
  return `https://cdn.apartmentlist.com/image/upload/f_auto,q_auto/${id}.jpg`;
}

function extractPhotos(listing: Json): ListingPhoto[] {
  const all = get(listing, "all_photos");
  if (!Array.isArray(all)) return [];
  const photos: ListingPhoto[] = [];
  for (const p of all) {
    const id = asString(get(p, "id"));
    if (id) photos.push({ url: buildPhotoUrl(id) });
  }
  return photos;
}

// Map each available_units entry to the shared ParsedUnit shape, then
// dedup + sort. Note ApartmentList uses singular `bed` / `bath` keys
// (Zillow uses `beds` / `baths`).
function extractUnits(listing: Json): ParsedUnit[] {
  const all = get(listing, "available_units");
  if (!Array.isArray(all) || all.length === 0) return [];
  const mapped = all
    .map((u): ParsedUnit => ({
      name: asString(get(u, "name")) ?? asString(get(u, "floor_plan_name")),
      beds: asNum(get(u, "bed")),
      baths: asNum(get(u, "bath")),
      sqft: asNum(get(u, "sqft")),
      price: asNum(get(u, "price")),
      availableFrom: asString(get(u, "availability")),
      photoUrl: asString(get(u, "image_url")),
    }))
    .filter(
      (u) =>
        u.beds != null ||
        u.baths != null ||
        u.price != null ||
        u.sqft != null,
    );
  return dedupUnits(mapped);
}

function extractSchools(component: Json): ParsedSchool[] {
  const list = get(component, "schools");
  if (!Array.isArray(list)) return [];
  const ranked = [...list].sort((a, b) => {
    const da = asNum(get(a, "distance_to_school")) ?? Infinity;
    const db = asNum(get(b, "distance_to_school")) ?? Infinity;
    return da - db;
  });
  const out: ParsedSchool[] = [];
  for (const s of ranked.slice(0, 12)) {
    const name = asString(get(s, "name"));
    if (!name) continue;
    out.push({
      name,
      schoolType: asString(get(s, "school_type")),
      gradeRange: asString(get(s, "level")),
      rating: asNum(get(s, "great_schools_rating")),
      distanceMiles: asNum(get(s, "distance_to_school")),
      greatSchoolsUrl: asString(get(s, "great_schools_url")),
      enrollment: asNum(get(s, "enrollment")),
      lat: asNum(get(s, "lat")),
      lng: asNum(get(s, "lon")),
    });
  }
  return out;
}

// ApartmentList availability signals (verified against real samples):
// - `availability_last_checked_at` is a recent ISO timestamp on currently-
//   listed properties (including "ask for price" rentals where every unit's
//   price is 0) and `null` on properties that show the "This property is no
//   longer available" overlay. That overlay is rendered client-side, so the
//   timestamp is the only reliable raw-HTML signal.
// - To stay safe against scrape glitches that drop the timestamp, only treat
//   a null timestamp as unavailable when no advertised unit has a real price.
// - An empty `available_units` array also means unavailable.
// - The "no longer available" page text is checked too as a defensive
//   fallback in case ApartmentList ever ships it server-rendered.
function extractAvailability(listing: Json, html: string): Availability {
  if (/this property is no longer available/i.test(html)) {
    return "unavailable";
  }
  if (listing == null || typeof listing !== "object") return "unknown";

  const units = get(listing, "available_units");
  if (Array.isArray(units) && units.length === 0) return "unavailable";

  const lastChecked = get(listing, "availability_last_checked_at");
  const hasRealPrice =
    Array.isArray(units) &&
    units.some((u) => {
      const p = asNum(get(u, "price"));
      return p != null && p > 0;
    });
  if (lastChecked == null && !hasRealPrice) return "unavailable";

  return "available";
}

export function parseApartmentList(
  sourceUrl: string,
  html: string,
): ParsedListing {
  const sourceListingId = extractListingId(sourceUrl);

  const ld = extractFirstJsonLd(html);
  const ldAddr = get(ld, "address");
  const ldGeo = get(ld, "geo");

  const aptLd = findApartmentLd(html);

  const nextData = extractNextData(html);
  const component = get(nextData, "props", "pageProps", "component");
  const listing = get(component, "listing");

  const units = extractUnits(listing);
  const headline = pickHeadlineUnit(units);

  return {
    sourceUrl,
    sourceHost: "apartmentlist.com",
    sourceListingId,
    title:
      asString(get(listing, "display_name")) ?? asString(get(ld, "name")),
    address:
      asString(get(listing, "formatted_address")) ??
      asString(get(ld, "name")),
    streetAddress:
      asString(get(listing, "street_address")) ??
      asString(get(listing, "street")) ??
      asString(get(ldAddr, "streetAddress")),
    city:
      asString(get(listing, "city")) ??
      asString(get(ldAddr, "addressLocality")),
    state:
      asString(get(listing, "state")) ??
      asString(get(ldAddr, "addressRegion")),
    zipCode:
      asString(get(listing, "zip")) ?? asString(get(ldAddr, "postalCode")),
    latitude: asNum(get(listing, "lat")) ?? asNum(get(ldGeo, "latitude")),
    longitude: asNum(get(listing, "lon")) ?? asNum(get(ldGeo, "longitude")),
    bedrooms: headline?.beds ?? asNum(get(aptLd, "numberOfBedrooms")),
    bathrooms: headline?.baths ?? asNum(get(aptLd, "numberOfBathroomsTotal")),
    squareFeet: headline?.sqft ?? null,
    priceUsd: headline?.price ?? null,
    description:
      asString(get(listing, "description")) ??
      asString(get(ld, "description")),
    neighborhood: asString(get(listing, "neighborhood")),
    availability: extractAvailability(listing, html),
    units: units.length > 1 ? units : null,
    photos: extractPhotos(listing),
    schools: extractSchools(component),
    raw: { jsonLd: ld, apartmentLd: aptLd, listing, headline },
  };
}
