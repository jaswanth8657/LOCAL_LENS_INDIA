import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, Tooltip, useMap } from 'react-leaflet';
import L from 'leaflet';
import { Place, ItineraryStop } from '../../types';
import { VerificationBadge } from '../ui/Badge';
import { MapPin, Navigation, Info, AlertTriangle } from 'lucide-react';

// Fix default Leaflet icon paths in Vite/Webpack
delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown })._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

interface InteractiveMapProps {
  centerLat: number;
  centerLng: number;
  zoom?: number;
  places?: Place[];
  selectedPlace?: Place | null;
  onSelectPlace?: (place: Place) => void;
  radiusKm?: number;
  searchMarker?: {
    lat: number;
    lng: number;
    title: string;
    subtitle?: string;
  } | null;
  itineraryStops?: ItineraryStop[];
  showRoutePolyline?: boolean;
}

// Controller component to smoothly pan/zoom when center or selectedPlace changes
const MapRecenter: React.FC<{ lat: number; lng: number; zoom: number }> = ({ lat, lng, zoom }) => {
  const map = useMap();
  useEffect(() => {
    map.setView([lat, lng], zoom, { animate: true });
  }, [lat, lng, zoom, map]);
  return null;
};

// Component to automatically fit bounds to itinerary stops
const MapBoundsFitter: React.FC<{ positions: [number, number][] }> = ({ positions }) => {
  const map = useMap();
  useEffect(() => {
    if (positions.length > 0) {
      if (positions.length === 1) {
        map.setView(positions[0], 14, { animate: true });
      } else {
        const bounds = L.latLngBounds(positions);
        map.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 });
      }
    }
  }, [positions, map]);
  return null;
};

// Numbered Marker Icon for Itinerary Stops
const createNumberedIcon = (order: number) => {
  return L.divIcon({
    className: 'custom-itinerary-marker',
    html: `<div style="
      background: linear-gradient(135deg, #F97316 0%, #EA580C 100%);
      color: white;
      width: 26px;
      height: 26px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 800;
      font-size: 12px;
      border: 2px solid white;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.4);
    ">${order}</div>`,
    iconSize: [26, 26],
    iconAnchor: [13, 13],
    popupAnchor: [0, -13],
  });
};

