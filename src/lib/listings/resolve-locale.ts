import { reverseGeocodeAddress } from "@/lib/geocode";

// Resolves a listing's neighborhood + district pair. Reverse-geocoding from
// the listing's lat/lng is the primary source — listing-website fields vary
// in quality and meaning across sources, while OSM coordinates give us a
// consistent definition. Listing-derived values fall in only when Nominatim
// has nothing to say for that point. Existing column values are the very
// last resort so we don't wipe data when both Nominatim and the parser are
// unavailable on a given run.

export type ResolveLocaleInput = {
  parsedNeighborhood: string | null;
  parsedDistrict: string | null;
  currentNeighborhood?: string | null;
  currentDistrict?: string | null;
  latitude: number | null;
  longitude: number | null;
};

export type ResolvedLocale = {
  neighborhood: string | null;
  district: string | null;
};

function trimToNull(s: string | null | undefined): string | null {
  if (!s) return null;
  const t = s.trim();
  return t.length > 0 ? t : null;
}

export async function resolveLocale(
  input: ResolveLocaleInput,
): Promise<ResolvedLocale> {
  const geo =
    input.latitude != null && input.longitude != null
      ? await reverseGeocodeAddress(input.latitude, input.longitude)
      : null;

  const neighborhood =
    trimToNull(geo?.neighborhood) ??
    trimToNull(input.parsedNeighborhood) ??
    trimToNull(input.currentNeighborhood) ??
    null;

  const district =
    trimToNull(geo?.district) ??
    trimToNull(input.parsedDistrict) ??
    trimToNull(input.currentDistrict) ??
    null;

  // No de-dupe — the user prefers both columns populated even when they
  // resolve to the same name (e.g. "West Town"), so neighborhood- and
  // district-level filter chip groups stay independent.
  return { neighborhood, district };
}
