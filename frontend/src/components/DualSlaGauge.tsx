"use client";

import { useState, useEffect } from "react";
import { CheckCircle2 } from "lucide-react";

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

// ─── Helpers ──────────────────────────────────────────────────────────────────
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
  const s = Math.round((absMin * 60) % 60);

  if (absMin >= 24 * 60) {
    return h > 0 ? `${d}j ${h}h` : `${d}j`;
  } else if (absMin >= 60) {
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  } else {
    return s > 0 ? `${m}m ${s}s` : `${m}m`;
  }
}

// ─── Glow keyframes injected once ─────────────────────────────────────────────
const DUAL_GAUGE_STYLE = `
@keyframes dual-sla-pulse {
  0%, 100% { opacity: 1; }
  50%       { opacity: 0.55; }
}
.dual-sla-breached { animation: dual-sla-pulse 2s ease-in-out infinite; }
`;

// ─── Single arc gauge ─────────────────────────────────────────────────────────
interface ArcProps {
  pct: number;       // 0–1 elapsed
  isBreached: boolean;
  isAtRisk: boolean;
  isMet: boolean;    // SLA respected (final state)
  label: string;
  size: number;
  title: string;
}

function SlaArc({ pct, isBreached, isAtRisk, isMet, label, size, title }: ArcProps) {
  const sw = 5;
  const r = (size - sw) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - Math.min(pct, 1));

  const color = isMet
    ? "#4ade80"
    : isBreached
    ? "#ef4444"
    : isAtRisk
    ? "#fbbf24"
    : "#4ade80";

  const glow = isMet
    ? "rgba(74,222,128,0.35)"
    : isBreached
    ? "rgba(239,68,68,0.45)"
    : isAtRisk
    ? "rgba(251,191,36,0.40)"
    : "rgba(74,222,128,0.35)";

  const textColor = color;
  const filterId = `gf-${Math.random().toString(36).slice(2, 6)}`;

  const labelLen = label.length;
  let fontSize = size * 0.18;
  if (labelLen <= 3) fontSize = size * 0.28;
  else if (labelLen <= 5) fontSize = size * 0.22;
  else if (labelLen <= 7) fontSize = size * 0.18;
  else fontSize = size * 0.15;

  return (
    <div
      className="relative flex-shrink-0"
      style={{ width: size, height: size }}
      title={title}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        style={{ transform: "rotate(-90deg)", overflow: "visible" }}
      >
        <defs>
          <filter id={filterId} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="2.5" result="blur" />
            <feFlood floodColor={glow} result="color" />
            <feComposite in="color" in2="blur" operator="in" result="glow" />
            <feMerge>
              <feMergeNode in="glow" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        {/* Track */}
        <circle
          cx={size / 2} cy={size / 2} r={r}
          fill="none" stroke="currentColor" strokeWidth={sw}
          className="text-[hsl(var(--border)/0.4)]"
        />
        {/* Arc */}
        <circle
          cx={size / 2} cy={size / 2} r={r}
          fill="none"
          stroke={color}
          strokeWidth={sw}
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={isMet ? 0 : offset}
          filter={`url(#${filterId})`}
          style={{ transition: "stroke-dashoffset 0.7s ease, stroke 0.4s ease" }}
          className={isBreached && !isMet ? "dual-sla-breached" : undefined}
        />
      </svg>
      {/* Centre label */}
      <div className="absolute inset-0 flex items-center justify-center">
        {isMet ? (
          <CheckCircle2
            size={size * 0.32}
            style={{ color: "#4ade80" }}
            strokeWidth={2.5}
          />
        ) : (
          <span
            className="font-bold tabular-nums leading-none select-none text-center flex items-center justify-center w-full px-1"
            style={{ fontSize, color: textColor, letterSpacing: "-0.5px" }}
          >
            {label}
          </span>
        )}
      </div>
    </div>
  );
}

// ─── Props ────────────────────────────────────────────────────────────────────
export interface DualSlaGaugeProps {
  // SLA Résolution
  slaDeadline: string | null;
  slaStatus: string | null;
  priority: string;
  state: string;
  // SLA Réponse (v2)
  slaResponseDeadline?: string | null;
  slaResponseStatus?: string | null;
  dateFirstAssigned?: string | null;
  dateResolved?: string | null;
  /** Outer diameter in px — default 64 per gauge */
  size?: number;
}

