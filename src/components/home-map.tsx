"use client";

// Provider-agnostic wrapper for the home-page map. The current implementation
// is OpenStreetMap + Leaflet. To switch to Mapbox or Google Maps later, write
// a sibling file (e.g. home-map-mapbox.tsx) that exports a component with the
// same props (HomeMapLeafletProps shape) and replace the dynamic import below.
import dynamic from "next/dynamic";
import type { HomeMapLeafletProps } from "./home-map-leaflet";

export type HomeMapProps = HomeMapLeafletProps;

export const HomeMap = dynamic(
  () =>
    import("./home-map-leaflet").then((mod) => mod.HomeMapLeaflet),
  {
    ssr: false,
    loading: () => (
      <div className="aspect-[16/9] bg-muted rounded animate-pulse border border-border" />
    ),
  },
);
