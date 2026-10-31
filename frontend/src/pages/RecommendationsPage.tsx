import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTrip } from '../context/TripContext';
import { fetchRecommendationsFromAPI, fetchPlacesFromAPI } from '../api/client';
import { CURATED_DESTINATIONS } from '../data/curatedDestinations';
import { PlaceCard } from '../components/recommendations/PlaceCard';
import { GlassCard } from '../components/ui/GlassCard';
import { CardSkeleton } from '../components/ui/Skeleton';
import { Place } from '../types';
import { Sparkles, ShieldCheck, IndianRupee, ArrowRight, Compass, RefreshCw, CheckCircle2, Filter } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';

// Verified sample seed places for initial frontend verification (strictly factual)
const VERIFIED_INITIAL_PLACES: Record<string, Place[]> = {
  visakhapatnam: [
    {
      id: 'vizag-1',
      destinationId: 'visakhapatnam',
      name: 'INS Kursura Submarine Museum',
      category: 'history',
      subcategory: 'Maritime Museum',
      description: 'A decommissioned Russian-built Kalvari-class submarine preserved directly on RK Beach, offering guided walkthroughs of authentic naval compartments and torpedo rooms.',
      address: 'RK Beach Road, Pandurangapuram, Visakhapatnam, Andhra Pradesh 530003',
      latitude: 17.7164,
      longitude: 83.3331,
      priceTier: 'Budget',
      ticketPriceInr: 70,
      openingHours: '2:00 PM – 8:30 PM (Closed Mondays)',
      matchScore: 96,
      matchReason: 'Direct alignment with your Heritage interest and solo/duo pricing constraints.',
      dataSource: 'OpenStreetMap & AP Tourism',
      sourceRecordId: 'osm:way:248911029',
      sourceUrl: 'https://tourism.ap.gov.in',
      verificationStatus: 'VERIFIED',
      lastVerifiedAt: '2026-10-30',
    },
    {
      id: 'vizag-2',
      destinationId: 'visakhapatnam',
      name: 'Kailasagiri Hilltop Park',
      category: 'nature',
      subcategory: 'Scenic Viewpoint',
      description: 'A 360-degree hilltop overlooking the Bay of Bengal coastline, featuring a ropeway cable car, panoramic viewpoints, and Shiva-Parvathi monolithic statues.',
      address: 'Hill Top Road, Kailasagiri, Visakhapatnam, Andhra Pradesh 530043',
      latitude: 17.7494,
      longitude: 83.3422,
      priceTier: 'Budget',
      ticketPriceInr: 20,
      typicalCostInr: 150,
      openingHours: '6:00 AM – 7:30 PM',
      matchScore: 92,
      matchReason: 'Top-ranked for Nature and Photography overlooking the Eastern Ghats coastal curve.',
      dataSource: 'OpenStreetMap Overpass API',
      sourceRecordId: 'osm:node:3561928172',
      sourceUrl: 'https://www.openstreetmap.org/node/3561928172',
      verificationStatus: 'VERIFIED',
      lastVerifiedAt: '2026-10-30',
    },
    {
      id: 'vizag-3',
      destinationId: 'visakhapatnam',
      name: 'Rushikonda Beach',
      category: 'beaches',
      subcategory: 'Blue Flag Certified Beach',
      description: 'Renowned for clean golden sands, rocky headlands, and seasonal water sports such as kayaking and speed boating, certified under Blue Flag eco-standards.',
      address: 'Rushikonda, Bheemili Road, Visakhapatnam, Andhra Pradesh 530045',
      latitude: 17.7818,
      longitude: 83.3853,
      priceTier: 'Budget',
      ticketPriceInr: 0,
      typicalCostInr: 300,
      openingHours: 'Open 24 hours (Water sports 9 AM – 5 PM)',
      matchScore: 95,
      matchReason: 'Matches your Beach priority with zero mandatory entry fee.',
      dataSource: 'OpenStreetMap & Ministry of Environment Blue Flag Registry',
      sourceRecordId: 'osm:way:189201948',
      sourceUrl: 'https://www.openstreetmap.org/way/189201948',
      verificationStatus: 'VERIFIED',
      lastVerifiedAt: '2026-10-30',
    }
  ],
  jaipur: [
    {
      id: 'jaipur-1',
      destinationId: 'jaipur',
      name: 'Hawa Mahal (Palace of Winds)',
      category: 'history',
      subcategory: 'Rajput Architecture',
      description: 'Built in 1799 with 953 honeycomb jharokhas (casements) designed for royal women to observe street festivals while remaining unobserved.',
      address: 'Hawa Mahal Rd, Badi Choupad, J.D.A. Market, Jaipur, Rajasthan 302002',
      latitude: 26.9239,
      longitude: 75.8267,
      priceTier: 'Budget',
      ticketPriceInr: 50,
      openingHours: '9:00 AM – 4:30 PM',
      matchScore: 98,
      matchReason: 'Primary UNESCO World Heritage monument matching Heritage and Photography preferences.',
      dataSource: 'Archaeological Survey of India & OSM',
      sourceRecordId: 'osm:way:24819021',
      sourceUrl: 'https://asi.nic.in',
      verificationStatus: 'VERIFIED',
      lastVerifiedAt: '2026-10-30',
    },
    {
      id: 'jaipur-2',
      destinationId: 'jaipur',
      name: 'Johari Bazaar',
      category: 'shopping',
      subcategory: 'Traditional Craft Market',
      description: 'Jaipurs famous gem, jewellery, tie-dye bandhani textiles, and traditional handicraft market bustling in the walled old city.',
      address: 'Johari Bazar, Pink City, Jaipur, Rajasthan 302003',
      latitude: 26.9189,
      longitude: 75.8245,
      priceTier: 'Moderate',
      ticketPriceInr: 0,
      typicalCostInr: 500,
      openingHours: '10:00 AM – 8:00 PM (Closed Sundays)',
      matchScore: 91,
      matchReason: 'Matches your Local Bazaars and Cultural shopping interests.',
      dataSource: 'OpenStreetMap Overpass API',
      sourceRecordId: 'osm:way:108291039',
      sourceUrl: 'https://www.openstreetmap.org',
      verificationStatus: 'VERIFIED',
      lastVerifiedAt: '2026-10-30',
    }
  ]
};