export const InteractiveMap: React.FC<InteractiveMapProps> = ({
  centerLat,
  centerLng,
  zoom = 13,
  places = [],
  selectedPlace = null,
  onSelectPlace,
  searchMarker = null,
  itineraryStops,
  showRoutePolyline = true,
}) => {
  const [mapType, setMapType] = useState<'standard' | 'humanitarian'>('standard');
  const [showRadiusGuide, setShowRadiusGuide] = useState(false);

  // If itineraryStops are provided, extract valid positions for route
  const validItineraryStops = (itineraryStops || []).filter(
    (s) => typeof s.latitude === 'number' && typeof s.longitude === 'number' && !isNaN(s.latitude) && !isNaN(s.longitude)
  );
  const itineraryRoutePositions: [number, number][] = validItineraryStops.map((s) => [s.latitude!, s.longitude!]);

  const missingCoordsStops = (itineraryStops || []).filter(
    (s) => typeof s.latitude !== 'number' || typeof s.longitude !== 'number' || isNaN(s.latitude) || isNaN(s.longitude)
  );

  // If a place or search marker is selected, prioritize its coordinate
  const activeLat = selectedPlace
    ? selectedPlace.latitude
    : searchMarker
    ? searchMarker.lat
    : validItineraryStops.length > 0
    ? validItineraryStops[0].latitude!
    : centerLat;
  const activeLng = selectedPlace
    ? selectedPlace.longitude
    : searchMarker
    ? searchMarker.lng
    : validItineraryStops.length > 0
    ? validItineraryStops[0].longitude!
    : centerLng;

  const tileUrl =
    mapType === 'standard'
      ? 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
      : 'https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png';

  // Strict check: Only show markers that have authentic, verified latitude and longitude
  const validPlaces = places.filter(
    (p) => typeof p.latitude === 'number' && typeof p.longitude === 'number' && !isNaN(p.latitude)
  );

  return (
    <div className="relative w-full h-full min-h-[420px] rounded-3xl overflow-hidden border border-slate-200 dark:border-white/10 shadow-2xl bg-slate-100 dark:bg-[#070A13]">
      {/* Top Map Layer Controls & Coordinate Readout */}
      <div className="absolute top-4 left-4 right-4 z-[1000] flex flex-wrap items-center justify-between gap-2 pointer-events-none">
        <div className="flex items-center gap-2 pointer-events-auto">
          <div className="flex items-center p-1 rounded-xl bg-white/90 dark:bg-slate-950/85 backdrop-blur-xl border border-slate-200 dark:border-white/10 text-xs shadow-lg">
            <button
              type="button"
              onClick={() => setMapType('standard')}
              className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
                mapType === 'standard'
                  ? 'bg-brand-saffron text-white font-bold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              OSM Standard
            </button>
            <button
              type="button"
              onClick={() => setMapType('humanitarian')}
              className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
                mapType === 'humanitarian'
                  ? 'bg-brand-saffron text-white font-bold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              OSM Humanitarian
            </button>
          </div>

          <button
            type="button"
            onClick={() => setShowRadiusGuide(!showRadiusGuide)}
            className="px-3 py-1.5 rounded-xl bg-white/90 dark:bg-slate-950/85 backdrop-blur-xl border border-slate-200 dark:border-white/10 text-xs text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white pointer-events-auto flex items-center gap-1.5 shadow-lg"
          >
            <Navigation className="w-3.5 h-3.5 text-brand-teal" />
            <span>5km Radius</span>
          </button>
        </div>

        {/* Real Coordinates HUD */}
        <div className="px-3 py-1.5 rounded-xl bg-white/90 dark:bg-slate-950/85 backdrop-blur-xl border border-slate-200 dark:border-white/10 text-[11px] font-mono text-slate-700 dark:text-slate-300 pointer-events-auto shadow-lg flex items-center gap-1.5">
          <MapPin className="w-3.5 h-3.5 text-brand-saffron" />
          <span>{activeLat.toFixed(4)}° N, {activeLng.toFixed(4)}° E</span>
        </div>
      </div>

      {/* Notice for Stops with Missing Coordinates if applicable */}
      {missingCoordsStops.length > 0 && (
        <div className="absolute top-16 left-4 right-4 z-[999] pointer-events-auto max-w-md p-2 rounded-xl bg-amber-500/90 text-white text-[11px] font-semibold flex items-center gap-2 shadow-lg backdrop-blur-md">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span className="truncate">
            Coordinates unavailable for: {missingCoordsStops.map((s) => s.placeName).join(', ')} (shown in timeline only)
          </span>
        </div>
      )}

      {/* Route Polyline Legend overlay at bottom */}
      {itineraryStops && itineraryStops.length > 0 && (
        <div className="absolute bottom-4 left-4 right-4 z-[999] pointer-events-auto flex items-center justify-between p-2.5 rounded-2xl bg-white/95 dark:bg-slate-950/90 backdrop-blur-xl border border-slate-200 dark:border-white/10 text-[11px] text-slate-700 dark:text-slate-300 shadow-xl flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <div className="w-5 h-0.5 border-t-2 border-dashed border-orange-500" />
            <span className="font-semibold text-stone-900 dark:text-white">
              Itinerary sequence (approximate straight-line visual connection)
            </span>
          </div>
          <span className="text-[10px] text-stone-500 dark:text-slate-400">
            {validItineraryStops.length} stops mapped
          </span>
        </div>
      )}

      {/* Verified Notice Status Overlay if 0 places and 0 stops loaded */}
      {validPlaces.length === 0 && validItineraryStops.length === 0 && (
        <div className="absolute bottom-5 left-5 z-[1000] max-w-sm p-3.5 rounded-2xl bg-white/95 dark:bg-slate-950/90 backdrop-blur-xl border border-slate-200 dark:border-white/10 text-xs text-slate-700 dark:text-slate-300 shadow-2xl flex items-start gap-3">
          <Info className="w-4 h-4 text-sky-500 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-bold text-slate-900 dark:text-white">Strict Factual Map Mode Active</p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Interactive Leaflet engine ready with OpenStreetMap tiles. Fake pins are forbidden. Authentic place markers stream from verified database records.
            </p>
          </div>
        </div>
      )}

      {/* Leaflet Map */}
      <MapContainer
        center={[activeLat, activeLng]}
        zoom={zoom}
        scrollWheelZoom={true}
        className="w-full h-full z-0"
      >
        {validItineraryStops.length > 0 ? (
          <MapBoundsFitter positions={itineraryRoutePositions} />
        ) : (
          <MapRecenter lat={activeLat} lng={activeLng} zoom={zoom} />
        )}

        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url={tileUrl}
        />

        {/* Search Result Pin if Geocoded */}
        {searchMarker && (
          <Marker position={[searchMarker.lat, searchMarker.lng]}>
            <Popup>
              <div className="p-1 space-y-1 text-slate-900 dark:text-slate-100 max-w-[220px]">
                <div className="font-bold text-sm text-brand-spice flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5" />
                  <span>{searchMarker.title}</span>
                </div>
                {searchMarker.subtitle && (
                  <p className="text-xs text-slate-600 dark:text-slate-300">{searchMarker.subtitle}</p>
                )}
                <div className="pt-1 text-[10px] font-mono text-slate-400">
                  {searchMarker.lat.toFixed(4)}° N, {searchMarker.lng.toFixed(4)}° E
                </div>
              </div>
            </Popup>
          </Marker>
        )}

        {/* Regular Places Markers */}
        {validPlaces.map((place) => (
          <Marker
            key={place.id}
            position={[place.latitude, place.longitude]}
            eventHandlers={{
              click: () => onSelectPlace && onSelectPlace(place),
            }}
          >
            <Popup>
              <div className="p-1 space-y-2 text-slate-900 dark:text-slate-100 max-w-[220px]">
                <div className="font-bold text-sm text-slate-900 dark:text-white">{place.name}</div>
                <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-2">{place.description}</p>
                <div className="pt-1 flex items-center justify-between text-xs">
                  <VerificationBadge status={place.verificationStatus} />
                  {place.ticketPriceInr !== undefined && (
                    <span className="font-bold text-emerald-600 dark:text-emerald-400">₹{place.ticketPriceInr}</span>
                  )}
                </div>
              </div>
            </Popup>
          </Marker>
        ))}

        {/* Itinerary Straight-Line Visual Polyline */}
        {showRoutePolyline && itineraryRoutePositions.length > 1 && (
          <Polyline
            positions={itineraryRoutePositions}
            pathOptions={{
              color: '#EA580C',
              weight: 3.5,
              dashArray: '8, 6',
              opacity: 0.85,
            }}
          >
            <Tooltip sticky>
              Itinerary sequence (approximate straight-line visual connection)
            </Tooltip>
          </Polyline>
        )}

        {/* Numbered Itinerary Stop Markers */}
        {validItineraryStops.map((stop) => (
          <Marker
            key={stop.id}
            position={[stop.latitude!, stop.longitude!]}
            icon={createNumberedIcon(stop.stopOrder)}
          >
            <Popup>
              <div className="p-1 space-y-1.5 text-slate-900 dark:text-slate-100 max-w-[220px]">
                <div className="flex items-center gap-1.5 text-[10px] font-bold text-brand-spice uppercase">
                  <span>Stop {stop.stopOrder}</span>
                  <span>•</span>
                  <span>{stop.timeSlot}</span>
                </div>
                <div className="font-bold text-sm text-slate-900 dark:text-white">
                  {stop.placeName}
                </div>
                <div className="text-xs text-slate-600 dark:text-slate-300">
                  {stop.time} ({stop.durationMinutes} mins)
                </div>
                {stop.localTips && (
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 italic">
                    "{stop.localTips}"
                  </p>
                )}
                {stop.costInr !== undefined && (
                  <div className="text-xs font-semibold text-emerald-500">
                    {stop.costInr === 0 ? 'Free Entry' : `₹${stop.costInr}`}
                  </div>
                )}
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
};
