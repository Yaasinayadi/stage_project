"use client";

import { useEffect, useState } from "react";
import { Clock, AlertTriangle, CheckCircle2 } from "lucide-react";

type SlaStatus = "on_track" | "at_risk" | "breached" | null;

interface SlaBadgeProps {
  slaDeadline: string | null | undefined;
  slaStatus?: string | null;
  compact?: boolean;
  ticketState?: string;
  dateResolved?: string | null;
}

function parseDateString(raw: string): Date {
  const sanitized = raw.trim().replace(" ", "T");
  return new Date(sanitized.endsWith("Z") ? sanitized : sanitized + "Z");
}

function getTimeInfo(deadline: string, isResolved: boolean, dateResolved: string | null | undefined): { hours: number; minutes: number; seconds: number; isOverdue: boolean } {
  let now = new Date().getTime();
  if (isResolved && dateResolved) {
    now = parseDateString(dateResolved).getTime();
  }
  const end = parseDateString(deadline).getTime();
  const diff = end - now;
  const absDiff = Math.abs(diff);

  const hours = Math.floor(absDiff / (1000 * 60 * 60));
  const minutes = Math.floor((absDiff % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((absDiff % (1000 * 60)) / 1000);
  
  return { hours, minutes, seconds, isOverdue: diff < 0 };
}

export default function SlaBadge({ slaDeadline, slaStatus, compact = false, ticketState, dateResolved }: SlaBadgeProps) {
  const isResolved = ticketState === "resolved" || ticketState === "closed";

  const [timeInfo, setTimeInfo] = useState(() =>
    slaDeadline ? getTimeInfo(slaDeadline, isResolved, dateResolved) : null
  );

  useEffect(() => {
    if (!slaDeadline) return;
    if (isResolved) {
      setTimeInfo(getTimeInfo(slaDeadline, isResolved, dateResolved));
      return;
    }
    const interval = setInterval(() => {
      setTimeInfo(getTimeInfo(slaDeadline, isResolved, dateResolved));
    }, 1000);
    return () => clearInterval(interval);
  }, [slaDeadline, isResolved, dateResolved]);

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
    (parseDateString(slaDeadline).getTime() - (isResolved && dateResolved ? parseDateString(dateResolved).getTime() : new Date().getTime()) < 60 * 60 * 1000);

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
        className={`inline-flex items-center gap-1 text-[0.65rem] font-bold px-2 py-0.5 rounded-full border ${cfg.bg} ${cfg.text} ${cfg.pulse && !isResolved ? "animate-pulse" : ""}`}
        title={`SLA deadline : ${parseDateString(slaDeadline).toLocaleString("fr-FR")}`}
      >
        {cfg.icon}
        {timeInfo.isOverdue ? `En retard ${timeString}${isResolved ? " (clos)" : ""}` : timeString}
      </span>
    );
  }

  return (
    <div
      className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-semibold ${cfg.bg} ${cfg.text} ${cfg.pulse && !isResolved ? "animate-pulse" : ""}`}
    >
      <Clock size={13} />
      <span>
        {timeInfo.isOverdue ? "SLA Dépassé de " : "SLA : "}
        <span className="font-mono tabular-nums">{timeString}</span>
        {timeInfo.isOverdue ? (isResolved ? " lors de la clôture" : "") : " restants"}
      </span>
    </div>
  );
}
