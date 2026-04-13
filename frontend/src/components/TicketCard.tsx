"use client";

import { useState } from "react";
import axios from "axios";
import { Globe, Key, Laptop, HardDrive, Mail, Server, AlertCircle, Clock, Edit2, Trash2, X, Save, ChevronDown, ChevronUp } from "lucide-react";
import TicketDetailsModal from "./TicketDetailsModal";
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
  if (s.includes("attente") || s.includes("waiting")) return { label: "En attente", dotClass: "open" };
  return { label: state || "Ouvert", dotClass: "open" };
}

export default function TicketCard({ ticket, index, onRefresh }: TicketCardProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);

  const catColor = getCategoryColor(ticket.category);
  const status = getStatusInfo(ticket.state);

  return (
    <>
      <div
        className="glass-card p-5 cursor-pointer group animate-fade-in hover:-translate-y-1 transition-all duration-300"
        style={{ animationDelay: `${index * 60}ms` }}
        onClick={() => setIsModalOpen(true)}
      >
        {/* Top row: icon + priority */}
        <div className="flex items-start justify-between mb-4">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center transition-colors duration-200"
            style={{
              background: `${catColor}14`,
              color: catColor,
            }}
          >
            {getCategoryIcon(ticket.category)}
          </div>
          {getPriorityBadge(ticket.priority)}
        </div>

        {/* Title */}
        <h3 className="font-semibold text-[0.95rem] leading-snug mb-1.5 line-clamp-1 group-hover:text-[hsl(var(--primary))] transition-colors">
          {ticket.name}
        </h3>

        {/* Description */}
        <p className="text-sm text-[hsl(var(--muted-foreground))] line-clamp-2 mb-4 leading-relaxed">
          {ticket.description}
        </p>

        {/* Footer: status + category */}
        <div className="flex items-center justify-between pt-3 border-t border-[hsl(var(--border)/0.5)]">
          <div className="flex items-center gap-2">
            <span className={`status-dot ${status.dotClass}`} />
            <span className="text-xs font-medium text-[hsl(var(--muted-foreground))]">
              {status.label}
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-[hsl(var(--muted-foreground))]">
            <Clock size={12} />
            <span>{ticket.category || "Non classé"}</span>
          </div>
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
