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

const ZPID_RE = /\/(\d+)_zpid\//;
const BUILDING_URL_RE = /\/apartments\/[^/]+\/[^/]+\/([a-zA-Z0-9]+)\/?/;

function extractNextData(html: string): Json {
  const m = html.match(
    /<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/,
  );
  return m ? safeJsonParse(m[1]) : null;
}

function extractProperty(nextData: Json): Json {
  const cacheStr = get(
    nextData,
    "props",
    "pageProps",
    "componentProps",
    "gdpClientCache",
  );
  if (typeof cacheStr !== "string") return null;
  const cache = safeJsonParse(cacheStr);
  if (!cache || typeof cache !== "object") return null;
  const firstKey = Object.keys(cache as Record<string, unknown>)[0];
  return firstKey ? get(cache, firstKey, "property") : null;
}

function pickLargestJpeg(mix: Json): ListingPhoto | null {
  const jpegs = get(mix, "jpeg");
  if (!Array.isArray(jpegs)) return null;
  let best: { url: string; width?: number } | null = null;
  for (const j of jpegs) {
    const url = asString(get(j, "url"));
    if (!url) continue;
    const width = asNum(get(j, "width")) ?? 0;
    if (!best || width > (best.width ?? 0)) best = { url, width };
  }
  return best;
}

function extractSchools(property: Json): ParsedSchool[] {
  const list = get(property, "schools");
  if (!Array.isArray(list)) return [];
  const out: ParsedSchool[] = [];
  for (const s of list) {
    const name = asString(get(s, "name"));
    if (!name) continue;
    out.push({
      name,
      schoolType: asString(get(s, "type")),
      level: asString(get(s, "level")),
      gradeRange: asString(get(s, "grades")),
      rating: asNum(get(s, "rating")),
      distanceMiles: asNum(get(s, "distance")),
      greatSchoolsUrl: asString(get(s, "link")),
      enrollment: asNum(get(s, "size")),
      isAssigned: typeof get(s, "isAssigned") === "boolean"
        ? (get(s, "isAssigned") as boolean)
        : null,
    });
  }
  return out;
}

// Zillow surfaces neighborhood under a few different shapes depending on
// listing type. Probe in order of specificity, first hit wins.
function extractNeighborhood(property: Json): string | null {
  return (
    asString(get(property, "neighborhoodRegion", "name")) ??
    asString(get(property, "parentRegion", "name")) ??
    asString(get(property, "address", "neighborhood")) ??
    asString(get(property, "neighborhood")) ??
    null
  );
}

// Zillow's homeStatus values: FOR_RENT / FOR_SALE → available; RECENTLY_RENTED
// / RECENTLY_SOLD / OFF_MARKET → unavailable. Anything else stays unknown.
function extractAvailability(property: Json): Availability {
  const status = asString(get(property, "homeStatus"));
  if (!status) return "unknown";
  const s = status.toUpperCase();
  if (s === "FOR_RENT" || s === "FOR_SALE") return "available";
  if (
    s === "RECENTLY_RENTED" ||
    s === "RECENTLY_SOLD" ||
    s === "OFF_MARKET" ||
    s === "PENDING"
  )
    return "unavailable";
  return "unknown";
}

function extractPhotos(property: Json): ListingPhoto[] {
  const list = get(property, "originalPhotos");
  if (!Array.isArray(list)) return [];
  const photos: ListingPhoto[] = [];
  for (const p of list) {
    const photo = pickLargestJpeg(get(p, "mixedSources"));
    if (photo) photos.push(photo);
  }
  return photos;
}

// Zillow's "/apartments/<city>/<slug>/<lnId>/" URLs render an apartment-
// building page rather than a single home, with a different React component
// and a different __NEXT_DATA__ shape. Multiple paths probed because Zillow
// nests this differently across rollouts.
function extractBuilding(nextData: Json): Json {
  const candidates: Json[] = [
    get(
      nextData,
      "props",
      "pageProps",
      "componentProps",
      "initialReduxState",
      "gdp",
      "building",
    ),
    get(
      nextData,
      "props",
      "pageProps",
      "initialReduxState",
      "gdp",
      "building",
    ),
    get(nextData, "props", "pageProps", "componentProps", "building"),
    get(nextData, "props", "pageProps", "buildingData"),
    get(nextData, "props", "pageProps", "building"),
  ];
  for (const c of candidates) {
    if (c && typeof c === "object") return c;
  }
  return null;
}

