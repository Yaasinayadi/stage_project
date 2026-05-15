"use client";

import { useState } from "react";
import axios from "axios";
import {
  Globe,
  Key,
  Laptop,
  HardDrive,
  Mail,
  Server,
  AlertCircle,
  Clock,
  User,
  Calendar,
  ArrowRight,
  Target,
} from "lucide-react";
import TicketDetailsModal from "./TicketDetailsModal";
import LinearSlaBar from "./LinearSlaBar";
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
};

function formatDateCompact(d: string | null | undefined) {
  if (!d) return "--";
  const date = new Date(d);
  if (isNaN(date.getTime())) return "--";
  return date
    .toLocaleString("fr-FR", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    })
    .replace(",", "");
}

function getCategoryIcon(cat: string) {
  if (!cat) return <AlertCircle size={18} />;
  const lcat = cat.toLowerCase();
  if (lcat.includes("réseau")) return <Globe size={18} />;
  if (lcat.includes("accès")) return <Key size={18} />;
  if (lcat.includes("logiciel")) return <Laptop size={18} />;
  if (lcat.includes("matériel")) return <HardDrive size={18} />;
  if (lcat.includes("messagerie")) return <Mail size={18} />;
  if (lcat.includes("infrastructure")) return <Server size={18} />;
  return <AlertCircle size={18} />;
}

function getCategoryColor(cat: string): string {
  if (!cat) return "#71717a";
  const lcat = cat.toLowerCase();
  if (lcat.includes("réseau")) return "#6366f1";
  if (lcat.includes("accès")) return "#f59e0b";
  if (lcat.includes("logiciel")) return "#8b5cf6";
  if (lcat.includes("matériel")) return "#10b981";
  if (lcat.includes("messagerie")) return "#ec4899";
  if (lcat.includes("infrastructure")) return "#06b6d4";
  return "#71717a";
}

