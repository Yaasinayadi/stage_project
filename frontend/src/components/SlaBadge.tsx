"use client";

import { useEffect, useState } from "react";
import { Clock, AlertTriangle, CheckCircle2 } from "lucide-react";

type SlaStatus = "on_track" | "at_risk" | "breached" | null;

interface SlaBadgeProps {
  slaDeadline: string | null | undefined;
  slaStatus?: string | null;
  compact?: boolean;
}

function getTimeLeft(deadline: string): { hours: number; minutes: number; seconds: number; totalMs: number } {
  const now = new Date().getTime();
  const end = new Date(deadline).getTime();
  const diff = end - now;

  if (diff <= 0) return { hours: 0, minutes: 0, seconds: 0, totalMs: diff };

  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((diff % (1000 * 60)) / 1000);
  return { hours, minutes, seconds, totalMs: diff };
}

export default function SlaBadge({ slaDeadline, slaStatus, compact = false }: SlaBadgeProps) {
  const [timeLeft, setTimeLeft] = useState(() =>
    slaDeadline ? getTimeLeft(slaDeadline) : null
  );

  useEffect(() => {
    if (!slaDeadline) return;
    const interval = setInterval(() => {
      setTimeLeft(getTimeLeft(slaDeadline));
    }, 1000);
    return () => clearInterval(interval);
  }, [slaDeadline]);

  if (!slaDeadline || !timeLeft) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-[hsl(var(--muted-foreground))] px-2 py-1 rounded-md bg-[hsl(var(--muted)/0.5)]">
        <Clock size={11} /> Pas de SLA
      </span>
    );
  }

  const isBreached = timeLeft.totalMs <= 0;
  const isAtRisk = !isBreached && timeLeft.totalMs <= 60 * 60 * 1000; // < 1 hour

  const status: SlaStatus =
    slaStatus === "breached" || isBreached
      ? "breached"
      : slaStatus === "at_risk" || isAtRisk
      ? "at_risk"
      : "on_track";

  const config = {
    on_track: {
      bg: "bg-emerald-500/10 border-emerald-500/20",
      text: "text-emerald-600 dark:text-emerald-400",
      icon: <CheckCircle2 size={11} />,
      pulse: false,
    },
    at_risk: {
      bg: "bg-amber-500/10 border-amber-500/20",
      text: "text-amber-600 dark:text-amber-400",
      icon: <AlertTriangle size={11} />,
      pulse: true,
    },
    breached: {
      bg: "bg-red-500/10 border-red-500/20",
      text: "text-red-600 dark:text-red-400",
      icon: <AlertTriangle size={11} />,
      pulse: true,
    },
  };

  const cfg = config[status!];

  if (compact) {
    return (
      <span
        className={`inline-flex items-center gap-1 text-[0.65rem] font-bold px-2 py-0.5 rounded-full border ${cfg.bg} ${cfg.text} ${cfg.pulse ? "animate-pulse" : ""}`}
        title={`SLA deadline : ${new Date(slaDeadline).toLocaleString("fr-FR")}`}
      >
        {cfg.icon}
        {isBreached
          ? "SLA Dépassé"
          : `${timeLeft.hours}h ${timeLeft.minutes}m`}
      </span>
    );
  }

  return (
    <div
      className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-semibold ${cfg.bg} ${cfg.text} ${cfg.pulse ? "animate-pulse" : ""}`}
    >
      <Clock size={13} />
      {isBreached ? (
        <span>SLA Dépassé !</span>
      ) : (
        <span>
          {timeLeft.hours > 0 && `${timeLeft.hours}h `}
          {timeLeft.minutes}m {timeLeft.seconds}s restants
        </span>
      )}
    </div>
  );
}