const RESOLVED_STATES = ["resolved", "closed"];

// ─── Main component ───────────────────────────────────────────────────────────
export default function DualSlaGauge({
  slaDeadline,
  slaStatus,
  priority,
  state,
  slaResponseDeadline,
  slaResponseStatus,
  dateFirstAssigned,
  dateResolved,
  size = 68,
}: DualSlaGaugeProps) {
  const [now, setNow] = useState<Date>(() => new Date());
  const isResolved = RESOLVED_STATES.includes(state);

  // Inject keyframes once
  useEffect(() => {
    if (document.getElementById("dual-sla-gauge-style")) return;
    const el = document.createElement("style");
    el.id = "dual-sla-gauge-style";
    el.textContent = DUAL_GAUGE_STYLE;
    document.head.appendChild(el);
  }, []);

  // Tick every 60s for active tickets
  useEffect(() => {
    if (isResolved) return;
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, [isResolved]);

  // ── Resolution SLA maths ─────────────────────────────────────────────────
  const resDeadline = toUTC(slaDeadline);
  const hasResSla = !!resDeadline;
  let resPct = 0, resLabel = "--", resBreached = false, resRisk = false;
  let resMet = slaStatus === "met";

  if (hasResSla && resDeadline) {
    const totalMin = (SLA_RESOLUTION_HOURS[priority] ?? 24) * 60;
    const start = new Date(resDeadline.getTime() - totalMin * 60_000);
    const evalAt = isResolved && dateResolved
      ? toUTC(dateResolved)! 
      : now;
    const elapsed = (evalAt.getTime() - start.getTime()) / 60_000;
    const remaining = totalMin - elapsed;

    resPct = Math.min(Math.max(elapsed / totalMin, 0), 1);
    resBreached = slaStatus === "breached";
    resRisk = slaStatus === "at_risk";
    resLabel = resBreached
      ? `+${formatDuration(-remaining)}`
      : formatDuration(remaining);
  }

  // ── Response SLA maths ───────────────────────────────────────────────────
  const respDeadline = toUTC(slaResponseDeadline ?? null);
  const hasRespSla = !!respDeadline;
  let respPct = 0, respLabel = "--", respBreached = false, respRisk = false;
  const respMet = slaResponseStatus === "met";

  if (hasRespSla && respDeadline) {
    const totalMin = (SLA_RESPONSE_HOURS[priority] ?? 4) * 60;
    const start = new Date(respDeadline.getTime() - totalMin * 60_000);
    const evalAt = dateFirstAssigned ? toUTC(dateFirstAssigned)! : now;
    const elapsed = (evalAt.getTime() - start.getTime()) / 60_000;
    const remaining = totalMin - elapsed;

    respPct = Math.min(Math.max(elapsed / totalMin, 0), 1);
    respBreached = slaResponseStatus === "breached";
    respRisk = slaResponseStatus === "at_risk";
    respLabel = respBreached
      ? `+${formatDuration(-remaining)}`
      : formatDuration(remaining);
  }

  // If no SLA data at all — render nothing
  if (!hasResSla && !hasRespSla) return null;

  return (
    <div className="flex flex-col items-center gap-2">
      {/* Response gauge (only shown if data available) */}
      {hasRespSla && (
        <div className="flex flex-col items-center gap-0.5">
          <SlaArc
            pct={respPct}
            isBreached={respBreached}
            isAtRisk={respRisk}
            isMet={respMet}
            label={respLabel}
            size={size * 0.78}
            title={
              respMet
                ? "SLA Réponse respecté ✓"
                : respBreached
                ? `SLA Réponse dépassé de ${respLabel.replace("+", "")}`
                : `Réponse — ${respLabel} restant`
            }
          />
        </div>
      )}

      {/* Resolution gauge */}
      {hasResSla && (
        <div className="flex flex-col items-center gap-0.5">
          <SlaArc
            pct={resPct}
            isBreached={resBreached}
            isAtRisk={resRisk}
            isMet={resMet}
            label={resLabel}
            size={size}
            title={
              resMet
                ? "SLA Résolution respecté ✓"
                : resBreached
                ? `SLA dépassé de ${resLabel.replace("+", "")}`
                : resRisk
                ? `À risque — ${resLabel} restant`
                : `${resLabel} restant`
            }
          />
        </div>
      )}
    </div>
  );
}