function getPriorityBadge(prio: string) {
  const label =
    prio === "3"
      ? "Critique"
      : prio === "2"
        ? "Haute"
        : prio === "1"
          ? "Moyenne"
          : "Basse";
  const colors =
    prio === "3"
      ? "bg-rose-500/10 text-rose-500 border-rose-500/20"
      : prio === "2"
        ? "bg-amber-500/10 text-amber-500 border-amber-500/20"
        : prio === "1"
          ? "bg-blue-500/10 text-blue-500 border-blue-500/20"
          : "bg-zinc-500/10 text-zinc-400 border-zinc-500/20";
  return (
    <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-widest border ${colors}`}>
      {label}
    </span>
  );
}

function getPriorityBorder(prio: string) {
  if (prio === "3") return "border-l-rose-500";
  if (prio === "2") return "border-l-amber-500";
  if (prio === "1") return "border-l-blue-500";
  return "border-l-slate-400";
}

function getStatusInfo(state: string): { label: string; colors: string } {
  const s = (state || "").toLowerCase();
  
  if (s.includes("nouveau") || s.includes("new"))
    return { label: "Nouveau", colors: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20" };
  
  if (s.includes("assigné") || s.includes("assigned"))
    return { label: "Assigné", colors: "bg-indigo-500/10 text-indigo-400 border-indigo-500/20" };
  
  if (s.includes("cours") || s.includes("progress"))
    return { label: "En cours", colors: "bg-sky-500/10 text-sky-400 border-sky-500/20" };
  
  if (s === "waiting_material" || s.includes("matériel") || s.includes("material"))
    return { label: "En attente matériel", colors: "bg-orange-600/10 text-orange-500 border-orange-600/20" };
  
  if (s.includes("attente") || s.includes("waiting"))
    return { label: "En attente client", colors: "bg-amber-500/10 text-amber-500 border-amber-500/20" };
  
  if (s.includes("escaladé") || s.includes("escalated"))
    return { label: "Escaladé", colors: "bg-purple-600/10 text-purple-400 border-purple-600/20" };
  
  if (s.includes("résolu") || s.includes("resolved") || s.includes("done") || s.includes("closed") || s.includes("clos"))
    return { label: "Résolu", colors: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" };
  
  return { label: state || "Nouveau", colors: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20" };
}

export function formatTicketRef(id: number | undefined): string {
  if (!id) return "";
  return `TK-${String(id).padStart(4, "0")}`;
}

function getAgentInitials(name: string): string {
  const parts = name.trim().split(" ").filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

function getAgentColor(name: string): string {
  const colors = [
    "#6366f1",
    "#8b5cf6",
    "#ec4899",
    "#10b981",
    "#f59e0b",
    "#06b6d4",
    "#3b82f6",
    "#ef4444",
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++)
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

export default function TicketCard({
  ticket,
  index,
  onRefresh,
  onClickOverride,
  actions,
  footerLeftOverride,
  showSlaResponse,
}: TicketCardProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);

  const catColor = getCategoryColor(ticket.category);
  const status = getStatusInfo(ticket.state);
  const priorityBorder = getPriorityBorder(ticket.priority);

  return (
    <>
      <div
        className={`bg-zinc-900/40 backdrop-blur-md border border-white/10 hover:border-white/20 transition-all duration-300 p-5 cursor-pointer group animate-fade-in flex flex-col h-full rounded-2xl`}
        style={{ animationDelay: `${index * 60}ms` }}
        onClick={(e) => {
          if (onClickOverride) {
            onClickOverride(e);
          } else {
            setIsModalOpen(true);
          }
        }}
      >
        {/* Top row: icon + ID + Badges */}
        <div className="flex items-start justify-between w-full mb-4 gap-2">
          {/* Left: Icon + ID */}
          <div className="flex items-center gap-2 shrink-0">
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors duration-200 flex-shrink-0"
              style={{
                background: `${catColor}14`,
                color: catColor,
              }}
            >
              {getCategoryIcon(ticket.category)}
            </div>
            <span className="text-[10px] font-mono text-muted-foreground/60 whitespace-nowrap bg-white/5 border border-white/5 px-2 py-0.5 rounded-md">
              {formatTicketRef(ticket.id)}
            </span>
          </div>
          {/* Right: Status + Priority */}
          <div className="flex flex-wrap items-center justify-end gap-1.5">
            {/* Status */}
            <span
              className={`inline-flex items-center px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-widest border text-center ${status.colors}`}
            >
              {status.label}
            </span>
            {/* Priority */}
            {getPriorityBadge(ticket.priority)}
          </div>
        </div>

        {/* Title */}
        <h3 className="h-10 line-clamp-2 text-sm font-bold text-white tracking-tight mb-1 group-hover:text-[hsl(var(--primary))] transition-colors">
          {ticket.name}
        </h3>

        {/* Description */}
        <p className="h-[46px] overflow-hidden text-[11px] text-zinc-500 leading-snug line-clamp-3 mb-3">
          {ticket.description}
        </p>

        {/* Bottom Section (Fixed to bottom) */}
        <div className="mt-auto flex flex-col">
          {/* Timeline Tracking */}
          <div className="flex items-center justify-center gap-3 py-1.5 px-3 bg-zinc-900/30 rounded-lg border border-white/5 mb-3">
            {/* Creation */}
            <div className="flex items-center gap-1.5">
              <Calendar
                size={12}
                className="text-[hsl(var(--muted-foreground))]"
              />
              <span className="text-[10px] font-medium font-mono text-[hsl(var(--muted-foreground)/0.9)]">
                {formatDateCompact(ticket.create_date)}
              </span>
            </div>

            {/* Separator */}
            <ArrowRight
              size={10}
              className="text-[hsl(var(--muted-foreground)/0.5)]"
            />

            {/* Deadline */}
            <div className="flex items-center gap-1.5">
              <Target size={12} className="text-[hsl(var(--muted-foreground))]" />
              <span
                className={`text-[10px] font-medium font-mono ${ticket.sla_status === "breached" ? "text-rose-500/80" : "text-[hsl(var(--muted-foreground)/0.9)]"}`}
              >
                {formatDateCompact(ticket.sla_deadline)}
              </span>
            </div>
          </div>

          {/* SLA Linear Bar */}
          <LinearSlaBar
            type={showSlaResponse ? "response" : "resolution"}
            slaDeadline={showSlaResponse ? ticket.sla_response_deadline ?? null : ticket.sla_deadline ?? null}
            slaStatus={showSlaResponse ? ticket.sla_response_status ?? null : ticket.sla_status ?? null}
            priority={ticket.priority}
            state={ticket.state}
            dateResolved={ticket.date_resolved ?? null}
            xLastPauseDate={ticket.x_last_pause_date ?? null}
          />

          {/* Footer: Avatar + Category */}
          <div className="flex items-center justify-between border-t border-[hsl(var(--border)/0.3)] pt-3 mt-3">
            {/* Left part (Agent or override) */}
            <div className="flex items-center gap-2">
              {footerLeftOverride ? (
                footerLeftOverride
              ) : ticket.assigned_to ? (
                <>
                  <div
                    className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold text-white flex-shrink-0 ring-1 ring-white/20"
                    style={{ background: getAgentColor(ticket.assigned_to) }}
                    title={ticket.assigned_to}
                  >
                    {getAgentInitials(ticket.assigned_to)}
                  </div>
                  <span
                    className="text-[11px] font-medium truncate max-w-[120px]"
                    style={{ color: getAgentColor(ticket.assigned_to) }}
                  >
                    {ticket.assigned_to}
                  </span>
                </>
              ) : (
                <>
                  <div className="w-5 h-5 rounded-full bg-[hsl(var(--muted))] flex items-center justify-center flex-shrink-0">
                    <User
                      size={10}
                      className="text-[hsl(var(--muted-foreground)/0.5)]"
                    />
                  </div>
                  <span className="text-[11px] italic opacity-40 text-[hsl(var(--muted-foreground))]">
                    Non assigné
                  </span>
                </>
              )}
            </div>

            {/* Category */}
            <span
              className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded border text-[9px] font-bold uppercase tracking-wider"
              style={{
                backgroundColor: `${catColor}14`,
                borderColor: `${catColor}33`,
                color: catColor,
              }}
            >
              <div className="scale-75 origin-center -ml-1">
                {getCategoryIcon(ticket.category)}
              </div>
              {ticket.category || "Non classé"}
            </span>
          </div>

          {/* Actions additionnelles */}
          {actions && (
            <div className="mt-3 pt-3 border-t border-[hsl(var(--border)/0.3)]">
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

// Export utility functions for the table view
export { getCategoryIcon, getCategoryColor, getPriorityBadge, getStatusInfo };
