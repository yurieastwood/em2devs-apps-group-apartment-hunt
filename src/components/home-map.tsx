"use client";

// Provider-agnostic wrapper for the home-page map. Currently Google Maps via
// @vis.gl/react-google-maps. To swap providers, write a sibling impl with
// the same prop shape (HomeMapGoogleProps) and change the import below.
import dynamic from "next/dynamic";
import type { HomeMapGoogleProps } from "./home-map-google";

export type HomeMapProps = HomeMapGoogleProps;

export const HomeMap = dynamic(
  () =>
    import("./home-map-google").then((mod) => mod.HomeMapGoogle),
  {
    ssr: false,
    loading: () => (
      <div className="aspect-[16/9] bg-muted rounded animate-pulse border border-border" />
    ),
  },
);
