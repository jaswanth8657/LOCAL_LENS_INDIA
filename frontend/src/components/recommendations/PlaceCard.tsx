import React from 'react';
import { Place } from '../../types';
import { GlassCard } from '../ui/GlassCard';
import { VerificationBadge, MatchBadge, CategoryBadge } from '../ui/Badge';
import { MapPin, Clock, IndianRupee, Compass, Plus, Check } from 'lucide-react';

interface PlaceCardProps {
  place: Place;
  onViewOnMap?: (place: Place) => void;
  onAddToItinerary?: (place: Place) => void;
  isAddedToItinerary?: boolean;
}

export const PlaceCard: React.FC<PlaceCardProps> = ({
  place,
  onViewOnMap,
  onAddToItinerary,
  isAddedToItinerary = false
}) => {
  return (
    <GlassCard hoverEffect className="p-5 flex flex-col justify-between space-y-4">
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
          <VerificationBadge
            status={place.verificationStatus}
            source={place.dataSource}
          />
          <CategoryBadge category={place.category} />
          {place.distanceKm !== undefined && (
            <span className="text-[10px] font-semibold text-amber-700 dark:text-amber-300 bg-amber-500/10 border border-amber-500/25 px-2 py-0.5 rounded-full">
              {place.distanceKm} km away
            </span>
          )}
          <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400">
            Source: {place.dataSource}
          </span>
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
      <div className="pt-2 border-t border-slate-200 dark:border-white/5 flex items-center justify-between gap-2">
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

        {onAddToItinerary && (
          <button
            type="button"
            onClick={() => onAddToItinerary(place)}
            className={`flex items-center gap-1.5 text-xs font-bold px-3.5 py-2 rounded-xl transition-all ${
              isAddedToItinerary
                ? 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30'
                : 'bg-slate-100 dark:bg-white/10 hover:bg-brand-saffron hover:text-white text-slate-800 dark:text-white border border-slate-200 dark:border-white/10'
            }`}
          >
            {isAddedToItinerary ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-500 dark:text-emerald-400" />
                <span>In Itinerary</span>
              </>
            ) : (
              <>
                <Plus className="w-3.5 h-3.5" />
                <span>Add to Trip</span>
              </>
            )}
          </button>
        )}
      </div>
    </GlassCard>
  );
};

