"use client";

import React, { useState, useMemo } from "react";
import { MapContainer, TileLayer, Marker, Circle, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { getDistanceMeters } from "@/lib/geoUtils";

// Fix for default Leaflet markers in Next.js
const defaultIcon = L.icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

interface LocationPickerProps {
  initialGps: { lat: number; lng: number };
  pinnedLocation: { lat: number; lng: number };
  onPinChange: (coords: { lat: number; lng: number }) => void;
  maxRadiusMeters?: number;
}

function MapEventsHandler({
  initialGps,
  maxRadiusMeters,
  onPinChange,
  setWarning,
}: {
  initialGps: { lat: number; lng: number };
  maxRadiusMeters: number;
  onPinChange: (coords: { lat: number; lng: number }) => void;
  setWarning: (msg: string | null) => void;
}) {
  useMapEvents({
    click(e) {
      const clickedLat = e.latlng.lat;
      const clickedLng = e.latlng.lng;
      const dist = getDistanceMeters(initialGps.lat, initialGps.lng, clickedLat, clickedLng);

      if (dist <= maxRadiusMeters) {
        setWarning(null);
        onPinChange({ lat: clickedLat, lng: clickedLng });
      } else {
        setWarning(`Cannot pin here. Must be within ${maxRadiusMeters}m of your detected GPS.`);
      }
    },
  });
  return null;
}

export default function TetheredLocationPicker({
  initialGps,
  pinnedLocation,
  onPinChange,
  maxRadiusMeters = 100,
}: LocationPickerProps) {
  const [warning, setWarning] = useState<string | null>(null);

  const markerEventHandlers = useMemo(
    () => ({
      dragend(e: L.DragEndEvent) {
        const marker = e.target;
        const position = marker.getLatLng();
        const dist = getDistanceMeters(initialGps.lat, initialGps.lng, position.lat, position.lng);

        if (dist <= maxRadiusMeters) {
          setWarning(null);
          onPinChange({ lat: position.lat, lng: position.lng });
        } else {
          setWarning(`Pin moved outside ${maxRadiusMeters}m bounds. Snapping back to GPS.`);
          marker.setLatLng([initialGps.lat, initialGps.lng]);
          onPinChange({ lat: initialGps.lat, lng: initialGps.lng });
        }
      },
    }),
    [initialGps, maxRadiusMeters, onPinChange]
  );

  return (
    <div className="space-y-2">
      <div className="relative w-full h-64 rounded-xl overflow-hidden border border-[#dce4de]">
        <MapContainer
          center={[pinnedLocation.lat, pinnedLocation.lng]}
          zoom={17}
          scrollWheelZoom={false}
          className="h-full w-full z-0"
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          <Circle
            center={[initialGps.lat, initialGps.lng]}
            radius={maxRadiusMeters}
            pathOptions={{
              color: "#124b35",
              fillColor: "#124b35",
              fillOpacity: 0.1,
              weight: 2,
              dashArray: "5, 5",
            }}
          />

          <Marker
            position={[pinnedLocation.lat, pinnedLocation.lng]}
            draggable={true}
            eventHandlers={markerEventHandlers}
            icon={defaultIcon}
          />

          <MapEventsHandler
            initialGps={initialGps}
            maxRadiusMeters={maxRadiusMeters}
            onPinChange={onPinChange}
            setWarning={setWarning}
          />
        </MapContainer>
      </div>

      {warning && <p className="text-xs font-bold text-red-500 animate-pulse">{warning}</p>}
      
      <div className="flex items-center justify-between text-xs text-[#718078]">
        <span>Drag pin to adjust (Max {maxRadiusMeters}m)</span>
        <button
          type="button"
          onClick={() => {
            onPinChange({ lat: initialGps.lat, lng: initialGps.lng });
            setWarning(null);
          }}
          className="text-[#124b35] hover:underline font-bold"
        >
          Reset to Center
        </button>
      </div>
    </div>
  );
}