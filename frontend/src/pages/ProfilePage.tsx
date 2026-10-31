import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { GlassCard } from '../components/ui/GlassCard';
import {
  User,
  Bookmark,
  Sun,
  Moon,
  LogOut,
  IndianRupee,
  Sparkles,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';

const INTEREST_OPTIONS = [
  'beaches',
  'culture',
  'food',
  'history',
  'nature',
  'shopping'
];

export const ProfilePage: React.FC = () => {
  const { user, profile, isAuthenticated, isLoading, logout, updateProfile } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();

  const [name, setName] = useState('');
  const [budgetPerDay, setBudgetPerDay] = useState(2000);
  const [groupType, setGroupType] = useState('Duo');
  const [groupSize, setGroupSize] = useState(2);
  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);
  const [themePref, setThemePref] = useState<'dark' | 'light'>('dark');
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      navigate('/login');
    }
  }, [isLoading, isAuthenticated, navigate]);

  useEffect(() => {
    if (profile) {
      setName(profile.name || user?.name || '');
      setBudgetPerDay(profile.budget_per_day || 2000);
      setGroupType(profile.group_type || 'Duo');
      setGroupSize(profile.group_size || 2);
      setSelectedInterests(profile.interests || ['beaches', 'culture', 'food']);
      setThemePref(profile.theme_preference || theme);
    }
  }, [profile, user, theme]);

  const toggleInterest = (interest: string) => {
    setSelectedInterests((prev) =>
      prev.includes(interest) ? prev.filter((i) => i !== interest) : [...prev, interest]
    );
  };

  const handleSavePreferences = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSaveError(null);
    try {
      await updateProfile({
        name,
        budget_per_day: budgetPerDay,
        group_type: groupType,
        group_size: groupSize,
        interests: selectedInterests,
        theme_preference: themePref,
      });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: any) {
      setSaveError(err.message || 'Failed to update preferences.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  if (isLoading || !profile) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center">
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-400">
          <span className="w-4 h-4 border-2 border-brand-saffron/40 border-t-brand-saffron rounded-full animate-spin" />
          <span>Loading your account profile...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-brand-saffron/15 text-brand-spice border border-brand-saffron/30 text-xs font-bold">
            <Sparkles className="w-3.5 h-3.5" />
            <span>ACCOUNT & TRAVEL PREFERENCES</span>
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white mt-1">
            My Account Profile
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Manage your personal traveler profile, synced preferences, and saved itineraries.
          </p>
        </div>

        <button
          type="button"
          onClick={handleLogout}
          className="self-start sm:self-auto flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-red-500 dark:text-red-400 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 transition-all"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>Sign Out</span>
        </button>
      </div>

      {saveSuccess && (
        <div className="p-4 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 text-xs font-semibold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
          <span>Your travel preferences and account details have been updated successfully!</span>
        </div>
      )}

      {saveError && (
        <div className="p-4 rounded-2xl bg-red-500/15 border border-red-500/30 text-red-700 dark:text-red-300 text-xs font-semibold flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
          <span>{saveError}</span>
        </div>
      )}

      {/* Two Columns: User Card on Left, Preferences Form on Right */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left Column: Account Summary */}
        <div className="md:col-span-1 space-y-6">
          <GlassCard className="p-6 border-slate-200 dark:border-white/10 space-y-5 text-center">
            <div className="w-20 h-20 rounded-full bg-gradient-to-tr from-brand-saffron to-brand-spice p-1 mx-auto shadow-glow-saffron">
              <div className="w-full h-full rounded-full bg-slate-900 flex items-center justify-center text-white font-black text-2xl">
                {name.charAt(0).toUpperCase() || user?.username.charAt(0).toUpperCase() || 'U'}
              </div>
            </div>

            <div className="space-y-1">
              <h3 className="font-extrabold text-slate-900 dark:text-white text-base">
                {name || user?.username}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                {user?.email}
              </p>
              <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-brand-saffron/20 text-brand-spice border border-brand-saffron/30 mt-1">
                Verified Explorer
              </span>
            </div>

            <div className="pt-4 border-t border-slate-200 dark:border-white/10">
              <Link
                to="/saved"
                className="flex items-center justify-between p-3 rounded-xl bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 text-xs transition-colors"
              >
                <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300 font-semibold">
                  <Bookmark className="w-4 h-4 text-brand-spice" />
                  <span>Saved Itineraries</span>
                </div>
                <span className="font-bold text-slate-900 dark:text-white bg-brand-saffron/20 px-2 py-0.5 rounded-md">
                  {profile.savedTripsCount}
                </span>
              </Link>
            </div>
          </GlassCard>

          {/* Theme Quick Switcher Card */}
          <GlassCard className="p-5 border-slate-200 dark:border-white/10 space-y-3">
            <span className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-2">
              {theme === 'dark' ? <Moon className="w-4 h-4 text-cyan-400" /> : <Sun className="w-4 h-4 text-amber-500" />}
              <span>Theme Appearance</span>
            </span>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Currently in <strong className="capitalize">{theme} Mode</strong>. Automatically syncs with your profile.
            </p>
            <button
              type="button"
              onClick={toggleTheme}
              className="w-full py-2 px-3 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-white/10 dark:hover:bg-white/15 text-slate-800 dark:text-slate-200 flex items-center justify-center gap-2 transition-colors"
            >
              {theme === 'dark' ? (
                <>
                  <Sun className="w-3.5 h-3.5 text-amber-400" />
                  <span>Switch to Light Mode</span>
                </>
              ) : (
                <>
                  <Moon className="w-3.5 h-3.5 text-cyan-500" />
                  <span>Switch to Dark Mode</span>
                </>
              )}
            </button>
          </GlassCard>
        </div>

        {/* Right Column: Editable Preferences */}
        <div className="md:col-span-2">
          <GlassCard className="p-6 border-slate-200 dark:border-white/10 space-y-6">
            <div className="border-b border-slate-200 dark:border-white/10 pb-3">
              <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                Traveler Profile & Default Preferences
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                These defaults pre-fill the AI planner and recommendations engine on every visit.
              </p>
            </div>

            <form onSubmit={handleSavePreferences} className="space-y-5">
              {/* Name */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Display Name
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-white/10 text-slate-900 dark:text-white focus:outline-none focus:border-brand-saffron"
                  />
                </div>
              </div>

              {/* Daily Budget */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                    <IndianRupee className="w-3.5 h-3.5 text-emerald-500" />
                    Default Daily Budget (per person)
                  </span>
                  <span className="font-bold text-slate-900 dark:text-white">
                    ₹{budgetPerDay.toLocaleString('en-IN')}/day
                  </span>
                </div>
                <input
                  type="range"
                  min="500"
                  max="12000"
                  step="500"
                  value={budgetPerDay}
                  onChange={(e) => setBudgetPerDay(Number(e.target.value))}
                  className="w-full accent-brand-saffron cursor-pointer"
                />
              </div>

              {/* Group Type & Size */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Typical Travel Style
                  </label>
                  <select
                    value={groupType}
                    onChange={(e) => setGroupType(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-white/10 text-slate-900 dark:text-white focus:outline-none focus:border-brand-saffron font-medium"
                  >
                    <option value="Solo">Solo Traveler</option>
                    <option value="Duo">Duo / Couple</option>
                    <option value="Family">Family</option>
                    <option value="Friends">Friends Group</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Default Group Size
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="15"
                    value={groupSize}
                    onChange={(e) => setGroupSize(Number(e.target.value))}
                    className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-white/10 text-slate-900 dark:text-white focus:outline-none focus:border-brand-saffron"
                  />
                </div>
              </div>

              {/* Interests */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block">
                  Favorite Travel Interests
                </label>
                <div className="flex flex-wrap gap-2">
                  {INTEREST_OPTIONS.map((interest) => {
                    const active = selectedInterests.includes(interest);
                    return (
                      <button
                        key={interest}
                        type="button"
                        onClick={() => toggleInterest(interest)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-semibold capitalize transition-all ${
                          active
                            ? 'bg-brand-saffron text-white shadow-sm'
                            : 'bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                        }`}
                      >
                        {interest}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Submit */}
              <div className="pt-3 border-t border-slate-200 dark:border-white/10 flex justify-end">
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-6 py-2.5 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-brand-saffron to-brand-spice shadow-glow-saffron hover:opacity-95 transition-all disabled:opacity-50 flex items-center gap-2"
                >
                  {isSaving ? (
                    <>
                      <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Saving Preferences...</span>
                    </>
                  ) : (
                    <span>Save Changes</span>
                  )}
                </button>
              </div>
            </form>
          </GlassCard>
        </div>
      </div>
    </div>
  );
};
