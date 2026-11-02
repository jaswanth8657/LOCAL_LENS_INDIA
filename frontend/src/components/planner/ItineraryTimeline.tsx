import React, { useState } from 'react';
import { Itinerary, ItineraryDay } from '../../types';
import { useTrip } from '../../context/TripContext';
import { GlassCard } from '../ui/GlassCard';
import { VerificationBadge } from '../ui/Badge';
import {
  calculateHaversineDistanceKm,
  calculateDayTotalDistanceKm,
  detectZigZagSequence,
} from '../../utils/geo';
import {
  classifyPlaceEnvironment,
  optimizeHeatAwareSchedule,
} from '../../utils/heatAware';
import {
  IndianRupee,
  Lightbulb,
  Navigation2,
  Calendar,
  Sparkles,
  Share2,
  Printer,
  AlertCircle,
  ChevronUp,
  ChevronDown,
  Trash2,
  Copy,
  Check,
  ArrowRightLeft,
  Compass,
  Sun,
  ArrowUpDown,
  X,
  Info,
} from 'lucide-react';

interface ItineraryTimelineProps {
  itinerary: Itinerary;
  onSave?: () => void;
  isSaved?: boolean;
  isSaving?: boolean;
  activeDayIndex?: number;
  setActiveDayIndex?: (index: number) => void;
}

