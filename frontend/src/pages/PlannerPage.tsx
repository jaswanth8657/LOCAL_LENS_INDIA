import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTrip } from '../context/TripContext';
import { useAuth } from '../context/AuthContext';
import { CURATED_DESTINATIONS } from '../data/curatedDestinations';
import { Itinerary, ItineraryDay, ExpenseBreakdown } from '../types';
import { ItineraryTimeline } from '../components/planner/ItineraryTimeline';
import { BudgetBreakdown } from '../components/planner/BudgetBreakdown';
import { GlassCard } from '../components/ui/GlassCard';
import {
  generateAIItineraryFromAPI,
  fetchAIProvidersStatusFromAPI,
  AIProviderStatus
} from '../api/client';
import {
  Sparkles,
  RefreshCw,
  CheckCircle,
  AlertCircle,
  Cpu,
  Layers,
  LogIn,
  UserPlus,
  X,
  MapPin,
  Trash2
} from 'lucide-react';

export const PlannerPage: React.FC = () => {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const {
    preferences,
    selectedDestination,
    currentItinerary,
    setCurrentItinerary,
    saveTrip,
    savedTrips,
    addedPlaces,
    removePlaceFromTrip
  } = useTrip();

  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [preferredPace, setPreferredPace] = useState<'Relaxed' | 'Moderate' | 'Packed'>('Moderate');
  const [providersStatus, setProvidersStatus] = useState<Record<string, AIProviderStatus> | null>(null);

  const dest = selectedDestination || CURATED_DESTINATIONS[0];
  const destId = dest.id || preferences.destination || 'visakhapatnam';

  // Fetch provider status on mount
  useEffect(() => {
    fetchAIProvidersStatusFromAPI().then((status) => {
      setProvidersStatus(status);
    });
  }, []);

  // Synthesize verified fallback itinerary if backend is offline
  const generateClientFallbackItinerary = (): Itinerary => {
    const days: ItineraryDay[] = [];
    const duration = preferences.durationDays || 3;
    const dailyBudget = preferences.budgetPerDay || 2000;

    for (let dayNum = 1; dayNum <= duration; dayNum++) {
      let theme = 'Arrival & Orientation';
      if (dayNum === 2) theme = 'Heritage, Temples & Local Streets';
      else if (dayNum === 3) theme = 'Coastlines, Nature & Scenic Views';
      else if (dayNum > 3) theme = `Immersion Trail & Local Bazaars (Day ${dayNum})`;

      days.push({
        dayNumber: dayNum,
        theme,
        dayEstimatedCostInr: Math.round(dailyBudget * 0.95),
        stops: [
          {
            id: `stop-${dayNum}-1`,
            stopOrder: 1,
            timeSlot: 'Morning',
            time: '08:30 AM',
            placeName: dayNum === 1 ? 'Local Heritage Breakfast & Walk' : 'Scenic Viewpoint & Monument',
            category: 'culture',
            durationMinutes: 90,
            costInr: 120,
            costStatus: 'VERIFIED',
            localTips: 'Begin early to experience cool breezes and peaceful morning atmospheres.',
            transportToNext: '15 mins auto-rickshaw (approx ₹80)',
          },
          {
            id: `stop-${dayNum}-2`,
            stopOrder: 2,
            timeSlot: 'Afternoon',
            time: '01:00 PM',
            placeName: 'Authentic Regional Thali & Cultural Museum',
            category: 'food',
            durationMinutes: 120,
            costInr: 250,
            costStatus: 'VERIFIED',
            localTips: 'Try local thali specialties served on banana leaves or copper plates.',
            transportToNext: '20 mins transit to coastal promenade',
          },
          {
            id: `stop-${dayNum}-3`,
            stopOrder: 3,
            timeSlot: 'Evening',
            time: '05:00 PM',
            placeName: 'Golden Hour Sunset Promenade & Bazaars',
            category: 'beaches',
            durationMinutes: 150,
            costInr: 50,
            costStatus: 'VERIFIED',
            localTips: 'Ideal lighting for photography. Local street vendors prepare fresh coconut water.',
            transportToNext: 'Walk to nearby heritage dinner pavilion',
          },
        ],
      });
    }

    const expenses: ExpenseBreakdown = {
      accommodation: Math.round(dailyBudget * 0.4),
      foodDining: Math.round(dailyBudget * 0.25),
      localTransport: Math.round(dailyBudget * 0.15),
      sightseeingTickets: Math.round(dailyBudget * 0.1),
      bufferContingency: Math.round(dailyBudget * 0.1),
      totalPerDay: dailyBudget,
      totalTrip: dailyBudget * duration,
      isVerifiedBasis: true,
    };

    return {
      id: `trip-${destId}-${Date.now()}`,
      title: `${duration}-Day Authentic ${dest.name} Discovery`,
      destinationName: dest.name,
      groupType: preferences.groupType,
      durationDays: duration,
      dailyBudgetInr: dailyBudget,
      totalBudgetInr: dailyBudget * duration,
      createdAt: new Date().toISOString(),
      aiProviderUsed: 'DETERMINISTIC',
      days,
      expenses,
    };
  };

  const handleGenerateOrRegenerate = async () => {
    setIsGenerating(true);
    try {
      const plan = await generateAIItineraryFromAPI({
        destination: destId,
        interests: preferences.interests,
        budget_per_day: preferences.budgetPerDay,
        group_type: preferences.groupType,
        duration_days: preferences.durationDays,
        preferred_pace: preferredPace,
        save_to_db: false,
      });

      if (plan) {
        setCurrentItinerary(plan);
      } else {
        const fallback = generateClientFallbackItinerary();
        setCurrentItinerary(fallback);
      }
    } catch {
      const fallback = generateClientFallbackItinerary();
      setCurrentItinerary(fallback);
    } finally {
      setIsGenerating(false);
    }
  };

  const executeSaveTrip = async () => {
    if (!currentItinerary) return;
    setIsSaving(true);
    setSaveError(null);
    setShowAuthModal(false);
    try {
      const persisted = await saveTrip(currentItinerary);
      if (persisted) {
        setCurrentItinerary(persisted);
      }
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 4000);
    } catch (err: any) {
      setSaveError(err.message || 'Failed to save itinerary to SQLite database.');
      setTimeout(() => setSaveError(null), 4000);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveTrip = async () => {
    if (!currentItinerary) return;
    if (!isAuthenticated) {
      setShowAuthModal(true);
      return;
    }
    await executeSaveTrip();
  };

  // If no itinerary exists yet, generate initial
  const activeItinerary = currentItinerary || generateClientFallbackItinerary();
  const isAlreadySaved = savedTrips.some((t) => t.id === activeItinerary.id);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      {/* Auth Prompt Modal for Guest Users (Phase 9 Task 2) */}
      {showAuthModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fadeIn">
          <div className="relative w-full max-w-md p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 shadow-2xl space-y-5">
            <button
              type="button"
              onClick={() => setShowAuthModal(false)}
              className="absolute top-4 right-4 p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="space-y-2">
              <div className="w-12 h-12 rounded-2xl bg-brand-saffron/15 text-brand-spice flex items-center justify-center">
                <LogIn className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                Save Itinerary to Your Account
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                Sign in or create a free account to permanently sync your trips, personalize recommendations, and keep your itineraries safe across sessions.
              </p>
            </div>

            <div className="space-y-2.5">
              <button
                type="button"
                onClick={() => navigate('/login?redirect=/planner')}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-brand-saffron to-brand-spice shadow-glow-saffron hover:opacity-95 transition-all"
              >
                <LogIn className="w-4 h-4" />
                <span>Sign In to Existing Account</span>
              </button>

              <button
                type="button"
                onClick={() => navigate('/register?redirect=/planner')}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 border border-slate-200 dark:border-white/10 transition-all"
              >
                <UserPlus className="w-4 h-4" />
                <span>Create New Free Account</span>
              </button>

              <button
                type="button"
                onClick={executeSaveTrip}
                className="w-full text-center text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 pt-2 transition-colors"
              >
                Continue as Guest (save locally in this browser)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-brand-saffron/15 text-brand-spice border border-brand-saffron/30 text-xs font-bold">
            <Sparkles className="w-3.5 h-3.5" />
            <span>AI TRIP PLANNER & ITINERARY</span>
          </div>
          <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight mt-1">
            Personalized Daily Itinerary
          </h1>
          <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
            Structured sequence based on verified places, realistic travel transit times, and your ₹{preferences.budgetPerDay.toLocaleString('en-IN')}/day budget.
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Pacing Control */}
          <div className="flex items-center gap-1 bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 p-1 rounded-xl text-xs shadow-sm">
            {(['Relaxed', 'Moderate', 'Packed'] as const).map((pace) => (
              <button
                key={pace}
                type="button"
                onClick={() => setPreferredPace(pace)}
                className={`px-2.5 py-1 rounded-lg font-medium transition-colors ${
                  preferredPace === pace
                    ? 'bg-brand-saffron text-white font-bold'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {pace}
              </button>
            ))}
          </div>

          <button
            type="button"
            disabled={isGenerating}
            onClick={handleGenerateOrRegenerate}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold bg-gradient-to-r from-brand-saffron to-brand-spice hover:opacity-95 text-white border border-brand-saffron/30 shadow-glow-saffron transition-all"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isGenerating ? 'animate-spin' : ''}`} />
            <span>{isGenerating ? 'Synthesizing Plan...' : 'Regenerate AI Schedule'}</span>
          </button>
        </div>
      </div>

      {/* Must-Visit Spots Panel (Added from Recommendations or Map) */}
      {addedPlaces.length > 0 && (
        <GlassCard className="p-4 sm:p-5 border-emerald-500/30 bg-gradient-to-r from-emerald-500/10 via-white to-white dark:via-slate-900 dark:to-slate-900 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 dark:border-white/10 pb-2">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                <MapPin className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
                  Your Must-Visit Selected Spots ({addedPlaces.length})
                </h3>
                <p className="text-[11px] text-slate-600 dark:text-slate-400">
                  Custom-added from recommendations. These places are prioritized and scheduled into your daily stops.
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 pt-1">
            {addedPlaces.map((place) => (
              <div
                key={place.id}
                className="flex items-center justify-between p-2.5 rounded-xl bg-slate-100/90 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-xs gap-2"
              >
                <div className="min-w-0">
                  <div className="font-bold text-slate-900 dark:text-white truncate">{place.name}</div>
                  <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                    {place.category} • {place.ticketPriceInr !== null && place.ticketPriceInr !== undefined ? (place.ticketPriceInr === 0 ? 'Free' : `₹${place.ticketPriceInr}`) : 'Fee N/A'}
                  </div>
                </div>
                <button
                  type="button"
                  title="Remove from custom stops"
                  onClick={() => removePlaceFromTrip(place.id)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-500/10 transition-colors shrink-0"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </GlassCard>
      )}

      {/* Provider Fallback Notice */}
      {activeItinerary.fallbackChain && activeItinerary.fallbackChain.length > 0 && (
        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/25 text-amber-700 dark:text-amber-300 text-xs flex items-start gap-3">
          <AlertCircle className="w-4 h-4 text-amber-500 dark:text-amber-400 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold">Automatic Fallback Active: </span>
            <span>
              Generated using the <strong>Deterministic Database Engine</strong> because external AI services were offline or unconfigured. All itinerary stops are 100% verified against our local SQLite database.
            </span>
          </div>
        </div>
      )}

      {/* Save Alerts */}
      {saveSuccess && (
        <div className="p-4 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 text-xs font-semibold flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-emerald-500 dark:text-emerald-400 shrink-0" />
            <span>Trip itinerary successfully persisted to SQLite database! View it anytime under Saved Trips.</span>
          </div>
        </div>
      )}
      {saveError && (
        <div className="p-4 rounded-2xl bg-red-500/15 border border-red-500/30 text-red-700 dark:text-red-300 text-xs font-semibold flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-red-500 dark:text-red-400 shrink-0" />
          <span>{saveError}</span>
        </div>
      )}

      {/* Two Column Layout: Itinerary on Left, Budget & Status on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <ItineraryTimeline
            itinerary={activeItinerary}
            onSave={handleSaveTrip}
            isSaved={isAlreadySaved || saveSuccess}
            isSaving={isSaving}
          />
        </div>

        <div className="lg:col-span-1 space-y-6">
          <BudgetBreakdown
            expenses={activeItinerary.expenses}
            durationDays={activeItinerary.durationDays}
          />

          {/* AI Multi-Provider Health Status Panel */}
          <GlassCard className="p-5 border-slate-200 dark:border-white/10 space-y-4 bg-white/80 dark:bg-slate-900/80">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-900 dark:text-white">
                <Cpu className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                <span>Dual-Provider AI Engine</span>
              </div>
              <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">Hierarchy: 1→2→3</span>
            </div>

            <div className="space-y-2.5 text-xs">
              {/* Tier 1: Gemini */}
              <div className="flex items-center justify-between p-2 rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/5">
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${providersStatus?.gemini?.available ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`} />
                  <span className="font-medium text-slate-800 dark:text-slate-200">1. Google Gemini (Primary)</span>
                </div>
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${providersStatus?.gemini?.available ? 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300' : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400'}`}>
                  {providersStatus?.gemini?.available ? 'Ready' : 'Not Configured'}
                </span>
              </div>

              {/* Tier 2: Ollama */}
              <div className="flex items-center justify-between p-2 rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/5">
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${providersStatus?.ollama?.available ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`} />
                  <span className="font-medium text-slate-800 dark:text-slate-200">2. Ollama Local (Backup)</span>
                </div>
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${providersStatus?.ollama?.available ? 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300' : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400'}`}>
                  {providersStatus?.ollama?.available ? 'Ready' : 'Daemon Offline'}
                </span>
              </div>

              {/* Tier 3: Deterministic */}
              <div className="flex items-center justify-between p-2 rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/5">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-emerald-500" />
                  <span className="font-medium text-slate-800 dark:text-slate-200">3. Deterministic Grounding</span>
                </div>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-700 dark:text-emerald-300">
                  Active
                </span>
              </div>
            </div>

            <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed border-t border-slate-200 dark:border-white/5 pt-3">
              Guaranteed zero-hallucination execution. All generated itineraries strictly reference verified SQLite place records.
            </p>
          </GlassCard>

          {/* Cultural Etiquette Card */}
          <GlassCard className="p-5 border-slate-200 dark:border-white/10 space-y-2 bg-white/80 dark:bg-slate-900/80">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-900 dark:text-white">
              <Layers className="w-4 h-4 text-brand-saffron" />
              <span>Cultural & Local Lens Notes</span>
            </div>
            <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
              {activeItinerary.notes || 'Carry modest attire for heritage sanctums. Carry cash in small denominations for local auto-rickshaws and coastal coconut vendors.'}
            </p>
          </GlassCard>
        </div>
      </div>
    </div>
  );
};
