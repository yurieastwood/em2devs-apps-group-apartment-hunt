// Google Distance Matrix API client. Server-side only.
// Requires GOOGLE_MAPS_SERVER_KEY (a separate key from the public Maps JS one,
// because the public key has HTTP-referrer restrictions that don't apply to
// server-to-server requests).

const ENDPOINT = "https://maps.googleapis.com/maps/api/distancematrix/json";

export type LatLng = { lat: number; lng: number };

export type Distance = {
  durationSeconds: number | null;
  distanceMeters: number | null;
};

type DistanceMatrixElement = {
  status: string;
  duration?: { value: number };
  distance?: { value: number };
};

type DistanceMatrixResponse = {
  status: string;
  error_message?: string;
  rows?: Array<{ elements: DistanceMatrixElement[] }>;
};

const empty = (origins: LatLng[], destinations: LatLng[]): Distance[][] =>
  origins.map(() =>
    destinations.map(() => ({
      durationSeconds: null,
      distanceMeters: null,
    })),
  );

// Returns an origins.length × destinations.length matrix of transit
// distances. Quietly returns an all-null matrix on misconfiguration or
// network failure so callers can fall back to "no data" UI without crashing.
export async function fetchTransitDistances(
  origins: LatLng[],
  destinations: LatLng[],
): Promise<Distance[][]> {
  if (origins.length === 0 || destinations.length === 0) return [];

  const apiKey = process.env.GOOGLE_MAPS_SERVER_KEY;
  if (!apiKey) {
    console.warn(
      "GOOGLE_MAPS_SERVER_KEY is not set; Distance Matrix calls are skipped",
    );
    return empty(origins, destinations);
  }

  const params = new URLSearchParams({
    origins: origins.map((o) => `${o.lat},${o.lng}`).join("|"),
    destinations: destinations.map((d) => `${d.lat},${d.lng}`).join("|"),
    mode: "transit",
    departure_time: "now",
    units: "metric",
    key: apiKey,
  });

  try {
    const res = await fetch(`${ENDPOINT}?${params}`);
    if (!res.ok) {
      console.error("Distance Matrix HTTP", res.status, await res.text());
      return empty(origins, destinations);
    }
    const data = (await res.json()) as DistanceMatrixResponse;
    if (data.status !== "OK") {
      console.error(
        "Distance Matrix status",
        data.status,
        data.error_message,
      );
      return empty(origins, destinations);
    }
    return (data.rows ?? []).map((r) =>
      r.elements.map((e) => {
        if (e.status !== "OK") {
          return { durationSeconds: null, distanceMeters: null };
        }
        return {
          durationSeconds: e.duration?.value ?? null,
          distanceMeters: e.distance?.value ?? null,
        };
      }),
    );
  } catch (err) {
    console.error("Distance Matrix request failed:", err);
    return empty(origins, destinations);
  }
}
