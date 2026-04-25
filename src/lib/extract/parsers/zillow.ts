import type { ListingPhoto, ParsedListing } from "../types";
import {
  asNum,
  asString,
  extractFirstJsonLd,
  get,
  safeJsonParse,
  type Json,
} from "./util";

const ZPID_RE = /\/(\d+)_zpid\//;

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

export function parseZillow(sourceUrl: string, html: string): ParsedListing {
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
    photos: extractPhotos(property),
    raw: { jsonLd: ld, property },
  };
}