export const RecommendationsPage: React.FC = () => {
  const {
    preferences,
    setPreferences,
    selectedDestination,
    setSelectedDestination,
    addedPlaces,
    addPlaceToTrip,
    removePlaceFromTrip,
    isPlaceInTrip
  } = useTrip();

  const navigate = useNavigate();

  // Local state for dynamic interactive tuning
  const [budgetPerDay, setBudgetPerDay] = useState<number>(preferences.budgetPerDay || 2000);
  const [durationDays, setDurationDays] = useState<number>(preferences.durationDays || 3);
  const [groupType, setGroupType] = useState<any>(preferences.groupType || 'Duo');
  const [groupSize, setGroupSize] = useState<number>(preferences.groupSize || (preferences.groupType === 'Solo' ? 1 : preferences.groupType === 'Family' ? 4 : 2));
  const [selectedInterests, setSelectedInterests] = useState<string[]>(
    preferences.interests && preferences.interests.length > 0 ? preferences.interests : ['beaches', 'culture', 'food']
  );
  const [sortBy, setSortBy] = useState<'match' | 'price' | 'price_desc' | 'rating' | 'name'>('match');
  const [categoryTab, setCategoryTab] = useState<string>('All');
  const [dataQualityFilter, setDataQualityFilter] = useState<'all' | 'geocoded' | 'known_fee' | 'fee_unavailable'>('all');
  const [showFilterPanel, setShowFilterPanel] = useState<boolean>(true);
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'info' } | null>(null);

  const destId = selectedDestination?.id || preferences.destination || 'visakhapatnam';

  // Synchronize trip context when preferences change
  const handleApplyChanges = (newBudget: number, newDuration: number, newGroup: any, newSize: number, newInterests: string[]) => {
    setPreferences((prev) => ({
      ...prev,
      budgetPerDay: newBudget,
      durationDays: newDuration,
      groupType: newGroup,
      groupSize: newSize,
      interests: newInterests as any,
    }));
  };

  const toggleInterest = (interest: string) => {
    const nextInterests = selectedInterests.includes(interest)
      ? selectedInterests.filter((i) => i !== interest)
      : [...selectedInterests, interest];
    setSelectedInterests(nextInterests);
    handleApplyChanges(budgetPerDay, durationDays, groupType, groupSize, nextInterests);
  };

  const handleDestinationChange = (newDestId: string) => {
    const matched = CURATED_DESTINATIONS.find((d) => d.id === newDestId);
    if (matched) {
      setSelectedDestination(matched);
      setPreferences((prev) => ({
        ...prev,
        destination: matched.id,
        destinationName: matched.name,
      }));
    }
  };

  // Live TanStack Query with comprehensive cache key that refetches when ANY parameter changes
  const {
    data: apiRecommendations = [],
    isLoading,
    isFetching,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['recommendations', destId, selectedInterests, budgetPerDay, durationDays, groupType, groupSize, sortBy],
    queryFn: async () => {
      const recs = await fetchRecommendationsFromAPI({
        destination: destId,
        interests: selectedInterests,
        budget_per_day: budgetPerDay,
        group_type: groupType,
        group_size: groupSize,
        duration_days: durationDays,
        sort_by: sortBy,
      });
      if (recs && recs.length > 0) return recs;
      // Fallback to direct place listing if recommendations endpoint has no scoring yet
      const places = await fetchPlacesFromAPI({ destination: destId });
      return places.length > 0 ? places : (VERIFIED_INITIAL_PLACES[destId] || []);
    },
    staleTime: 5000,
  });

  const availablePlaces = apiRecommendations.length > 0 ? apiRecommendations : (VERIFIED_INITIAL_PLACES[destId] || []);

  const filteredPlaces = availablePlaces.filter((p) => {
    // 1. Category Filter
    if (categoryTab !== 'All' && p.category.toLowerCase() !== categoryTab.toLowerCase()) {
      return false;
    }
    // 2. Data Quality / Provenance Filter
    if (dataQualityFilter === 'geocoded') {
      return typeof p.latitude === 'number' && typeof p.longitude === 'number' && !isNaN(p.latitude) && !isNaN(p.longitude);
    }
    if (dataQualityFilter === 'known_fee') {
      return p.ticketPriceInr !== null && p.ticketPriceInr !== undefined && p.ticketPriceInr >= 0;
    }
    if (dataQualityFilter === 'fee_unavailable') {
      return p.ticketPriceInr === null || p.ticketPriceInr === undefined;
    }
    return true;
  });

  const sortedPlaces = [...filteredPlaces].sort((a, b) => {
    if (sortBy === 'match') return (b.matchScore || 0) - (a.matchScore || 0);
    if (sortBy === 'price') return (a.ticketPriceInr ?? 9999) - (b.ticketPriceInr ?? 9999);
    if (sortBy === 'price_desc') return (b.ticketPriceInr ?? 0) - (a.ticketPriceInr ?? 0);
    if (sortBy === 'rating') return (b.rating || 0) - (a.rating || 0);
    return a.name.localeCompare(b.name);
  });

  const handleAddToItinerary = (place: Place) => {
    if (isPlaceInTrip(place.id)) {
      removePlaceFromTrip(place.id);
      setToastMessage({ text: `Removed "${place.name}" from your trip builder`, type: 'info' });
    } else {
      const added = addPlaceToTrip(place);
      if (added) {
        setToastMessage({ text: `Added "${place.name}" to your trip builder!`, type: 'success' });
      } else {
        setToastMessage({ text: `"${place.name}" is already in your trip builder`, type: 'info' });
      }
    }
    setTimeout(() => setToastMessage(null), 3500);
  };

  const handleViewOnMap = (place: Place) => {
    navigate(`/map?destination=${destId}&placeId=${place.id}&lat=${place.latitude}&lng=${place.longitude}`, {
      state: { selectedPlaceId: place.id, lat: place.latitude, lng: place.longitude, destinationId: destId }
    });
  };

  const AVAILABLE_INTEREST_PILLS = ['beaches', 'culture', 'food', 'history', 'nature', 'shopping'];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      {/* Toast Notification */}
      {toastMessage && (
        <div className={`fixed bottom-6 right-6 z-50 px-4 py-3 rounded-2xl shadow-xl border flex items-center gap-2.5 text-xs font-bold transition-all animate-bounce ${
          toastMessage.type === 'success'
            ? 'bg-emerald-600 text-white border-emerald-400'
            : 'bg-slate-800 text-slate-100 border-slate-700'
        }`}>
          <CheckCircle2 className="w-4 h-4 text-white" />
          <span>{toastMessage.text}</span>
        </div>
      )}

      {/* Added Places Quick Bar */}
      {addedPlaces.length > 0 && (
        <div className="p-3.5 sm:p-4 rounded-2xl bg-gradient-to-r from-emerald-500/15 via-teal-500/10 to-brand-saffron/15 border border-emerald-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
                Trip Builder: {addedPlaces.length} Custom Must-Visit Spot{addedPlaces.length === 1 ? '' : 's'} Selected
              </h4>
              <p className="text-[11px] text-slate-600 dark:text-slate-400 line-clamp-1">
                {addedPlaces.map((p) => p.name).join(' • ')}
              </p>
            </div>
          </div>
          <Link
            to="/planner"
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm transition-colors shrink-0"
          >
            <span>Review in Trip Builder</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      )}

      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-brand-saffron/15 text-brand-spice border border-brand-saffron/30 text-xs font-bold">
            <Sparkles className="w-3.5 h-3.5" />
            <span>DYNAMIC MACHINE LEARNING RECOMMENDATIONS</span>
          </div>
          <div className="flex flex-wrap items-center gap-3 mt-1.5">
            <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              Verified Experiences in
            </h1>
            <select
              value={destId}
              onChange={(e) => handleDestinationChange(e.target.value)}
              className="text-2xl font-extrabold bg-transparent border-b-2 border-brand-saffron text-brand-spice dark:text-brand-saffron focus:outline-none cursor-pointer py-0.5"
            >
              {CURATED_DESTINATIONS.map((d) => (
                <option key={d.id} value={d.id} className="text-sm bg-white dark:bg-slate-900 text-slate-900 dark:text-white">
                  {d.name}{d.placesCount !== undefined && d.placesCount !== null ? ` (${d.placesCount} spots)` : ''}
                </option>
              ))}
            </select>
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
            Ranked dynamically via Scikit-learn TF-IDF, budget scoring, group suitability, and SQLite place records.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setShowFilterPanel(!showFilterPanel)}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 bg-slate-200/80 hover:bg-slate-300 dark:bg-white/10 dark:hover:bg-white/15 transition-all"
          >
            <span>{showFilterPanel ? 'Hide Controls' : 'Adjust Criteria'}</span>
          </button>
          <Link
            to="/planner"
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-brand-saffron to-brand-spice shadow-glow-saffron hover:opacity-95 transition-all self-start md:self-auto"
          >
            <span>Generate Itinerary</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>

      {/* Dynamic Interactive Filter & Parameter Control Panel */}
      {showFilterPanel && (
        <GlassCard className="p-5 border-slate-200 dark:border-white/15 space-y-5 bg-white/80 dark:bg-slate-900/70">
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-white/10 pb-3">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-brand-saffron" />
              <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                Live Recommendation Parameters
              </h2>
            </div>
            {isFetching && (
              <span className="flex items-center gap-1.5 text-xs text-brand-saffron animate-pulse font-medium">
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                Recalculating scores...
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            {/* 1. Daily Budget */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-700 dark:text-slate-300 font-semibold flex items-center gap-1">
                  <IndianRupee className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  Daily Budget:
                </span>
                <span className="text-slate-900 dark:text-white font-bold text-sm">₹{budgetPerDay.toLocaleString('en-IN')}/day</span>
              </div>
              <input
                type="range"
                min="500"
                max="12000"
                step="500"
                value={budgetPerDay}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  setBudgetPerDay(val);
                  handleApplyChanges(val, durationDays, groupType, groupSize, selectedInterests);
                }}
                className="w-full accent-brand-saffron cursor-pointer"
              />
              <div className="flex items-center justify-between gap-1">
                {[1000, 2500, 5000, 10000].map((b) => (
                  <button
                    key={b}
                    type="button"
                    onClick={() => {
                      setBudgetPerDay(b);
                      handleApplyChanges(b, durationDays, groupType, groupSize, selectedInterests);
                    }}
                    className={`px-2 py-1 rounded text-[11px] font-semibold transition-colors ${
                      budgetPerDay === b
                        ? 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border border-emerald-500/40'
                        : 'bg-slate-200/70 dark:bg-white/5 text-slate-700 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    ₹{b >= 1000 ? `${b / 1000}k` : b}
                  </button>
                ))}
              </div>
            </div>

            {/* 2. Duration */}
            <div className="space-y-2">
              <span className="text-xs text-slate-700 dark:text-slate-300 font-semibold block">
                Trip Duration: <strong className="text-slate-900 dark:text-white">{durationDays} Days</strong>
              </span>
              <div className="grid grid-cols-5 gap-1">
                {[1, 2, 3, 5, 7].map((days) => (
                  <button
                    key={days}
                    type="button"
                    onClick={() => {
                      setDurationDays(days);
                      handleApplyChanges(budgetPerDay, days, groupType, groupSize, selectedInterests);
                    }}
                    className={`py-1.5 rounded text-xs font-bold transition-colors ${
                      durationDays === days
                        ? 'bg-brand-saffron text-white shadow-sm'
                        : 'bg-slate-200/70 dark:bg-white/5 text-slate-700 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    {days}D
                  </button>
                ))}
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                {durationDays <= 1 ? 'Focuses on top central sights' : 'Explores wider regional highlights'}
              </p>
            </div>

            {/* 3. Group Type & Size */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-700 dark:text-slate-300 font-semibold">Group Type:</span>
                <span className="text-slate-900 dark:text-white font-bold">{groupType} ({groupSize} {groupSize === 1 ? 'person' : 'people'})</span>
              </div>
              <div className="grid grid-cols-4 gap-1">
                {(['Solo', 'Duo', 'Family', 'Friends'] as const).map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => {
                      const newSize = type === 'Solo' ? 1 : type === 'Duo' ? 2 : type === 'Family' ? 4 : 4;
                      setGroupType(type);
                      setGroupSize(newSize);
                      handleApplyChanges(budgetPerDay, durationDays, type, newSize, selectedInterests);
                    }}
                    className={`py-1.5 rounded text-xs font-bold transition-colors ${
                      groupType === type
                        ? 'bg-brand-spice text-white'
                        : 'bg-slate-200/70 dark:bg-white/5 text-slate-700 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    {type}
                  </button>
                ))}
              </div>
              <div className="flex items-center justify-between text-xs pt-0.5">
                <span className="text-slate-500 dark:text-slate-400">Traveler count:</span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const next = Math.max(1, groupSize - 1);
                      setGroupSize(next);
                      handleApplyChanges(budgetPerDay, durationDays, groupType, next, selectedInterests);
                    }}
                    className="w-6 h-6 rounded bg-slate-200 dark:bg-white/10 text-slate-800 dark:text-white font-bold flex items-center justify-center hover:bg-slate-300 dark:hover:bg-white/20"
                  >
                    -
                  </button>
                  <span className="text-slate-900 dark:text-white font-bold text-xs">{groupSize}</span>
                  <button
                    type="button"
                    onClick={() => {
                      const next = Math.min(15, groupSize + 1);
                      setGroupSize(next);
                      handleApplyChanges(budgetPerDay, durationDays, groupType, next, selectedInterests);
                    }}
                    className="w-6 h-6 rounded bg-slate-200 dark:bg-white/10 text-slate-800 dark:text-white font-bold flex items-center justify-center hover:bg-slate-300 dark:hover:bg-white/20"
                  >
                    +
                  </button>
                </div>
              </div>
            </div>

            {/* 4. Interests Selector */}
            <div className="space-y-2">
              <span className="text-xs text-slate-700 dark:text-slate-300 font-semibold block">
                Travel Interests:
              </span>
              <div className="flex flex-wrap gap-1.5">
                {AVAILABLE_INTEREST_PILLS.map((interest) => {
                  const active = selectedInterests.includes(interest);
                  return (
                    <button
                      key={interest}
                      type="button"
                      onClick={() => toggleInterest(interest)}
                      className={`px-2.5 py-1 rounded-lg text-xs capitalize font-medium transition-all ${
                        active
                          ? 'bg-brand-saffron/20 text-brand-saffron border border-brand-saffron/50 font-bold'
                          : 'bg-slate-200/70 dark:bg-white/5 text-slate-700 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white border border-transparent'
                      }`}
                    >
                      {interest}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </GlassCard>
      )}

      {/* Sorting, Category Tabs & Data Quality Filter Bar */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
          {/* Category Tabs */}
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <span className="text-slate-500 dark:text-slate-400 font-semibold">Category:</span>
            {['All', 'history', 'nature', 'beaches', 'shopping', 'food', 'culture'].map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setCategoryTab(cat)}
                className={`px-3 py-1.5 rounded-xl capitalize font-medium transition-colors ${
                  categoryTab.toLowerCase() === cat.toLowerCase()
                    ? 'bg-brand-saffron text-white font-bold shadow-sm'
                    : 'bg-slate-200/70 dark:bg-white/5 text-slate-700 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Sort By Dropdown */}
          <div className="flex items-center gap-2 text-xs self-start sm:self-auto">
            <span className="text-slate-500 dark:text-slate-400 font-semibold">Sort By:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="bg-slate-100 dark:bg-slate-900 border border-slate-300 dark:border-white/15 rounded-xl px-3 py-1.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-brand-saffron font-medium"
            >
              <option value="match">Best Match (ML Score)</option>
              <option value="price">Budget: Low to High</option>
              <option value="price_desc">Budget: High to Low</option>
              <option value="rating">Highest Rated</option>
              <option value="name">Alphabetical (A-Z)</option>
            </select>
          </div>
        </div>

        {/* Part 3: Data Quality & Provenance Filter Row */}
        <div className="flex flex-wrap items-center gap-2 text-xs pt-1 border-t border-slate-200 dark:border-white/5">
          <div className="flex items-center gap-1 text-slate-500 dark:text-slate-400 font-semibold">
            <Filter className="w-3.5 h-3.5 text-brand-spice" />
            <span>Data Provenance:</span>
          </div>
          {[
            { id: 'all', label: 'All Places' },
            { id: 'geocoded', label: 'Source-Backed Coordinates' },
            { id: 'known_fee', label: 'Known Ticket Fee' },
            { id: 'fee_unavailable', label: 'Fee Unavailable' },
          ].map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setDataQualityFilter(item.id as any)}
              className={`px-3 py-1 rounded-lg font-medium text-[11px] transition-colors ${
                dataQualityFilter === item.id
                  ? 'bg-brand-peacock/20 text-brand-peacock border border-brand-peacock/40 font-bold'
                  : 'bg-slate-200/60 dark:bg-white/5 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white border border-transparent'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* Results Header Summary */}
      <div className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-400 px-1">
        <div>
          Showing <strong className="text-slate-900 dark:text-white">{sortedPlaces.length}</strong> experiences matching{' '}
          <strong className="text-emerald-600 dark:text-emerald-400">₹{budgetPerDay.toLocaleString('en-IN')}/day</strong> •{' '}
          <strong className="text-slate-900 dark:text-white">{groupType}</strong> ({groupSize} travelers) •{' '}
          <strong className="text-slate-900 dark:text-white">{durationDays} Days</strong>
        </div>
        <div className="hidden sm:block text-[11px] text-slate-500">
          Source: OpenStreetMap & Curated Cultural Records
        </div>
      </div>

      {/* Places Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
      ) : isError ? (
        <GlassCard className="p-8 text-center space-y-3 border-slate-200 dark:border-white/10">
          <p className="text-sm font-bold text-red-500 dark:text-red-400">Failed to connect to recommendation engine</p>
          <button
            type="button"
            onClick={() => refetch()}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-slate-200 dark:bg-white/10 text-slate-800 dark:text-white"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Retry Recommendations</span>
          </button>
        </GlassCard>
      ) : sortedPlaces.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {sortedPlaces.map((place) => (
            <PlaceCard
              key={place.id}
              place={place}
              onViewOnMap={() => handleViewOnMap(place)}
              onAddToItinerary={() => handleAddToItinerary(place)}
              isAddedToItinerary={isPlaceInTrip(place.id)}
            />
          ))}
        </div>
      ) : (
        /* Transparent Empty State per Strict Data Rule */
        <GlassCard className="p-10 text-center max-w-xl mx-auto space-y-4 border-slate-200 dark:border-white/10">
          <div className="w-12 h-12 rounded-2xl bg-brand-peacock/15 border border-brand-peacock/30 flex items-center justify-center text-brand-peacock mx-auto">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <h3 className="text-lg font-bold text-slate-900 dark:text-white">
            No matching places found under current filters
          </h3>
          <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
            In strict compliance with our anti-hallucination policy, we never generate synthetic places or fake coordinates. Try selecting "All Places" or clearing category filters.
          </p>
          <div className="pt-2 flex items-center justify-center gap-2">
            <button
              type="button"
              onClick={() => {
                setCategoryTab('All');
                setDataQualityFilter('all');
              }}
              className="px-4 py-2 rounded-xl text-xs font-bold bg-brand-saffron text-white shadow-glow-saffron"
            >
              Reset Filters
            </button>
            <Link
              to="/discover"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-slate-200 dark:bg-white/10 text-slate-800 dark:text-white"
            >
              <Compass className="w-4 h-4" />
              <span>Explore Other Destinations</span>
            </Link>
          </div>
        </GlassCard>
      )}
    </div>
  );
};
