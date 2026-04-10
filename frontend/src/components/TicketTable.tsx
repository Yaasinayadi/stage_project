"use client";

import { getCategoryIcon, getCategoryColor, getPriorityBadge, getStatusInfo } from "./TicketCard";

type Ticket = {
  id: number;
  name: string;
  description: string;
  state: string;
  priority: string;
  category: string;
};

type TicketTableProps = {
  tickets: Ticket[];
};

export default function TicketTable({ tickets }: TicketTableProps) {
  return (
    <div className="glass-card overflow-hidden animate-fade-in">
      <div className="overflow-x-auto">
        <table className="ticket-table">
          <thead>
            <tr>
              <th style={{ width: "40px" }}>Statut</th>
              <th>Ticket</th>
              <th>Catégorie</th>
              <th>Priorité</th>
              <th style={{ width: "80px" }}>ID</th>
            </tr>
          </thead>
          <tbody>
            {tickets.map((ticket, idx) => {
              const status = getStatusInfo(ticket.state);
              const catColor = getCategoryColor(ticket.category);

              return (
                <tr
                  key={ticket.id}
                  className="cursor-pointer animate-fade-in"
                  style={{ animationDelay: `${idx * 40}ms` }}
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

                  {/* ID */}
                  <td>
                    <span className="text-xs text-[hsl(var(--muted-foreground))] font-mono">
                      #{ticket.id}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