export const ItineraryTimeline: React.FC<ItineraryTimelineProps> = ({
  itinerary,
  onSave,
  isSaved = false,
  isSaving = false,
  activeDayIndex: controlledDayIndex,
  setActiveDayIndex: controlledSetDayIndex,
}) => {
  const [internalDayIndex, setInternalDayIndex] = useState(0);
  const [copiedSummary, setCopiedSummary] = useState(false);
  const [dismissedZigZagDays, setDismissedZigZagDays] = useState<Record<number, boolean>>({});
  const [isHeatModalOpen, setIsHeatModalOpen] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);

  const activeDayIndex = controlledDayIndex !== undefined ? controlledDayIndex : internalDayIndex;
  const setActiveDayIndex = controlledSetDayIndex || setInternalDayIndex;

  const { reorderStop, reorderDayStops, moveStopToDay, deleteStop } = useTrip();

  const currentDay: ItineraryDay | undefined = itinerary.days[activeDayIndex];

  // Pillar 1: Day Distance & Zig-Zag Analysis
  const dayDistAnalysis = currentDay
    ? calculateDayTotalDistanceKm(currentDay.stops)
    : { totalKm: 0, hasMissingCoords: false, missingCount: 0, spread: 'Compact' as const };

  const zigZagAnalysis = currentDay
    ? detectZigZagSequence(currentDay.stops)
    : { hasSuggestion: false, currentKm: 0, optimizedKm: 0, savingsKm: 0, savingsPct: 0 };

  const isZigZagDismissed = currentDay ? dismissedZigZagDays[currentDay.dayNumber] : false;

  // Pillar 2: Heat-Aware Schedule Analysis
  const heatAnalysis = currentDay
    ? optimizeHeatAwareSchedule(currentDay.stops)
    : { hasSuggestions: false, optimizedStops: [], changesCount: 0, explanations: [] };

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

  const handleCopySummary = async () => {
    const lines: string[] = [
      `========================================`,
      `LOCAL LENS INDIA — Travel Itinerary`,
      `Experience Like a Local`,
      `========================================`,
      `Title: ${itinerary.title}`,
      `Destination: ${itinerary.destinationName}`,
      `Duration: ${itinerary.durationDays} Days | Group Type: ${itinerary.groupType}`,
      `Total Estimated Budget: ₹${itinerary.totalBudgetInr.toLocaleString('en-IN')}`,
      `Daily Budget: ₹${itinerary.dailyBudgetInr.toLocaleString('en-IN')}`,
      `AI Provider: ${itinerary.aiProviderUsed || 'Verified Local Engine'}`,
      `Generated / Updated: ${new Date(itinerary.createdAt).toLocaleDateString()}`,
      `========================================\n`,
    ];

    itinerary.days.forEach((day) => {
      const distInfo = calculateDayTotalDistanceKm(day.stops);
      lines.push(`----------------------------------------`);
      lines.push(`DAY ${day.dayNumber}: ${day.theme}`);
      lines.push(`Estimated Day Spend: ₹${day.dayEstimatedCostInr.toLocaleString('en-IN')}`);
      lines.push(`Straight-Line Transit: ~${distInfo.totalKm} km (${distInfo.spread} Spread)`);
      lines.push(`----------------------------------------`);

      if (!day.stops || day.stops.length === 0) {
        lines.push(`  (No stops scheduled for this day)\n`);
        return;
      }

      day.stops.forEach((stop, sIdx) => {
        const env = classifyPlaceEnvironment(stop.category, undefined, stop.placeName);
        lines.push(
          `  Stop ${stop.stopOrder}: ${stop.placeName} [${env}]`
        );
        lines.push(`    • Time: ${stop.timeSlot} (${stop.time}) — Duration: ${stop.durationMinutes} mins`);
        lines.push(
          `    • Cost: ${
            stop.costStatus === 'UNAVAILABLE'
              ? 'Price unavailable'
              : stop.costStatus === 'ESTIMATED'
              ? `~₹${stop.costInr} (Est.)`
              : stop.costInr === 0
              ? 'Free Entry (Verified)'
              : `₹${stop.costInr} (Verified ticket)`
          }`
        );
        if (stop.localTips) {
          lines.push(`    • Local Tip: ${stop.localTips}`);
        }
        if (stop.transportToNext) {
          lines.push(`    • Transit: ${stop.transportToNext}`);
        }

        // Distance to next stop if both coordinates are present
        if (sIdx < day.stops.length - 1) {
          const next = day.stops[sIdx + 1];
          if (
            typeof stop.latitude === 'number' &&
            typeof stop.longitude === 'number' &&
            typeof next.latitude === 'number' &&
            typeof next.longitude === 'number'
          ) {
            const dist = calculateHaversineDistanceKm(
              stop.latitude,
              stop.longitude,
              next.latitude,
              next.longitude
            );
            lines.push(`    ↳ Approx. ${dist} km straight-line distance to next stop`);
          }
        }
        lines.push('');
      });
    });

    if (itinerary.expenses) {
      lines.push(`========================================`);
      lines.push(`BUDGET BREAKDOWN`);
      lines.push(`========================================`);
      lines.push(`• Accommodation: ₹${itinerary.expenses.accommodation.toLocaleString('en-IN')}`);
      lines.push(`• Food & Dining: ₹${itinerary.expenses.foodDining.toLocaleString('en-IN')}`);
      lines.push(`• Local Transport: ₹${itinerary.expenses.localTransport.toLocaleString('en-IN')}`);
      lines.push(`• Sightseeing & Tickets: ₹${itinerary.expenses.sightseeingTickets.toLocaleString('en-IN')}`);
      lines.push(`• Buffer / Contingency: ₹${itinerary.expenses.bufferContingency.toLocaleString('en-IN')}`);
      lines.push(`• Total Trip Cost: ₹${itinerary.expenses.totalTrip.toLocaleString('en-IN')}`);
      lines.push(`========================================\n`);
    }

    const fullText = lines.join('\n');
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(fullText);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = fullText;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      setCopiedSummary(true);
      setTimeout(() => setCopiedSummary(false), 3000);
    } catch (e) {
      console.warn('Clipboard copy failed:', e);
    }
  };

  const handleApplyZigZag = () => {
    if (currentDay && zigZagAnalysis.suggestedStops) {
      reorderDayStops(currentDay.dayNumber, zigZagAnalysis.suggestedStops);
      setFeedbackMessage(
        `Route optimized for Day ${currentDay.dayNumber}! Estimated ~${zigZagAnalysis.savingsKm} km saved. Click "Save Itinerary" to persist.`
      );
      setTimeout(() => setFeedbackMessage(null), 5000);
    }
  };

  const handleApplyHeatAware = () => {
    if (currentDay && heatAnalysis.optimizedStops.length > 0) {
      reorderDayStops(currentDay.dayNumber, heatAnalysis.optimizedStops);
      setIsHeatModalOpen(false);
      setFeedbackMessage(
        `Heat-Aware schedule applied for Day ${currentDay.dayNumber}! Midday heat exposures minimized. Click "Save Itinerary" to persist.`
      );
      setTimeout(() => setFeedbackMessage(null), 5000);
    }
  };

  return (
    <div className="space-y-6">
      {/* Toast / Feedback Banner */}
      {feedbackMessage && (
        <div className="p-3.5 rounded-xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-xs flex items-center justify-between gap-2 shadow-lg animate-fade-in no-print">
          <div className="flex items-center gap-2">
            <Check className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{feedbackMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setFeedbackMessage(null)}
            className="p-1 text-slate-400 hover:text-white"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Top Header Card */}
      <GlassCard className="p-6 border-stone-200 dark:border-white/10 itinerary-header-card">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-brand-saffron/20 text-brand-spice border border-brand-saffron/30">
                {itinerary.durationDays} Days • {itinerary.groupType}
              </span>
              {itinerary.aiProviderUsed && (
                <span
                  className={`px-2.5 py-0.5 rounded-full text-[11px] font-medium border flex items-center gap-1 ${
                    itinerary.aiProviderUsed === 'GEMINI' || itinerary.aiProviderUsed === 'Gemini'
                      ? 'bg-purple-500/15 text-purple-300 border-purple-500/30'
                      : itinerary.aiProviderUsed === 'OLLAMA' || itinerary.aiProviderUsed === 'Ollama'
                      ? 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30'
                      : 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                  }`}
                >
                  <Sparkles className="w-3 h-3" />
                  Provider: {itinerary.aiProviderUsed}
                </span>
              )}
            </div>
            <h2 className="text-2xl font-extrabold text-stone-900 dark:text-white mt-1.5 tracking-tight">
              {itinerary.title}
            </h2>
            <p className="text-xs text-stone-600 dark:text-slate-400 mt-0.5">
              Destination: <strong className="text-stone-800 dark:text-slate-200">{itinerary.destinationName}</strong> • Daily Budget:{' '}
              <strong className="text-emerald-400">₹{itinerary.dailyBudgetInr.toLocaleString('en-IN')}</strong>
            </p>
            {itinerary.coverageWarning && (
              <div className="mt-3 p-3 rounded-xl bg-amber-500/10 border border-amber-500/25 text-amber-200 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
                <span>{itinerary.coverageWarning}</span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 flex-wrap no-print">
            <button
              type="button"
              onClick={handleCopySummary}
              className="px-3 py-2 rounded-xl bg-stone-200/80 hover:bg-stone-300 dark:bg-white/5 dark:hover:bg-white/10 border border-stone-300 dark:border-white/10 text-stone-700 dark:text-slate-300 hover:text-stone-900 dark:hover:text-white transition-colors text-xs font-semibold flex items-center gap-1.5"
              title="Copy formatted text summary of itinerary to clipboard"
            >
              {copiedSummary ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-400">Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy Summary</span>
                </>
              )}
            </button>
            <button
              type="button"
              onClick={handleShare}
              className="p-2.5 rounded-xl bg-stone-200/80 hover:bg-stone-300 dark:bg-white/5 dark:hover:bg-white/10 border border-stone-300 dark:border-white/10 text-stone-700 dark:text-slate-300 hover:text-stone-900 dark:hover:text-white transition-colors"
              title="Share Trip"
            >
              <Share2 className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={handlePrint}
              className="p-2.5 rounded-xl bg-stone-200/80 hover:bg-stone-300 dark:bg-white/5 dark:hover:bg-white/10 border border-stone-300 dark:border-white/10 text-stone-700 dark:text-slate-300 hover:text-stone-900 dark:hover:text-white transition-colors"
              title="Print Itinerary (A4 / PDF friendly)"
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
        <div className="flex gap-2 overflow-x-auto pt-6 border-t border-stone-200 dark:border-white/5 mt-5 pb-1 no-print">
          {itinerary.days.map((day, idx) => (
            <button
              key={day.dayNumber}
              type="button"
              onClick={() => setActiveDayIndex(idx)}
              className={`px-4 py-2 rounded-xl text-xs font-bold shrink-0 transition-all ${
                activeDayIndex === idx
                  ? 'bg-brand-saffron text-white shadow-glow-saffron'
                  : 'bg-stone-200/70 dark:bg-white/5 text-stone-600 dark:text-slate-400 hover:text-stone-900 dark:hover:text-white hover:bg-stone-300 dark:hover:bg-white/10'
              }`}
            >
              Day {day.dayNumber}: {day.theme}
            </button>
          ))}
        </div>
      </GlassCard>

      {/* Active Day Timeline Stops */}
      {currentDay ? (
        <div className="space-y-4 itinerary-day-section">
          {/* Day Metrics Header & Intelligence Actions */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-2">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-lg font-bold text-stone-900 dark:text-white flex items-center gap-2">
                <Calendar className="w-4 h-4 text-brand-spice" />
                Day {currentDay.dayNumber} — {currentDay.theme}
              </h3>

              {/* Geographic Spread & Straight-line Distance Badge */}
              {currentDay.stops.length > 1 && (
                <span
                  className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${
                    dayDistAnalysis.spread === 'Compact'
                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                      : dayDistAnalysis.spread === 'Moderate'
                      ? 'bg-amber-500/10 text-amber-300 border-amber-500/30'
                      : 'bg-purple-500/10 text-purple-300 border-purple-500/30'
                  }`}
                  title={`Straight-line sum of intervals between consecutive stops: ${dayDistAnalysis.totalKm} km`}
                >
                  <Compass className="w-3 h-3" />
                  <span>
                    ~{dayDistAnalysis.totalKm} Kilometers ({dayDistAnalysis.spread})
                  </span>
                </span>
              )}
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {/* Heat-Aware Schedule Button */}
              {currentDay.stops.length >= 2 && (
                <button
                  type="button"
                  onClick={() => setIsHeatModalOpen(true)}
                  className="px-2.5 py-1.5 rounded-xl text-xs font-semibold bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 flex items-center gap-1.5 transition-colors no-print"
                  title="Optimize stop timings for tropical solar hours"
                >
                  <Sun className="w-3.5 h-3.5 text-amber-400" />
                  <span>Heat-Aware Schedule</span>
                </button>
              )}

              <span className="text-xs text-stone-600 dark:text-slate-400 font-medium">
                Est. Day Spend: <strong className="text-emerald-400 font-bold">₹{currentDay.dayEstimatedCostInr.toLocaleString('en-IN')}</strong>
              </span>
            </div>
          </div>

          {/* Zig-Zag Route Efficiency Alert */}
          {zigZagAnalysis.hasSuggestion && !isZigZagDismissed && (
            <div className="p-4 rounded-xl bg-cyan-950/40 border border-cyan-500/30 text-cyan-200 text-xs flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-lg no-print">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-cyan-500/15 text-cyan-400 shrink-0">
                  <ArrowUpDown className="w-4 h-4" />
                </div>
                <div>
                  <div className="font-bold text-white text-sm">
                    Route Efficiency Recommendation (Save ~{zigZagAnalysis.savingsKm} km)
                  </div>
                  <p className="text-cyan-200/90 text-xs mt-0.5">
                    {zigZagAnalysis.reason ||
                      `Reordering stops reduces back-and-forth transit from ${zigZagAnalysis.currentKm} km down to ${zigZagAnalysis.optimizedKm} km (~${zigZagAnalysis.savingsPct}% reduction).`}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
                <button
                  type="button"
                  onClick={handleApplyZigZag}
                  className="px-3.5 py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs transition-colors shadow-sm"
                >
                  Accept Reorder
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setDismissedZigZagDays((prev) => ({
                      ...prev,
                      [currentDay.dayNumber]: true,
                    }))
                  }
                  className="px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-colors text-xs"
                >
                  Dismiss
                </button>
              </div>
            </div>
          )}

          {currentDay.stops.length === 0 ? (
            <GlassCard className="p-8 text-center text-slate-400 border-dashed border-stone-300 dark:border-white/10 space-y-2">
              <p className="text-sm font-medium text-stone-700 dark:text-slate-300">
                No stops scheduled for Day {currentDay.dayNumber}.
              </p>
              <p className="text-xs text-stone-500 dark:text-slate-400">
                Use the <strong>"Add to Trip"</strong> button on any place card in Discover or Recommendations to schedule attractions here.
              </p>
            </GlassCard>
          ) : (
            <div className="space-y-3 relative before:absolute before:inset-0 before:left-6 before:w-0.5 before:bg-stone-300 dark:before:bg-white/10">
              {currentDay.stops.map((stop, stopIdx) => {
                const nextStop = currentDay.stops[stopIdx + 1];
                const hasBothCoords =
                  typeof stop.latitude === 'number' &&
                  typeof stop.longitude === 'number' &&
                  nextStop &&
                  typeof nextStop.latitude === 'number' &&
                  typeof nextStop.longitude === 'number';

                const distToNext = hasBothCoords
                  ? calculateHaversineDistanceKm(
                      stop.latitude!,
                      stop.longitude!,
                      nextStop.latitude!,
                      nextStop.longitude!
                    )
                  : null;

                const placeEnv = classifyPlaceEnvironment(stop.category, undefined, stop.placeName);

                return (
                  <div key={stop.id} className="relative pl-12 stop-item">
                    {/* Stop Number Marker */}
                    <div className="absolute left-3.5 -translate-x-1/2 top-5 w-6 h-6 rounded-full bg-stone-900 dark:bg-slate-900 border-2 border-brand-saffron flex items-center justify-center text-[11px] font-extrabold text-white z-10 shadow-glow-saffron">
                      {stop.stopOrder}
                    </div>

                    <GlassCard className="p-4 border-stone-200 dark:border-white/10 hover:border-brand-saffron/30 transition-all space-y-3">
                      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-stone-200/80 dark:bg-white/10 text-stone-700 dark:text-slate-300">
                              {stop.timeSlot} • {stop.time}
                            </span>
                            <span className="text-xs text-slate-400">
                              ({stop.durationMinutes} mins)
                            </span>
                            <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-brand-saffron/10 text-brand-spice">
                              {stop.category}
                            </span>
                            {/* Environment Tag */}
                            <span
                              className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                                placeEnv === 'OUTDOOR'
                                  ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20'
                                  : placeEnv === 'INDOOR'
                                  ? 'bg-blue-500/10 text-blue-300 border-blue-500/20'
                                  : 'bg-stone-500/10 text-stone-300 border-stone-500/20'
                              }`}
                            >
                              {placeEnv}
                            </span>
                          </div>
                          <h4 className="text-base font-bold text-stone-900 dark:text-white">
                            {stop.placeName}
                          </h4>
                        </div>

                        {/* Cost & Verification Badge */}
                        <div className="flex items-center gap-2 shrink-0">
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

                      {/* Interactive Stop Actions: Reorder, Move Day, Delete (Hidden in print) */}
                      <div className="flex items-center justify-between pt-2 border-t border-stone-200 dark:border-white/5 text-xs no-print flex-wrap gap-2">
                        {/* Reorder Buttons */}
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            disabled={stopIdx === 0}
                            onClick={() => reorderStop(currentDay.dayNumber, stopIdx, 'up')}
                            className="p-1 rounded hover:bg-stone-200 dark:hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed text-stone-600 dark:text-slate-400 transition-colors"
                            title="Move Stop Up"
                          >
                            <ChevronUp className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            disabled={stopIdx === currentDay.stops.length - 1}
                            onClick={() => reorderStop(currentDay.dayNumber, stopIdx, 'down')}
                            className="p-1 rounded hover:bg-stone-200 dark:hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed text-stone-600 dark:text-slate-400 transition-colors"
                            title="Move Stop Down"
                          >
                            <ChevronDown className="w-4 h-4" />
                          </button>
                          <span className="text-[11px] text-stone-500 dark:text-slate-400 ml-1">
                            Stop {stop.stopOrder} of {currentDay.stops.length}
                          </span>
                        </div>

                        {/* Move to another day & Remove */}
                        <div className="flex items-center gap-2">
                          {itinerary.days.length > 1 && (
                            <div className="flex items-center gap-1 text-[11px]">
                              <ArrowRightLeft className="w-3 h-3 text-stone-400" />
                              <select
                                aria-label={`Move ${stop.placeName} to another day`}
                                value={currentDay.dayNumber}
                                onChange={(e) => {
                                  const targetDay = Number(e.target.value);
                                  if (targetDay !== currentDay.dayNumber) {
                                    moveStopToDay(currentDay.dayNumber, stop.id, targetDay);
                                  }
                                }}
                                className="bg-stone-200/80 dark:bg-slate-900 border border-stone-300 dark:border-white/10 rounded-lg px-2 py-1 text-stone-700 dark:text-slate-300 text-[11px] focus:outline-none focus:border-brand-saffron"
                              >
                                {itinerary.days.map((d) => (
                                  <option key={d.dayNumber} value={d.dayNumber}>
                                    Move to Day {d.dayNumber}
                                  </option>
                                ))}
                              </select>
                            </div>
                          )}

                          <button
                            type="button"
                            onClick={() => deleteStop(currentDay.dayNumber, stop.id)}
                            className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-500/10 border border-transparent hover:border-rose-500/20 transition-colors"
                            title="Remove stop from day"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
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
                        <div className="pt-2 border-t border-stone-200 dark:border-white/5 flex items-center gap-2 text-xs text-stone-600 dark:text-slate-400">
                          <Navigation2 className="w-3.5 h-3.5 text-brand-teal shrink-0" />
                          <span>{stop.transportToNext}</span>
                        </div>
                      )}
                    </GlassCard>

                    {/* Haversine Straight-line Distance Badge to Next Stop */}
                    {distToNext !== null && (
                      <div className="my-2.5 ml-2 flex items-center gap-2 text-[11px] text-stone-500 dark:text-slate-400">
                        <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-stone-200/90 dark:bg-white/5 border border-stone-300 dark:border-white/10 font-medium shadow-sm">
                          <Navigation2 className="w-3 h-3 text-brand-teal shrink-0" />
                          <span>
                            Approx. <strong>{distToNext} km</strong> straight-line distance to next stop
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        <GlassCard className="p-8 text-center text-slate-400">
          No stops planned for this day yet.
        </GlassCard>
      )}

      {/* Heat-Aware Optimization Preview Modal */}
      {isHeatModalOpen && currentDay && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in no-print">
          <div className="relative w-full max-w-2xl bg-stone-900 border border-stone-700 rounded-2xl p-6 text-white space-y-5 shadow-2xl overflow-y-auto max-h-[90vh]">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
                  <Sun className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold">Smart Heat-Aware Tropical Scheduling</h3>
                  <p className="text-xs text-stone-400">
                    Day {currentDay.dayNumber} — {currentDay.theme}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsHeatModalOpen(false)}
                className="p-1 rounded-lg text-stone-400 hover:text-white hover:bg-white/10"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Mandatory Transparency Disclaimer */}
            <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs flex items-start gap-2.5">
              <Info className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <div className="leading-relaxed">
                <strong>Notice: </strong>
                Smart Heat-Aware Schedule: Times are organized using general tropical scheduling heuristics to help avoid peak midday sun exposure. This is not a live weather forecast or a guarantee of safe outdoor conditions.
              </div>
            </div>

            {/* Heuristic Explanation */}
            <div className="text-xs text-stone-300 space-y-2 bg-stone-800/60 p-4 rounded-xl border border-stone-700/60">
              <div className="font-semibold text-white">Tropical Solar Routing Logic:</div>
              <ul className="list-disc list-inside space-y-1 text-stone-400">
                <li><strong className="text-emerald-400">07:30 – 10:30 (Morning):</strong> Prioritize open-air viewpoints, ghats & outdoor activities while solar heat is low.</li>
                <li><strong className="text-amber-400">12:00 – 15:30 (Midday):</strong> Shift to climate-sheltered museums, galleries & indoor palaces during peak ultraviolet and solar intensity.</li>
                <li><strong className="text-emerald-400">16:30 – 19:00 (Evening):</strong> Resume outdoor promenades, sunset points & cultural gatherings.</li>
              </ul>
            </div>

            {/* Proposed Changes Preview */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-stone-400">
                Proposed Day {currentDay.dayNumber} Schedule
              </h4>
              <div className="space-y-2">
                {heatAnalysis.optimizedStops.map((stop, idx) => {
                  const env = classifyPlaceEnvironment(stop.category, undefined, stop.placeName);
                  return (
                    <div
                      key={stop.id}
                      className="p-3 rounded-xl bg-stone-800/80 border border-stone-700/80 flex items-center justify-between text-xs"
                    >
                      <div className="flex items-center gap-2.5">
                        <span className="w-5 h-5 rounded-full bg-brand-saffron/20 text-brand-spice flex items-center justify-center font-bold text-[10px]">
                          {idx + 1}
                        </span>
                        <div>
                          <div className="font-bold text-white">{stop.placeName}</div>
                          <div className="text-[11px] text-stone-400">
                            {stop.timeSlot} • {stop.time}
                          </div>
                        </div>
                      </div>
                      <span
                        className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                          env === 'OUTDOOR'
                            ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20'
                            : env === 'INDOOR'
                            ? 'bg-blue-500/10 text-blue-300 border-blue-500/20'
                            : 'bg-stone-500/10 text-stone-300 border-stone-500/20'
                        }`}
                      >
                        {env}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-stone-800">
              <button
                type="button"
                onClick={() => setIsHeatModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-stone-800 hover:bg-stone-700 text-stone-300"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleApplyHeatAware}
                className="px-5 py-2 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-400 text-stone-950 transition-colors shadow-glow-saffron"
              >
                Apply Heat-Aware Schedule
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
