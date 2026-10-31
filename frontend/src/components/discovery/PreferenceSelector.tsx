import React from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { TravelInterest, TravelGroup } from '../../types';
import { useTrip } from '../../context/TripContext';
import { CURATED_DESTINATIONS } from '../../data/curatedDestinations';
import { GlassCard } from '../ui/GlassCard';
import { useNavigate } from 'react-router-dom';
import {
  Sparkles,
  Users,
  Calendar,
  IndianRupee,
  Utensils,
  Landmark,
  TreePine,
  ShoppingBag,
  Palmtree,
  Compass,
  History,
  Camera,
  ArrowRight
} from 'lucide-react';

const preferenceSchema = z.object({
  destination: z.string().min(1, 'Please select a destination'),
  interests: z.array(z.string()).min(1, 'Select at least one travel interest'),
  budgetPerDay: z.number().min(500, 'Minimum budget is ₹500/day').max(15000),
  groupType: z.enum(['Solo', 'Duo', 'Family', 'Friends']),
  durationDays: z.number().min(1).max(21),
});

type PreferenceFormData = z.infer<typeof preferenceSchema>;

const INTEREST_CONFIGS: { id: TravelInterest; label: string; icon: React.FC<{ className?: string }> }[] = [
  { id: 'food', label: 'Culinary & Street Eats', icon: Utensils },
  { id: 'culture', label: 'Culture & Arts', icon: Landmark },
  { id: 'nature', label: 'Nature & Serenity', icon: TreePine },
  { id: 'shopping', label: 'Local Bazaars & Crafts', icon: ShoppingBag },
  { id: 'beaches', label: 'Beaches & Coastlines', icon: Palmtree },
  { id: 'adventure', label: 'Adventure & Trails', icon: Compass },
  { id: 'history', label: 'Forts & Heritage', icon: History },
  { id: 'photography', label: 'Scenic Viewpoints', icon: Camera },
];

