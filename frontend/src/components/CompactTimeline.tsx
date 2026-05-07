"use client";

import { Calendar, Target, CheckCircle2 } from "lucide-react";
import { useState } from "react";

interface CompactTimelineProps {
  createDate?: string | null;
  slaDeadline?: string | null;       // Used for tickets view (resolution SLA)
  slaResponseDeadline?: string | null; // Used for queue view (response SLA)
  slaStatus?: string | null;
  slaResponseStatus?: string | null;
  dateResolved?: string | null;
  state?: string;
}

function fmt(dateStr: string): { datePart: string; timePart: string } {
  const d = new Date(dateStr.includes("T") ? dateStr : dateStr.replace(" ", "T") + "Z");
  const datePart = d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" });
  const timePart = d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  return { datePart, timePart };
}

function isSameDay(a: string, b: string): boolean {
  const da = new Date(a.includes("T") ? a : a.replace(" ", "T") + "Z");
  const db = new Date(b.includes("T") ? b : b.replace(" ", "T") + "Z");
  return (
    da.getFullYear() === db.getFullYear() &&
    da.getMonth() === db.getMonth() &&
    da.getDate() === db.getDate()
  );
}

function processingTime(createDate: string, resolvedDate: string): string {
  const start = new Date(createDate.includes("T") ? createDate : createDate.replace(" ", "T") + "Z").getTime();
  const end = new Date(resolvedDate.includes("T") ? resolvedDate : resolvedDate.replace(" ", "T") + "Z").getTime();
  const diffMs = Math.max(0, end - start);
  const totalMins = Math.floor(diffMs / 60000);
  const hours = Math.floor(totalMins / 60);
  const mins = totalMins % 60;
  if (hours === 0) return `${mins}m`;
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}m`;
}

export default function CompactTimeline({
  createDate,
  slaDeadline,
  slaResponseDeadline,
  slaStatus,
  slaResponseStatus,
  dateResolved,
  state,
}: CompactTimelineProps) {
  const [showTooltip, setShowTooltip] = useState(false);

  if (!createDate) return null;

  const isResolved = state === "resolved" || state === "closed";
  // The effective deadline to show (prefer response deadline in queue, resolution in tickets)
  const deadline = slaResponseDeadline || slaDeadline;
  const effectiveStatus = slaResponseDeadline ? slaResponseStatus : slaStatus;

  const created = fmt(createDate);

  const deadlineColorClass =
    effectiveStatus === "breached"
      ? "text-red-500 font-bold"
      : effectiveStatus === "at_risk"
      ? "text-orange-400 font-bold"
      : "text-[hsl(var(--foreground)/0.85)] font-medium";

  return (
    <div className="inline-flex items-center gap-1 text-[11px] bg-[hsl(var(--muted)/0.3)] px-2 py-1 rounded-md border border-[hsl(var(--border)/0.4)] font-mono">
      {/* Creation date — always shown */}
      <Calendar className="w-3 h-3 text-muted-foreground flex-shrink-0" />
      <span className="text-muted-foreground">
        {created.datePart} {created.timePart}
      </span>

      {isResolved && dateResolved ? (
        /* ── Resolved mode: show resolution date in green ── */
        <>
          <span className="mx-0.5 text-muted-foreground/40">·</span>
          <span
            className="relative inline-flex items-center gap-0.5 cursor-default"
            onMouseEnter={() => setShowTooltip(true)}
            onMouseLeave={() => setShowTooltip(false)}
          >
            <CheckCircle2 className="w-3 h-3 text-emerald-500 flex-shrink-0" />
            <span className="text-emerald-500 font-semibold">
              {isSameDay(createDate, dateResolved)
                ? fmt(dateResolved).timePart           // same day → time only
                : `${fmt(dateResolved).datePart} ${fmt(dateResolved).timePart}`}
            </span>

            {/* Tooltip — processing time */}
            {showTooltip && (
              <span className="absolute bottom-[calc(100%+4px)] left-1/2 -translate-x-1/2 z-50 whitespace-nowrap rounded-md bg-[hsl(var(--popover))] border border-[hsl(var(--border))] text-[hsl(var(--popover-foreground))] px-2.5 py-1 text-[10px] shadow-xl font-sans font-medium pointer-events-none">
                Traité en {processingTime(createDate, dateResolved)}
              </span>
            )}
          </span>
        </>
      ) : (
        /* ── Active mode: show SLA deadline ── */
        deadline && (
          <>
            <span className="mx-0.5 text-muted-foreground/40">→</span>
            <Target className="w-3 h-3 text-muted-foreground/60 flex-shrink-0" />
            <span className={deadlineColorClass}>
              {(() => {
                const d = fmt(deadline);
                return isSameDay(createDate, deadline)
                  ? d.timePart
                  : `${d.datePart} ${d.timePart}`;
              })()}
            </span>
          </>
        )
      )}
    </div>
  );
}
