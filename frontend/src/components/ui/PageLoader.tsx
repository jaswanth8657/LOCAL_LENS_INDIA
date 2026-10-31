import React from 'react';
import { Compass } from 'lucide-react';

export const PageLoader: React.FC = () => {
  return (
    <div className="min-h-[50vh] flex flex-col items-center justify-center space-y-4 py-20">
      <div className="relative">
        <div className="w-12 h-12 rounded-2xl bg-brand-saffron/20 border border-brand-saffron/40 flex items-center justify-center text-brand-spice animate-pulse">
          <Compass className="w-6 h-6 animate-spin [animation-duration:3s]" />
        </div>
      </div>
      <p className="text-xs font-semibold text-stone-500 dark:text-slate-400 tracking-wide uppercase">
        Loading Local Lens...
      </p>
    </div>
  );
};

