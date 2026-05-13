"use client";

import { useState, useEffect } from "react";
import { Timer, CheckCircle2 } from "lucide-react";

// ─── SLA windows per priority ─────────────────────────────────────────────────
const SLA_RESOLUTION_HOURS: Record<string, number> = {
  "3": 2,   // Critique
  "2": 8,   // Haute
  "1": 24,  // Moyenne
  "0": 48,  // Basse
};

const SLA_RESPONSE_HOURS: Record<string, number> = {
  "3": 0.5, // Critique  → 30 min
  "2": 1,   // Haute     → 1h
  "1": 4,   // Moyenne   → 4h
  "0": 8,   // Basse     → 8h
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

export interface LinearSlaBarProps {
  type?: "resolution" | "response";
  slaDeadline: string | null;
  slaStatus: string | null;
  priority: string;
  state: string;
  dateResolved?: string | null;
  xLastPauseDate?: string | null;
}

const RESOLVED_STATES = ["resolved", "closed"];

export default function LinearSlaBar({
  type = "resolution",
  slaDeadline,
  slaStatus,
  priority,
  state,
  dateResolved,
  xLastPauseDate,
}: LinearSlaBarProps) {
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

  let resPct = 0;
  let resLabel = "--";
  const resBreached = slaStatus === "breached";
  const resRisk = slaStatus === "at_risk";
  const resMet = slaStatus === "met";

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

    resPct = Math.min(Math.max(elapsed / totalMin, 0), 1);
    resLabel = resBreached
      ? `+${formatDuration(-remaining)}`
      : formatDuration(remaining);
  }

  // Couleurs dynamiques et Largeur
  let fillColorClass = "bg-emerald-500";
  let textColorClass = "text-emerald-400";
  let barWidth = Math.max(0, Math.min(100, resPct * 100));

  if (isResolved || resMet) {
    fillColorClass = "bg-emerald-500";
    textColorClass = "text-emerald-500";
    barWidth = 100;
  } else if (resBreached) {
    fillColorClass = "bg-rose-500";
    textColorClass = "text-rose-500";
    barWidth = 100;
  } else if (isResPaused) {
    fillColorClass = "bg-zinc-500";
    textColorClass = "text-zinc-400";
  } else if (resRisk) {
    fillColorClass = "bg-amber-500";
    textColorClass = "text-amber-500";
  }

  return (
    <div className="w-full flex flex-col gap-1.5 mt-auto mb-2 pt-2">
      {/* Badge de Temps */}
      <div className="flex items-center justify-between w-full">
        <span className="text-[10px] font-bold tracking-tight text-[hsl(var(--foreground))/0.9] flex items-center">
          {resMet ? (
            <CheckCircle2 size={12} className="inline mr-1 text-emerald-500" />
          ) : (
            <Timer size={12} className="inline mr-1 opacity-70" />
          )}
          {isResPaused ? "PAUSE" : resMet ? "RÉSOLU" : `${resLabel} restant`}
        </span>
        <span className={`text-[9px] font-black tracking-widest uppercase ${textColorClass}`}>
          {isResPaused ? "Suspendu" : resBreached && !resMet ? "Dépassé" : resRisk && !resMet ? "À risque" : "Dans les temps"}
        </span>
      </div>

      {/* Barre de Progression */}
      <div className="h-1 w-full bg-zinc-800 rounded-full overflow-hidden">
        <div 
          className={`h-full rounded-full transition-all duration-500 ${fillColorClass}`}
          style={{ width: `${barWidth}%` }}
        />
      </div>
    </div>
  );
}
