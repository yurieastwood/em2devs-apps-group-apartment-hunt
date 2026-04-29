// Single seam for resolving a listing's neighborhood. Today it just returns
// what the parser found. When we later add Google Places (or another
// geocoding) fallback, this is the only function callers need to await.
//
// Keeping this async even when the body is sync keeps the call sites stable
// for that future change.

export type ResolveNeighborhoodInput = {
  parsedNeighborhood: string | null;
  latitude: number | null;
  longitude: number | null;
};

export async function resolveNeighborhood(
  input: ResolveNeighborhoodInput,
): Promise<string | null> {
  if (input.parsedNeighborhood && input.parsedNeighborhood.trim().length > 0) {
    return input.parsedNeighborhood.trim();
  }
  // Future: if (lat/lng available) → Google Places reverseLookup → component
  //   of type "neighborhood". Today: return null and let the UI show "—".
  return null;
}
