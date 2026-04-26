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

function extractNextData(html: string): Json {
  const m = html.match(
    /<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/,
  );
  return m ? safeJsonParse(m[1]) : null;
}

// Walks every JSON-LD block looking for an Apartment / Residence entity —
// the page emits seven blocks and which index holds bed/bath info isn't
// stable across pages, so locate it by @type.
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

// Photos are stored as Cloudinary asset ids. ApartmentList's Cloudinary is
// configured with strict transforms — only specific named transforms are
// allowed; arbitrary ones (like c_fit,h_1080) return 404. Use f_auto,q_auto
// which is on the allowlist: full original resolution with format and
// quality auto-negotiation. Server-side fetches receive image/jpeg by
// default; browsers that include Accept: image/webp receive WebP.
function buildPhotoUrl(id: string): string {
  return `https://cdn.apartmentlist.com/image/upload/f_auto,q_auto/${id}.jpg`;
}

// ApartmentList ships a flat array of up to ~50 schools attached to the page,
// not the listing object — at component.schools. Each entry is rich.
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

  const units = get(listing, "available_units");
  const firstUnit = Array.isArray(units) ? units[0] : null;

  const rawSqft = asNum(get(firstUnit, "sqft"));
  const squareFeet = rawSqft != null && rawSqft > 0 ? rawSqft : null;

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
    bedrooms: asNum(get(aptLd, "numberOfBedrooms")),
    bathrooms: asNum(get(aptLd, "numberOfBathroomsTotal")),
    squareFeet,
    priceUsd: asNum(get(firstUnit, "price")),
    description:
      asString(get(listing, "description")) ??
      asString(get(ld, "description")),
    photos: extractPhotos(listing),
    schools: extractSchools(component),
    raw: { jsonLd: ld, apartmentLd: aptLd, listing },
  };
}
