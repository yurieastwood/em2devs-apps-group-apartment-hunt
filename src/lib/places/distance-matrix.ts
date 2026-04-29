// Transit distances for listing × POI pairs.
//
// Historically this called Google's Distance Matrix API in transit mode,
// which only returned the default route — often not the fastest one
// surfaced in the Maps UI. We now delegate to the Routes API v2 client
// (`routes-api.ts`) per pair, which asks for alternatives and returns the
// fastest. The signature is unchanged so callers can keep using a simple
// matrix shape.
//
// Departure time is fixed at the upcoming Tuesday 08:30 in America/Chicago
// to match the user's commute scenario.

import {
  fetchFastestTransit,
  nextTuesdayMorningChicagoIso,
  type Distance,
  type LatLng,
} from "./routes-api";

export type { Distance, LatLng };

const PER_PAIR_CONCURRENCY = 4;

export async function fetchTransitDistances(
  origins: LatLng[],
  destinations: LatLng[],
): Promise<Distance[][]> {
  if (origins.length === 0 || destinations.length === 0) return [];

  const departureTime = nextTuesdayMorningChicagoIso();

  // Build a flat task list of (originIdx, destIdx) pairs and run them in
  // parallel batches so we don't fan out 250+ requests at once.
  type Task = { i: number; j: number };
  const tasks: Task[] = [];
  for (let i = 0; i < origins.length; i++) {
    for (let j = 0; j < destinations.length; j++) {
      tasks.push({ i, j });
    }
  }

  const matrix: Distance[][] = origins.map(() =>
    destinations.map(() => ({
      durationSeconds: null,
      distanceMeters: null,
    })),
  );

  for (let start = 0; start < tasks.length; start += PER_PAIR_CONCURRENCY) {
    const slice = tasks.slice(start, start + PER_PAIR_CONCURRENCY);
    const results = await Promise.all(
      slice.map((t) =>
        fetchFastestTransit(
          origins[t.i],
          destinations[t.j],
          departureTime,
        ),
      ),
    );
    slice.forEach((t, k) => {
      matrix[t.i][t.j] = results[k];
    });
  }

  return matrix;
}
