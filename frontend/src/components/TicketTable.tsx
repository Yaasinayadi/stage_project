"use client";

import { useState } from "react";
import { getCategoryIcon, getCategoryColor, getPriorityBadge, getStatusInfo, formatTicketRef } from "./TicketCard";
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

type TicketTableProps = {
  tickets: Ticket[];
  onRefresh?: () => void;
};

export default function TicketTable({ tickets, onRefresh }: TicketTableProps) {
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);

  return (
    <>
      <div className="glass-card overflow-hidden animate-fade-in">
        <div className="overflow-x-auto">
          <table className="ticket-table">
            <thead>
              <tr>
                <th style={{ width: "40px" }}>Statut</th>
                <th>Ticket</th>
                <th>Catégorie</th>
                <th>Priorité</th>
                <th style={{ width: "100px" }}>Réf.</th>
              </tr>
            </thead>
            <tbody>
              {tickets.map((ticket, idx) => {
                const status = getStatusInfo(ticket.state);
                const catColor = getCategoryColor(ticket.category);

                return (
                  <tr
                    key={ticket.id}
                    className="cursor-pointer animate-fade-in hover:bg-[hsl(var(--muted)/0.3)] transition-colors"
                    style={{ animationDelay: `${idx * 40}ms` }}
                    onClick={() => setSelectedTicket(ticket)}
                  >
                    {/* Status Dot */}
                    <td>
                      <div className="flex items-center justify-center">
                        <span className={`status-dot ${status.dotClass}`} />
                      </div>
                    </td>

                    {/* Ticket Info */}
                    <td>
                      <div>
                        <p className="font-semibold text-sm leading-snug mb-0.5">{ticket.name}</p>
                        <p className="text-xs text-[hsl(var(--muted-foreground))] line-clamp-1">
                          {ticket.description}
                        </p>
                      </div>
                    </td>

                    {/* Category */}
                    <td>
                      <div className="flex items-center gap-2">
                        <span style={{ color: catColor }}>{getCategoryIcon(ticket.category)}</span>
                        <span className="text-sm">{ticket.category || "Non classé"}</span>
                      </div>
                    </td>

                    {/* Priority */}
                    <td>{getPriorityBadge(ticket.priority)}</td>

                    {/* ID / Ref */}
                    <td>
                      <span className="text-xs text-[hsl(var(--muted-foreground))] font-mono font-semibold tracking-wide">
                        {formatTicketRef(ticket.id)}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {selectedTicket && (
        <TicketDetailsModal
          isOpen={!!selectedTicket}
          ticket={selectedTicket as any}
          onClose={() => setSelectedTicket(null)}
          onRefresh={onRefresh}
        />
      )}
    </>
  );
}
