// Nominatim (OpenStreetMap) geocoder. Free with a 1 req/sec rate limit and
// a ToS that asks for an identifying User-Agent. Plenty for this app — the
// only call is when the user sets or edits their home address.

const NOMINATIM_USER_AGENT =
  "ApartmentHuntFamilyApp/1.0 (https://www.group-apartment-hunt.xyz)";

export type GeocodeResult = {
  lat: number;
  lng: number;
  displayName: string;
};

export async function geocodeAddress(
  query: string,
): Promise<GeocodeResult | null> {
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(
    query,
  )}&format=json&limit=1&addressdetails=0`;
  const res = await fetch(url, {
    headers: { "User-Agent": NOMINATIM_USER_AGENT },
  });
  if (!res.ok) return null;
  const data = (await res.json()) as Array<{
    lat: string;
    lon: string;
    display_name: string;
  }>;
  if (!Array.isArray(data) || data.length === 0) return null;
  const r = data[0];
  const lat = parseFloat(r.lat);
  const lng = parseFloat(r.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng, displayName: r.display_name };
}

export type ReverseGeocodeResult = {
  neighborhood: string | null;
  district: string | null;
};

// Reverse geocode a coordinate to its OSM address components. Used as a
// fallback when listing parsers don't expose neighborhood / district fields.
// Maps Nominatim's address shape to our two columns:
// - district = admin_level 10 boundary (`city_district` / `borough`), the
//   Chicago community-area concept (e.g. "Near West Side")
// - neighborhood = the more granular `neighbourhood` / `suburb` / `quarter`
//   if present
function asNonEmpty(v: unknown): string | null {
  return typeof v === "string" && v.trim().length > 0 ? v.trim() : null;
}

export async function reverseGeocodeAddress(
  lat: number,
  lng: number,
): Promise<ReverseGeocodeResult | null> {
  const url = new URL("https://nominatim.openstreetmap.org/reverse");
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("lat", lat.toString());
  url.searchParams.set("lon", lng.toString());
  url.searchParams.set("zoom", "17");
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": NOMINATIM_USER_AGENT },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { address?: Record<string, unknown> };
    const addr = data.address ?? {};
    // OSM uses different keys at different granularities. In Chicago for
    // example: `neighbourhood` is the most-specific named area (e.g.
    // "Illinois Medical District"), `suburb` is the community-area level
    // (e.g. "Near West Side"). Pick the most specific name available for
    // `neighborhood`, and only emit `district` when it's strictly broader
    // than the neighborhood we picked — otherwise we'd duplicate the same
    // name into both columns.
    const granular = asNonEmpty(addr.neighbourhood) ?? asNonEmpty(addr.quarter);
    const broader =
      asNonEmpty(addr.suburb) ??
      asNonEmpty(addr.city_district) ??
      asNonEmpty(addr.borough) ??
      asNonEmpty(addr.district);
    return {
      neighborhood: granular ?? broader ?? null,
      district: granular ? broader : null,
    };
  } catch (err) {
    console.error("Nominatim reverse-geocode failed:", err);
    return null;
  }
}