export const PreferenceSelector: React.FC = () => {
  const { preferences, setPreferences, setSelectedDestination } = useTrip();
  const navigate = useNavigate();

  const {
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { errors }
  } = useForm<PreferenceFormData>({
    resolver: zodResolver(preferenceSchema),
    defaultValues: {
      destination: preferences.destination,
      interests: preferences.interests,
      budgetPerDay: preferences.budgetPerDay,
      groupType: preferences.groupType,
      durationDays: preferences.durationDays,
    }
  });

  const selectedInterests = watch('interests');
  const currentBudget = watch('budgetPerDay');
  const currentGroup = watch('groupType');
  const currentDuration = watch('durationDays');

  const toggleInterest = (interest: TravelInterest) => {
    const exists = selectedInterests.includes(interest);
    if (exists) {
      if (selectedInterests.length > 1) {
        setValue('interests', selectedInterests.filter((i) => i !== interest));
      }
    } else {
      setValue('interests', [...selectedInterests, interest]);
    }
  };

  const getBudgetTierLabel = (budget: number) => {
    if (budget < 1200) return { label: 'Backpacker Budget', color: 'text-sky-400' };
    if (budget < 2500) return { label: 'Smart Explorer', color: 'text-emerald-400' };
    if (budget < 4500) return { label: 'Comfort & Heritage', color: 'text-amber-400' };
    return { label: 'Boutique & Luxury', color: 'text-rose-400' };
  };

  const onSubmit = (data: PreferenceFormData) => {
    const dest = CURATED_DESTINATIONS.find((d) => d.id === data.destination);
    if (dest) {
      setSelectedDestination(dest);
    }
    setPreferences({
      destination: data.destination,
      destinationName: dest ? dest.name : data.destination,
      interests: data.interests as TravelInterest[],
      budgetPerDay: data.budgetPerDay,
      groupType: data.groupType as TravelGroup,
      durationDays: data.durationDays,
    });
    navigate('/recommendations');
  };

  return (
    <GlassCard className="p-6 sm:p-8 max-w-4xl mx-auto border-white/10 shadow-2xl">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-5">
          <div>
            <span className="text-xs font-bold text-brand-spice uppercase tracking-wider">
              Step 1 • Customize Your Journey
            </span>
            <h2 className="text-2xl font-extrabold text-white tracking-tight mt-1">
              Travel Preferences & Criteria
            </h2>
          </div>
          <div className="flex items-center gap-2 text-xs font-medium text-slate-400 bg-white/5 px-3 py-1.5 rounded-xl border border-white/10">
            <Sparkles className="w-4 h-4 text-brand-spice" />
            <span>AI-Guided Scoring</span>
          </div>
        </div>

        {/* 1. Destination Picker */}
        <div className="space-y-2.5">
          <label className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
            <Compass className="w-3.5 h-3.5 text-brand-saffron" />
            Choose Indian Destination
          </label>
          <Controller
            name="destination"
            control={control}
            render={({ field }) => (
              <select
                {...field}
                className="w-full rounded-2xl bg-slate-900 border border-white/15 px-4 py-3 text-sm font-semibold text-white focus:outline-none focus:border-brand-saffron transition-all"
              >
                {CURATED_DESTINATIONS.map((dest) => (
                  <option key={dest.id} value={dest.id} className="bg-slate-900 text-white">
                    {dest.name}, {dest.state} ({dest.region} India)
                  </option>
                ))}
              </select>
            )}
          />
          {errors.destination && (
            <p className="text-xs text-red-400">{errors.destination.message}</p>
          )}
        </div>

        {/* 2. Travel Interests Selector */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-brand-spice" />
              What Interests You Most?
            </label>
            <span className="text-xs text-slate-400">
              {selectedInterests.length} selected
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {INTEREST_CONFIGS.map((item) => {
              const Icon = item.icon;
              const isSelected = selectedInterests.includes(item.id);
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => toggleInterest(item.id)}
                  className={`flex flex-col items-center justify-center p-3.5 rounded-2xl border text-center transition-all ${
                    isSelected
                      ? 'bg-brand-saffron/15 border-brand-saffron/60 text-white font-bold shadow-glow-saffron'
                      : 'bg-slate-900/60 border-white/5 text-slate-400 hover:text-white hover:bg-slate-800'
                  }`}
                >
                  <Icon
                    className={`w-5 h-5 mb-1.5 ${
                      isSelected ? 'text-brand-spice' : 'text-slate-400'
                    }`}
                  />
                  <span className="text-xs">{item.label}</span>
                </button>
              );
            })}
          </div>
          {errors.interests && (
            <p className="text-xs text-red-400">{errors.interests.message}</p>
          )}
        </div>

        {/* 3. Budget Range Slider */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
              <IndianRupee className="w-3.5 h-3.5 text-emerald-400" />
              Estimated Daily Budget Per Person
            </label>
            <div className="text-right">
              <span className="text-base font-extrabold text-white">
                ₹{currentBudget.toLocaleString('en-IN')}
              </span>
              <span className="text-xs text-slate-400"> / day</span>
              <div className={`text-[10px] font-semibold ${getBudgetTierLabel(currentBudget).color}`}>
                {getBudgetTierLabel(currentBudget).label}
              </div>
            </div>
          </div>

          <Controller
            name="budgetPerDay"
            control={control}
            render={({ field }) => (
              <input
                type="range"
                min={500}
                max={10000}
                step={250}
                value={field.value}
                onChange={(e) => field.onChange(Number(e.target.value))}
                className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-brand-saffron"
              />
            )}
          />
          <div className="flex justify-between text-[10px] font-medium text-slate-500">
            <span>₹500 (Budget)</span>
            <span>₹2,500 (Moderate)</span>
            <span>₹5,000 (Premium)</span>
            <span>₹10,000+ (Luxury)</span>
          </div>
        </div>

        {/* 4. Travel Group & Duration Selection */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {/* Group Type */}
          <div className="space-y-2.5">
            <label className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-sky-400" />
              Travel Group
            </label>
            <div className="grid grid-cols-4 gap-2">
              {(['Solo', 'Duo', 'Family', 'Friends'] as TravelGroup[]).map((group) => (
                <button
                  key={group}
                  type="button"
                  onClick={() => setValue('groupType', group)}
                  className={`py-2.5 rounded-xl text-xs font-semibold border transition-all ${
                    currentGroup === group
                      ? 'bg-sky-500/20 border-sky-400 text-white font-bold'
                      : 'bg-slate-900/60 border-white/5 text-slate-400 hover:text-white'
                  }`}
                >
                  {group}
                </button>
              ))}
            </div>
          </div>

          {/* Duration in Days */}
          <div className="space-y-2.5">
            <div className="flex justify-between items-center">
              <label className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-purple-400" />
                Trip Duration
              </label>
              <span className="text-xs font-bold text-purple-400">
                {currentDuration} {currentDuration === 1 ? 'Day (Day Trip)' : 'Days'}
              </span>
            </div>
            <Controller
              name="durationDays"
              control={control}
              render={({ field }) => (
                <input
                  type="range"
                  min={1}
                  max={14}
                  step={1}
                  value={field.value}
                  onChange={(e) => field.onChange(Number(e.target.value))}
                  className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-purple-500"
                />
              )}
            />
            <div className="flex justify-between text-[10px] text-slate-500">
              <span>1 Day</span>
              <span>3 Days (Weekend)</span>
              <span>7 Days (Week)</span>
              <span>14 Days (Extended)</span>
            </div>
          </div>
        </div>

        {/* Action Button */}
        <div className="pt-4 border-t border-white/10 flex justify-end">
          <button
            type="submit"
            className="flex items-center gap-2.5 px-8 py-3.5 rounded-2xl text-sm font-extrabold text-white bg-gradient-to-r from-brand-saffron via-brand-spice to-brand-amber hover:opacity-95 shadow-glow-saffron transition-all transform hover:-translate-y-0.5"
          >
            <Sparkles className="w-4 h-4" />
            <span>Generate Personalized Recommendations</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </form>
    </GlassCard>
  );
};

