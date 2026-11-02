import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, useReducedMotion } from 'framer-motion';
import { CURATED_DESTINATIONS } from '../data/curatedDestinations';
import {
  fetchDestinationsFromAPI,
  searchPlacesHybridAPI,
  importExternalPlaceAPI,
  HybridPlaceResult,
} from '../api/client';
import { DestinationCard } from '../components/discovery/DestinationCard';
import { GlassCard } from '../components/ui/GlassCard';
import { CardSkeleton } from '../components/ui/Skeleton';
import { ProvenanceDrawer } from '../components/ui/ProvenanceDrawer';
import { RegionalCulinaryGuide } from '../components/culinary/RegionalCulinaryGuide';
import { classifyPlaceEnvironment } from '../utils/heatAware';
import { useTrip } from '../context/TripContext';
import {
  Search,
  Compass,
  RefreshCw,
  Globe2,
  Database,
  DownloadCloud,
  CheckCircle2,
  Clock,
  IndianRupee,
  Building,
  Map as MapIcon,
  Scale,
  UtensilsCrossed,
  Sun,
  ShieldCheck,
} from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';

export const DiscoverPage: React.FC = () => {
  const { selectedDestination, setSelectedDestination } = useTrip();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const prefersReducedMotion = useReducedMotion();

  const initialQuery = searchParams.get('q') || searchParams.get('search') || '';
  const initialMode =
    (searchParams.get('mode') as 'destinations' | 'places' | 'culinary') || 'destinations';

  const [activeTab, setActiveTab] = useState<'destinations' | 'places' | 'culinary'>(initialMode);
  const [search, setSearch] = useState(initialQuery);
  const [debouncedSearch, setDebouncedSearch] = useState(initialQuery);
  const [selectedRegion, setSelectedRegion] = useState<string>('All');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [selectedEnvironment, setSelectedEnvironment] = useState<string>('All');
  const [importingId, setImportingId] = useState<string | null>(null);
  const [provenanceModalPlace, setProvenanceModalPlace] = useState<{ id: string | number; name: string } | null>(null);

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

  const handleTabChange = (tab: 'destinations' | 'places' | 'culinary') => {
    setActiveTab(tab);
    const newParams = new URLSearchParams(searchParams);
    newParams.set('mode', tab);
    setSearchParams(newParams, { replace: true });
  };

  const regions = ['All', 'North', 'South', 'West', 'North-East'];
  const categories = ['All', 'beaches', 'culture', 'nature', 'history', 'food', 'adventure'];
  const environments = ['All', 'OUTDOOR', 'INDOOR', 'SHELTERED'];

  // Destinations Query
  const {
    data: destinations = CURATED_DESTINATIONS,
    isLoading: isLoadingDestinations,
    isError: isErrorDestinations,
    refetch: refetchDestinations,
  } = useQuery({
    queryKey: ['destinations', selectedRegion, debouncedSearch],
    queryFn: () => fetchDestinationsFromAPI({ region: selectedRegion, search: debouncedSearch }),
    staleTime: 60000,
  });

  // Hybrid Live Places Query
  const {
    data: liveSearchResults,
    isLoading: isLoadingPlaces,
    isError: isErrorPlaces,
    refetch: refetchPlaces,
  } = useQuery({
    queryKey: ['hybridPlaces', debouncedSearch, selectedDestination?.id, selectedCategory],
    queryFn: () =>
      searchPlacesHybridAPI({
        q: debouncedSearch,
        destination: selectedDestination?.id,
        category: selectedCategory !== 'All' ? selectedCategory : undefined,
        live: true,
        limit: 30,
      }),
    enabled: activeTab === 'places',
    staleTime: 30000,
  });

  // Import Mutation
  const importMutation = useMutation({
    mutationFn: (place: HybridPlaceResult) =>
      importExternalPlaceAPI({
        name: place.name,
        destination_slug: selectedDestination?.id || place.destination_slug || 'visakhapatnam',
        category: place.category || 'culture',
        latitude: place.latitude,
        longitude: place.longitude,
        address: place.address || '',
        source_record_id: place.source_record_id || place.id,
      }),
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
    const query = (debouncedSearch || search).toLowerCase().trim();
    const matchesSearch =
      !query ||
      d.name.toLowerCase().includes(query) ||
      (d.state && d.state.toLowerCase().includes(query)) ||
      (d.description && d.description.toLowerCase().includes(query));
    const matchesRegion = selectedRegion === 'All' || d.region === selectedRegion;
    const matchesCat =
      selectedCategory === 'All' || (d.popularCategories && d.popularCategories.includes(selectedCategory as any));
    return matchesSearch && matchesRegion && matchesCat;
  });

  // Filter places by environment if selected
  const displayedPlaces = (liveSearchResults?.results || []).filter((place) => {
    if (selectedEnvironment === 'All') return true;
    const env = classifyPlaceEnvironment(place.category, place.subcategory, place.name);
    return env === selectedEnvironment;
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8 animate-fade-in">
      {/* Page Header with Compare Link */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-brand-saffron/15 text-brand-spice border border-brand-saffron/30 text-xs font-bold">
            <Compass className="w-3.5 h-3.5" />
            <span>LIVE DISCOVERY & TRAVEL INTELLIGENCE</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-stone-900 dark:text-white tracking-tight">
            Explore India Like a Local
          </h1>
          <p className="text-sm text-stone-600 dark:text-slate-400 max-w-2xl">
            Discover verified Indian destinations, search live attractions across OpenStreetMap and SQLite database records, and explore authentic culinary heritage.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <Link
            to="/compare"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold bg-stone-200/90 dark:bg-white/10 hover:bg-stone-300 dark:hover:bg-white/15 text-stone-900 dark:text-white border border-stone-300 dark:border-white/10 transition-colors shadow-sm"
          >
            <Scale className="w-4 h-4 text-brand-saffron" />
            <span>Compare Destinations</span>
          </Link>
        </div>
      </div>

      {/* Discovery Mode Switcher Tabs */}
      <div className="flex items-center gap-3 border-b border-stone-200 dark:border-white/10 pb-4 overflow-x-auto">
        <button
          type="button"
          onClick={() => handleTabChange('destinations')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold shrink-0 transition-all ${
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
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold shrink-0 transition-all ${
            activeTab === 'places'
              ? 'bg-gradient-to-r from-brand-saffron to-brand-spice text-white shadow-glow-saffron'
              : 'bg-stone-200/80 dark:bg-white/5 text-stone-700 dark:text-slate-400 hover:text-stone-900 dark:hover:text-white'
          }`}
        >
          <Globe2 className="w-4 h-4" />
          <span>Live Place & Attraction Discovery</span>
          <span className="px-1.5 py-0.5 rounded text-[10px] font-extrabold bg-emerald-500 text-white">LIVE</span>
        </button>

        <button
          type="button"
          onClick={() => handleTabChange('culinary')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold shrink-0 transition-all ${
            activeTab === 'culinary'
              ? 'bg-brand-spice text-white shadow-sm'
              : 'bg-stone-200/80 dark:bg-white/5 text-stone-700 dark:text-slate-400 hover:text-stone-900 dark:hover:text-white'
          }`}
        >
          <UtensilsCrossed className="w-4 h-4" />
          <span>Culinary Heritage Guide</span>
          <span className="px-1.5 py-0.5 rounded text-[10px] font-extrabold bg-amber-500 text-white">GASTRONOMY</span>
        </button>
      </div>

      {/* Filter and Search Bar for Destinations and Places tabs */}
      {activeTab !== 'culinary' && (
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

            {/* Region selector (for destinations) */}
            {activeTab === 'destinations' && (
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
                {regions.map((region) => (
                  <button
                    key={region}
                    type="button"
                    onClick={() => setSelectedRegion(region)}
                    className={`px-3 py-2 rounded-xl text-xs font-semibold shrink-0 transition-colors ${
                      selectedRegion === region
                        ? 'bg-brand-saffron text-white shadow-sm'
                        : 'bg-stone-100 dark:bg-white/5 text-stone-600 dark:text-slate-400 hover:text-stone-900 dark:hover:text-white'
                    }`}
                  >
                    {region}
                  </button>
                ))}
              </div>
            )}

            {/* Environment filter (for places tab - Pillar 2) */}
            {activeTab === 'places' && (
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
                <span className="text-[11px] font-bold text-stone-500 dark:text-slate-400 mr-1 flex items-center gap-1">
                  <Sun className="w-3 h-3 text-amber-500" />
                  <span>Climate:</span>
                </span>
                {environments.map((env) => (
                  <button
                    key={env}
                    type="button"
                    onClick={() => setSelectedEnvironment(env)}
                    className={`px-3 py-2 rounded-xl text-xs font-semibold shrink-0 transition-colors ${
                      selectedEnvironment === env
                        ? 'bg-stone-900 dark:bg-white text-white dark:text-stone-950 font-bold'
                        : 'bg-stone-100 dark:bg-white/5 text-stone-600 dark:text-slate-400 hover:text-stone-900 dark:hover:text-white'
                    }`}
                  >
                    {env === 'All' ? 'All Environments' : env}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Category Chips Bar */}
          <div className="flex items-center gap-1.5 overflow-x-auto pt-1">
            <span className="text-xs text-stone-500 dark:text-slate-400 mr-1 shrink-0 font-medium">Categories:</span>
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium shrink-0 capitalize transition-colors ${
                  selectedCategory === cat
                    ? 'bg-brand-spice text-white'
                    : 'bg-stone-200/60 dark:bg-white/5 text-stone-600 dark:text-slate-400 hover:bg-stone-300 dark:hover:bg-white/10'
                }`}
              >
                {cat}
              </button>
            ))}
            <button
              type="button"
              onClick={() => {
                handleSearchChange('');
                setSelectedRegion('All');
                setSelectedCategory('All');
                setSelectedEnvironment('All');
              }}
              className="px-2.5 py-1 text-xs text-stone-400 hover:text-stone-700 dark:hover:text-white underline ml-auto shrink-0"
            >
              Clear filters
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
            <GlassCard className="p-12 text-center space-y-4">
              <p className="text-base font-bold text-stone-900 dark:text-white">
                No seeded destination hub matching "{debouncedSearch || search}"
              </p>
              <p className="text-xs text-stone-600 dark:text-slate-400 max-w-md mx-auto">
                Looking for attractions, food, or heritage spots in this area? You can discover live OpenStreetMap places right away.
              </p>
              <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                {debouncedSearch.trim() && (
                  <button
                    type="button"
                    onClick={() => {
                      handleTabChange('places');
                    }}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold bg-gradient-to-r from-brand-saffron to-brand-spice text-white shadow-glow-saffron hover:opacity-95 transition-all"
                  >
                    <Globe2 className="w-4 h-4" />
                    <span>Search Places in "{debouncedSearch}" via Live Discovery</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    handleSearchChange('');
                    setSelectedRegion('All');
                    setSelectedCategory('All');
                    setSelectedEnvironment('All');
                  }}
                  className="px-4 py-2.5 rounded-xl text-xs font-semibold bg-stone-200 dark:bg-white/10 text-stone-800 dark:text-white hover:bg-stone-300 dark:hover:bg-white/15 transition-colors"
                >
                  Reset Filters
                </button>
              </div>
            </GlassCard>
          )}
        </>
      )}

      {/* TAB 2: LIVE PLACES HYBRID SEARCH GRID */}
      {activeTab === 'places' && (
        <div className="space-y-6">
          {/* Metadata Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-stone-600 dark:text-slate-400 px-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-stone-900 dark:text-white">
                {liveSearchResults?.total_count || displayedPlaces.length} Places Discovered
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

            <div className="flex items-center gap-2">
              {selectedDestination ? (
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-brand-saffron/15 border border-brand-saffron/30 text-brand-spice text-[11px] font-semibold">
                  <span>Scoped to: <strong>{selectedDestination.name}</strong></span>
                  <button
                    type="button"
                    onClick={() => setSelectedDestination(null)}
                    className="hover:text-red-500 font-bold ml-1 text-xs"
                    title="Remove destination filter for nationwide search"
                  >
                    ×
                  </button>
                </div>
              ) : (
                <span className="text-[11px] text-stone-500 dark:text-slate-400">
                  Nationwide search
                </span>
              )}
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
          ) : displayedPlaces.length > 0 ? (
            <motion.div
              initial={prefersReducedMotion ? {} : { opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.3 }}
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6"
            >
              {displayedPlaces.map((place) => {
                const isDb = place.result_type === 'database';
                const isImported = place.provenance_label === 'Imported and persisted record';
                const isImporting = importingId === place.id;
                const env = classifyPlaceEnvironment(place.category, place.subcategory, place.name);

                return (
                  <GlassCard
                    key={place.id}
                    className="p-5 flex flex-col justify-between space-y-4 border-stone-200 dark:border-white/10 hover:border-brand-saffron/40 transition-all overflow-hidden"
                  >
                    <div className="space-y-3">
                      {/* Optional Wikimedia / Verified Photograph with Full Attribution */}
                      {place.image_url && (
                        <div className="relative h-40 -mx-5 -mt-5 mb-2 overflow-hidden bg-slate-900 group/img">
                          <img
                            src={place.image_url}
                            alt={place.name}
                            className="w-full h-full object-cover transition-transform duration-700 group-hover/img:scale-105"
                            loading="lazy"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-transparent" />
                          <div className="absolute bottom-1.5 inset-x-3 flex items-center justify-between text-[10px] text-slate-200">
                            <span className="truncate max-w-[180px]">
                              {place.image_author ? `Photo: ${place.image_author}` : 'Wikimedia Commons'}
                            </span>
                            {place.image_source_url ? (
                              <a
                                href={place.image_source_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-brand-saffron hover:underline font-semibold shrink-0 ml-1"
                              >
                                {place.image_license || 'CC BY-SA'} ↗
                              </a>
                            ) : (
                              <span className="shrink-0 ml-1">{place.image_license || 'CC BY-SA'}</span>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Provenance Badge & Environment Tag */}
                      <div className="flex items-center justify-between gap-2 flex-wrap">
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

                        <div className="flex items-center gap-1.5">
                          <span
                            className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                              env === 'OUTDOOR'
                                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-300 border-emerald-500/20'
                                : env === 'INDOOR'
                                ? 'bg-blue-500/10 text-blue-600 dark:text-blue-300 border-blue-500/20'
                                : 'bg-stone-500/10 text-stone-600 dark:text-stone-300 border-stone-500/20'
                            }`}
                          >
                            {env}
                          </span>
                          <span className="text-[11px] font-semibold text-stone-500 dark:text-slate-400 capitalize">
                            {place.category}
                          </span>
                        </div>
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
                    <div className="pt-3 border-t border-stone-200 dark:border-white/5 flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-2">
                        <Link
                          to={`/map?lat=${place.latitude}&lon=${place.longitude}`}
                          className="inline-flex items-center gap-1 text-xs font-semibold text-stone-700 dark:text-slate-300 hover:text-brand-saffron transition-colors"
                        >
                          <MapIcon className="w-3.5 h-3.5" />
                          <span>Locate</span>
                        </Link>

                        {/* Provenance Drawer Inspection */}
                        {isDb && (
                          <button
                            type="button"
                            onClick={() => setProvenanceModalPlace({ id: place.id, name: place.name })}
                            className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 hover:underline"
                            title="Inspect recorded data provenance"
                          >
                            <ShieldCheck className="w-3 h-3" />
                            <span>Audit</span>
                          </button>
                        )}
                      </div>

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
                No places discovered matching "{debouncedSearch}" {selectedEnvironment !== 'All' ? `with climate environment "${selectedEnvironment}"` : ''}
              </p>
              <p className="text-xs text-stone-600 dark:text-slate-400">
                Try searching for general Indian landmarks, beaches, temples, or street food names.
              </p>
              <button
                type="button"
                onClick={() => {
                  handleSearchChange('');
                  setSelectedEnvironment('All');
                }}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-brand-saffron text-white"
              >
                Clear Search
              </button>
            </GlassCard>
          )}
        </div>
      )}

      {/* TAB 3: REGIONAL CULINARY HERITAGE GUIDE (PILLAR 4) */}
      {activeTab === 'culinary' && (
        <RegionalCulinaryGuide
          initialDestinationSlug={selectedDestination?.id}
        />
      )}

      {/* Provenance Drawer Modal */}
      {provenanceModalPlace && (
        <ProvenanceDrawer
          isOpen={!!provenanceModalPlace}
          onClose={() => setProvenanceModalPlace(null)}
          placeId={provenanceModalPlace.id}
          placeName={provenanceModalPlace.name}
        />
      )}
    </div>
  );
};
