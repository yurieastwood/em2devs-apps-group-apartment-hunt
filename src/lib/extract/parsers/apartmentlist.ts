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

// Photos are stored as Cloudinary asset ids. Build a URL with a height-fit
// transform so we get a reasonable resolution without massive originals.
function buildPhotoUrl(id: string): string {
  return `https://cdn.apartmentlist.com/image/upload/c_fit,h_1080,q_auto,f_auto/${id}.jpg`;
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
  const listing = get(
    nextData,
    "props",
    "pageProps",
    "component",
    "listing",
  );

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
    raw: { jsonLd: ld, apartmentLd: aptLd, listing },
  };
}
