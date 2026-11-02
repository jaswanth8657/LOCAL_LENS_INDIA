import React, { useState } from 'react';
import {
  REGIONAL_CULINARY_REGISTRY,
} from '../../data/regionalCuisine';
import { GlassCard } from '../ui/GlassCard';
import {
  UtensilsCrossed,
  MapPin,
  Leaf,
  Info,
  Flame,
  ChefHat,
  Compass,
  ExternalLink,
  Award,
  ShieldCheck,
} from 'lucide-react';

interface RegionalCulinaryGuideProps {
  initialDestinationSlug?: string;
  className?: string;
}

const DESTINATION_TABS = [
  { slug: 'all', name: 'All Destinations' },
  { slug: 'visakhapatnam', name: 'Visakhapatnam' },
  { slug: 'jaipur', name: 'Jaipur' },
  { slug: 'kochi', name: 'Kochi' },
  { slug: 'varanasi', name: 'Varanasi' },
  { slug: 'hampi', name: 'Hampi' },
  { slug: 'ladakh', name: 'Ladakh' },
  { slug: 'hyderabad', name: 'Hyderabad' },
];

export const RegionalCulinaryGuide: React.FC<RegionalCulinaryGuideProps> = ({
  initialDestinationSlug,
  className = '',
}) => {
  const [selectedDest, setSelectedDest] = useState<string>(
    initialDestinationSlug || 'all'
  );
  const [dietaryFilter, setDietaryFilter] = useState<string>('All');

  const filteredDishes = REGIONAL_CULINARY_REGISTRY.filter((dish) => {
    const matchesDest = selectedDest === 'all' || dish.destinationSlug === selectedDest;
    const matchesDiet = dietaryFilter === 'All' || dish.dietaryTag === dietaryFilter;
    return matchesDest && matchesDiet;
  });

  return (
    <div className={`space-y-6 culinary-guide-section ${className}`}>
      {/* Registry Header */}
      <div className="space-y-2">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-brand-spice/15 text-brand-spice border border-brand-spice/30 text-xs font-bold">
          <UtensilsCrossed className="w-3.5 h-3.5" />
          <span>REGIONAL CULINARY HERITAGE GUIDE</span>
        </div>
        <h2 className="text-2xl sm:text-3xl font-extrabold text-stone-900 dark:text-white tracking-tight">
          Authentic Regional Gastronomy
        </h2>
        <p className="text-xs sm:text-sm text-stone-600 dark:text-slate-400 max-w-3xl">
          Explore iconic dishes, traditional preparation rituals, and historic street food corridors rooted in centuries of local culture across India.
        </p>
      </div>

      {/* Advisory Banner */}
      <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/25 text-amber-200 text-xs flex items-start gap-2.5">
        <Info className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
        <div className="leading-relaxed">
          <strong>Curated Evidence-Based Registry: </strong>
          This guide presents traditional dishes and historic food bazaar locations for the 7 destinations. Every dish is accompanied by its regional origin and an explicit evidence status. Items marked <em>Partially Supported</em> represent authentic local bazaar and oral traditions that lack a centralized government recipe gazette; they are not presented as officially authenticated. Statutory Geographical Indications (GI) strictly identify certified agricultural or confectionery products, not derivative street preparations.
        </div>
      </div>

      {/* Controls Bar: Destination & Dietary Selectors */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pt-1 no-print">
        {/* Destination Filter Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 max-w-full">
          {DESTINATION_TABS.map((tab) => (
            <button
              key={tab.slug}
              type="button"
              onClick={() => setSelectedDest(tab.slug)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold shrink-0 transition-all ${
                selectedDest === tab.slug
                  ? 'bg-brand-spice text-white shadow-sm'
                  : 'bg-stone-200/80 dark:bg-white/5 text-stone-700 dark:text-slate-300 hover:bg-stone-300 dark:hover:bg-white/10'
              }`}
            >
              {tab.name}
            </button>
          ))}
        </div>

        {/* Dietary Filters */}
        <div className="flex items-center gap-1.5 shrink-0">
          {(['All', 'Vegetarian', 'Non-Vegetarian', 'Vegan'] as const).map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => setDietaryFilter(tag)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                dietaryFilter === tag
                  ? 'bg-stone-900 dark:bg-white text-white dark:text-stone-950 font-bold'
                  : 'bg-stone-200/70 dark:bg-white/5 text-stone-600 dark:text-slate-400 hover:text-stone-900 dark:hover:text-white'
              }`}
            >
              {tag}
            </button>
          ))}
        </div>
      </div>

      {/* Dish Cards Grid */}
      {filteredDishes.length === 0 ? (
        <GlassCard className="p-8 text-center text-slate-400">
          No culinary entries matching the selected filters.
        </GlassCard>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredDishes.map((dish) => (
            <div
              key={dish.id}
              className="bg-white/70 dark:bg-slate-900/60 backdrop-blur-md rounded-2xl border border-stone-200 dark:border-white/10 p-5 flex flex-col justify-between space-y-4 shadow-sm hover:border-brand-spice/40 transition-all dish-card"
            >
              <div className="space-y-3">
                {/* Destination & Dietary Badge Header */}
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold text-brand-spice uppercase tracking-wider">
                    <MapPin className="w-3 h-3" />
                    {dish.destinationName}
                  </span>

                  <div className="flex items-center gap-1.5 flex-wrap">
                    {dish.isGIRegistered && (
                      <span
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-500/15 text-amber-500 dark:text-amber-300 border border-amber-500/30"
                        title={dish.giRegisteredName ? `Registered Product: ${dish.giRegisteredName}` : 'GI Registered'}
                      >
                        <Award className="w-2.5 h-2.5" />
                        <span>GI Registered Product (App #{dish.giApplicationNumber})</span>
                      </span>
                    )}
                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                        dish.dietaryTag === 'Vegetarian'
                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                          : dish.dietaryTag === 'Vegan'
                          ? 'bg-teal-500/10 text-teal-300 border-teal-500/30'
                          : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                      }`}
                    >
                      {dish.dietaryTag === 'Vegan' && <Leaf className="w-2.5 h-2.5" />}
                      {dish.dietaryTag === 'Vegetarian' && (
                        <span className="w-2 h-2 rounded-full bg-emerald-400" />
                      )}
                      {dish.dietaryTag === 'Non-Vegetarian' && (
                        <span className="w-2 h-2 rounded-full bg-rose-400" />
                      )}
                      <span>{dish.dietaryTag}</span>
                    </span>
                  </div>
                </div>

                {/* Dish Name */}
                <h3 className="text-lg font-extrabold text-stone-900 dark:text-white tracking-tight">
                  {dish.dishName}
                </h3>

                {/* Cultural Context */}
                <p className="text-xs text-stone-600 dark:text-slate-300 leading-relaxed">
                  {dish.culturalContext}
                </p>

                {/* Key Ingredients */}
                <div className="space-y-1">
                  <div className="text-[10px] uppercase font-bold tracking-wider text-stone-500 dark:text-slate-400 flex items-center gap-1">
                    <ChefHat className="w-3 h-3" />
                    <span>Key Ingredients</span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {dish.keyIngredients.map((ing) => (
                      <span
                        key={ing}
                        className="px-2 py-0.5 rounded-md text-[10px] bg-stone-100 dark:bg-white/5 text-stone-700 dark:text-slate-300 border border-stone-200 dark:border-white/5"
                      >
                        {ing}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Traditional Preparation */}
                <div className="p-3 rounded-xl bg-stone-100/70 dark:bg-white/5 border border-stone-200/70 dark:border-white/5 text-xs text-stone-700 dark:text-slate-300 space-y-1">
                  <div className="flex items-center gap-1 text-[10px] font-bold text-brand-spice uppercase tracking-wider">
                    <Flame className="w-3 h-3" />
                    <span>Traditional Method</span>
                  </div>
                  <p className="text-[11px] leading-relaxed text-stone-600 dark:text-slate-400">
                    {dish.traditionalPreparation}
                  </p>
                </div>
              </div>

              {/* Footer: Authentic Hubs, Regional Origin, Evidence Note, and Source */}
              <div className="pt-3 border-t border-stone-200 dark:border-white/5 space-y-2 text-xs">
                {dish.regionalOrigin && (
                  <div className="text-[10px] text-stone-500 dark:text-slate-400">
                    <strong className="text-stone-700 dark:text-slate-300">Regional Origin: </strong>
                    <span>{dish.regionalOrigin}</span>
                  </div>
                )}

                <div className="flex items-start gap-1.5 text-[11px] text-stone-700 dark:text-slate-300">
                  <Compass className="w-3.5 h-3.5 text-brand-spice shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold text-stone-900 dark:text-white">Authentic Hubs: </span>
                    <span className="text-stone-600 dark:text-slate-400">{dish.famousFoodStreets}</span>
                  </div>
                </div>

                {/* Evidence Note */}
                {dish.evidenceNotes && (
                  <div className="p-2 rounded-lg bg-stone-100/80 dark:bg-white/[0.04] border border-stone-200/70 dark:border-white/5 text-[10.5px] leading-relaxed text-stone-600 dark:text-slate-400">
                    <strong className="text-stone-700 dark:text-slate-300">Evidence Note: </strong>
                    <span>{dish.evidenceNotes}</span>
                  </div>
                )}

                {/* Evidence Status Badge & Source Link */}
                <div className="flex items-center justify-between gap-2 pt-1">
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold border ${
                      dish.evidenceStatus === 'DIRECTLY_SUPPORTED'
                        ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
                        : dish.evidenceStatus === 'REGIONALLY_SUPPORTED'
                        ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30'
                        : dish.evidenceStatus === 'PARTIALLY_SUPPORTED'
                        ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30'
                        : 'bg-stone-500/10 text-stone-600 dark:text-stone-400 border-stone-500/30'
                    }`}
                  >
                    <ShieldCheck className="w-2.5 h-2.5" />
                    <span>
                      {dish.evidenceStatus === 'DIRECTLY_SUPPORTED' && 'Direct Authority / GI'}
                      {dish.evidenceStatus === 'REGIONALLY_SUPPORTED' && 'Regional Culinary Tradition'}
                      {dish.evidenceStatus === 'PARTIALLY_SUPPORTED' && 'Partially Supported / Local Specialty'}
                      {dish.evidenceStatus === 'SOURCE_NOT_FOUND' && 'Source Unverified'}
                    </span>
                  </span>

                  {dish.sourceUrl ? (
                    <a
                      href={dish.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-brand-spice hover:underline font-semibold text-[10px] shrink-0"
                    >
                      <span>Authority Source</span>
                      <ExternalLink className="w-2.5 h-2.5" />
                    </a>
                  ) : (
                    <span className="text-[10px] text-stone-400 italic">No source URL recorded</span>
                  )}
                </div>

                {dish.sourceName && (
                  <div className="text-[10px] text-stone-500 dark:text-slate-400 truncate" title={dish.sourceName}>
                    Source: {dish.sourceName}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
