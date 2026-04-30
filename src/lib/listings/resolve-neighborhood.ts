import { reverseGeocodeAddress } from "@/lib/geocode";

// Single seam for resolving a listing's neighborhood + district. The parser's
// output is preferred; a stored value (`current`) is preserved on refresh
// when the parser comes back empty; finally we reverse-geocode lat/lng via
// Nominatim if all else fails. Caching is implicit: once a value lands in
// the column, subsequent refreshes see it via `current` and skip Nominatim.

export type ResolveLocaleInput = {
  parsed: string | null;
  current?: string | null;
  latitude: number | null;
  longitude: number | null;
};

function trimToNull(s: string | null | undefined): string | null {
  if (!s) return null;
  const t = s.trim();
  return t.length > 0 ? t : null;
}

export async function resolveNeighborhood(
  input: ResolveLocaleInput,
): Promise<string | null> {
  const fromParsed = trimToNull(input.parsed);
  if (fromParsed) return fromParsed;
  const fromCurrent = trimToNull(input.current);
  if (fromCurrent) return fromCurrent;
  if (input.latitude == null || input.longitude == null) return null;
  const geo = await reverseGeocodeAddress(input.latitude, input.longitude);
  return geo?.neighborhood ?? null;
}

export async function resolveDistrict(
  input: ResolveLocaleInput,
): Promise<string | null> {
  const fromParsed = trimToNull(input.parsed);
  if (fromParsed) return fromParsed;
  const fromCurrent = trimToNull(input.current);
  if (fromCurrent) return fromCurrent;
  if (input.latitude == null || input.longitude == null) return null;
  const geo = await reverseGeocodeAddress(input.latitude, input.longitude);
  return geo?.district ?? null;
}
