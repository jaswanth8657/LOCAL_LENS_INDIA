import React from 'react';
import { Destination } from '../../types';
import { GlassCard } from '../ui/GlassCard';
import { VerificationBadge, CategoryBadge } from '../ui/Badge';
import { Calendar, IndianRupee, MapPin, ArrowRight, Compass } from 'lucide-react';
import { useTrip } from '../../context/TripContext';
import { useNavigate } from 'react-router-dom';

interface DestinationCardProps {
  destination: Destination;
  isSelected?: boolean;
}

export const DestinationCard: React.FC<DestinationCardProps> = ({
  destination,
  isSelected = false
}) => {
  const { setSelectedDestination, setPreferences } = useTrip();
  const navigate = useNavigate();

  const handleSelect = () => {
    setSelectedDestination(destination);
    setPreferences((prev) => ({
      ...prev,
      destination: destination.id,
      destinationName: destination.name,
    }));
  };

  const handlePlanTrip = (e: React.MouseEvent) => {
    e.stopPropagation();
    handleSelect();
    navigate('/planner');
  };

  return (
    <GlassCard
      onClick={handleSelect}
      hoverEffect
      variant={isSelected ? 'glow-saffron' : 'default'}
      className="group cursor-pointer flex flex-col h-full"
    >
      {/* Destination Image with gradient overlay */}
      <div className="relative h-48 w-full overflow-hidden bg-slate-900">
        <img
          src={destination.imageUrl}
          alt={destination.name}
          className="w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-108"
          loading="lazy"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent" />

        {/* State & Verification Badges */}
        <div className="absolute top-3 inset-x-3 flex items-center justify-between">
          <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-slate-950/80 backdrop-blur-md text-white border border-white/10 flex items-center gap-1">
            <MapPin className="w-3 h-3 text-brand-saffron" />
            {destination.state}
          </span>
          {destination.isExternal ? (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-500/90 text-white backdrop-blur-md border border-sky-400/40 flex items-center gap-1 shadow-sm">
              Live Discovery (OSM)
            </span>
          ) : (
            <VerificationBadge status={destination.verifiedStatus} source="State Tourism & OSM" />
          )}
        </div>

        {/* Name on image */}
        <div className="absolute bottom-3 left-4 right-4">
          <h3 className="text-xl font-bold text-white tracking-tight group-hover:text-brand-spice transition-colors">
            {destination.name}
          </h3>
          <p className="text-xs text-slate-300 line-clamp-1 italic">
            {destination.tagline}
          </p>
        </div>
      </div>

      {/* Card Content */}
      <div className="p-4 flex-1 flex flex-col justify-between space-y-4">
        <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-2 leading-relaxed">
          {destination.description}
        </p>

        {/* Spot Count & Status */}
        {destination.placesCount !== undefined && destination.placesCount !== null ? (
          <div className="flex items-center gap-1.5 text-[11px] font-bold text-brand-teal dark:text-brand-teal px-2.5 py-1 rounded-lg bg-brand-teal/10 border border-brand-teal/20 w-fit">
            <Compass className="w-3.5 h-3.5 text-brand-teal shrink-0" />
            <span>{destination.placesCount} Local Spots</span>
          </div>
        ) : destination.isExternal ? (
          <div className="flex items-center gap-1.5 text-[11px] font-bold text-sky-600 dark:text-sky-400 px-2.5 py-1 rounded-lg bg-sky-500/10 border border-sky-500/20 w-fit">
            <Compass className="w-3.5 h-3.5 text-sky-500 shrink-0" />
            <span>Live Geocoded City</span>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 text-[11px] font-medium text-slate-500 dark:text-slate-400 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 w-fit">
            <Compass className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span>Spots unavailable</span>
          </div>
        )}

        {/* Metadata grid */}
        <div className="grid grid-cols-2 gap-2 text-[11px] bg-slate-100/70 dark:bg-white/[0.02] p-2.5 rounded-xl border border-slate-200 dark:border-white/5">
          <div className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
            <Calendar className="w-3.5 h-3.5 text-brand-spice shrink-0" />
            <span className="truncate">{destination.bestTimeToVisit}</span>
          </div>
          <div className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300 justify-end">
            <IndianRupee className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>{destination.averageDailyBudgetInr ? `₹${destination.averageDailyBudgetInr.toLocaleString('en-IN')}/day` : 'Budget varies'}</span>
          </div>
        </div>

        {/* Categories */}
        <div className="flex flex-wrap gap-1.5 pt-1">
          {(destination.popularCategories || []).map((cat) => (
            <CategoryBadge key={cat} category={cat} />
          ))}
        </div>

        {/* Bottom CTA Actions */}
        <div className="pt-2 border-t border-slate-200 dark:border-white/5 flex items-center justify-between">
          <button
            type="button"
            onClick={handleSelect}
            className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors ${
              isSelected
                ? 'bg-brand-saffron text-white font-bold'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5'
            }`}
          >
            {isSelected ? '✓ Selected' : 'Choose Destination'}
          </button>

          <button
            type="button"
            onClick={handlePlanTrip}
            className="flex items-center gap-1 text-xs font-bold text-brand-spice hover:text-brand-saffron transition-colors"
          >
            <span>Plan Itinerary</span>
            <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
          </button>
        </div>
      </div>
    </GlassCard>
  );
};

