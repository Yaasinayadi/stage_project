"use client";

import { useEffect, useState } from "react";
import { Clock, AlertTriangle, CheckCircle2 } from "lucide-react";

type SlaStatus = "on_track" | "at_risk" | "breached" | null;

interface SlaBadgeProps {
  slaDeadline: string | null | undefined;
  slaStatus?: string | null;
  compact?: boolean;
}

function getTimeInfo(deadline: string): { hours: number; minutes: number; seconds: number; isOverdue: boolean } {
  const now = new Date().getTime();
  const end = new Date(deadline).getTime();
  const diff = end - now;
  const absDiff = Math.abs(diff);

  const hours = Math.floor(absDiff / (1000 * 60 * 60));
  const minutes = Math.floor((absDiff % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((absDiff % (1000 * 60)) / 1000);
  
  return { hours, minutes, seconds, isOverdue: diff < 0 };
}

export default function SlaBadge({ slaDeadline, slaStatus, compact = false }: SlaBadgeProps) {
  const [timeInfo, setTimeInfo] = useState(() =>
    slaDeadline ? getTimeInfo(slaDeadline) : null
  );

  useEffect(() => {
    if (!slaDeadline) return;
    const interval = setInterval(() => {
      setTimeInfo(getTimeInfo(slaDeadline));
    }, 1000);
    return () => clearInterval(interval);
  }, [slaDeadline]);

  if (!slaDeadline || !timeInfo) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-[hsl(var(--muted-foreground))] px-2 py-1 rounded-md bg-[hsl(var(--muted)/0.5)]">
        <Clock size={11} /> Pas de SLA
      </span>
    );
  }

  const isBreached = timeInfo.isOverdue || slaStatus === "breached";
  // At risk if less than 1 hour left AND not overdue
  const isAtRisk = !isBreached && !timeInfo.isOverdue && 
    (new Date(slaDeadline).getTime() - new Date().getTime() < 60 * 60 * 1000);

  const status: SlaStatus = isBreached ? "breached" : isAtRisk ? "at_risk" : "on_track";

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
      bg: "bg-rose-500/10 border-rose-500/20",
      text: "text-rose-600 dark:text-rose-400",
      icon: <AlertTriangle size={11} />,
      pulse: true,
    },
  };

  const cfg = config[status!];

  const timeString = `${timeInfo.isOverdue ? "+" : ""}${timeInfo.hours}h ${timeInfo.minutes}m ${timeInfo.seconds}s`;

  if (compact) {
    return (
      <span
        className={`inline-flex items-center gap-1 text-[0.65rem] font-bold px-2 py-0.5 rounded-full border ${cfg.bg} ${cfg.text} ${cfg.pulse ? "animate-pulse" : ""}`}
        title={`SLA deadline : ${new Date(slaDeadline).toLocaleString("fr-FR")}`}
      >
        {cfg.icon}
        {timeInfo.isOverdue ? `En retard ${timeString}` : timeString}
      </span>
    );
  }

  return (
    <div
      className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-semibold ${cfg.bg} ${cfg.text} ${cfg.pulse ? "animate-pulse" : ""}`}
    >
      <Clock size={13} />
      <span>
        {timeInfo.isOverdue ? "SLA Dépassé de " : "SLA : "}
        <span className="font-mono tabular-nums">{timeString}</span>
        {timeInfo.isOverdue ? "" : " restants"}
      </span>
    </div>
  );
}
