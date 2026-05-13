"use client";

import { useState, useEffect } from "react";
import { Timer, CheckCircle2 } from "lucide-react";

const SLA_RESOLUTION_HOURS: Record<string, number> = {
  "3": 2,
  "2": 8,
  "1": 24,
  "0": 48,
};

const SLA_RESPONSE_HOURS: Record<string, number> = {
  "3": 0.5,
  "2": 1,
  "1": 4,
  "0": 8,
};

function toUTC(raw: string | null): Date | null {
  if (!raw) return null;
  const s = raw.includes("Z") ? raw : raw + "Z";
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

function formatDuration(totalMinutes: number): string {
  const absMin = Math.abs(totalMinutes);
  const d = Math.floor(absMin / (24 * 60));
  const h = Math.floor((absMin % (24 * 60)) / 60);
  const m = Math.floor(absMin % 60);

  if (absMin >= 24 * 60) {
    return h > 0 ? `${d}j ${h}h` : `${d}j`;
  } else if (absMin >= 60) {
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  } else {
    return `${m}m`;
  }
}

export interface CompactSlaBadgeProps {
  type?: "resolution" | "response";
  slaDeadline: string | null;
  slaStatus: string | null;
  priority: string;
  state: string;
  dateResolved?: string | null;
  xLastPauseDate?: string | null;
}

const RESOLVED_STATES = ["resolved", "closed"];

export default function CompactSlaBadge({
  type = "resolution",
  slaDeadline,
  slaStatus,
  priority,
  state,
  dateResolved,
  xLastPauseDate,
}: CompactSlaBadgeProps) {
  const isResolved = RESOLVED_STATES.includes(state);
  const isResPaused = ["waiting", "waiting_material", "blocked", "escalated"].includes(state);

  const [now, setNow] = useState<Date>(() => {
    if (isResPaused && xLastPauseDate) {
      const frozen = toUTC(xLastPauseDate);
      if (frozen) return frozen;
    }
    return new Date();
  });

  useEffect(() => {
    if (isResolved || isResPaused) return;
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, [isResolved, isResPaused]);

  useEffect(() => {
    if (isResPaused) {
      const frozen = (xLastPauseDate ? toUTC(xLastPauseDate) : null) ?? new Date();
      setNow(frozen);
    } else if (!isResolved) {
      setNow(new Date());
    }
  }, [state, xLastPauseDate, isResolved]);

  const resDeadline = toUTC(slaDeadline);
  const hasResSla = !!resDeadline;
  
  if (!hasResSla) return null;

  const resBreached = slaStatus === "breached";
  const resRisk = slaStatus === "at_risk";
  const resMet = slaStatus === "met";

  let resLabel = "--";
  if (resDeadline) {
    const hoursMap = type === "response" ? SLA_RESPONSE_HOURS : SLA_RESOLUTION_HOURS;
    const totalMin = (hoursMap[priority] ?? 24) * 60;
    const start = new Date(resDeadline.getTime() - totalMin * 60_000);
    const evalAt = isResolved && dateResolved
      ? toUTC(dateResolved)! 
      : isResPaused && xLastPauseDate
      ? toUTC(xLastPauseDate)!
      : now;
    
    const elapsed = (evalAt.getTime() - start.getTime()) / 60_000;
    const remaining = totalMin - elapsed;

    resLabel = resBreached
      ? `-${formatDuration(-remaining)}`
      : formatDuration(remaining);
  }

  // Style Glassmorphism
  let badgeClass = "bg-emerald-500/5 text-emerald-400 border border-emerald-500/10";
  let label = isResPaused ? "PAUSE" : resMet ? "RÉSOLU" : `${resLabel} RESTANT`;
  
  if (resBreached && !resMet) {
    badgeClass = "bg-rose-500/10 text-rose-500 border border-rose-500/20";
    label = `${resLabel} RETARD`;
  } else if (resRisk && !resMet) {
    badgeClass = "bg-amber-500/10 text-amber-500 border border-amber-500/20";
  }

  if (isResPaused) {
    badgeClass = "bg-zinc-500/10 text-zinc-400 border border-zinc-500/20";
  }

  return (
    <div className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md ${badgeClass}`}>
      {resMet ? (
        <CheckCircle2 size={12} />
      ) : (
        <Timer size={12} />
      )}
      <span className="text-[10px] font-black uppercase tracking-wider">{label}</span>
    </div>
  );
}
