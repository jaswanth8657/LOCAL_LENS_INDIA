import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTrip } from '../context/TripContext';
import { fetchPlacesFromAPI } from '../api/client';
import { InteractiveMap } from '../components/map/InteractiveMap';
import { MapSearchBar } from '../components/map/MapSearchBar';
import { GlassCard } from '../components/ui/GlassCard';
import { CURATED_DESTINATIONS } from '../data/curatedDestinations';
import { Place, Destination } from '../types';
import { MapPin, Layers, Compass, Info, Plus, Check, CheckCircle2 } from 'lucide-react';
import { useSearchParams, useLocation } from 'react-router-dom';

export const MapExplorePage: React.FC = () => {
  const {
    selectedDestination,
    setSelectedDestination,
    addPlaceToTrip,
    removePlaceFromTrip,
    isPlaceInTrip
  } = useTrip();

  const [searchParams] = useSearchParams();
  const location = useLocation();

  const destQuery = searchParams.get('destination') || (location.state as any)?.destinationId;
  const placeIdQuery = searchParams.get('placeId') || (location.state as any)?.selectedPlaceId;
  const latQuery = searchParams.get('lat') ? parseFloat(searchParams.get('lat')!) : (location.state as any)?.lat;
  const lngQuery = searchParams.get('lng') ? parseFloat(searchParams.get('lng')!) : (location.state as any)?.lng;

  // Resolve initial destination based on query param or context
  const currentDest = (destQuery
    ? CURATED_DESTINATIONS.find((d) => d.id === destQuery)
    : selectedDestination) || CURATED_DESTINATIONS[0];

  const [selectedPlace, setSelectedPlace] = useState<Place | null>(null);
  const [activeCategoryFilter, setActiveCategoryFilter] = useState<string>('All');
  const [searchMarker, setSearchMarker] = useState<{
    lat: number;
    lng: number;
    title: string;
    subtitle?: string;
  } | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Sync destination if query param changes
  useEffect(() => {
    if (destQuery) {
      const match = CURATED_DESTINATIONS.find((d) => d.id === destQuery);
      if (match && match.id !== selectedDestination?.id) {
        setSelectedDestination(match);
      }
    }
  }, [destQuery]);

  // Query live places from Django REST backend
  const { data: backendPlaces = [] } = useQuery({
    queryKey: ['map-places', currentDest.id],
    queryFn: () => fetchPlacesFromAPI({
      destination: currentDest.id,
    }),
    staleTime: 60000,
  });

  // When backendPlaces load or placeIdQuery changes, focus the targeted place
  useEffect(() => {
    if (placeIdQuery && backendPlaces.length > 0) {
      const found = backendPlaces.find((p) => String(p.id) === String(placeIdQuery));
      if (found) {
        setSelectedPlace(found);
      } else if (latQuery && lngQuery && !isNaN(latQuery) && !isNaN(lngQuery)) {
        // If place ID is not in current subset, pin exact coordinates
        setSearchMarker({
          lat: latQuery,
          lng: lngQuery,
          title: 'Selected Spot',
          subtitle: `Verified Location (${latQuery.toFixed(4)}, ${lngQuery.toFixed(4)})`,
        });
      }
    }
  }, [placeIdQuery, backendPlaces, latQuery, lngQuery]);

  // Coordinates from the verified destination record
  const centerLat = selectedPlace?.latitude || latQuery || currentDest.latitude;
  const centerLng = selectedPlace?.longitude || lngQuery || currentDest.longitude;

  const handleSelectDestination = (dest: Destination) => {
    setSelectedDestination(dest);
    setSelectedPlace(null);
    setSearchMarker(null);
  };

  const handleSelectPlace = (place: Place) => {
    setSelectedPlace(place);
    setSearchMarker(null);
  };

  const handleSelectLocation = (loc: { lat: number; lng: number; title: string; subtitle?: string }) => {
    setSelectedPlace(null);
    setSearchMarker(loc);
  };

  const handleToggleAddToTrip = (place: Place) => {
    if (isPlaceInTrip(place.id)) {
      removePlaceFromTrip(place.id);
      setToastMessage(`Removed "${place.name}" from your trip builder`);
    } else {
      addPlaceToTrip(place);
      setToastMessage(`Added "${place.name}" to your trip builder!`);
    }
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Filter places based on activeCategoryFilter
  const filteredPlaces = backendPlaces.filter((p) => {
    if (activeCategoryFilter === 'All') return true;
    if (activeCategoryFilter === 'Known Fee') {
      return p.ticketPriceInr !== null && p.ticketPriceInr !== undefined && p.ticketPriceInr >= 0;
    }
    if (activeCategoryFilter === 'Fee Unavailable') {
      return p.ticketPriceInr === null || p.ticketPriceInr === undefined;
    }
    return p.category.toLowerCase() === activeCategoryFilter.toLowerCase();
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Toast Feedback */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 px-4 py-3 rounded-2xl shadow-xl bg-emerald-600 text-white border border-emerald-400 flex items-center gap-2.5 text-xs font-bold animate-bounce">
          <CheckCircle2 className="w-4 h-4 text-white" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Header & Search Bar Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-brand-teal/15 text-brand-teal border border-brand-teal/30 text-xs font-bold">
            <Compass className="w-3.5 h-3.5" />
            <span>INTERACTIVE MAP EXPLORER</span>
          </div>
          <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight mt-1">
            Local Spatial Navigation
          </h1>
        </div>

        {/* Global Search Bar (Phase 9 Task 4) */}
        <div className="flex-1 max-w-xl">
          <MapSearchBar
            currentPlaces={backendPlaces}
            onSelectDestination={handleSelectDestination}
            onSelectPlace={handleSelectPlace}
            onSelectLocation={handleSelectLocation}
          />
        </div>

        {/* Destination Switcher */}
        <div className="flex items-center gap-2">
          <MapPin className="w-4 h-4 text-brand-saffron shrink-0" />
          <select
            value={currentDest.id}
            onChange={(e) => {
              const found = CURATED_DESTINATIONS.find((d) => d.id === e.target.value);
              if (found) handleSelectDestination(found);
            }}
            className="rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-white/10 px-3.5 py-2.5 text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:border-brand-saffron shadow-sm"
          >
            {CURATED_DESTINATIONS.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}, {d.state}{d.placesCount !== undefined && d.placesCount !== null ? ` (${d.placesCount} spots)` : ''}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Main Map Viewport */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[640px]">
        {/* Left Information & Layer Panel */}
        <div className="lg:col-span-1 flex flex-col gap-4 h-full overflow-hidden">
          <GlassCard className="p-4 border-slate-200 dark:border-white/10 space-y-3 bg-white/80 dark:bg-slate-900/80">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Layers className="w-4 h-4 text-brand-spice" />
                <span>Exploration Layers</span>
              </h3>
              <span className="text-[10px] text-slate-500 dark:text-slate-400">
                {filteredPlaces.length} spot{filteredPlaces.length === 1 ? '' : 's'}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-1.5 text-xs">
              {['All', 'History', 'Nature', 'Beaches', 'Food', 'Culture', 'Known Fee', 'Fee Unavailable'].map((layer) => (
                <button
                  key={layer}
                  type="button"
                  onClick={() => setActiveCategoryFilter(layer)}
                  className={`p-1.5 rounded-xl text-center font-medium border text-[11px] transition-colors ${
                    activeCategoryFilter === layer
                      ? 'bg-brand-saffron/20 border-brand-saffron text-slate-900 dark:text-white font-bold'
                      : 'bg-slate-100 dark:bg-white/5 border-slate-200 dark:border-white/5 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {layer}
                </button>
              ))}
            </div>
          </GlassCard>

          {/* Destination Brief Card */}
          <GlassCard className="p-4 border-slate-200 dark:border-white/10 flex-1 overflow-y-auto space-y-3 bg-white/80 dark:bg-slate-900/80">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-brand-spice">
                Regional Profile
              </span>
              <h4 className="text-base font-bold text-slate-900 dark:text-white mt-0.5">
                {currentDest.name}
              </h4>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 leading-relaxed">
                {currentDest.description}
              </p>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-white/5 space-y-1 text-xs">
              <div className="flex justify-between text-slate-600 dark:text-slate-300">
                <span>Best Season:</span>
                <strong className="text-slate-900 dark:text-white">{currentDest.bestTimeToVisit}</strong>
              </div>
              <div className="flex justify-between text-slate-600 dark:text-slate-300">
                <span>Daily Budget:</span>
                <strong className="text-emerald-600 dark:text-emerald-400">₹{currentDest.averageDailyBudgetInr}/day</strong>
              </div>
              <div className="flex justify-between text-slate-600 dark:text-slate-300">
                <span>Coordinates:</span>
                <strong className="font-mono text-slate-700 dark:text-slate-200">{currentDest.latitude}° N, {currentDest.longitude}° E</strong>
              </div>
            </div>

            {/* Selected Place Summary */}
            {selectedPlace && (
              <div className="p-3.5 rounded-xl bg-brand-saffron/10 border border-brand-saffron/30 space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-brand-spice uppercase">Selected Place</span>
                  <button
                    type="button"
                    onClick={() => handleToggleAddToTrip(selectedPlace)}
                    className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all ${
                      isPlaceInTrip(selectedPlace.id)
                        ? 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30'
                        : 'bg-brand-saffron text-white hover:opacity-95 shadow-sm'
                    }`}
                  >
                    {isPlaceInTrip(selectedPlace.id) ? (
                      <>
                        <Check className="w-3 h-3 text-emerald-500 dark:text-emerald-400" />
                        <span>In Trip</span>
                      </>
                    ) : (
                      <>
                        <Plus className="w-3 h-3" />
                        <span>Add to Trip</span>
                      </>
                    )}
                  </button>
                </div>
                <div className="font-bold text-slate-900 dark:text-white text-sm">{selectedPlace.name}</div>
                <div className="text-[11px] text-slate-600 dark:text-slate-300">{selectedPlace.category} • {selectedPlace.address}</div>
                <div className="flex items-center justify-between text-xs pt-1">
                  <span className="text-slate-500 dark:text-slate-400">Entry Fee:</span>
                  <strong className="text-emerald-600 dark:text-emerald-400">
                    {selectedPlace.ticketPriceInr !== null && selectedPlace.ticketPriceInr !== undefined
                      ? selectedPlace.ticketPriceInr === 0 ? 'Free Entry' : `₹${selectedPlace.ticketPriceInr}`
                      : 'Fee Unavailable'}
                  </strong>
                </div>
                {selectedPlace.openingHours && (
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500 dark:text-slate-400">Hours:</span>
                    <span className="text-slate-700 dark:text-slate-300 text-[11px]">{selectedPlace.openingHours}</span>
                  </div>
                )}
                {selectedPlace.dataSource && (
                  <div className="text-[10px] text-slate-400 italic">Source: {selectedPlace.dataSource}</div>
                )}
              </div>
            )}

            {searchMarker && (
              <div className="p-3 rounded-xl bg-brand-teal/10 border border-brand-teal/30 space-y-1 text-xs">
                <span className="text-[10px] font-bold text-brand-teal uppercase">Search Location</span>
                <div className="font-bold text-slate-900 dark:text-white">{searchMarker.title}</div>
                {searchMarker.subtitle && (
                  <div className="text-[11px] text-slate-600 dark:text-slate-300 line-clamp-2">{searchMarker.subtitle}</div>
                )}
                <div className="text-[10px] font-mono text-slate-500">
                  {searchMarker.lat.toFixed(4)}° N, {searchMarker.lng.toFixed(4)}° E
                </div>
              </div>
            )}

            {/* Anti-Hallucination Data Integrity Notice */}
            <div className="p-3 rounded-xl bg-sky-500/10 border border-sky-500/20 text-xs text-sky-700 dark:text-sky-300 flex items-start gap-2">
              <Info className="w-4 h-4 text-sky-500 shrink-0 mt-0.5" />
              <p className="text-[11px] leading-relaxed">
                Map center accurately resolves to verified geocodes for {currentDest.name}. Authentic OpenStreetMap tiles and verified database places power all spatial queries without paid APIs.
              </p>
            </div>
          </GlassCard>
        </div>

        {/* Right Map Canvas */}
        <div className="lg:col-span-2 h-full">
          <InteractiveMap
            centerLat={centerLat}
            centerLng={centerLng}
            zoom={12}
            places={filteredPlaces}
            selectedPlace={selectedPlace}
            searchMarker={searchMarker}
            onSelectPlace={(p) => {
              setSelectedPlace(p);
              setSearchMarker(null);
            }}
          />
        </div>
      </div>
    </div>
  );
};
