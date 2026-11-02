import React, { useState } from 'react';
import { Place } from '../../types';
import { GlassCard } from '../ui/GlassCard';
import { VerificationBadge, MatchBadge, CategoryBadge } from '../ui/Badge';
import { ProvenanceDrawer } from '../ui/ProvenanceDrawer';
import { MapPin, Clock, IndianRupee, Compass, Plus, Check, ShieldCheck } from 'lucide-react';

interface PlaceCardProps {
  place: Place;
  onViewOnMap?: (place: Place) => void;
  onAddToItinerary?: (place: Place) => void;
  onAddToDay?: (place: Place, dayNumber: number) => void;
  isAddedToItinerary?: boolean;
  availableDays?: number[];
}

export const PlaceCard: React.FC<PlaceCardProps> = ({
  place,
  onViewOnMap,
  onAddToItinerary,
  onAddToDay,
  isAddedToItinerary = false,
  availableDays = [],
}) => {
  const [isProvenanceOpen, setIsProvenanceOpen] = useState(false);

  return (
    <>
      <GlassCard hoverEffect className="p-5 flex flex-col justify-between space-y-4 overflow-hidden">
        {/* Optional Wikimedia / Verified Photograph with Full Attribution */}
        {(place.imageUrl || (place as any).image_url) && (
          <div className="relative h-44 -mx-5 -mt-5 mb-1 overflow-hidden bg-slate-900 group/img">
            <img
              src={place.imageUrl || (place as any).image_url}
              alt={place.name}
              className="w-full h-full object-cover transition-transform duration-700 group-hover/img:scale-105"
              loading="lazy"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-transparent" />
            <div className="absolute bottom-1.5 inset-x-3 flex items-center justify-between text-[10px] text-slate-200">
              <span className="truncate max-w-[200px]">
                {place.imageAuthor || (place as any).image_author ? `Photo: ${place.imageAuthor || (place as any).image_author}` : 'Wikimedia Commons'}
              </span>
              {(place.imageSourceUrl || (place as any).image_source_url) ? (
                <a
                  href={place.imageSourceUrl || (place as any).image_source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="text-brand-saffron hover:underline font-semibold shrink-0 ml-1"
                >
                  {place.imageLicense || (place as any).image_license || 'CC BY-SA'} ↗
                </a>
              ) : (
                <span className="shrink-0 ml-1">{place.imageLicense || (place as any).image_license || 'CC BY-SA'}</span>
              )}
            </div>
          </div>
        )}

        {/* Header with Title & Badges */}
        <div className="space-y-2">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h4 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight hover:text-brand-spice transition-colors">
                {place.name}
              </h4>
              <div className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                <MapPin className="w-3.5 h-3.5 text-brand-saffron shrink-0" />
                <span className="line-clamp-1">{place.address}</span>
              </div>
            </div>
            {place.matchScore !== undefined && (
              <MatchBadge score={place.matchScore} />
            )}
          </div>

          {/* Verification & Category row */}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <button
              type="button"
              onClick={() => setIsProvenanceOpen(true)}
              className="hover:opacity-80 transition-opacity"
              title="Click to view full data provenance & source records"
            >
              <VerificationBadge
                status={place.verificationStatus}
                source={place.dataSource}
              />
            </button>
            <CategoryBadge category={place.category} />
            {place.distanceKm !== undefined && (
              <span className="text-[10px] font-semibold text-amber-700 dark:text-amber-300 bg-amber-500/10 border border-amber-500/25 px-2 py-0.5 rounded-full">
                {place.distanceKm} km away
              </span>
            )}
            <button
              type="button"
              onClick={() => setIsProvenanceOpen(true)}
              className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 hover:underline"
              title="Inspect verifiable data trail"
            >
              <ShieldCheck className="w-3 h-3" />
              <span>Provenance</span>
            </button>
          </div>
        </div>

        {/* Description */}
        <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed line-clamp-2">
          {place.description}
        </p>

        {/* Explainable Match Reason */}
        {place.matchReason && (
          <div className="p-2.5 rounded-xl bg-brand-saffron/10 border border-brand-saffron/20 text-xs text-brand-spice leading-snug">
            <span className="font-semibold">Why this spot: </span>
            <span>{place.matchReason}</span>
          </div>
        )}

        {/* Fact-Checked Practical Details */}
        <div className="grid grid-cols-2 gap-2 text-xs bg-slate-100/70 dark:bg-slate-950/60 p-3 rounded-xl border border-slate-200 dark:border-white/5">
          <div className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
            <Clock className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400 shrink-0" />
            <span className="truncate">
              {place.openingHours && place.openingHours.trim() ? place.openingHours : 'Hours: Not available'}
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300 justify-end">
            <IndianRupee className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>
              {place.ticketPriceInr !== undefined && place.ticketPriceInr !== null
                ? place.ticketPriceInr === 0
                  ? 'Free Entry (Verified)'
                  : `₹${place.ticketPriceInr} ticket`
                : place.typicalCostInr !== undefined && place.typicalCostInr !== null && place.typicalCostInr > 0
                ? `₹${place.typicalCostInr} (Est. typical)`
                : 'Price: Not available'}
            </span>
          </div>
        </div>

        {/* Bottom Action Controls */}
        <div className="pt-2 border-t border-slate-200 dark:border-white/5 flex items-center justify-between gap-2 flex-wrap">
          {onViewOnMap && (
            <button
              type="button"
              onClick={() => onViewOnMap(place)}
              className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white px-3 py-2 rounded-xl hover:bg-slate-100 dark:hover:bg-white/5 transition-colors"
            >
              <Compass className="w-3.5 h-3.5 text-brand-saffron" />
              <span>Map Location</span>
            </button>
          )}

          {/* Add to Trip Action / Day Picker */}
          {onAddToItinerary && (
            <div className="flex items-center">
              {isAddedToItinerary ? (
                <button
                  type="button"
                  onClick={() => onAddToItinerary(place)}
                  className="flex items-center gap-1.5 text-xs font-bold px-3.5 py-2 rounded-xl transition-all bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 hover:bg-rose-500/10 hover:text-rose-500 hover:border-rose-500/20"
                  title="Click to remove from trip"
                >
                  <Check className="w-3.5 h-3.5 text-emerald-500 dark:text-emerald-400" />
                  <span>In Itinerary</span>
                </button>
              ) : availableDays.length > 1 && onAddToDay ? (
                <div className="inline-flex rounded-xl shadow-sm border border-slate-200 dark:border-white/10 overflow-hidden">
                  <button
                    type="button"
                    onClick={() => onAddToItinerary(place)}
                    className="flex items-center gap-1 text-xs font-bold px-3 py-2 bg-slate-100 dark:bg-white/10 hover:bg-brand-saffron hover:text-white text-slate-800 dark:text-white transition-all border-r border-slate-200 dark:border-white/10"
                    title="Add to trip"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add</span>
                  </button>
                  <select
                    aria-label={`Select day to add ${place.name}`}
                    defaultValue=""
                    onChange={(e) => {
                      const dayNum = Number(e.target.value);
                      if (dayNum) {
                        onAddToDay(place, dayNum);
                        e.target.value = '';
                      }
                    }}
                    className="text-[11px] font-bold px-2 py-2 bg-slate-200/80 dark:bg-white/15 text-slate-800 dark:text-slate-200 focus:outline-none cursor-pointer hover:bg-brand-saffron hover:text-white transition-colors"
                  >
                    <option value="" disabled>+ Day</option>
                    {availableDays.map((d) => (
                      <option key={d} value={d} className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">
                        Day {d}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => onAddToItinerary(place)}
                  className="flex items-center gap-1.5 text-xs font-bold px-3.5 py-2 rounded-xl transition-all bg-slate-100 dark:bg-white/10 hover:bg-brand-saffron hover:text-white text-slate-800 dark:text-white border border-slate-200 dark:border-white/10"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add to Trip</span>
                </button>
              )}
            </div>
          )}
        </div>
      </GlassCard>

      {/* Slide-out Data Provenance & Trust Drawer */}
      {isProvenanceOpen && (
        <ProvenanceDrawer
          isOpen={isProvenanceOpen}
          onClose={() => setIsProvenanceOpen(false)}
          placeId={place.id}
          placeName={place.name}
        />
      )}
    </>
  );
};
