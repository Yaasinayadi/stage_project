"use client";

import { useState, useEffect } from "react";
import {
  Globe, Key, Laptop, HardDrive, Mail, Server, AlertCircle,
  User, Clock, Timer, PauseCircle, CheckCircle2, Calendar, ArrowRight, ChevronRight,
} from "lucide-react";
import TicketDetailsModal from "./TicketDetailsModal";

// ─── Types ────────────────────────────────────────────────────────────────────
type Ticket = {
  id: number;
  name: string;
  description: string;
  state: string;
  priority: string;
  category: string;
  assigned_to?: string | null;
  create_date?: string | null;
  write_date?: string | null;
  sla_deadline?: string | null;
  sla_status?: string | null;
  date_resolved?: string | null;
  sla_response_deadline?: string | null;
  sla_response_status?: string | null;
  x_last_pause_date?: string | null;
  user_name?: string | null;
  assigned_to_id?: number | string | null;
  x_accepted?: boolean;
  [key: string]: any;
};

type TicketCardProps = {
  ticket: Ticket;
  index: number;
  onRefresh?: () => void;
  onClickOverride?: (e: React.MouseEvent) => void;
  actions?: React.ReactNode;
  footerLeftOverride?: React.ReactNode;
  showSlaResponse?: boolean;
  timelineLarge?: boolean;
};

// ─── SLA Config ───────────────────────────────────────────────────────────────
const SLA_RESOLUTION_HOURS: Record<string, number> = { "3": 2, "2": 8, "1": 24, "0": 48 };
const SLA_RESPONSE_HOURS: Record<string, number>   = { "3": 0.5, "2": 1, "1": 4, "0": 8 };
const RESOLVED_STATES = ["resolved", "closed"];
const PAUSED_STATES   = ["waiting", "waiting_material", "blocked", "escalated"];

