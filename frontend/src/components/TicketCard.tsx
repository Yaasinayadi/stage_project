"use client";

import { useState } from "react";
import axios from "axios";
import { Globe, Key, Laptop, HardDrive, Mail, Server, AlertCircle, Clock, User } from "lucide-react";
import TicketDetailsModal from "./TicketDetailsModal";
import CompactTimeline from "./CompactTimeline";
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
};

type TicketCardProps = {
  ticket: Ticket;
  index: number;
  onRefresh?: () => void;
};

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
  switch (prio) {
    case "3":
      return <span className="badge badge-critical">Critique</span>;
    case "2":
      return <span className="badge badge-high">Haute</span>;
    case "1":
      return <span className="badge badge-medium">Moyenne</span>;
    default:
      return <span className="badge badge-low">Basse</span>;
  }
}

function getStatusInfo(state: string): { label: string; dotClass: string } {
  const s = (state || "").toLowerCase();
  if (s.includes("nouveau") || s.includes("new")) return { label: "Nouveau", dotClass: "new" };
  if (s.includes("cours") || s.includes("progress")) return { label: "En cours", dotClass: "progress" };
  if (s.includes("résolu") || s.includes("resolved") || s.includes("done")) return { label: "Résolu", dotClass: "resolved" };
  if (s === "waiting_material") return { label: "En attente matériel", dotClass: "open" };
  if (s.includes("attente") || s.includes("waiting")) return { label: "En attente client", dotClass: "open" };
  return { label: state || "Ouvert", dotClass: "open" };
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
  const colors = ["#6366f1", "#8b5cf6", "#ec4899", "#10b981", "#f59e0b", "#06b6d4", "#3b82f6", "#ef4444"];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

export default function TicketCard({ ticket, index, onRefresh }: TicketCardProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);

  const catColor = getCategoryColor(ticket.category);
  const status = getStatusInfo(ticket.state);

  return (
    <>
      <div
        className="glass-card p-5 cursor-pointer group animate-fade-in hover:-translate-y-1 transition-all duration-300 flex flex-col h-full"
        style={{ animationDelay: `${index * 60}ms` }}
        onClick={() => setIsModalOpen(true)}
      >
        {/* Top row: icon + ID + Badges */}
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-center gap-2 flex-wrap">
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors duration-200 flex-shrink-0"
              style={{
                background: `${catColor}14`,
                color: catColor,
              }}
            >
              {getCategoryIcon(ticket.category)}
            </div>
            <span className="text-[10px] font-mono font-semibold text-[hsl(var(--muted-foreground))] bg-[hsl(var(--muted))] px-1.5 py-0.5 rounded uppercase">
              {formatTicketRef(ticket.id)}
            </span>
            {/* Priority */}
            {getPriorityBadge(ticket.priority)}
            {/* Status */}
            <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full border text-[10px] font-semibold tracking-wider ${status.dotClass === 'resolved' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' : 'bg-[hsl(var(--muted)/0.3)] border-[hsl(var(--border))] text-[hsl(var(--foreground))]'}`}>
              <span className={`w-1.5 h-1.5 rounded-full bg-current opacity-70`} />
              {status.label}
            </span>
          </div>
        </div>

        {/* Title */}
        <h3 className="font-semibold text-[0.95rem] leading-snug mb-1.5 line-clamp-1 group-hover:text-[hsl(var(--primary))] transition-colors">
          {ticket.name}
        </h3>

        {/* Description */}
        <p className="text-sm text-[hsl(var(--muted-foreground))] line-clamp-2 mb-4 leading-relaxed flex-grow">
          {ticket.description}
        </p>

        {/* Footer: Timeline + Category */}
        <div className="flex items-center justify-between pt-3 mt-auto border-t border-[hsl(var(--border)/0.5)]">
          {/* Timeline Compacte Contextuelle */}
          <div className="flex items-center flex-wrap gap-2">
            {ticket.create_date && (
              <CompactTimeline
                createDate={ticket.create_date}
                slaDeadline={ticket.sla_deadline}
                slaStatus={ticket.sla_status}
                dateResolved={ticket.date_resolved}
                state={ticket.state}
              />
            )}
          </div>
          <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
            <Clock size={12} />
            <span>{ticket.category || "Non classé"}</span>
          </div>
        </div>

        {/* Agent Assigné — visible sans clic */}
        <div className="flex items-center gap-2 pt-2.5 mt-2 border-t border-[hsl(var(--border)/0.3)]">
          {ticket.assigned_to ? (
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
                <User size={10} className="text-[hsl(var(--muted-foreground)/0.5)]" />
              </div>
              <span className="text-[11px] italic opacity-40 text-[hsl(var(--muted-foreground))]">
                Non assigné
              </span>
            </>
          )}
        </div>
      </div>

      <TicketDetailsModal 
        isOpen={isModalOpen} 
        ticket={ticket} 
        onClose={() => setIsModalOpen(false)} 
        onRefresh={onRefresh}
      />
    </>
  );
}

// Export utility functions for the table view
export { getCategoryIcon, getCategoryColor, getPriorityBadge, getStatusInfo };
