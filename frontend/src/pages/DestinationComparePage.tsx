import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CURATED_DESTINATIONS } from '../data/curatedDestinations';
import {
  compareDestinationsAPI,
  DestinationComparisonItem,
} from '../api/client';
import { GlassCard } from '../components/ui/GlassCard';
import { CardSkeleton } from '../components/ui/Skeleton';
import { useTrip } from '../context/TripContext';
import {
  ArrowRight,
  Scale,
  Calendar,
  IndianRupee,
  Compass,
  Building,
  Sun,
  ShieldCheck,
  Trash2,
  Globe2,
} from 'lucide-react';

const PRESET_COMPARISONS = [
  {
    name: 'Coastal & Heritage vs Royal Desert',
    slugs: ['visakhapatnam', 'jaipur', 'kochi'],
  },
  {
    name: 'Spiritual Sacred Hub vs Ancient Ruins',
    slugs: ['varanasi', 'hampi'],
  },
  {
    name: 'Himalayan High Altitude vs Coastal Port',
    slugs: ['ladakh', 'visakhapatnam'],
  },
  {
    name: 'Catalog Seeded vs Live Discovery',
    slugs: ['jaipur', 'hyderabad'],
  },
];

export const DestinationComparePage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { setSelectedDestination, setPreferences } = useTrip();

  const queryDests = searchParams.get('destinations');
  const initialSlugs = queryDests
    ? queryDests.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean)
    : ['visakhapatnam', 'jaipur', 'kochi'];

  const [selectedSlugs, setSelectedSlugs] = useState<string[]>(
    initialSlugs.length >= 2 && initialSlugs.length <= 3
      ? initialSlugs
      : ['visakhapatnam', 'jaipur', 'kochi']
  );

  const [candidateSlug, setCandidateSlug] = useState<string>('');

  useEffect(() => {
    const params = new URLSearchParams();
    params.set('destinations', selectedSlugs.join(','));
    setSearchParams(params, { replace: true });
  }, [selectedSlugs, setSearchParams]);

  const {
    data: comparisonData,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ['destinationsCompare', selectedSlugs],
    queryFn: () => compareDestinationsAPI(selectedSlugs),
    enabled: selectedSlugs.length >= 2 && selectedSlugs.length <= 3,
  });

  const handleAddDestination = (slugToAdd: string) => {
    if (!slugToAdd || selectedSlugs.includes(slugToAdd) || selectedSlugs.length >= 3) return;
    setSelectedSlugs([...selectedSlugs, slugToAdd]);
    setCandidateSlug('');
  };

  const handleRemoveDestination = (slugToRemove: string) => {
    if (selectedSlugs.length <= 2) return; // Keep minimum 2
    setSelectedSlugs(selectedSlugs.filter((s) => s !== slugToRemove));
  };

  const handleApplyPreset = (slugs: string[]) => {
    setSelectedSlugs(slugs);
  };

  const handlePlanTrip = (item: DestinationComparisonItem) => {
    const curated = CURATED_DESTINATIONS.find((d) => d.id === item.slug);
    if (curated) {
      setSelectedDestination(curated);
    }
    setPreferences((prev) => ({
      ...prev,
      destination: item.slug,
      destinationName: item.name,
      budgetPerDay: item.average_daily_budget_inr,
    }));
    navigate('/planner');
  };

  const availableToAdd = CURATED_DESTINATIONS.filter(
    (d) => !selectedSlugs.includes(d.id)
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8 animate-fade-in">
      {/* Header */}
      <div className="space-y-3">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-brand-saffron/15 text-brand-spice border border-brand-saffron/30 text-xs font-bold">
          <Scale className="w-3.5 h-3.5" />
          <span>DESTINATION COMPARISON WORKSPACE</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-stone-900 dark:text-white tracking-tight">
          Compare Destinations Side-by-Side
        </h1>
        <p className="text-sm text-stone-600 dark:text-slate-400 max-w-3xl">
          Evaluate 2 or 3 destinations simultaneously using real SQLite database statistics, catalog provenance indicators, and tropical solar season profiles.
        </p>
      </div>

      {/* Preset Quick Selectors */}
      <div className="flex flex-wrap items-center gap-2 pt-1">
        <span className="text-xs font-bold text-stone-600 dark:text-slate-400 mr-2">
          Suggested Comparisons:
        </span>
        {PRESET_COMPARISONS.map((preset) => (
          <button
            key={preset.name}
            type="button"
            onClick={() => handleApplyPreset(preset.slugs)}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-stone-200/80 dark:bg-white/5 hover:bg-stone-300 dark:hover:bg-white/10 text-stone-700 dark:text-slate-300 border border-stone-300 dark:border-white/10 transition-colors"
          >
            {preset.name}
          </button>
        ))}
      </div>

      {/* Selection Control Bar */}
      <GlassCard className="p-4 border-stone-200 dark:border-white/10">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-bold text-stone-700 dark:text-slate-300">
              Selected ({selectedSlugs.length}/3):
            </span>
            {selectedSlugs.map((slug) => {
              const info = CURATED_DESTINATIONS.find((d) => d.id === slug);
              return (
                <div
                  key={slug}
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-brand-saffron/15 text-brand-spice border border-brand-saffron/30 text-xs font-bold"
                >
                  <span>{info?.name || slug}</span>
                  {selectedSlugs.length > 2 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveDestination(slug)}
                      className="hover:text-red-500 ml-1"
                      title="Remove from comparison"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          {selectedSlugs.length < 3 && availableToAdd.length > 0 && (
            <div className="flex items-center gap-2">
              <select
                aria-label="Add destination to comparison"
                value={candidateSlug}
                onChange={(e) => setCandidateSlug(e.target.value)}
                className="bg-stone-100 dark:bg-slate-900 border border-stone-300 dark:border-white/15 rounded-xl px-3 py-1.5 text-xs text-stone-800 dark:text-white focus:outline-none focus:border-brand-saffron"
              >
                <option value="">+ Add a Destination...</option>
                {availableToAdd.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name} ({d.state})
                  </option>
                ))}
              </select>
              <button
                type="button"
                disabled={!candidateSlug}
                onClick={() => handleAddDestination(candidateSlug)}
                className="px-3 py-1.5 rounded-xl text-xs font-bold bg-brand-saffron text-white hover:bg-brand-spice disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Add
              </button>
            </div>
          )}
        </div>
      </GlassCard>

      {/* Comparison Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <CardSkeleton />
          <CardSkeleton />
          {selectedSlugs.length === 3 && <CardSkeleton />}
        </div>
      ) : isError ? (
        <GlassCard className="p-8 text-center space-y-3">
          <p className="text-sm font-bold text-red-500">
            Failed to load comparison data: {(error as Error)?.message || 'Server error'}
          </p>
          <button
            type="button"
            onClick={() => refetch()}
            className="px-4 py-2 rounded-xl text-xs font-bold bg-stone-200 dark:bg-white/10 text-stone-800 dark:text-white"
          >
            Retry Comparison
          </button>
        </GlassCard>
      ) : comparisonData?.destinations ? (
        <div
          className={`grid grid-cols-1 md:grid-cols-${selectedSlugs.length} gap-6 items-stretch`}
          style={{
            gridTemplateColumns: `repeat(${comparisonData.destinations.length}, minmax(0, 1fr))`,
          }}
        >
          {comparisonData.destinations.map((dest) => (
            <div
              key={dest.slug}
              className="flex flex-col bg-white/70 dark:bg-slate-900/60 backdrop-blur-md rounded-2xl border border-stone-200 dark:border-white/10 overflow-hidden shadow-lg transition-all hover:border-brand-saffron/40"
            >
              {/* Card Header & Image */}
              <div className="relative h-44 bg-slate-800 overflow-hidden">
                {dest.imageUrl ? (
                  <img
                    src={dest.imageUrl}
                    alt={dest.name}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-slate-800 to-slate-900 text-slate-500">
                    <Building className="w-12 h-12 opacity-30" />
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-stone-950/90 via-stone-950/40 to-transparent" />

                <div className="absolute bottom-3 left-4 right-4 text-white">
                  <div className="text-[11px] font-bold text-brand-saffron uppercase tracking-wider">
                    {dest.region} India • {dest.state}
                  </div>
                  <h3 className="text-2xl font-black tracking-tight">{dest.name}</h3>
                  <p className="text-xs text-stone-300 line-clamp-1 mt-0.5">{dest.tagline}</p>
                </div>
              </div>

              {/* Body Matrix Content */}
              <div className="p-5 flex-1 flex flex-col justify-between space-y-6">
                <div className="space-y-5">
                  {/* Catalog Status Badge */}
                  <div>
                    <span
                      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${
                        dest.catalog_status === 'CATALOG_SEEDED'
                          ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                          : 'bg-purple-500/15 text-purple-300 border-purple-500/30'
                      }`}
                    >
                      <ShieldCheck className="w-3.5 h-3.5" />
                      {dest.catalog_badge}
                    </span>
                  </div>

                  {/* Budget Section */}
                  <div className="p-3.5 rounded-xl bg-stone-100/80 dark:bg-white/5 border border-stone-200 dark:border-white/5 space-y-1">
                    <div className="text-[11px] uppercase font-bold tracking-wider text-stone-500 dark:text-slate-400 flex items-center gap-1">
                      <IndianRupee className="w-3.5 h-3.5" />
                      <span>Est. Daily Budget</span>
                    </div>
                    <div className="text-xl font-extrabold text-stone-900 dark:text-white flex items-baseline gap-1">
                      <span>₹{dest.average_daily_budget_inr.toLocaleString('en-IN')}</span>
                      <span className="text-xs font-normal text-stone-500 dark:text-slate-400">/ day / person</span>
                    </div>
                  </div>

                  {/* Seasonality / Best Time */}
                  <div className="space-y-1">
                    <div className="text-[11px] uppercase font-bold tracking-wider text-stone-500 dark:text-slate-400 flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5" />
                      <span>Best Time to Visit</span>
                    </div>
                    <div className="text-xs font-semibold text-stone-800 dark:text-slate-200">
                      {dest.best_time_to_visit}
                    </div>
                  </div>

                  {/* Attraction Distribution & Ticket Pricing */}
                  <div className="space-y-2">
                    <div className="text-[11px] uppercase font-bold tracking-wider text-stone-500 dark:text-slate-400 flex items-center gap-1">
                      <Compass className="w-3.5 h-3.5" />
                      <span>Attraction Insights</span>
                    </div>

                    {dest.catalog_status === 'LIVE_DISCOVERY_TARGET' ? (
                      <div className="p-3 rounded-xl bg-purple-500/10 border border-purple-500/25 space-y-1.5 text-xs">
                        <div className="flex items-center gap-1.5 text-purple-300 font-bold">
                          <Globe2 className="w-3.5 h-3.5" />
                          <span>On-demand live discovery — attractions are searched when planning.</span>
                        </div>
                        <div className="text-[11px] text-stone-400 leading-relaxed">
                          Local catalogue: <strong className="text-stone-300">0 seeded attractions</strong>. Real-world spots are not pre-fetched in this comparison view; they are retrieved dynamically on demand during itinerary planning.
                        </div>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="p-2.5 rounded-lg bg-stone-100/60 dark:bg-white/5 border border-stone-200 dark:border-white/5">
                          <div className="text-stone-500 dark:text-slate-400 text-[10px]">Free Entry Sites</div>
                          <div className="font-extrabold text-emerald-500 text-sm">
                            {dest.places_summary.free_entry_count} spots
                          </div>
                        </div>
                        <div className="p-2.5 rounded-lg bg-stone-100/60 dark:bg-white/5 border border-stone-200 dark:border-white/5">
                          <div className="text-stone-500 dark:text-slate-400 text-[10px]">Avg Ticket (Paid)</div>
                          <div className="font-extrabold text-stone-800 dark:text-white text-sm">
                            {dest.places_summary.avg_ticket_price_inr > 0
                              ? `₹${dest.places_summary.avg_ticket_price_inr}`
                              : 'Free / N/A'}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Tropical Environment Profile */}
                  <div className="space-y-2">
                    <div className="text-[11px] uppercase font-bold tracking-wider text-stone-500 dark:text-slate-400 flex items-center gap-1">
                      <Sun className="w-3.5 h-3.5" />
                      <span>Solar Environment</span>
                    </div>
                    {dest.catalog_status === 'LIVE_DISCOVERY_TARGET' ? (
                      <div className="text-xs text-stone-400 italic bg-stone-100/40 dark:bg-white/5 p-2 rounded-lg border border-stone-200/40 dark:border-white/5">
                        Solar profile classified on demand upon live attraction discovery using time-of-day heuristics. No live weather sensors used.
                      </div>
                    ) : (
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-2 text-xs">
                          <span className="px-2 py-1 rounded-md bg-emerald-500/10 text-emerald-400 font-semibold border border-emerald-500/20">
                            {dest.climate_summary.outdoor_places_count} Outdoor
                          </span>
                          <span className="px-2 py-1 rounded-md bg-blue-500/10 text-blue-300 font-semibold border border-blue-500/20">
                            {dest.climate_summary.indoor_sheltered_count} Sheltered / Indoor
                          </span>
                        </div>
                        <p className="text-[10px] text-stone-500 dark:text-slate-400 leading-tight">
                          General planning heuristic based on venue shelter classification (morning/evening outdoor vs midday indoor). No live weather or solar radiation telemetry is retrieved.
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Categories Tags */}
                  <div className="space-y-1.5">
                    <div className="text-[11px] uppercase font-bold tracking-wider text-stone-500 dark:text-slate-400">
                      Popular Highlights
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {dest.popular_categories.map((cat) => (
                        <span
                          key={cat}
                          className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-brand-saffron/10 text-brand-spice border border-brand-saffron/20"
                        >
                          {cat}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Plan Trip Action */}
                <div className="pt-4 border-t border-stone-200 dark:border-white/10">
                  <button
                    type="button"
                    onClick={() => handlePlanTrip(dest)}
                    className="w-full py-2.5 rounded-xl font-bold text-xs bg-gradient-to-r from-brand-saffron to-brand-spice text-white shadow-glow-saffron hover:opacity-95 transition-all flex items-center justify-center gap-2"
                  >
                    <span>Plan Trip to {dest.name}</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
};
