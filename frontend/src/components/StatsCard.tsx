"use client";

import { useEffect, useState } from "react";
import { Info } from "lucide-react";

type StatsCardProps = {
  title: string;
  value: number | string;
  icon: React.ReactNode;
  color: string; // CSS color for the accent
  loading?: boolean;
  delay?: number; // stagger animation delay in ms
  onClick?: () => void;
  tooltip?: string;
};

export default function StatsCard({ title, value, icon, color, loading, delay = 0, onClick, tooltip }: StatsCardProps) {
  const [displayValue, setDisplayValue] = useState<number | string>(0);
  const [showTooltip, setShowTooltip] = useState(false);

  // Count-up animation
  useEffect(() => {
    if (loading) return;
    
    if (typeof value === 'string') {
      setDisplayValue(value);
      return;
    }
    
    if (value === 0) { setDisplayValue(0); return; }

    const duration = 800;
    const startTime = Date.now();
    const timer = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // Ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayValue(Math.floor(eased * value));
      if (progress >= 1) clearInterval(timer);
    }, 16);

    return () => clearInterval(timer);
  }, [value, loading]);

  if (loading) {
    return (
      <div className="stat-card animate-fade-in" style={{ animationDelay: `${delay}ms` }}>
        <div className="flex items-center justify-between mb-3">
          <div className="w-20 h-3 rounded animate-shimmer" />
          <div className="w-10 h-10 rounded-xl animate-shimmer" />
        </div>
        <div className="w-16 h-8 rounded animate-shimmer mt-1" />
      </div>
    );
  }

  return (
    <div
      className={`stat-card animate-fade-in relative ${onClick ? "cursor-pointer hover:shadow-md transition-shadow" : ""}`}
      style={{ animationDelay: `${delay}ms`, overflow: 'visible' }}
      onClick={onClick}
    >
      {/* Decorative circle behind */}
      <div className="absolute inset-0 overflow-hidden rounded-[var(--radius)] pointer-events-none">
        <div
          className="absolute top-0 right-0 w-24 h-24 rounded-full opacity-[0.07]"
          style={{ background: color, transform: "translate(30%, -30%)" }}
        />
      </div>

      <div className="flex items-center justify-between mb-3 relative z-10">
        <span className="text-xs font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))] flex items-center gap-1">
          {title}
        </span>
        <div className="flex items-center gap-2">
          {tooltip && (
            <div 
              className="relative flex items-center justify-center cursor-help text-[hsl(var(--muted-foreground))]"
              onMouseEnter={() => setShowTooltip(true)}
              onMouseLeave={() => setShowTooltip(false)}
              onClick={(e) => { e.stopPropagation(); setShowTooltip(!showTooltip); }}
            >
              <Info size={16} />
              {showTooltip && (
                <div className="absolute bottom-full right-0 mb-2 w-64 p-3 bg-[hsl(var(--popover))] border border-[hsl(var(--border))] rounded-lg shadow-2xl text-xs text-[hsl(var(--popover-foreground))] z-[100] normal-case font-medium leading-relaxed">
                  {tooltip}
                </div>
              )}
            </div>
          )}
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ background: `${color}18`, color: color }}
          >
            {icon}
          </div>
        </div>
      </div>

      <div className="flex items-end gap-2 relative z-10">
        <span className="text-3xl font-bold tracking-tight animate-count-up" style={{ animationDelay: `${delay + 200}ms` }}>
          {displayValue}
        </span>
      </div>
    </div>
  );
}
