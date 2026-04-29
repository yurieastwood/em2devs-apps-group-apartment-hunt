import type {
  Availability,
  ListingPhoto,
  ParsedListing,
  ParsedSchool,
} from "../types";
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

// ApartmentList listings often have many "available_units" (floor plans),
// some with price > 0 (actually rentable now) and many with price = 0
// (placeholder / coming soon). Each plan has its own bed / bath / price /
// sqft, so we pick a single plan and source all four fields from it to
// keep them consistent.
//
// Strategy: prefer the plan whose price matches `available_units[0].price`
// when that price is non-zero (the same plan ApartmentList usually shows
// in the header — empirically the one we'd been picking before). Fall
// back to the cheapest available plan, then to the very first plan.
function pickFloorPlan(listing: Json): Json {
  const all = get(listing, "available_units");
  if (!Array.isArray(all) || all.length === 0) return null;

  const headPrice = asNum(get(all[0], "price"));
  if (headPrice != null && headPrice > 0) return all[0];

  const available = all.filter((u) => {
    const p = asNum(get(u, "price"));
    return p != null && p > 0;
  });
  if (available.length === 0) return all[0];

  return available.reduce<Json>((cheapest, u) => {
    const cp = asNum(get(cheapest, "price")) ?? Number.POSITIVE_INFINITY;
    const up = asNum(get(u, "price")) ?? Number.POSITIVE_INFINITY;
    return up < cp ? u : cheapest;
  }, available[0]);
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

  const plan = pickFloorPlan(listing);

  const planSqft = asNum(get(plan, "sqft"));
  const squareFeet = planSqft != null && planSqft > 0 ? planSqft : null;

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
    bedrooms:
      asNum(get(plan, "bed")) ??
      asNum(get(aptLd, "numberOfBedrooms")),
    bathrooms:
      asNum(get(plan, "bath")) ??
      asNum(get(aptLd, "numberOfBathroomsTotal")),
    squareFeet,
    priceUsd: asNum(get(plan, "price")),
    description:
      asString(get(listing, "description")) ??
      asString(get(ld, "description")),
    neighborhood: asString(get(listing, "neighborhood")),
    availability: extractAvailability(listing, html),
    units: null,
    photos: extractPhotos(listing),
    schools: extractSchools(component),
    raw: { jsonLd: ld, apartmentLd: aptLd, listing, pickedPlan: plan },
  };
}
