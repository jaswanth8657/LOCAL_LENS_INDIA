import React from 'react';

interface GlassCardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  variant?: 'default' | 'subtle' | 'glow-saffron' | 'glow-teal';
  className?: string;
  hoverEffect?: boolean;
}

export const GlassCard: React.FC<GlassCardProps> = ({
  children,
  variant = 'default',
  className = '',
  hoverEffect = false,
  ...props
}) => {
  const baseClasses = 'relative rounded-2xl overflow-hidden backdrop-blur-xl border transition-colors duration-200';
  
  const variantClasses = {
    default: 'bg-white/90 border-slate-200/90 text-slate-800 shadow-sm dark:bg-slate-900/70 dark:border-white/10 dark:text-slate-100 dark:shadow-glass',
    subtle: 'bg-slate-100/70 border-slate-200/60 text-slate-800 dark:bg-white/[0.03] dark:border-white/5 dark:text-slate-100',
    'glow-saffron': 'bg-white/95 border-brand-saffron/40 shadow-glow-saffron text-slate-800 dark:bg-slate-900/80 dark:border-brand-saffron/30 dark:text-slate-100',
    'glow-teal': 'bg-white/95 border-brand-teal/40 shadow-glow-teal text-slate-800 dark:bg-slate-900/80 dark:border-brand-teal/30 dark:text-slate-100',
  };

  const hoverClasses = hoverEffect
    ? 'transition-all duration-300 ease-out hover:-translate-y-1 hover:border-brand-saffron/50 hover:shadow-glow-saffron hover:bg-white dark:hover:bg-slate-900/90'
    : '';

  return (
    <div
      className={`${baseClasses} ${variantClasses[variant]} ${hoverClasses} ${className}`}
      {...props}
    >
      {/* Specular highlight border reflection */}
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/40 dark:via-white/20 to-transparent pointer-events-none" />
      {children}
    </div>
  );
};
