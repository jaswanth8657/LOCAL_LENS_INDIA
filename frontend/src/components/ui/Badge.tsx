import React from 'react';
import { VerificationStatus } from '../../types';
import { ShieldCheck, AlertCircle, HelpCircle } from 'lucide-react';

interface VerificationBadgeProps {
  status: VerificationStatus;
  source?: string;
  className?: string;
}

export const VerificationBadge: React.FC<VerificationBadgeProps> = ({
  status,
  source,
  className = ''
}) => {
  if (status === 'VERIFIED') {
    return (
      <span
        title={source ? `Verified via ${source}` : 'Verified external data'}
        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 ${className}`}
      >
        <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
        Verified Data
      </span>
    );
  }

  if (status === 'ESTIMATED') {
    return (
      <span
        title="Estimated from neighborhood / historical averages"
        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/15 text-amber-400 border border-amber-500/30 ${className}`}
      >
        <AlertCircle className="w-3.5 h-3.5 text-amber-400" />
        Estimated
      </span>
    );
  }

  return (
    <span
      title="Factual data unavailable from verified external providers"
      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-800 text-slate-400 border border-slate-700 ${className}`}
    >
      <HelpCircle className="w-3.5 h-3.5 text-slate-400" />
      Not available
    </span>
  );
};

export const CategoryBadge: React.FC<{ category: string; className?: string }> = ({
  category,
  className = ''
}) => {
  const formatted = category.charAt(0).toUpperCase() + category.slice(1);
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-800/80 text-slate-300 border border-slate-700/60 ${className}`}
    >
      {formatted}
    </span>
  );
};

export const MatchBadge: React.FC<{ score: number; className?: string }> = ({
  score,
  className = ''
}) => {
  const isHigh = score >= 85;
  const colorClass = isHigh
    ? 'bg-brand-saffron/15 text-brand-spice border-brand-saffron/30'
    : 'bg-brand-teal/15 text-teal-400 border-brand-teal/30';

  return (
    <span
      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold border ${colorClass} ${className}`}
    >
      ★ {score}% Match
    </span>
  );
};