function extractFloorPlans(building: Json): ParsedUnit[] {
  // Union all three candidate arrays — Zillow's pages sometimes split
  // floorPlans (summary rows) from ungroupedUnits (every individual unit
  // including those behind the "Show XX more units" button). Picking just
  // one drops data; merging then deduping gives us everything.
  const sources: Json[] = [
    get(building, "floorPlans"),
    get(building, "units"),
    get(building, "ungroupedUnits"),
  ];
  const allRaw: Json[] = [];
  for (const c of sources) {
    if (Array.isArray(c)) allRaw.push(...c);
  }
  if (allRaw.length === 0) return [];

  const mapped = allRaw
    .map((p): ParsedUnit => ({
      name:
        asString(get(p, "name")) ??
        asString(get(p, "label")) ??
        asString(get(p, "floorPlanName")),
      beds: asNum(get(p, "beds")) ?? asNum(get(p, "bedrooms")),
      baths:
        asNum(get(p, "baths")) ??
        asNum(get(p, "bathrooms")) ??
        asNum(get(p, "fullBaths")),
      sqft:
        asNum(get(p, "sqft")) ??
        asNum(get(p, "squareFootage")) ??
        asNum(get(p, "minSqft")),
      price:
        asNum(get(p, "priceMin")) ??
        asNum(get(p, "price")) ??
        asNum(get(p, "minPrice")),
      availableFrom:
        asString(get(p, "availableFrom")) ??
        asString(get(p, "availFrom")) ??
        asString(get(p, "availability")),
      photoUrl:
        asString(get(p, "imageURL")) ??
        asString(get(p, "image", "url")) ??
        asString(get(p, "photo", "url")),
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

function extractBuildingPhotos(building: Json): ListingPhoto[] {
  const candidates: Json[] = [
    get(building, "photos"),
    get(building, "mediaSlideShow"),
    get(building, "buildingMedia"),
    get(building, "mediaItems"),
  ];
  let list: Json[] = [];
  for (const c of candidates) {
    if (Array.isArray(c) && c.length > 0) {
      list = c;
      break;
    }
  }
  const out: ListingPhoto[] = [];
  for (const p of list) {
    const url =
      asString(get(p, "url")) ??
      asString(get(p, "imageURL")) ??
      asString(get(p, "src"));
    if (!url) {
      const mixed = pickLargestJpeg(get(p, "mixedSources"));
      if (mixed) out.push(mixed);
      continue;
    }
    out.push({ url });
  }
  return out;
}

function parseZillowBuilding(
  sourceUrl: string,
  html: string,
  buildingId: string,
): ParsedListing {
  const ld = extractFirstJsonLd(html);
  const nextData = extractNextData(html);
  const building = extractBuilding(nextData);

  const units = extractFloorPlans(building);
  const headline = pickHeadlineUnit(units);

  const ldAddress = get(ld, "address");
  const ldGeo = get(ld, "geo");

  const street =
    asString(get(building, "streetAddress")) ??
    asString(get(ldAddress, "streetAddress"));
  const city =
    asString(get(building, "city")) ??
    asString(get(ldAddress, "addressLocality"));
  const state =
    asString(get(building, "state")) ??
    asString(get(ldAddress, "addressRegion"));
  const zip =
    asString(get(building, "zipcode")) ??
    asString(get(ldAddress, "postalCode"));
  const composedAddress =
    [street, [city, state].filter(Boolean).join(", "), zip]
      .filter(Boolean)
      .join(", ") || null;
  const fullAddress =
    asString(get(ld, "name")) ??
    asString(get(building, "fullAddress")) ??
    composedAddress;

  return {
    sourceUrl,
    sourceHost: "zillow.com",
    sourceListingId: buildingId,
    title:
      asString(get(building, "buildingName")) ??
      asString(get(building, "name")) ??
      asString(get(ld, "name")),
    address: fullAddress,
    streetAddress: street,
    city,
    state,
    zipCode: zip,
    latitude: asNum(get(building, "latitude")) ?? asNum(get(ldGeo, "latitude")),
    longitude:
      asNum(get(building, "longitude")) ?? asNum(get(ldGeo, "longitude")),
    bedrooms: headline?.beds ?? null,
    bathrooms: headline?.baths ?? null,
    squareFeet: headline?.sqft ?? null,
    priceUsd: headline?.price ?? null,
    description: asString(get(building, "description")),
    neighborhood:
      asString(get(building, "neighborhoodRegion", "name")) ??
      asString(get(building, "neighborhood")),
    availability: "available",
    units: units.length > 0 ? units : null,
    photos: extractBuildingPhotos(building),
    schools: extractSchools(building),
    raw: { kind: "building", buildingId, jsonLd: ld, building },
  };
}

export function parseZillow(sourceUrl: string, html: string): ParsedListing {
  const buildingMatch = sourceUrl.match(BUILDING_URL_RE);
  if (buildingMatch) {
    return parseZillowBuilding(sourceUrl, html, buildingMatch[1]);
  }

  const zpidMatch = sourceUrl.match(ZPID_RE);
  const sourceListingId = zpidMatch ? zpidMatch[1] : null;

  const ld = extractFirstJsonLd(html);
  const offered = get(ld, "offers", "itemOffered");
  const ldAddress = get(offered, "address");
  const ldGeo = get(offered, "geo");

  const property = extractProperty(extractNextData(html));

  return {
    sourceUrl,
    sourceHost: "zillow.com",
    sourceListingId,
    title: asString(get(ld, "name")),
    address: asString(get(ld, "name")),
    streetAddress:
      asString(get(ldAddress, "streetAddress")) ??
      asString(get(property, "streetAddress")),
    city:
      asString(get(ldAddress, "addressLocality")) ??
      asString(get(property, "city")),
    state:
      asString(get(ldAddress, "addressRegion")) ??
      asString(get(property, "state")),
    zipCode:
      asString(get(ldAddress, "postalCode")) ??
      asString(get(property, "zipcode")),
    latitude: asNum(get(ldGeo, "latitude")),
    longitude: asNum(get(ldGeo, "longitude")),
    bedrooms:
      asNum(get(offered, "numberOfBedrooms")) ?? asNum(get(property, "bedrooms")),
    bathrooms: asNum(get(property, "bathrooms")),
    squareFeet: asNum(get(property, "livingArea")),
    priceUsd: asNum(get(ld, "offers", "price")) ?? asNum(get(property, "price")),
    description: asString(get(property, "description")),
    neighborhood: extractNeighborhood(property),
    availability: extractAvailability(property),
    units: null,
    photos: extractPhotos(property),
    schools: extractSchools(property),
    raw: { jsonLd: ld, property },
  };
}
