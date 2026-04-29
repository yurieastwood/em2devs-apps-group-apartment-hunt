// Google Routes API v2 (computeRoutes) client. Server-side only.
// We use this in transit mode with computeAlternativeRoutes=true and pick
// the fastest returned alternative — the older Distance Matrix API only
// returned Google's default route, which often wasn't the fastest one
// surfaced in the Maps UI.
//
// Departure time is fixed at the next upcoming Tuesday 08:30 in
// America/Chicago, so cached durations consistently model the user's
// weekday morning commute scenario rather than whatever time the import
// happened to fire at.

const ENDPOINT =
  "https://routes.googleapis.com/directions/v2:computeRoutes";

export type LatLng = { lat: number; lng: number };

export type Distance = {
  durationSeconds: number | null;
  distanceMeters: number | null;
};

type RoutesResponse = {
  routes?: Array<{
    duration?: string; // "1234s"
    distanceMeters?: number;
  }>;
  error?: { message?: string; status?: string };
};

function parseDurationSeconds(d: string | undefined): number | null {
  if (!d) return null;
  const m = d.match(/^(\d+(?:\.\d+)?)s$/);
  return m ? Math.round(parseFloat(m[1])) : null;
}

// Returns the upcoming Tuesday 08:30 in America/Chicago as a UTC ISO string.
// Uses Intl.DateTimeFormat to read Chicago wall-clock parts (handles DST
// transitions automatically) and resolves the right UTC offset via
// `longOffset`. If today is Tuesday and it's already past 08:30, jumps to
// next week.
export function nextTuesdayMorningChicagoIso(): string {
  const TARGET_DOW = 2; // Sunday=0, Tuesday=2
  const TARGET_HOUR = 8;
  const TARGET_MINUTE = 30;

  const now = new Date();
  const partsArr = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    weekday: "short",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(now);
  const parts = Object.fromEntries(
    partsArr.map((p) => [p.type, p.value]),
  ) as Record<string, string>;

  const wdMap: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  const dow = wdMap[parts.weekday] ?? 0;
  const hour = parseInt(parts.hour, 10);
  const minute = parseInt(parts.minute, 10);
  const isPastTarget =
    hour > TARGET_HOUR || (hour === TARGET_HOUR && minute >= TARGET_MINUTE);

  let daysAhead = (TARGET_DOW - dow + 7) % 7;
  if (daysAhead === 0 && isPastTarget) daysAhead = 7;

  // Today's Chicago Y-M-D shifted by daysAhead, expressed via Intl on a
  // shifted Date object.
  const todayChicagoMidnightUtc = Date.UTC(
    parseInt(parts.year, 10),
    parseInt(parts.month, 10) - 1,
    parseInt(parts.day, 10),
  );
  const targetSeed = new Date(
    todayChicagoMidnightUtc + daysAhead * 86_400_000,
  );
  const targetParts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Chicago",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    })
      .formatToParts(targetSeed)
      .map((p) => [p.type, p.value]),
  ) as Record<string, string>;

  // Pretend "08:30 on the target Y-M-D" is UTC; then subtract the actual
  // Chicago offset for that moment to get the correct UTC instant.
  const pseudoUtcMs = Date.UTC(
    parseInt(targetParts.year, 10),
    parseInt(targetParts.month, 10) - 1,
    parseInt(targetParts.day, 10),
    TARGET_HOUR,
    TARGET_MINUTE,
  );
  const offsetMs = chicagoOffsetMsAt(new Date(pseudoUtcMs));
  return new Date(pseudoUtcMs - offsetMs).toISOString();
}

function chicagoOffsetMsAt(date: Date): number {
  const partsArr = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    timeZoneName: "longOffset",
  }).formatToParts(date);
  const offsetStr =
    partsArr.find((p) => p.type === "timeZoneName")?.value ?? "GMT-05:00";
  const m = offsetStr.match(/GMT([+-])(\d{1,2}):?(\d{2})?/);
  if (!m) return -5 * 3_600_000;
  const sign = m[1] === "+" ? 1 : -1;
  const h = parseInt(m[2], 10);
  const mn = m[3] ? parseInt(m[3], 10) : 0;
  return sign * (h * 3600 + mn * 60) * 1000;
}

// One origin → one destination. Returns the fastest transit alternative,
// or null on failure / no key configured. Callers that need a matrix should
// loop in parallel.
export async function fetchFastestTransit(
  origin: LatLng,
  dest: LatLng,
  departureTimeIso: string,
): Promise<Distance> {
  const apiKey = process.env.GOOGLE_MAPS_SERVER_KEY;
  if (!apiKey) {
    console.warn(
      "GOOGLE_MAPS_SERVER_KEY is not set; Routes API call skipped",
    );
    return { durationSeconds: null, distanceMeters: null };
  }

  const body = {
    origin: {
      location: {
        latLng: { latitude: origin.lat, longitude: origin.lng },
      },
    },
    destination: {
      location: {
        latLng: { latitude: dest.lat, longitude: dest.lng },
      },
    },
    travelMode: "TRANSIT",
    departureTime: departureTimeIso,
    computeAlternativeRoutes: true,
    units: "METRIC",
  };

  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": "routes.duration,routes.distanceMeters",
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      console.error("Routes API HTTP", res.status, await res.text());
      return { durationSeconds: null, distanceMeters: null };
    }
    const data = (await res.json()) as RoutesResponse;
    if (data.error) {
      console.error(
        "Routes API error",
        data.error.status,
        data.error.message,
      );
      return { durationSeconds: null, distanceMeters: null };
    }
    const routes = data.routes ?? [];
    if (routes.length === 0) {
      return { durationSeconds: null, distanceMeters: null };
    }
    // Pick the fastest of the returned alternatives.
    let best: Distance = { durationSeconds: null, distanceMeters: null };
    for (const r of routes) {
      const dur = parseDurationSeconds(r.duration);
      if (dur == null) continue;
      if (best.durationSeconds == null || dur < best.durationSeconds) {
        best = {
          durationSeconds: dur,
          distanceMeters: r.distanceMeters ?? null,
        };
      }
    }
    return best;
  } catch (err) {
    console.error("Routes API request failed:", err);
    return { durationSeconds: null, distanceMeters: null };
  }
}