// ─── Helpers ──────────────────────────────────────────────────────────────────
function toUTC(raw: string | null | undefined): Date | null {
  if (!raw) return null;
  const s = raw.includes("Z") ? raw : raw + "Z";
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

function formatDuration(min: number): string {
  const a = Math.abs(min);
  const d = Math.floor(a / 1440);
  const h = Math.floor((a % 1440) / 60);
  const m = Math.floor(a % 60);
  if (a >= 1440) return h > 0 ? `${d}j ${h}h` : `${d}j`;
  if (a >= 60)   return m > 0 ? `${h}h ${m}m` : `${h}h`;
  return `${m}m`;
}

function getCategoryIcon(cat: string, size = 16) {
  if (!cat) return <AlertCircle size={size} />;
  const l = cat.toLowerCase();
  if (l.includes("réseau"))         return <Globe size={size} />;
  if (l.includes("accès"))          return <Key size={size} />;
  if (l.includes("logiciel"))       return <Laptop size={size} />;
  if (l.includes("matériel"))       return <HardDrive size={size} />;
  if (l.includes("messagerie"))     return <Mail size={size} />;
  if (l.includes("infrastructure")) return <Server size={size} />;
  return <AlertCircle size={size} />;
}

function getCategoryColor(cat: string): string {
  if (!cat) return "#71717a";
  const l = cat.toLowerCase();
  if (l.includes("réseau"))         return "#6366f1";
  if (l.includes("accès"))          return "#f59e0b";
  if (l.includes("logiciel"))       return "#8b5cf6";
  if (l.includes("matériel"))       return "#10b981";
  if (l.includes("messagerie"))     return "#ec4899";
  if (l.includes("infrastructure")) return "#06b6d4";
  return "#71717a";
}

function getPriorityBadge(prio: string) {
  const map: Record<string, { label: string; cls: string }> = {
    "3": { label: "Critique", cls: "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-500/10 dark:text-rose-500 dark:border-rose-500/20" },
    "2": { label: "Haute",    cls: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-500 dark:border-amber-500/20" },
    "1": { label: "Moyenne",  cls: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-500/10 dark:text-blue-500 dark:border-blue-500/20" },
  };
  const { label, cls } = map[prio] ?? { label: "Basse", cls: "bg-[hsl(var(--muted)/0.5)] text-[hsl(var(--muted-foreground))] border-[hsl(var(--border)/0.5)]" };
  return <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-widest border ${cls}`}>{label}</span>;
}

function getStatusInfo(state: string): { label: string; colors: string; dotClass: string } {
  const s = (state || "").toLowerCase();
  if (s.includes("nouveau") || s.includes("new"))
    return { label: "Nouveau",         dotClass: "new", colors: "bg-[hsl(var(--muted)/0.5)] text-[hsl(var(--muted-foreground))] border-[hsl(var(--border)/0.5)]" };
  if (s.includes("assigné") || s.includes("assigned"))
    return { label: "Assigné",         dotClass: "assigned", colors: "bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-500/10 dark:text-indigo-400 dark:border-indigo-500/20" };
  if (s.includes("cours") || s.includes("progress"))
    return { label: "En cours",        dotClass: "in_progress", colors: "bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-500/10 dark:text-sky-400 dark:border-sky-500/20" };
  if (s === "waiting_material" || s.includes("matériel") || s.includes("material"))
    return { label: "Attente matériel",dotClass: "waiting_material", colors: "bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-600/10 dark:text-orange-500 dark:border-orange-600/20" };
  if (s.includes("attente") || s.includes("waiting"))
    return { label: "En attente",      dotClass: "waiting", colors: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-500 dark:border-amber-500/20" };
  if (s.includes("escaladé") || s.includes("escalated"))
    return { label: "Escaladé",        dotClass: "escalated", colors: "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-600/10 dark:text-purple-400 dark:border-purple-600/20" };
  if (s.includes("résolu") || s.includes("resolved") || s.includes("done") || s.includes("closed"))
    return { label: "Résolu",          dotClass: "resolved", colors: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20" };
  return { label: state || "Nouveau",  dotClass: "new", colors: "bg-[hsl(var(--muted)/0.5)] text-[hsl(var(--muted-foreground))] border-[hsl(var(--border)/0.5)]" };
}

export function formatTicketRef(id: number | undefined): string {
  if (!id) return "";
  return `TK-${String(id).padStart(4, "0")}`;
}

function getAgentInitials(name: string): string {
  const p = name.trim().split(" ").filter(Boolean);
  if (!p.length) return "?";
  if (p.length === 1) return p[0][0].toUpperCase();
  return (p[0][0] + p[p.length - 1][0]).toUpperCase();
}

function getAgentColor(name: string): string {
  const palette = ["#6366f1","#8b5cf6","#ec4899","#10b981","#f59e0b","#06b6d4","#3b82f6","#ef4444"];
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return palette[Math.abs(h) % palette.length];
}

// ─── SLA Battery Segments ─────────────────────────────────────────────────────
const TOTAL_SEGS = 8;

function SlaSegments({
  slaDeadline, slaStatus, priority, state, dateResolved, xLastPauseDate, createDate,
  type = "resolution",
}: {
  slaDeadline: string | null; slaStatus: string | null;
  priority: string; state: string;
  dateResolved?: string | null; xLastPauseDate?: string | null; createDate?: string | null;
  type?: "resolution" | "response";
}) {
  const isResolved = RESOLVED_STATES.includes(state);
  const isPaused   = PAUSED_STATES.includes(state);

  const [now, setNow] = useState<Date>(() => {
    if (isPaused && xLastPauseDate) { const f = toUTC(xLastPauseDate); if (f) return f; }
    return new Date();
  });

  useEffect(() => {
    if (isResolved || isPaused) return;
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, [isResolved, isPaused]);

  useEffect(() => {
    if (isPaused) setNow((xLastPauseDate ? toUTC(xLastPauseDate) : null) ?? new Date());
    else if (!isResolved) setNow(new Date());
  }, [state, xLastPauseDate, isResolved, isPaused]);

  const deadline = toUTC(slaDeadline);
  const start = toUTC(createDate);
  if (!deadline || !start) return null;

  const evalAt = isResolved && dateResolved ? toUTC(dateResolved)!
               : isPaused && xLastPauseDate  ? toUTC(xLastPauseDate)!
               : now;

  const timeElapsed = Math.max(0, (evalAt.getTime() - start.getTime()) / 60_000);
  const totalSlaTime = Math.max(1, (deadline.getTime() - start.getTime()) / 60_000);

  const usagePercentage = (timeElapsed / totalSlaTime) * 100;
  const activeSegments = Math.min(TOTAL_SEGS, Math.ceil(usagePercentage / 12.5));

  const isBreached = usagePercentage >= 100 || slaStatus === "overdue" || slaStatus === "breached";
  const remaining = totalSlaTime - timeElapsed;
  const isMet = isResolved;

  let theme: { color: string; glow: string; textCls: string; tagCls: string; filledCount: number; animateCls?: string };

  if (isBreached) {
    theme = { 
      color: "#f43f5e", glow: "0 0 8px rgba(244,63,94,0.8)", 
      textCls: "text-rose-600 dark:text-rose-400", tagCls: "text-rose-600 dark:text-rose-400",
      filledCount: TOTAL_SEGS
    };
  } else if (isPaused) {
    theme = { 
      color: "#0ea5e9", glow: "0 0 8px rgba(14,165,233,0.8)", 
      textCls: "text-sky-500 dark:text-sky-400", tagCls: "text-sky-500 dark:text-sky-400",
      filledCount: activeSegments,
      animateCls: "animate-pulse"
    };
  } else {
    // ACTIVE
    let color, glow, textCls, tagCls;
    if (usagePercentage < 50) {
      color = "#10b981"; glow = "0 0 8px rgba(16,185,129,0.8)"; // emerald
      textCls = "text-emerald-600 dark:text-emerald-400"; tagCls = "text-emerald-600 dark:text-emerald-400";
    } else if (usagePercentage <= 80) {
      color = "#eab308"; glow = "0 0 8px rgba(234,179,8,0.8)"; // yellow
      textCls = "text-yellow-600 dark:text-yellow-400"; tagCls = "text-yellow-600 dark:text-yellow-400";
    } else {
      color = "#d97706"; glow = "0 0 8px rgba(217,119,6,0.8)"; // amber-600
      textCls = "text-amber-600 dark:text-amber-500"; tagCls = "text-amber-600 dark:text-amber-500";
    }
    theme = { color, glow, textCls, tagCls, filledCount: activeSegments };
  }

  const timeLabel = isResolved ? "Résolu"
    : isPaused   ? "PAUSE"
    : isBreached ? `+${formatDuration(-remaining)}`
    : `${formatDuration(remaining)} restant`;

  const statusTag = (isResolved && isBreached) ? "Dépassé"
    : isResolved ? "Dans les temps"
    : isPaused   ? "Suspendu"
    : isBreached ? "Dépassé"
    : usagePercentage > 80 ? "À risque"
    : "Dans les temps";

  const Icon = isMet ? CheckCircle2 : isPaused ? PauseCircle : Timer;

  return (
    <div className="flex items-center justify-between w-full px-4 py-3 rounded-xl bg-[hsl(var(--card))] border border-[hsl(var(--border)/0.6)] shadow-sm hover:border-[hsl(var(--primary)/0.2)] transition-colors group/sla">
      
      {/* Left: Glow Dot + Texts */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <div className="relative flex items-center justify-center">
            <span className={`w-2 h-2 rounded-full z-10 ${isPaused ? "animate-pulse" : ""}`} style={{ backgroundColor: theme.color }} />
            <span className="absolute inset-0 w-2 h-2 rounded-full animate-ping opacity-75" style={{ backgroundColor: theme.color, animationDuration: '3s' }} />
          </div>
          <span className={`text-[10px] font-black uppercase tracking-widest ${theme.tagCls}`}>
            SLA {statusTag}
          </span>
        </div>
        <span className="text-[11px] font-bold text-[hsl(var(--foreground)/0.85)] ml-4">
          {timeLabel}
        </span>
      </div>

      {/* Right: Modern Circular Gauge with centered Icon */}
      <div className="relative flex items-center justify-center w-10 h-10 group-hover/sla:scale-105 transition-transform duration-300">
        <svg className="absolute inset-0 w-full h-full transform -rotate-90 overflow-visible" viewBox="0 0 36 36">
          {/* Subtle background track */}
          <circle 
            cx="18" cy="18" r="15" 
            fill="transparent" 
            stroke="currentColor" 
            strokeWidth="2.5" 
            className="text-[hsl(var(--muted-foreground)/0.15)]" 
          />
          {/* Glowing Progress */}
          <circle
            cx="18" cy="18" r="15"
            fill="transparent"
            stroke={theme.color}
            strokeWidth="2.5"
            strokeDasharray={94.247}
            strokeDashoffset={94.247 - (Math.min(usagePercentage, 100) / 100) * 94.247}
            strokeLinecap="round"
            className={`transition-all duration-1000 ease-out ${theme.animateCls || ""}`}
            style={{ filter: `drop-shadow(0 0 3px ${theme.color})` }}
          />
        </svg>
        {/* Centered Icon */}
        <div className={`relative z-10 ${theme.textCls} flex items-center justify-center`}>
          <Icon size={14} strokeWidth={2.5} />
        </div>
      </div>
    </div>
  );
}

// ─── Main Card ────────────────────────────────────────────────────────────────
export default function TicketCard({
  ticket, index, onRefresh, onClickOverride,
  actions, footerLeftOverride, showSlaResponse, timelineLarge,
}: TicketCardProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const catColor = getCategoryColor(ticket.category);
  const status   = getStatusInfo(ticket.state);

  return (
    <>
      <div
        className="glass-card h-full p-5 cursor-pointer group animate-fade-in flex flex-col gap-4"
        style={{ animationDelay: `${index * 60}ms` }}
        onClick={(e) => { if (onClickOverride) onClickOverride(e); else setIsModalOpen(true); }}
      >

        {/* ── Row 1: icon / ID / badges ─── */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div
              className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: `${catColor}18`, color: catColor }}
            >
              {getCategoryIcon(ticket.category, 18)}
            </div>
            <span className="text-[10px] font-mono font-semibold text-[hsl(var(--muted-foreground))] bg-[hsl(var(--muted)/0.5)] border border-[hsl(var(--border)/0.4)] px-2 py-0.5 rounded-md whitespace-nowrap">
              {formatTicketRef(ticket.id)}
            </span>
          </div>
          <div className="flex items-center gap-1.5 flex-wrap justify-end">
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded text-[9px] font-black uppercase tracking-widest border ${status.colors}`}>
              {status.label}
            </span>
            {getPriorityBadge(ticket.priority)}
          </div>
        </div>

        {/* ── Row 2: title ─── */}
        <div className="flex flex-col gap-1.5">
          <h3 className="h-[2.5rem] text-sm font-bold text-[hsl(var(--foreground))] tracking-tight leading-snug line-clamp-2 group-hover:text-[hsl(var(--primary))] transition-colors duration-200">
            {ticket.name}
          </h3>
          <p className="h-[2.5rem] text-[11px] text-[hsl(var(--muted-foreground))] leading-relaxed line-clamp-2">
            {ticket.description}
          </p>
        </div>

        {/* ── Bottom Section (pushed to bottom) ─── */}
        <div className="mt-auto flex flex-col gap-4">
          {/* ── SLA Battery (full-width) ─── */}
        <SlaSegments
          type={showSlaResponse ? "response" : "resolution"}
          slaDeadline={showSlaResponse ? (ticket.sla_response_deadline ?? null) : (ticket.sla_deadline ?? null)}
          slaStatus={showSlaResponse   ? (ticket.sla_response_status ?? null)  : (ticket.sla_status ?? null)}
          priority={ticket.priority}
          state={ticket.state}
          dateResolved={ticket.date_resolved ?? null}
          xLastPauseDate={ticket.x_last_pause_date ?? null}
          createDate={ticket.create_date ?? null}
        />

        {/* ── Organic Timeline: Création -> Échéance ─── */}
        <div className="flex items-center justify-center w-full mt-2 mb-0.5">
          <div className="flex items-center bg-[hsl(var(--muted)/0.3)] rounded-full px-2.5 py-1.5 border border-[hsl(var(--border)/0.5)] shadow-sm gap-0 max-w-full">
            
            {/* Node 1: Création */}
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <div className={`flex items-center justify-center rounded-full bg-[hsl(var(--primary)/0.15)] text-[hsl(var(--primary))] ring-1 ring-[hsl(var(--primary)/0.2)] flex-shrink-0 ${timelineLarge ? "w-6 h-6" : "w-[22px] h-[22px]"}`}>
                <Calendar size={timelineLarge ? 12 : 11} strokeWidth={2.5} />
              </div>
              <div className="flex flex-col">
                <span className={`font-bold uppercase tracking-wider text-[hsl(var(--muted-foreground))] leading-none mb-0.5 ${timelineLarge ? "text-[9px]" : "text-[8px]"}`}>Créé le</span>
                <span className={`font-mono font-semibold text-[hsl(var(--foreground)/0.85)] leading-none whitespace-nowrap ${timelineLarge ? "text-[11px]" : "text-[10px]"}`}>
                  {(() => {
                    const raw = ticket.create_date;
                    if (!raw) return "--";
                    const d = new Date(raw.includes("Z") ? raw : raw + "Z");
                    if (isNaN(d.getTime())) return "--";
                    const day = String(d.getDate()).padStart(2, "0");
                    const month = String(d.getMonth() + 1).padStart(2, "0");
                    const hh = String(d.getHours()).padStart(2, "0");
                    const mm = String(d.getMinutes()).padStart(2, "0");
                    return `${day}/${month} ${hh}:${mm}`;
                  })()}
                </span>
              </div>
            </div>

            {/* Connecting Arrow — distinct from icon nodes */}
            <div className="flex items-center gap-0.5 mx-2 opacity-50 flex-shrink-0">
              <div className="w-2 h-[1.5px] bg-gradient-to-r from-transparent to-[hsl(var(--muted-foreground))] rounded-full" />
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none" className="text-[hsl(var(--muted-foreground))] flex-shrink-0">
                <path d="M1 5h7M5.5 2l3 3-3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <div className="w-2 h-[1.5px] bg-gradient-to-l from-transparent to-[hsl(var(--muted-foreground))] rounded-full opacity-0" />
            </div>

            {/* Node 2: Échéance */}
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <div className={`flex items-center justify-center rounded-full ring-1 flex-shrink-0 ${timelineLarge ? "w-6 h-6" : "w-[22px] h-[22px]"} ${ticket.sla_status === "breached" ? "bg-rose-500/15 text-rose-600 ring-rose-500/30 animate-pulse" : "bg-[hsl(var(--muted-foreground)/0.15)] text-[hsl(var(--muted-foreground))] ring-[hsl(var(--border))]"}` }>
                <Clock size={timelineLarge ? 12 : 11} strokeWidth={2.5} />
              </div>
              <div className="flex flex-col items-start">
                <span className={`font-bold uppercase tracking-wider leading-none mb-0.5 ${timelineLarge ? "text-[9px]" : "text-[8px]"} ${ticket.sla_status === "breached" ? "text-rose-500" : "text-[hsl(var(--muted-foreground))]"}` }>
                  Échéance
                </span>
                <span className={`font-mono font-semibold leading-none whitespace-nowrap ${timelineLarge ? "text-[11px]" : "text-[10px]"} ${ticket.sla_status === "breached" ? "text-rose-600 font-bold" : "text-[hsl(var(--foreground)/0.85)]"}` }>
                  {(() => {
                    const raw = showSlaResponse ? ticket.sla_response_deadline : ticket.sla_deadline;
                    if (!raw) return "--";
                    const d = new Date(raw.includes("Z") ? raw : raw + "Z");
                    if (isNaN(d.getTime())) return "--";
                    const day = String(d.getDate()).padStart(2, "0");
                    const month = String(d.getMonth() + 1).padStart(2, "0");
                    const hh = String(d.getHours()).padStart(2, "0");
                    const mm = String(d.getMinutes()).padStart(2, "0");
                    return `${day}/${month} ${hh}:${mm}`;
                  })()}
                </span>
              </div>
            </div>
            
          </div>
        </div>

        {/* ── Footer: agent + category ─── */}
        <div className="flex items-center justify-between border-t border-[hsl(var(--border)/0.4)] pt-3 -mt-1">
          {/* Agent */}
          <div className="flex items-center gap-2">
            {footerLeftOverride ? (
              footerLeftOverride
            ) : ticket.assigned_to ? (
              <>
                <div
                  className="w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold text-white flex-shrink-0 ring-1 ring-[hsl(var(--border)/0.5)]"
                  style={{ background: getAgentColor(ticket.assigned_to) }}
                  title={ticket.assigned_to}
                >
                  {getAgentInitials(ticket.assigned_to)}
                </div>
                <span className="text-[11px] font-semibold truncate max-w-[110px]" style={{ color: getAgentColor(ticket.assigned_to) }}>
                  {ticket.assigned_to}
                </span>
              </>
            ) : (
              <>
                <div className="w-6 h-6 rounded-full bg-[hsl(var(--muted)/0.6)] flex items-center justify-center flex-shrink-0">
                  <User size={11} className="text-[hsl(var(--muted-foreground))] opacity-50" />
                </div>
                <span className="text-[11px] italic opacity-40 text-[hsl(var(--muted-foreground))]">Non assigné</span>
              </>
            )}
          </div>

          {/* Category */}
          <span
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[9px] font-bold uppercase tracking-wider"
            style={{ backgroundColor: `${catColor}14`, borderColor: `${catColor}30`, color: catColor }}
          >
            <span className="scale-90 origin-center">{getCategoryIcon(ticket.category, 12)}</span>
            {ticket.category || "Non classé"}
          </span>
        </div>

        {/* Actions */}
        {actions && (
          <div className="border-t border-[hsl(var(--border)/0.4)] pt-3 -mt-1">
            {actions}
          </div>
        )}
        </div>
      </div>

      <TicketDetailsModal
        isOpen={isModalOpen}
        ticket={ticket as any}
        onClose={() => setIsModalOpen(false)}
        onRefresh={onRefresh}
      />
    </>
  );
}

export { getCategoryIcon, getCategoryColor, getPriorityBadge, getStatusInfo };
