"use client";

import { useEffect } from "react";
import L from "leaflet";
import {
  MapContainer,
  Marker,
  Popup,
  TileLayer,
  useMap,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";

const listingIcon = L.icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

const homeIcon = L.divIcon({
  html: `<div style="font-size:28px;line-height:1;text-align:center;filter:drop-shadow(0 1px 2px rgba(0,0,0,0.4))">🏠</div>`,
  className: "",
  iconSize: [32, 32],
  iconAnchor: [16, 28],
});

export type HomeMapPin = {
  id: string;
  lat: number;
  lng: number;
  label: string;
  href?: string;
};

export type HomeMapLeafletProps = {
  home: { lat: number; lng: number; label: string } | null;
  pins: HomeMapPin[];
};

export function HomeMapLeaflet({ home, pins }: HomeMapLeafletProps) {
  const positions: [number, number][] = [];
  if (home) positions.push([home.lat, home.lng]);
  for (const p of pins) positions.push([p.lat, p.lng]);

  if (positions.length === 0) {
    return (
      <div className="aspect-[16/9] bg-muted rounded flex items-center justify-center text-muted-foreground text-sm border border-border">
        Add a home address or a listing with coordinates to see the map.
      </div>
    );
  }

  const initialCenter: [number, number] = home
    ? [home.lat, home.lng]
    : positions[0];

  return (
    <div className="aspect-[16/9] rounded overflow-hidden border border-border">
      <MapContainer
        center={initialCenter}
        zoom={12}
        style={{ height: "100%", width: "100%" }}
        scrollWheelZoom={false}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <FitBounds positions={positions} />
        {home ? (
          <Marker position={[home.lat, home.lng]} icon={homeIcon}>
            <Popup>
              <strong>Your home</strong>
              <br />
              {home.label}
            </Popup>
          </Marker>
        ) : null}
        {pins.map((pin) => (
          <Marker
            key={pin.id}
            position={[pin.lat, pin.lng]}
            icon={listingIcon}
          >
            <Popup>
              {pin.href ? (
                <a
                  href={pin.href}
                  className="font-medium text-blue-600 underline"
                >
                  {pin.label}
                </a>
              ) : (
                <span className="font-medium">{pin.label}</span>
              )}
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}

function FitBounds({ positions }: { positions: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (positions.length === 0) return;
    if (positions.length === 1) {
      map.setView(positions[0], 14);
      return;
    }
    const bounds = L.latLngBounds(positions);
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 });
  }, [map, positions]);
  return null;
}
