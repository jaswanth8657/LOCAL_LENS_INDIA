import React, { useState, useEffect, useRef } from 'react';
import { Search, X, Loader2, MapPin, Compass, Landmark } from 'lucide-react';
import { CURATED_DESTINATIONS } from '../../data/curatedDestinations';
import { Destination, Place } from '../../types';

export interface SearchResultItem {
  id: string;
  type: 'destination' | 'place' | 'nominatim';
  title: string;
  subtitle: string;
  lat: number;
  lng: number;
  data?: Destination | Place;
}

interface MapSearchBarProps {
  currentPlaces: Place[];
  onSelectDestination: (destination: Destination) => void;
  onSelectPlace: (place: Place) => void;
  onSelectLocation: (location: { lat: number; lng: number; title: string; subtitle?: string }) => void;
}

// In-memory cache for Nominatim responses to respect usage policies and prevent repeat queries
const nominatimCache = new Map<string, SearchResultItem[]>();

export const MapSearchBar: React.FC<MapSearchBarProps> = ({
  currentPlaces,
  onSelectDestination,
  onSelectPlace,
  onSelectLocation,
}) => {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState<SearchResultItem[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Debounced search effect
  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setResults([]);
      setIsLoading(false);
      setHasSearched(false);
      return;
    }

    const lowerQuery = trimmed.toLowerCase();

    // 1. Immediate Local Matches from Curated Destinations
    const destMatches: SearchResultItem[] = CURATED_DESTINATIONS
      .filter(
        (d) =>
          d.name.toLowerCase().includes(lowerQuery) ||
          d.state.toLowerCase().includes(lowerQuery) ||
          d.tagline.toLowerCase().includes(lowerQuery)
      )
      .slice(0, 4)
      .map((d) => ({
        id: `dest-${d.id}`,
        type: 'destination',
        title: d.name,
        subtitle: `${d.state} • Curated Hub`,
        lat: d.latitude,
        lng: d.longitude,
        data: d,
      }));

    // 2. Immediate Local Matches from loaded / verified database places
    const placeMatches: SearchResultItem[] = currentPlaces
      .filter(
        (p) =>
          p.name.toLowerCase().includes(lowerQuery) ||
          p.category.toLowerCase().includes(lowerQuery) ||
          (p.address && p.address.toLowerCase().includes(lowerQuery))
      )
      .slice(0, 5)
      .map((p) => ({
        id: `place-${p.id}`,
        type: 'place',
        title: p.name,
        subtitle: `${p.category} • ${p.address || 'Verified Sight'}`,
        lat: p.latitude,
        lng: p.longitude,
        data: p,
      }));

    // Initially show instant local results
    const instantResults = [...destMatches, ...placeMatches];
    setResults(instantResults);
    setIsOpen(true);

    // 3. Debounced Nominatim Geocoding Fallback (>= 3 chars, 1s debounce)
    if (trimmed.length >= 3) {
      setIsLoading(true);

      const timer = setTimeout(async () => {
        // Check cache first
        if (nominatimCache.has(lowerQuery)) {
          const cached = nominatimCache.get(lowerQuery)!;
          setResults([...instantResults, ...cached]);
          setIsLoading(false);
          setHasSearched(true);
          return;
        }

        try {
          const nominatimUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
            trimmed
          )}&countrycodes=in&limit=5`;

          const response = await fetch(nominatimUrl, {
            headers: {
              Accept: 'application/json',
              // Custom User-Agent compliant with OSM Nominatim usage policy
              'User-Agent': 'LocalLensIndia/1.0 (contact: locallensindia@example.com)',
            },
          });

          if (response.ok) {
            const data = await response.json();
            const geoResults: SearchResultItem[] = (Array.isArray(data) ? data : [])
              .map((item: any) => ({
                id: `nom-${item.place_id || item.osm_id || Math.random()}`,
                type: 'nominatim' as const,
                title: item.name || item.display_name.split(',')[0],
                subtitle: item.display_name,
                lat: parseFloat(item.lat),
                lng: parseFloat(item.lon),
              }))
              .filter((item: SearchResultItem) => !isNaN(item.lat) && !isNaN(item.lng));

            nominatimCache.set(lowerQuery, geoResults);
            setResults([...instantResults, ...geoResults]);
          }
        } catch (err) {
          console.warn('Nominatim lookup skipped or blocked:', err);
        } finally {
          setIsLoading(false);
          setHasSearched(true);
        }
      }, 1000); // 1000ms debounce respecting Nominatim rate limits

      return () => clearTimeout(timer);
    } else {
      setIsLoading(false);
      setHasSearched(true);
    }
  }, [query, currentPlaces]);

  const handleClear = () => {
    setQuery('');
    setResults([]);
    setIsOpen(false);
    setHasSearched(false);
  };

  const handleSelectItem = (item: SearchResultItem) => {
    setQuery(item.title);
    setIsOpen(false);

    if (item.type === 'destination' && item.data) {
      onSelectDestination(item.data as Destination);
    } else if (item.type === 'place' && item.data) {
      onSelectPlace(item.data as Place);
    } else {
      onSelectLocation({
        lat: item.lat,
        lng: item.lng,
        title: item.title,
        subtitle: item.subtitle,
      });
    }
  };

  return (
    <div ref={containerRef} className="relative w-full max-w-xl">
      {/* Search Input Box */}
      <div className="relative flex items-center">
        <div className="absolute left-3.5 text-slate-400 pointer-events-none">
          {isLoading ? (
            <Loader2 className="w-4 h-4 animate-spin text-brand-saffron" />
          ) : (
            <Search className="w-4 h-4" />
          )}
        </div>

        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => {
            if (query.trim().length >= 2) setIsOpen(true);
          }}
          placeholder="Search places, cities, temples, beaches, landmarks..."
          className="w-full pl-10 pr-10 py-2.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 text-xs sm:text-sm font-medium text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-brand-saffron focus:ring-2 focus:ring-brand-saffron/20 shadow-sm transition-all"
        />

        {query && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-3 p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 transition-colors"
            title="Clear search"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Autocomplete Suggestions Dropdown */}
      {isOpen && query.trim().length >= 2 && (
        <div className="absolute left-0 right-0 mt-2 max-h-80 overflow-y-auto rounded-2xl bg-white/95 dark:bg-slate-950/95 backdrop-blur-2xl border border-slate-200 dark:border-white/10 shadow-2xl z-[1500] p-1.5 space-y-1">
          {results.length > 0 ? (
            results.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => handleSelectItem(item)}
                className="w-full text-left flex items-start gap-3 p-2.5 rounded-xl hover:bg-slate-100 dark:hover:bg-white/5 transition-colors group"
              >
                <div className="mt-0.5 p-1.5 rounded-lg bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-brand-spice shrink-0">
                  {item.type === 'destination' ? (
                    <Compass className="w-4 h-4" />
                  ) : item.type === 'place' ? (
                    <Landmark className="w-4 h-4 text-brand-teal" />
                  ) : (
                    <MapPin className="w-4 h-4 text-brand-saffron" />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-slate-900 dark:text-white truncate group-hover:text-brand-spice transition-colors">
                      {item.title}
                    </span>
                    <span className="text-[10px] font-mono uppercase px-1.5 py-0.2 rounded bg-slate-100 dark:bg-white/5 text-slate-500 dark:text-slate-400 shrink-0">
                      {item.type === 'destination'
                        ? 'Hub'
                        : item.type === 'place'
                        ? 'Place'
                        : 'OSM'}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                    {item.subtitle}
                  </p>
                </div>
              </button>
            ))
          ) : !isLoading && hasSearched ? (
            <div className="p-4 text-center text-xs text-slate-500 dark:text-slate-400 space-y-1">
              <p className="font-semibold text-slate-700 dark:text-slate-300">No locations found</p>
              <p className="text-[11px]">
                Try searching for a city, attraction, or landmark in India.
              </p>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
};

