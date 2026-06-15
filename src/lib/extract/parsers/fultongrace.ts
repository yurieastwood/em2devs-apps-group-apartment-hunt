import type {
  Availability,
  ListingPhoto,
  ParsedListing,
  ParsedSchool,
} from "../types";
import { asNum, asString, get, safeJsonParse, type Json } from "./util";

// Fulton Grace renders the entire listing as a single JSON blob in a
// <script id="page-context" type="application/json"> tag — no JSON-LD and
// no per-unit floor plans (each page is one MLS unit).
function extractPageContext(html: string): Json {
  const m = html.match(
    /<script[^>]*id="page-context"[^>]*>([\s\S]*?)<\/script>/,
  );
  return m ? safeJsonParse(m[1]) : null;
}

// MLS status drives availability. "Active" is rentable; closed / rented /
// cancelled / expired / withdrawn / pending / under-contract are not.
function extractAvailability(ctx: Json): Availability {
  const status = asString(get(ctx, "status"));
  if (!status) return "unknown";
  const s = status.toLowerCase();
  if (s === "active") return "available";
  if (
    s.includes("closed") ||
    s.includes("rented") ||
    s.includes("cancel") ||
    s.includes("expired") ||
    s.includes("withdrawn") ||
    s.includes("pending") ||
    s.includes("contingent") ||
    s.includes("contract") ||
    s.includes("off market") ||
    s.includes("off-market")
  ) {
    return "unavailable";
  }
  return "unknown";
}

function extractPhotos(ctx: Json): ListingPhoto[] {
  const list = get(ctx, "photos");
  if (!Array.isArray(list)) return [];
  // Prefer the original full-resolution Google Storage URL over the proxied,
  // size-capped variants so rehosting keeps the best image.
  const withOrder = list
    .map((p) => ({
      url: asString(get(p, "url")) ?? asString(get(p, "big_url")),
      order: asNum(get(p, "order")) ?? 0,
    }))
    .filter((p): p is { url: string; order: number } => p.url != null);
  withOrder.sort((a, b) => a.order - b.order);
  return withOrder.map((p) => ({ url: p.url }));
}

function extractSchools(ctx: Json): ParsedSchool[] {
  // The page exposes school names plus their CPS district numbers. District
  // numbers alone aren't schools, so only emit entries that carry a name.
  const out: ParsedSchool[] = [];
  const add = (key: string, level: string) => {
    const name = asString(get(ctx, key));
    if (name && name.trim()) out.push({ name: name.trim(), level });
  };
  add("elementary_school", "Elementary");
  add("middle_school", "Middle");
  add("high_school", "High");
  return out;
}

function idToString(v: Json): string | null {
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  if (typeof v === "string" && v.length > 0) return v;
  return null;
}

export function parseFultongrace(
  sourceUrl: string,
  html: string,
): ParsedListing {
  const ctx = extractPageContext(html);

  const rawAddress = asString(get(ctx, "address"));
  const city = asString(get(ctx, "city"));
  const zip = asString(get(ctx, "zip_code"));

  // No explicit state field; the address ends with the 2-letter code.
  const stateMatch = rawAddress?.match(/,\s*([A-Za-z]{2})\s*$/);
  const state = stateMatch ? stateMatch[1].toUpperCase() : null;

  // Street line is everything before the city segment.
  let streetAddress: string | null = rawAddress;
  if (rawAddress && city) {
    const idx = rawAddress.indexOf(`, ${city}`);
    if (idx > 0) streetAddress = rawAddress.slice(0, idx);
  }

  const address =
    rawAddress && zip && !rawAddress.includes(zip)
      ? `${rawAddress} ${zip}`
      : rawAddress;

  return {
    sourceUrl,
    sourceHost: "fultongrace.com",
    sourceListingId: idToString(get(ctx, "id")) ?? asString(get(ctx, "mls_id")),
    title: address,
    address,
    streetAddress,
    city,
    state,
    zipCode: zip,
    latitude: asNum(get(ctx, "latitude")),
    longitude: asNum(get(ctx, "longitude")),
    bedrooms: asNum(get(ctx, "bedroom_count")),
    bathrooms: asNum(get(ctx, "bathroom_count")),
    squareFeet: asNum(get(ctx, "living_area")),
    priceUsd: asNum(get(ctx, "price")),
    description: asString(get(ctx, "description")),
    neighborhood: asString(get(ctx, "neighborhood_name")),
    district: null,
    availability: extractAvailability(ctx),
    units: null,
    photos: extractPhotos(ctx),
    schools: extractSchools(ctx),
    raw: { kind: "fultongrace", pageContext: ctx },
  };
}
