import React, { useState } from 'react';
import { ExpenseBreakdown } from '../../types';
import { GlassCard } from '../ui/GlassCard';
import { IndianRupee, ShieldCheck, PieChart, Bed, Utensils, Bus, Ticket, ShieldAlert } from 'lucide-react';

interface BudgetBreakdownProps {
  expenses: ExpenseBreakdown;
  durationDays: number;
}

export const BudgetBreakdown: React.FC<BudgetBreakdownProps> = ({
  expenses,
  durationDays
}) => {
  const [viewMode, setViewMode] = useState<'daily' | 'total'>('total');

  const multiplier = viewMode === 'total' ? durationDays : 1;

  const categories = [
    {
      name: 'Stay & Accommodation',
      amount: expenses.accommodation * multiplier,
      pct: 40,
      icon: Bed,
      color: 'bg-brand-saffron',
      textColor: 'text-brand-spice',
    },
    {
      name: 'Food & Culinary Experiences',
      amount: expenses.foodDining * multiplier,
      pct: 25,
      icon: Utensils,
      color: 'bg-emerald-500',
      textColor: 'text-emerald-400',
    },
    {
      name: 'Local Transport & Auto',
      amount: expenses.localTransport * multiplier,
      pct: 15,
      icon: Bus,
      color: 'bg-sky-500',
      textColor: 'text-sky-400',
    },
    {
      name: 'Sightseeing & Entry Fees',
      amount: expenses.sightseeingTickets * multiplier,
      pct: 10,
      icon: Ticket,
      color: 'bg-purple-500',
      textColor: 'text-purple-400',
    },
    {
      name: 'Contingency & Local Buffer',
      amount: expenses.bufferContingency * multiplier,
      pct: 10,
      icon: ShieldAlert,
      color: 'bg-slate-400',
      textColor: 'text-slate-300',
    },
  ];

  const currentTotal = categories.reduce((sum, item) => sum + item.amount, 0);

  return (
    <GlassCard className="p-6 border-stone-200 dark:border-white/10 space-y-6">
      {/* Header and Toggle */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <PieChart className="w-4 h-4 text-brand-spice" />
            <span className="text-xs font-bold text-brand-spice uppercase tracking-wider">
              Transparent Budget Engineering
            </span>
          </div>
          <h3 className="text-xl font-extrabold text-stone-900 dark:text-white tracking-tight mt-1">
            Expense Allocation & Estimates
          </h3>
        </div>

        {/* View mode toggle */}
        <div className="flex items-center p-1 rounded-xl bg-stone-200/80 dark:bg-slate-950/80 border border-stone-300 dark:border-white/10 text-xs self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setViewMode('daily')}
            className={`px-3 py-1.5 rounded-lg font-semibold transition-colors ${
              viewMode === 'daily'
                ? 'bg-brand-saffron text-white font-bold'
                : 'text-stone-600 dark:text-slate-400 hover:text-stone-900 dark:hover:text-white'
            }`}
          >
            Daily Rate
          </button>
          <button
            type="button"
            onClick={() => setViewMode('total')}
            className={`px-3 py-1.5 rounded-lg font-semibold transition-colors ${
              viewMode === 'total'
                ? 'bg-brand-saffron text-white font-bold'
                : 'text-stone-600 dark:text-slate-400 hover:text-stone-900 dark:hover:text-white'
            }`}
          >
            Total ({durationDays} Days)
          </button>
        </div>
      </div>

      {/* Total Display */}
      <div className="p-4 rounded-2xl bg-stone-100 dark:bg-slate-950/70 border border-stone-200 dark:border-white/5 flex items-center justify-between">
        <span className="text-sm font-medium text-stone-700 dark:text-slate-300">
          Estimated {viewMode === 'total' ? `Total Trip (${durationDays} Days)` : 'Daily Spend'}
        </span>
        <div className="flex items-center text-2xl font-black text-stone-900 dark:text-white">
          <IndianRupee className="w-6 h-6 text-emerald-400" />
          <span>{currentTotal.toLocaleString('en-IN')}</span>
        </div>
      </div>

      {/* Multi-segmented Progress Bar */}
      <div className="space-y-1.5">
        <div className="h-3 w-full rounded-full bg-stone-200 dark:bg-slate-800 overflow-hidden flex">
          {categories.map((cat, idx) => (
            <div
              key={idx}
              style={{ width: `${cat.pct}%` }}
              className={`${cat.color} h-full transition-all duration-500`}
              title={`${cat.name}: ${cat.pct}%`}
            />
          ))}
        </div>
        <div className="flex justify-between text-[10px] text-slate-500 px-1 font-medium">
          <span>Accommodation (40%)</span>
          <span>Food (25%)</span>
          <span>Transport (15%)</span>
          <span>Activities (10%)</span>
          <span>Buffer (10%)</span>
        </div>
      </div>

      {/* Category List */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
        {categories.map((cat, idx) => {
          const Icon = cat.icon;
          return (
            <div
              key={idx}
              className="flex items-center justify-between p-3 rounded-xl bg-stone-50 dark:bg-white/[0.02] border border-stone-200 dark:border-white/5"
            >
              <div className="flex items-center gap-2.5">
                <div className={`p-2 rounded-lg bg-white/5 ${cat.textColor}`}>
                  <Icon className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-semibold text-stone-800 dark:text-slate-200">{cat.name}</h4>
                  <span className="text-[10px] text-slate-500">{cat.pct}% allocation</span>
                </div>
              </div>
              <div className="text-right">
                <span className="text-xs font-bold text-stone-900 dark:text-white">
                  ₹{cat.amount.toLocaleString('en-IN')}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Verified vs Estimated Transparency Notice */}
      <div className="p-3.5 rounded-2xl bg-stone-50 dark:bg-white/[0.02] border border-stone-200 dark:border-white/5 text-xs text-stone-600 dark:text-slate-400 flex items-start gap-2.5">
        <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
        <p className="text-[11px] leading-relaxed">
          <strong className="text-stone-800 dark:text-slate-200">Fact-Checked Pricing Protocol:</strong> Sightseeing and monument ticket fees are derived from verified official tourism listings. Accommodation, dining, and local transit reflect regional index averages and remain customizable to your personal travel style.
        </p>
      </div>
    </GlassCard>
  );
};

