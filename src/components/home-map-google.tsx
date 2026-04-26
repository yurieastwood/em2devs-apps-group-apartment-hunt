"use client";

import { useEffect, useState } from "react";
import {
  AdvancedMarker,
  APIProvider,
  InfoWindow,
  Map,
  Pin,
  useMap,
} from "@vis.gl/react-google-maps";

export type HomeMapPin = {
  id: string;
  lat: number;
  lng: number;
  label: string;
  href?: string;
};

export type HomeMapPoi = {
  id: string;
  lat: number;
  lng: number;
  label: string;
  address?: string;
};

export type HomeMapGoogleProps = {
  home: { lat: number; lng: number; label: string } | null;
  pins: HomeMapPin[];
  pois?: HomeMapPoi[];
};

const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

export function HomeMapGoogle({
  home,
  pins,
  pois = [],
}: HomeMapGoogleProps) {
  const positions: Array<{ lat: number; lng: number }> = [];
  if (home) positions.push({ lat: home.lat, lng: home.lng });
  for (const p of pins) positions.push({ lat: p.lat, lng: p.lng });
  for (const p of pois) positions.push({ lat: p.lat, lng: p.lng });

  if (positions.length === 0) {
    return (
      <div className="aspect-[16/9] bg-muted rounded flex items-center justify-center text-muted-foreground text-sm border border-border">
        Add a home address or a listing with coordinates to see the map.
      </div>
    );
  }

  if (!apiKey) {
    return (
      <div className="aspect-[16/9] bg-muted rounded flex items-center justify-center text-muted-foreground text-sm border border-border text-center px-6">
        Google Maps API key not configured. Set
        <code className="font-mono mx-1">NEXT_PUBLIC_GOOGLE_MAPS_API_KEY</code>
        in environment variables.
      </div>
    );
  }

  const center = home ? { lat: home.lat, lng: home.lng } : positions[0];

  return (
    <div className="aspect-[16/9] rounded overflow-hidden border border-border">
      <APIProvider apiKey={apiKey}>
        <Map
          style={{ width: "100%", height: "100%" }}
          defaultCenter={center}
          defaultZoom={12}
          gestureHandling="cooperative"
          disableDefaultUI={false}
          mapId="apartment-hunt-map"
        >
          <FitBounds positions={positions} />
          {home ? <HomeMarker home={home} /> : null}
          {pois.map((p) => (
            <PoiMarker key={p.id} poi={p} />
          ))}
          {pins.map((pin) => (
            <ListingMarker key={pin.id} pin={pin} />
          ))}
        </Map>
      </APIProvider>
    </div>
  );
}

function HomeMarker({
  home,
}: {
  home: { lat: number; lng: number; label: string };
}) {
  const [open, setOpen] = useState(false);
  return (
    <AdvancedMarker
      position={{ lat: home.lat, lng: home.lng }}
      onClick={() => setOpen((v) => !v)}
    >
      <div
        style={{
          fontSize: 28,
          lineHeight: 1,
          filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.4))",
          transform: "translateY(-12px)",
        }}
      >
        🏠
      </div>
      {open ? (
        <InfoWindow
          position={{ lat: home.lat, lng: home.lng }}
          onCloseClick={() => setOpen(false)}
        >
          <strong>Your home</strong>
          <br />
          {home.label}
        </InfoWindow>
      ) : null}
    </AdvancedMarker>
  );
}

function PoiMarker({ poi }: { poi: HomeMapPoi }) {
  const [open, setOpen] = useState(false);
  return (
    <AdvancedMarker
      position={{ lat: poi.lat, lng: poi.lng }}
      onClick={() => setOpen((v) => !v)}
    >
      <Pin background="#16a34a" borderColor="#15803d" glyphColor="#ffffff" />
      {open ? (
        <InfoWindow
          position={{ lat: poi.lat, lng: poi.lng }}
          onCloseClick={() => setOpen(false)}
        >
          <strong>{poi.label}</strong>
          {poi.address ? (
            <>
              <br />
              {poi.address}
            </>
          ) : null}
        </InfoWindow>
      ) : null}
    </AdvancedMarker>
  );
}

function ListingMarker({ pin }: { pin: HomeMapPin }) {
  const [open, setOpen] = useState(false);
  return (
    <AdvancedMarker
      position={{ lat: pin.lat, lng: pin.lng }}
      onClick={() => setOpen((v) => !v)}
    >
      <Pin background="#2563eb" borderColor="#1e40af" glyphColor="#ffffff" />
      {open ? (
        <InfoWindow
          position={{ lat: pin.lat, lng: pin.lng }}
          onCloseClick={() => setOpen(false)}
        >
          {pin.href ? (
            <a
              href={pin.href}
              style={{
                fontWeight: 600,
                color: "#2563eb",
                textDecoration: "underline",
              }}
            >
              {pin.label}
            </a>
          ) : (
            <span style={{ fontWeight: 600 }}>{pin.label}</span>
          )}
        </InfoWindow>
      ) : null}
    </AdvancedMarker>
  );
}

function FitBounds({
  positions,
}: {
  positions: Array<{ lat: number; lng: number }>;
}) {
  const map = useMap();
  useEffect(() => {
    if (!map || positions.length === 0) return;
    if (positions.length === 1) {
      map.setCenter(positions[0]);
      map.setZoom(14);
      return;
    }
    const bounds = new google.maps.LatLngBounds();
    for (const p of positions) bounds.extend(p);
    map.fitBounds(bounds, 60);
  }, [map, positions]);
  return null;
}
