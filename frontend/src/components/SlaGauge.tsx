"use client";

import { useState, useEffect } from "react";

// ─── SLA total window per priority ────────────────────────────────────────────
const SLA_HOURS: Record<string, number> = {
  "3": 2,   // Critique
  "2": 8,   // Haute
  "1": 24,  // Moyenne
  "0": 48,  // Basse
};

// ─── Format duration helper ───────────────────────────────────────────────────
function formatDuration(totalMinutes: number): string {
  const abs = Math.abs(totalMinutes);
  const h = Math.floor(abs / 60);
  const m = Math.round(abs % 60);
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

// ─── Props ────────────────────────────────────────────────────────────────────
interface SlaGaugeProps {
  slaDeadline: string | null;
  priority: string;
  state: string;
  /** Outer diameter in px — default 72 */
  size?: number;
}

const RESOLVED_STATES = ["resolved", "closed"];

// ─── Glow keyframes (injected once into <head>) ────────────────────────────────
const GAUGE_STYLE = `
@keyframes sla-pulse {
  0%, 100% { opacity: 1; }
  50%       { opacity: 0.65; }
}
.sla-breached-arc { animation: sla-pulse 2s ease-in-out infinite; }
`;

// ─── Component ────────────────────────────────────────────────────────────────
export default function SlaGauge({
  slaDeadline,
  priority,
  state,
  size = 72,
}: SlaGaugeProps) {
  const [now, setNow] = useState<Date>(() => new Date());
  const isResolved = RESOLVED_STATES.includes(state);

  // Inject keyframes once
  useEffect(() => {
    if (document.getElementById("sla-gauge-style")) return;
    const el = document.createElement("style");
    el.id = "sla-gauge-style";
    el.textContent = GAUGE_STYLE;
    document.head.appendChild(el);
  }, []);

  // Tick every 60 s for active tickets
  useEffect(() => {
    if (isResolved) return;
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, [isResolved]);

  if (!slaDeadline || isResolved) return null;

  // Parse deadline (Odoo returns UTC without "Z")
  const deadlineRaw = slaDeadline.includes("Z") ? slaDeadline : slaDeadline + "Z";
  const deadline = new Date(deadlineRaw);
  if (isNaN(deadline.getTime())) return null;

  // ── Maths ─────────────────────────────────────────────────────────────────
  const totalMinutes = (SLA_HOURS[priority] ?? 24) * 60;
  const start = new Date(deadline.getTime() - totalMinutes * 60_000);
  const elapsed = (now.getTime() - start.getTime()) / 60_000;
  const remaining = totalMinutes - elapsed;

  const rawPct = Math.min(Math.max(elapsed / totalMinutes, 0), 1);
  const isBreached = remaining < 0;
  const isAtRisk = !isBreached && remaining <= 60;

  // ── Colours ───────────────────────────────────────────────────────────────
  //   green-400 / amber-400 / red-500
  const color = isBreached ? "#ef4444" : isAtRisk ? "#fbbf24" : "#4ade80";
  const glowColor = isBreached
    ? "rgba(239,68,68,0.45)"
    : isAtRisk
    ? "rgba(251,191,36,0.40)"
    : "rgba(74,222,128,0.35)";
  const textColor = isBreached
    ? "#ef4444"
    : isAtRisk
    ? "#fbbf24"
    : "#4ade80";

  // ── SVG ───────────────────────────────────────────────────────────────────
  const strokeW = 5;
  const r = (size - strokeW) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - rawPct); // stroke-dashoffset

  // ── Label ─────────────────────────────────────────────────────────────────
  const label = isBreached
    ? `+${formatDuration(-remaining)}`
    : formatDuration(remaining);

  // Dynamic font-size so longer strings fit inside the circle
  const labelLen = label.length;
  const labelSize = labelLen <= 4 ? size * 0.22 : labelLen <= 6 ? size * 0.18 : size * 0.14;

  // ── Filter id (unique per instance) ──────────────────────────────────────
  const filterId = `glow-${priority}-${isBreached ? "b" : isAtRisk ? "r" : "g"}`;

  return (
    <div
      className="flex-shrink-0 relative"
      style={{ width: size, height: size }}
      title={
        isBreached
          ? `SLA dépassé de ${formatDuration(-remaining)}`
          : `${isAtRisk ? "À risque" : "Dans les temps"} — ${formatDuration(remaining)} restant(s)`
      }
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        style={{ transform: "rotate(-90deg)", overflow: "visible" }}
      >
        <defs>
          {/* Glow filter */}
          <filter id={filterId} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="2.5" result="blur" />
            <feFlood floodColor={glowColor} result="color" />
            <feComposite in="color" in2="blur" operator="in" result="glow" />
            <feMerge>
              <feMergeNode in="glow" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Track ring — very subtle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeW}
          className="text-[hsl(var(--border)/0.4)]"
        />

        {/* Progress arc */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={strokeW}
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={offset}
          filter={`url(#${filterId})`}
          style={{
            transition: "stroke-dashoffset 0.7s ease, stroke 0.4s ease",
          }}
          className={isBreached ? "sla-breached-arc" : undefined}
        />
      </svg>

      {/* Centre label — rotated back to normal reading direction */}
      <div
        className="absolute inset-0 flex items-center justify-center"
        style={{ transform: "rotate(0deg)" }}
      >
        <span
          className="font-bold tabular-nums leading-none select-none"
          style={{ fontSize: labelSize, color: textColor }}
        >
          {label}
        </span>
      </div>
    </div>
  );
}
