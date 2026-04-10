"use client";

import { useEffect, useState } from "react";

type StatsCardProps = {
  title: string;
  value: number;
  icon: React.ReactNode;
  color: string; // CSS color for the accent
  loading?: boolean;
  delay?: number; // stagger animation delay in ms
};

export default function StatsCard({ title, value, icon, color, loading, delay = 0 }: StatsCardProps) {
  const [displayValue, setDisplayValue] = useState(0);

  // Count-up animation
  useEffect(() => {
    if (loading) return;
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
      className="stat-card animate-fade-in"
      style={{ animationDelay: `${delay}ms` }}
    >
      {/* Decorative circle behind */}
      <div
        className="absolute top-0 right-0 w-24 h-24 rounded-full opacity-[0.07] pointer-events-none"
        style={{ background: color, transform: "translate(30%, -30%)" }}
      />

      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
          {title}
        </span>
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center"
          style={{ background: `${color}18`, color: color }}
        >
          {icon}
        </div>
      </div>

      <div className="flex items-end gap-2">
        <span className="text-3xl font-bold tracking-tight animate-count-up" style={{ animationDelay: `${delay + 200}ms` }}>
          {displayValue}
        </span>
      </div>
    </div>
  );
}
