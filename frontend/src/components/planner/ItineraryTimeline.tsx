import React, { useState } from 'react';
import { Itinerary, ItineraryDay } from '../../types';
import { GlassCard } from '../ui/GlassCard';
import { VerificationBadge } from '../ui/Badge';
import {
  IndianRupee,
  Lightbulb,
  Navigation2,
  Calendar,
  Sparkles,
  Share2,
  Printer,
  AlertCircle
} from 'lucide-react';

interface ItineraryTimelineProps {
  itinerary: Itinerary;
  onSave?: () => void;
  isSaved?: boolean;
  isSaving?: boolean;
}

export const ItineraryTimeline: React.FC<ItineraryTimelineProps> = ({
  itinerary,
  onSave,
  isSaved = false,
  isSaving = false
}) => {
  const [activeDayIndex, setActiveDayIndex] = useState(0);

  const currentDay: ItineraryDay | undefined = itinerary.days[activeDayIndex];

  const handlePrint = () => {
    window.print();
  };

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: itinerary.title,
        text: `Check out my authentic travel plan for ${itinerary.destinationName} on LOCAL LENS INDIA!`,
        url: window.location.href,
      }).catch(() => {});
    } else {
      navigator.clipboard.writeText(window.location.href);
      alert('Trip link copied to clipboard!');
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header Card */}
      <GlassCard className="p-6 border-white/10">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-brand-saffron/20 text-brand-spice border border-brand-saffron/30">
                {itinerary.durationDays} Days • {itinerary.groupType}
              </span>
              {itinerary.aiProviderUsed && (
                <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-medium border flex items-center gap-1 ${
                  itinerary.aiProviderUsed === 'GEMINI' || itinerary.aiProviderUsed === 'Gemini'
                    ? 'bg-purple-500/15 text-purple-300 border-purple-500/30'
                    : itinerary.aiProviderUsed === 'OLLAMA' || itinerary.aiProviderUsed === 'Ollama'
                    ? 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30'
                    : 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                }`}>
                  <Sparkles className="w-3 h-3" />
                  Provider: {itinerary.aiProviderUsed}
                </span>
              )}
            </div>
            <h2 className="text-2xl font-extrabold text-white mt-1.5 tracking-tight">
              {itinerary.title}
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Destination: <strong className="text-slate-200">{itinerary.destinationName}</strong> • Daily Budget: <strong className="text-emerald-400">₹{itinerary.dailyBudgetInr.toLocaleString('en-IN')}</strong>
            </p>
            {itinerary.coverageWarning && (
              <div className="mt-3 p-3 rounded-xl bg-amber-500/10 border border-amber-500/25 text-amber-200 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
                <span>{itinerary.coverageWarning}</span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={handleShare}
              className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 hover:text-white transition-colors"
              title="Share Trip"
            >
              <Share2 className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={handlePrint}
              className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 hover:text-white transition-colors"
              title="Print Itinerary"
            >
              <Printer className="w-4 h-4" />
            </button>
            {onSave && (
              <button
                type="button"
                disabled={isSaving}
                onClick={onSave}
                className={`px-5 py-2.5 rounded-xl text-xs font-bold transition-all shadow-md flex items-center gap-1.5 ${
                  isSaved
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                    : 'bg-gradient-to-r from-brand-saffron to-brand-spice text-white shadow-glow-saffron hover:opacity-95'
                }`}
              >
                {isSaving ? (
                  <>
                    <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Saving to SQLite...</span>
                  </>
                ) : isSaved ? (
                  '✓ Saved to Database'
                ) : (
                  'Save Itinerary'
                )}
              </button>
            )}
          </div>
        </div>

        {/* Day Selector Tabs */}
        <div className="flex gap-2 overflow-x-auto pt-6 border-t border-white/5 mt-5 pb-1">
          {itinerary.days.map((day, idx) => (
            <button
              key={day.dayNumber}
              type="button"
              onClick={() => setActiveDayIndex(idx)}
              className={`px-4 py-2 rounded-xl text-xs font-bold shrink-0 transition-all ${
                activeDayIndex === idx
                  ? 'bg-brand-saffron text-white shadow-glow-saffron'
                  : 'bg-white/5 text-slate-400 hover:text-white hover:bg-white/10'
              }`}
            >
              Day {day.dayNumber}: {day.theme}
            </button>
          ))}
        </div>
      </GlassCard>

      {/* Active Day Timeline Stops */}
      {currentDay ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between px-2">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <Calendar className="w-4 h-4 text-brand-spice" />
              Day {currentDay.dayNumber} — {currentDay.theme}
            </h3>
            <span className="text-xs text-slate-400 font-medium">
              Est. Day Spend: <strong className="text-emerald-400 font-bold">₹{currentDay.dayEstimatedCostInr.toLocaleString('en-IN')}</strong>
            </span>
          </div>

          <div className="space-y-3.5 relative before:absolute before:inset-0 before:left-6 before:w-0.5 before:bg-white/10">
            {currentDay.stops.map((stop) => (
              <div key={stop.id} className="relative pl-12">
                {/* Stop Number Marker */}
                <div className="absolute left-3.5 -translate-x-1/2 top-5 w-6 h-6 rounded-full bg-slate-900 border-2 border-brand-saffron flex items-center justify-center text-[11px] font-extrabold text-white z-10 shadow-glow-saffron">
                  {stop.stopOrder}
                </div>

                <GlassCard className="p-4 border-white/10 hover:border-brand-saffron/30 transition-all space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-white/10 text-slate-300">
                          {stop.timeSlot} • {stop.time}
                        </span>
                        <span className="text-xs text-slate-400">
                          ({stop.durationMinutes} mins)
                        </span>
                      </div>
                      <h4 className="text-base font-bold text-white mt-1">
                        {stop.placeName}
                      </h4>
                    </div>

                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1 text-xs font-semibold text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-lg border border-emerald-500/20">
                        <IndianRupee className="w-3 h-3" />
                        <span>
                          {stop.costStatus === 'UNAVAILABLE'
                            ? 'Price unavailable'
                            : stop.costStatus === 'ESTIMATED'
                            ? `~₹${stop.costInr} (Est.)`
                            : stop.costInr === 0
                            ? 'Free Entry (Verified)'
                            : `₹${stop.costInr} (Ticket)`}
                        </span>
                      </div>
                      <VerificationBadge status={stop.costStatus} />
                    </div>
                  </div>

                  {/* Local Etiquette / Insider Tip */}
                  {stop.localTips && (
                    <div className="flex items-start gap-2 p-2.5 rounded-xl bg-brand-spice/10 border border-brand-spice/20 text-xs text-brand-spice">
                      <Lightbulb className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-semibold">Local Tip: </span>
                        <span>{stop.localTips}</span>
                      </div>
                    </div>
                  )}

                  {/* Transit to next stop */}
                  {stop.transportToNext && (
                    <div className="pt-2 border-t border-white/5 flex items-center gap-2 text-xs text-slate-400">
                      <Navigation2 className="w-3.5 h-3.5 text-brand-teal shrink-0" />
                      <span>{stop.transportToNext}</span>
                    </div>
                  )}
                </GlassCard>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <GlassCard className="p-8 text-center text-slate-400">
          No stops planned for this day yet.
        </GlassCard>
      )}
    </div>
  );
};
