import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, useReducedMotion } from 'framer-motion';
import { CURATED_DESTINATIONS } from '../data/curatedDestinations';
import {
  fetchDestinationsFromAPI,
  searchPlacesHybridAPI,
  importExternalPlaceAPI,
  HybridPlaceResult
} from '../api/client';
import { DestinationCard } from '../components/discovery/DestinationCard';
import { GlassCard } from '../components/ui/GlassCard';
import { CardSkeleton } from '../components/ui/Skeleton';
import { useTrip } from '../context/TripContext';
import {
  Search,
  Compass,
  MapPin,
  ArrowRight,
  RefreshCw,
  Globe2,
  Database,
  DownloadCloud,
  CheckCircle2,
  Clock,
  IndianRupee,
  Building,
  Map as MapIcon
} from 'lucide-react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';

export const DiscoverPage: React.FC = () => {
  const { selectedDestination, setSelectedDestination, setPreferences } = useTrip();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const prefersReducedMotion = useReducedMotion();

  const initialQuery = searchParams.get('q') || searchParams.get('search') || '';
  const initialMode = (searchParams.get('mode') as 'destinations' | 'places') || 'destinations';

  const [activeTab, setActiveTab] = useState<'destinations' | 'places'>(initialMode);
  const [search, setSearch] = useState(initialQuery);
  const [debouncedSearch, setDebouncedSearch] = useState(initialQuery);
  const [selectedRegion, setSelectedRegion] = useState<string>('All');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [importingId, setImportingId] = useState<string | null>(null);

  // Debounce search to avoid excessive calls
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search);
    }, 400);
    return () => clearTimeout(handler);
  }, [search]);

  useEffect(() => {
    const q = searchParams.get('q') || searchParams.get('search') || '';
    if (q !== search) {
      setSearch(q);
    }
  }, [searchParams]);

  const handleSearchChange = (value: string) => {
    setSearch(value);
    const newParams = new URLSearchParams(searchParams);
    if (value.trim()) {
      newParams.set('q', value);
    } else {
      newParams.delete('q');
    }
    setSearchParams(newParams, { replace: true });
  };

  const handleTabChange = (tab: 'destinations' | 'places') => {
    setActiveTab(tab);
    const newParams = new URLSearchParams(searchParams);
    newParams.set('mode', tab);
    setSearchParams(newParams, { replace: true });
  };

  const regions = ['All', 'North', 'South', 'West', 'North-East'];
  const categories = ['All', 'beaches', 'culture', 'nature', 'history', 'food', 'adventure'];

  // Destinations Query
  const {
    data: destinations = CURATED_DESTINATIONS,
    isLoading: isLoadingDestinations,
    isError: isErrorDestinations,
    refetch: refetchDestinations,
  } = useQuery({
    queryKey: ['destinations', selectedRegion, search],
    queryFn: () => fetchDestinationsFromAPI({ region: selectedRegion, search }),
    staleTime: 60000,
  });

  // Hybrid Live Places Query
  const {
    data: liveSearchResults,
    isLoading: isLoadingPlaces,
    isError: isErrorPlaces,
    refetch: refetchPlaces,
  } = useQuery({
    queryKey: ['hybridPlaces', debouncedSearch, selectedCategory, selectedDestination?.id],
    queryFn: () =>
      searchPlacesHybridAPI({
        q: debouncedSearch,
        destination: selectedDestination?.id,
        category: selectedCategory,
        limit: 30,
        live: true,
      }),
    enabled: activeTab === 'places',
    staleTime: 45000,
  });

  // Import mutation for external places
  const importMutation = useMutation({
    mutationFn: (place: HybridPlaceResult) => importExternalPlaceAPI(place),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hybridPlaces'] });
      queryClient.invalidateQueries({ queryKey: ['places'] });
      setImportingId(null);
    },
    onError: () => {
      setImportingId(null);
    },
  });

  const handleImportPlace = (place: HybridPlaceResult) => {
    setImportingId(place.id);
    importMutation.mutate(place);
  };

  const filteredDestinations = destinations.filter((d) => {
    const matchesSearch =
      d.name.toLowerCase().includes(search.toLowerCase()) ||
      d.state.toLowerCase().includes(search.toLowerCase()) ||
      d.description.toLowerCase().includes(search.toLowerCase());
    const matchesRegion = selectedRegion === 'All' || d.region === selectedRegion;
    const matchesCat =
      selectedCategory === 'All' || (d.popularCategories && d.popularCategories.includes(selectedCategory as any));
    return matchesSearch && matchesRegion && matchesCat;
  });

  const handleSelectAndPlan = (dest: typeof CURATED_DESTINATIONS[0]) => {
    setSelectedDestination(dest);
    setPreferences((prev) => ({
      ...prev,
      destination: dest.id,
      destinationName: dest.name,
    }));
    navigate('/planner');
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      {/* Page Header */}
      <div className="space-y-2">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-brand-saffron/15 text-brand-spice border border-brand-saffron/30 text-xs font-bold">
          <Compass className="w-3.5 h-3.5" />
          <span>LIVE DISCOVERY & DESTINATIONS</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-stone-900 dark:text-white tracking-tight">
          Explore India Like a Local
        </h1>
        <p className="text-sm text-stone-600 dark:text-slate-400 max-w-2xl">
          Discover verified Indian destinations, search live attractions across OpenStreetMap and SQLite database records, and craft factual itineraries.
        </p>
      </div>

      {/* Discovery Mode Switcher Tabs */}
      <div className="flex items-center gap-3 border-b border-stone-200 dark:border-white/10 pb-4">
        <button
          type="button"
          onClick={() => handleTabChange('destinations')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'destinations'
              ? 'bg-brand-saffron text-white shadow-glow-saffron'
              : 'bg-stone-200/80 dark:bg-white/5 text-stone-700 dark:text-slate-400 hover:text-stone-900 dark:hover:text-white'
          }`}
        >
          <Building className="w-4 h-4" />
          <span>Destination Hubs ({destinations.length})</span>
        </button>

        <button
          type="button"
          onClick={() => handleTabChange('places')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'places'
              ? 'bg-gradient-to-r from-brand-saffron to-brand-spice text-white shadow-glow-saffron'
              : 'bg-stone-200/80 dark:bg-white/5 text-stone-700 dark:text-slate-400 hover:text-stone-900 dark:hover:text-white'
          }`}
        >
          <Globe2 className="w-4 h-4" />
          <span>Live Place & Attraction Discovery</span>
          <span className="px-1.5 py-0.5 rounded text-[10px] font-extrabold bg-emerald-500 text-white">LIVE</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <GlassCard className="p-4 sm:p-5 border-stone-200 dark:border-white/10 space-y-4">
        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-stone-400 dark:text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => handleSearchChange(e.target.value)}
              placeholder={
                activeTab === 'destinations'
                  ? 'Search by city name, state, or key terrain...'
                  : 'Search live places, temples, beaches, forts, food spots...'
              }
              className="w-full bg-white dark:bg-slate-900/80 border border-stone-300 dark:border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-xs text-stone-900 dark:text-white placeholder-stone-500 focus:outline-none focus:border-brand-saffron"
            />
          </div>

          {/* Region Tabs (for destinations mode) */}
          {activeTab === 'destinations' && (
            <div className="flex items-center gap-1 overflow-x-auto text-xs pb-1 sm:pb-0">
              {regions.map((reg) => (
                <button
                  key={reg}
                  type="button"
                  onClick={() => setSelectedRegion(reg)}
                  className={`px-3 py-2 rounded-xl font-medium shrink-0 transition-colors ${
                    selectedRegion === reg
                      ? 'bg-brand-saffron text-white font-bold shadow-glow-saffron'
                      : 'bg-stone-200/70 dark:bg-white/5 text-stone-700 dark:text-slate-400 hover:text-stone-900 dark:hover:text-white'
                  }`}
                >
                  {reg}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Category Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pt-2 border-t border-stone-200 dark:border-white/5 text-xs">
          <span className="text-[11px] font-semibold text-stone-500 dark:text-slate-400 shrink-0">Filter Terrain:</span>
          {categories.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1 rounded-lg capitalize shrink-0 transition-colors ${
                selectedCategory === cat
                  ? 'bg-brand-spice/20 text-brand-spice border border-brand-spice/40 font-bold'
                  : 'bg-stone-200/60 dark:bg-white/5 text-stone-700 dark:text-slate-400 hover:text-stone-900 dark:hover:text-white border border-stone-300/60 dark:border-white/5'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </GlassCard>

      {/* Active Selected Destination Showcase Bar */}
      {selectedDestination && (
        <GlassCard className="p-4 sm:p-5 border-brand-saffron/30 bg-gradient-to-r from-brand-saffron/10 via-stone-100 to-stone-200 dark:via-slate-900 dark:to-slate-900 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-brand-saffron/20 border border-brand-saffron/40 flex items-center justify-center text-brand-spice">
              <MapPin className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs font-semibold text-brand-spice uppercase">Active Destination</div>
              <h3 className="text-lg font-bold text-stone-900 dark:text-white">
                {selectedDestination.name}, {selectedDestination.state}
              </h3>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link
              to="/map"
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-stone-200 hover:bg-stone-300 dark:bg-white/10 dark:hover:bg-white/15 text-stone-800 dark:text-white border border-stone-300 dark:border-white/10 transition-colors"
            >
              View on Map
            </Link>
            <button
              type="button"
              onClick={() => handleSelectAndPlan(selectedDestination)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-brand-saffron to-brand-spice text-white shadow-glow-saffron hover:opacity-95 transition-all"
            >
              <span>Build Trip</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </GlassCard>
      )}

      {/* TAB 1: DESTINATIONS GRID */}
      {activeTab === 'destinations' && (
        <>
          {isLoadingDestinations ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <CardSkeleton key={i} />
              ))}
            </div>
          ) : isErrorDestinations ? (
            <GlassCard className="p-8 text-center space-y-3">
              <p className="text-sm font-bold text-red-500 dark:text-red-400">Failed to load destinations from server</p>
              <button
                type="button"
                onClick={() => refetchDestinations()}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-stone-200 dark:bg-white/10 text-stone-800 dark:text-white"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Retry Connection</span>
              </button>
            </GlassCard>
          ) : filteredDestinations.length > 0 ? (
            <motion.div
              initial={prefersReducedMotion ? {} : { opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.3 }}
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6"
            >
              {filteredDestinations.map((dest) => (
                <DestinationCard
                  key={dest.id}
                  destination={dest}
                  isSelected={selectedDestination?.id === dest.id}
                />
              ))}
            </motion.div>
          ) : (
            <GlassCard className="p-12 text-center space-y-3">
              <p className="text-base font-bold text-stone-900 dark:text-white">No destinations found matching your filters</p>
              <p className="text-xs text-stone-600 dark:text-slate-400">Try adjusting your search query or selecting "All" regions.</p>
              <button
                type="button"
                onClick={() => {
                  handleSearchChange('');
                  setSelectedRegion('All');
                  setSelectedCategory('All');
                }}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-brand-saffron text-white"
              >
                Reset Filters
              </button>
            </GlassCard>
          )}
        </>
      )}

      {/* TAB 2: LIVE PLACES HYBRID SEARCH GRID */}
      {activeTab === 'places' && (
        <div className="space-y-6">
          {/* Metadata Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-stone-600 dark:text-slate-400 px-1">
            <div className="flex items-center gap-2">
              <span className="font-bold text-stone-900 dark:text-white">
                {liveSearchResults?.total_count || 0} Places Discovered
              </span>
              <span className="text-stone-400">•</span>
              <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-semibold">
                <Database className="w-3 h-3" />
                {liveSearchResults?.database_count || 0} SQLite Database
              </span>
              <span className="text-stone-400">•</span>
              <span className="inline-flex items-center gap-1 text-sky-600 dark:text-sky-400 font-semibold">
                <Globe2 className="w-3 h-3" />
                {liveSearchResults?.live_external_count || 0} Live OSM
              </span>
            </div>

            <div className="text-[11px] text-stone-500 dark:text-slate-400">
              {selectedDestination ? `Scoped to ${selectedDestination.name}` : 'Nationwide search'}
            </div>
          </div>

          {isLoadingPlaces ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <CardSkeleton key={i} />
              ))}
            </div>
          ) : isErrorPlaces ? (
            <GlassCard className="p-8 text-center space-y-3">
              <p className="text-sm font-bold text-red-500 dark:text-red-400">Failed to execute live discovery search</p>
              <button
                type="button"
                onClick={() => refetchPlaces()}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-stone-200 dark:bg-white/10 text-stone-800 dark:text-white"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Retry Search</span>
              </button>
            </GlassCard>
          ) : liveSearchResults?.results && liveSearchResults.results.length > 0 ? (
            <motion.div
              initial={prefersReducedMotion ? {} : { opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.3 }}
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6"
            >
              {liveSearchResults.results.map((place) => {
                const isDb = place.result_type === 'database';
                const isImported = place.provenance_label === 'Imported and persisted record';
                const isImporting = importingId === place.id;

                return (
                  <GlassCard
                    key={place.id}
                    className="p-5 flex flex-col justify-between space-y-4 border-stone-200 dark:border-white/10 hover:border-brand-saffron/40 transition-all"
                  >
                    <div className="space-y-3">
                      {/* Provenance Badge */}
                      <div className="flex items-center justify-between gap-2">
                        {isDb ? (
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                              isImported
                                ? 'bg-purple-500/15 text-purple-700 dark:text-purple-300 border border-purple-500/30'
                                : 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30'
                            }`}
                          >
                            <Database className="w-3 h-3" />
                            <span>{place.provenance_label}</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-sky-500/15 text-sky-700 dark:text-sky-300 border border-sky-500/30">
                            <Globe2 className="w-3 h-3" />
                            <span>Live external search result</span>
                          </span>
                        )}

                        <span className="text-[11px] font-semibold text-stone-500 dark:text-slate-400 capitalize">
                          {place.category}
                        </span>
                      </div>

                      {/* Name & Destination */}
                      <div>
                        <h3 className="text-base font-bold text-stone-900 dark:text-white leading-snug">
                          {place.name}
                        </h3>
                        {place.destination_name && (
                          <p className="text-xs text-brand-spice font-medium mt-0.5">
                            {place.destination_name}
                          </p>
                        )}
                      </div>

                      {/* Address / Coordinates */}
                      <p className="text-xs text-stone-600 dark:text-slate-400 line-clamp-2">
                        {place.address || `${place.latitude.toFixed(4)}, ${place.longitude.toFixed(4)}`}
                      </p>

                      {/* Description */}
                      {place.description && (
                        <p className="text-xs text-stone-500 dark:text-slate-400 italic line-clamp-2">
                          "{place.description}"
                        </p>
                      )}

                      {/* Facts: Ticket Fee & Hours */}
                      <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-stone-200 dark:border-white/5 text-[11px]">
                        <span className="inline-flex items-center gap-1 text-stone-700 dark:text-slate-300">
                          <IndianRupee className="w-3 h-3 text-brand-saffron" />
                          <span>
                            {place.ticket_price_inr !== null && place.ticket_price_inr !== undefined
                              ? place.ticket_price_inr === 0
                                ? 'Free Entry'
                                : `₹${place.ticket_price_inr}`
                              : 'Fee unavailable'}
                          </span>
                        </span>

                        {place.opening_hours && (
                          <span className="inline-flex items-center gap-1 text-stone-600 dark:text-slate-400">
                            <Clock className="w-3 h-3" />
                            <span className="truncate max-w-[130px]">{place.opening_hours}</span>
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Bottom Actions */}
                    <div className="pt-3 border-t border-stone-200 dark:border-white/5 flex items-center justify-between gap-2">
                      <Link
                        to={`/map?lat=${place.latitude}&lon=${place.longitude}`}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-stone-700 dark:text-slate-300 hover:text-brand-saffron transition-colors"
                      >
                        <MapIcon className="w-3.5 h-3.5" />
                        <span>Locate on Map</span>
                      </Link>

                      {/* If external, show Import Button */}
                      {!place.is_persisted && (
                        <button
                          type="button"
                          disabled={isImporting}
                          onClick={() => handleImportPlace(place)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-brand-saffron hover:bg-brand-spice text-white shadow-sm transition-all disabled:opacity-50"
                        >
                          {isImporting ? (
                            <RefreshCw className="w-3 h-3 animate-spin" />
                          ) : (
                            <DownloadCloud className="w-3 h-3" />
                          )}
                          <span>{isImporting ? 'Importing...' : 'Save to DB'}</span>
                        </button>
                      )}

                      {place.is_persisted && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Saved in SQLite</span>
                        </span>
                      )}
                    </div>
                  </GlassCard>
                );
              })}
            </motion.div>
          ) : (
            <GlassCard className="p-12 text-center space-y-3">
              <p className="text-base font-bold text-stone-900 dark:text-white">
                No places discovered matching "{debouncedSearch}"
              </p>
              <p className="text-xs text-stone-600 dark:text-slate-400">
                Try searching for general Indian landmarks, beaches, temples, or street food names.
              </p>
              <button
                type="button"
                onClick={() => handleSearchChange('')}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-brand-saffron text-white"
              >
                Clear Search
              </button>
            </GlassCard>
          )}
        </div>
      )}
    </div>
  );
};
