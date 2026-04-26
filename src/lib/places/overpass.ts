// OpenStreetMap Overpass API client. Free, no key, fair-use only.
// We use it to discover pre-K schools (`amenity=kindergarten` in OSM tagging
// is the closest match to US pre-K / preschool / kindergarten in practice).

const OVERPASS_ENDPOINT = "https://overpass-api.de/api/interpreter";
const USER_AGENT =
  "ApartmentHuntFamilyApp/1.0 (https://www.group-apartment-hunt.xyz)";

export type Preschool = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  address: string | null;
};

type OverpassElement = {
  id: number;
  type: string;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
};

type OverpassResponse = { elements: OverpassElement[] };

function buildAddress(tags: Record<string, string> | undefined): string | null {
  if (!tags) return null;
  if (tags["addr:full"]) return tags["addr:full"];
  const street = [tags["addr:housenumber"], tags["addr:street"]]
    .filter(Boolean)
    .join(" ");
  const cityZip = [tags["addr:city"], tags["addr:postcode"]]
    .filter(Boolean)
    .join(" ");
  const joined = [street, cityZip].filter(Boolean).join(", ");
  return joined || null;
}

export async function fetchPreschoolsAround(
  lat: number,
  lng: number,
  radiusMeters: number,
): Promise<Preschool[]> {
  const query = `[out:json][timeout:25];(node["amenity"="kindergarten"](around:${radiusMeters},${lat},${lng});way["amenity"="kindergarten"](around:${radiusMeters},${lat},${lng}););out center;`;

  try {
    const res = await fetch(OVERPASS_ENDPOINT, {
      method: "POST",
      body: `data=${encodeURIComponent(query)}`,
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": USER_AGENT,
      },
      // Cache by URL+body for 1h to be a good Overpass citizen.
      next: { revalidate: 3600 },
    });
    if (!res.ok) return [];
    const data = (await res.json()) as OverpassResponse;
    const out: Preschool[] = [];
    for (const el of data.elements ?? []) {
      const itemLat = el.lat ?? el.center?.lat;
      const itemLng = el.lon ?? el.center?.lon;
      if (itemLat == null || itemLng == null) continue;
      out.push({
        id: `${el.type}/${el.id}`,
        name: el.tags?.name ?? "Unnamed pre-K",
        lat: itemLat,
        lng: itemLng,
        address: buildAddress(el.tags),
      });
    }
    return out;
  } catch (err) {
    console.error("overpass query failed:", err);
    return [];
  }
}

export function distanceMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 6_371_000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}
