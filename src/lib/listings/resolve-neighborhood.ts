// Single seam for resolving a listing's neighborhood + district. Today both
// just return what the parser found. When we later add Google Places (or
// another geocoding) fallback, this is the only place callers need to await.
//
// Keeping these async even when the body is sync keeps the call sites stable
// for that future change.

export type ResolveLocaleInput = {
  parsed: string | null;
  latitude: number | null;
  longitude: number | null;
};

export async function resolveNeighborhood(
  input: ResolveLocaleInput,
): Promise<string | null> {
  if (input.parsed && input.parsed.trim().length > 0) {
    return input.parsed.trim();
  }
  // Future: lat/lng → Places reverse lookup → component of type
  // "neighborhood". Today: return null.
  return null;
}

export async function resolveDistrict(
  input: ResolveLocaleInput,
): Promise<string | null> {
  if (input.parsed && input.parsed.trim().length > 0) {
    return input.parsed.trim();
  }
  // Future: lat/lng → Places reverse lookup → component of type
  // "sublocality_level_1" / "administrative_area_level_2". Today: null.
  return null;
}
