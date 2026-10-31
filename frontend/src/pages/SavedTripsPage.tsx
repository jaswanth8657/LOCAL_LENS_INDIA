import React from 'react';
import { useTrip } from '../context/TripContext';
import { useAuth } from '../context/AuthContext';
import { GlassCard } from '../components/ui/GlassCard';
import { Bookmark, Calendar, IndianRupee, Trash2, ArrowRight, Compass, LogIn, UserPlus } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';

export const SavedTripsPage: React.FC = () => {
  const { savedTrips, removeSavedTrip, setCurrentItinerary } = useTrip();
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();

  const handleOpenTrip = (trip: typeof savedTrips[0]) => {
    setCurrentItinerary(trip);
    navigate('/planner');
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      {/* Page Header */}
      <div className="space-y-1.5">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-brand-saffron/15 text-brand-spice border border-brand-saffron/30 text-xs font-bold">
          <Bookmark className="w-3.5 h-3.5" />
          <span>SAVED TRIPS</span>
        </div>
        <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
          Your Stored Travel Plans
        </h1>
        <p className="text-xs text-slate-600 dark:text-slate-400">
          Saved itineraries persisted in your SQLite database. Ready for review, export, and editing.
        </p>
      </div>

      {/* Guest Account Callout if not signed in */}
      {!isAuthenticated && (
        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/25 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <h4 className="text-sm font-bold text-slate-900 dark:text-amber-200">
              Browsing as a Guest
            </h4>
            <p className="text-xs text-slate-600 dark:text-amber-300/80">
              Sign in or create an account to permanently bind your itineraries to your profile and prevent local browser cache loss.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Link
              to="/login?redirect=/saved"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-brand-saffron to-brand-spice shadow-sm"
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>Sign In</span>
            </Link>
            <Link
              to="/register?redirect=/saved"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>Register</span>
            </Link>
          </div>
        </div>
      )}

      {/* Trips Grid */}
      {savedTrips.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {savedTrips.map((trip) => (
            <GlassCard key={trip.id} hoverEffect className="p-5 flex flex-col justify-between space-y-4">
              <div className="space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-brand-saffron/20 text-brand-spice border border-brand-saffron/30">
                      {trip.durationDays} Days • {trip.groupType}
                    </span>
                    {trip.aiProviderUsed && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-white/10">
                        {trip.aiProviderUsed}
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => removeSavedTrip(trip.id)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-500/10 transition-colors"
                    title="Delete Itinerary"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                <h3 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight">
                  {trip.title}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Destination: <strong className="text-slate-800 dark:text-slate-200">{trip.destinationName}</strong> • ID: <span className="font-mono text-[10px] text-slate-400">{trip.id}</span>
                </p>
              </div>

              {/* Practical Meta */}
              <div className="grid grid-cols-2 gap-2 text-xs bg-slate-50 dark:bg-slate-950/60 p-3 rounded-xl border border-slate-200 dark:border-white/5">
                <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
                  <Calendar className="w-3.5 h-3.5 text-brand-spice" />
                  <span>{trip.days.length} Daily Stops</span>
                </div>
                <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300 justify-end">
                  <IndianRupee className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span>₹{trip.totalBudgetInr.toLocaleString('en-IN')} Total</span>
                </div>
              </div>

              {/* Actions */}
              <div className="pt-2 border-t border-slate-200 dark:border-white/5 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => handleOpenTrip(trip)}
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-brand-spice hover:text-brand-saffron transition-colors"
                >
                  <span>Open Full Itinerary</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </GlassCard>
          ))}
        </div>
      ) : (
        <GlassCard className="p-12 text-center max-w-md mx-auto space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-brand-saffron/15 text-brand-spice mx-auto flex items-center justify-center">
            <Compass className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">No Saved Itineraries Yet</h3>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              Plan a trip using our AI Trip Planner and save your personalized day-by-day itinerary here.
            </p>
          </div>
          <Link
            to="/planner"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-brand-saffron to-brand-spice shadow-glow-saffron"
          >
            <span>Plan an Itinerary</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </GlassCard>
      )}
    </div>
  );
};

