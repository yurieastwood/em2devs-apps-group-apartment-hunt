// Pure formatters for transit duration / distance — safe to import from
// both server and client components.

export function fmtTransitDuration(seconds: number | null): string | null {
  if (seconds == null) return null;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

export function fmtTransitDistance(meters: number | null): string | null {
  if (meters == null) return null;
  const miles = meters / 1609.344;
  return `${miles.toFixed(1)} mi`;
}

// Google Maps directions URL with transit mode. Opens the route preview on
// the web and deep-links into the Google Maps app on mobile. Returns null
// when either endpoint lacks coordinates.
export function googleMapsTransitDirectionsUrl(
  origin: { lat: number | null; lng: number | null },
  dest: { lat: number | null; lng: number | null },
): string | null {
  if (
    origin.lat == null ||
    origin.lng == null ||
    dest.lat == null ||
    dest.lng == null
  ) {
    return null;
  }
  const params = new URLSearchParams({
    api: "1",
    origin: `${origin.lat},${origin.lng}`,
    destination: `${dest.lat},${dest.lng}`,
    travelmode: "transit",
  });
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}
