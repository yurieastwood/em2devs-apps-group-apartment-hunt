import {
  distanceMeters,
  fetchPreschoolsAround,
  type Preschool,
} from "@/lib/places/overpass";

type Props = {
  lat: number | null;
  lng: number | null;
};

function fmtDistance(m: number): string {
  if (m < 1000) return `${Math.round(m)} m`;
  return `${(m / 1000).toFixed(2)} km`;
}

export async function NearbySchools({ lat, lng }: Props) {
  if (lat == null || lng == null) return null;

  const schools = await fetchPreschoolsAround(lat, lng, 1500);
  const ranked: (Preschool & { distanceM: number })[] = schools
    .map((s) => ({ ...s, distanceM: distanceMeters(lat, lng, s.lat, s.lng) }))
    .sort((a, b) => a.distanceM - b.distanceM)
    .slice(0, 5);

  return (
    <section className="mt-8 border-t border-border pt-6">
      <h2 className="text-lg font-semibold mb-3">Nearby pre-K schools</h2>
      {ranked.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No pre-K schools found within 1.5 km on OpenStreetMap. Coverage may
          be incomplete.
        </p>
      ) : (
        <ul className="space-y-2 text-sm">
          {ranked.map((s) => (
            <li key={s.id} className="flex flex-wrap items-baseline gap-x-3">
              <span className="font-medium">{s.name}</span>
              <span className="text-muted-foreground">
                {fmtDistance(s.distanceM)}
              </span>
              {s.address ? (
                <span className="text-muted-foreground text-xs">
                  — {s.address}
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      )}
      <p className="text-xs text-muted-foreground mt-3">
        Source: OpenStreetMap (`amenity=kindergarten`). Coverage varies by
        region.
      </p>
    </section>
  );
}
