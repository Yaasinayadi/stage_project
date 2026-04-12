"use client";

import { useEffect, useState } from "react";
import axios from "axios";
import { useAuth } from "@/lib/auth";
import { ArrowRight, Ticket, CheckCircle2, Clock, UserCheck, RefreshCw, X } from "lucide-react";

type TicketType = {
  id: number;
  name: string;
  state: string;
  priority: string;
  create_date?: string;
  write_date?: string;
};

type ActivityEvent = {
  id: string;
  type: "ticket_created" | "ticket_resolved" | "ticket_updated" | "account_created";
  label: string;
  description: string;
  date: Date;
  color: string;
  icon: React.ReactNode;
};

function formatRelativeDate(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffH = Math.floor(diffMs / 3600000);
  const diffD = Math.floor(diffMs / 86400000);

  if (diffMin < 2) return "À l'instant";
  if (diffMin < 60) return `Il y a ${diffMin} min`;
  if (diffH < 24) return `Il y a ${diffH}h`;
  if (diffD === 1) return "Hier";
  if (diffD < 7) return `Il y a ${diffD} jours`;
  return date.toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });
}

function buildEvents(tickets: TicketType[], user: { name: string } | null): ActivityEvent[] {
  const events: ActivityEvent[] = [];

  // Account creation event (always first, pinned at bottom)
  events.push({
    id: "account-created",
    type: "account_created",
    label: "Bienvenue sur la plateforme !",
    description: `Votre compte a été créé avec succès. Bienvenue, ${user?.name?.split(" ")[0] || "vous"} !`,
    date: new Date(Date.now() - 1000 * 60 * 60 * 24 * 30), // fallback: 30d ago
    color: "hsl(var(--info))",
    icon: <UserCheck size={14} />,
  });

  for (const ticket of tickets) {
    const stateRaw = (ticket.state || "").toLowerCase();
    const isResolved =
      stateRaw.includes("résolu") ||
      stateRaw.includes("resolved") ||
      stateRaw.includes("done") ||
      stateRaw.includes("fermé");

    const isInProgress =
      stateRaw.includes("cours") ||
      stateRaw.includes("progress") ||
      stateRaw.includes("attente");

    // Ticket created event
    const createDate = ticket.create_date
      ? new Date(ticket.create_date)
      : new Date(Date.now() - Math.random() * 86400000 * 7);

    events.push({
      id: `ticket-created-${ticket.id}`,
      type: "ticket_created",
      label: `Ticket #${ticket.id} créé`,
      description: ticket.name || "Nouvelle demande de support soumise.",
      date: createDate,
      color: "hsl(var(--primary))",
      icon: <Ticket size={14} />,
    });

    // Ticket resolved event
    if (isResolved) {
      const writeDate = ticket.write_date
        ? new Date(ticket.write_date)
        : new Date(createDate.getTime() + 3600000 * 24);

      events.push({
        id: `ticket-resolved-${ticket.id}`,
        type: "ticket_resolved",
        label: `Ticket #${ticket.id} résolu`,
        description: `"${ticket.name}" a été résolu avec succès par le support.`,
        date: writeDate,
        color: "hsl(var(--success))",
        icon: <CheckCircle2 size={14} />,
      });
    } else if (isInProgress) {
      const writeDate = ticket.write_date
        ? new Date(ticket.write_date)
        : new Date(createDate.getTime() + 3600000 * 2);

      events.push({
        id: `ticket-updated-${ticket.id}`,
        type: "ticket_updated",
        label: `Ticket #${ticket.id} mis à jour`,
        description: `"${ticket.name}" est maintenant pris en charge par un agent.`,
        date: writeDate,
        color: "hsl(var(--warning))",
        icon: <RefreshCw size={14} />,
      });
    }
  }

  // Sort newest first
  return events.sort((a, b) => b.date.getTime() - a.date.getTime());
}

function EventDot({ color }: { color: string }) {
  return (
    <div
      className="absolute -left-[33px] top-1 w-[14px] h-[14px] rounded-full bg-[hsl(var(--background))] border-2 ring-4 ring-[hsl(var(--background))] flex-shrink-0"
      style={{ borderColor: color }}
    />
  );
}

function EventItem({ event }: { event: ActivityEvent }) {
  return (
    <div className="relative">
      <EventDot color={event.color} />
      <h4 className="text-sm font-bold text-[hsl(var(--foreground))]">{event.label}</h4>
      <p className="text-sm text-[hsl(var(--muted-foreground))] mt-0.5 leading-snug">{event.description}</p>
      <div className="text-xs font-semibold text-[hsl(var(--muted-foreground))] mt-1.5 uppercase tracking-wide opacity-70">
        {formatRelativeDate(event.date)}
      </div>
    </div>
  );
}

export default function ActivityFeed() {
  const { user } = useAuth();
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    const fetchActivity = async () => {
      if (!user) return;
      try {
        const url =
          user.role === "user"
            ? `http://localhost:8069/api/tickets?user_id=${user.id}`
            : "http://localhost:8069/api/tickets";
        const res = await axios.get(url);
        const tickets: TicketType[] = res.data?.data || [];
        setEvents(buildEvents(tickets, user));
      } catch {
        // Fallback: just show account created event
        setEvents(buildEvents([], user));
      } finally {
        setLoading(false);
      }
    };
    fetchActivity();
  }, [user]);

  const preview = events.slice(0, 3);

  if (loading) {
    return (
      <div className="glass-card p-6 lg:p-8 space-y-6 animate-pulse">
        {[1, 2, 3].map((i) => (
          <div key={i} className="space-y-2">
            <div className="h-3 bg-[hsl(var(--muted))] rounded w-2/3" />
            <div className="h-3 bg-[hsl(var(--muted))] rounded w-full" />
            <div className="h-2 bg-[hsl(var(--muted))] rounded w-1/3" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <>
      <div className="glass-card p-6 lg:p-8 space-y-6">
        {events.length === 0 ? (
          <p className="text-sm text-[hsl(var(--muted-foreground))] text-center py-4">
            Aucune activité récente.
          </p>
        ) : (
          <div className="relative pl-6 border-l-2 border-[hsl(var(--border))] space-y-8">
            {preview.map((event) => (
              <EventItem key={event.id} event={event} />
            ))}
          </div>
        )}

        {events.length > 3 && (
          <button
            onClick={() => setShowAll(true)}
            className="w-full btn-ghost flex items-center justify-center gap-2 text-sm font-semibold border-2 border-[hsl(var(--border))] py-2.5 rounded-xl hover:bg-[hsl(var(--muted))] hover:text-[hsl(var(--foreground))] transition-all"
          >
            Voir tout l'historique
            <ArrowRight size={16} />
          </button>
        )}
      </div>

      {/* Full History Modal */}
      {showAll && (
        <div
          className="modal-overlay"
          onClick={() => setShowAll(false)}
        >
          <div
            className="modal-content max-w-lg w-full"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b border-[hsl(var(--border))]">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-[hsl(var(--primary)/0.1)] flex items-center justify-center">
                  <Clock size={18} className="text-[hsl(var(--primary))]" />
                </div>
                <div>
                  <h2 className="font-semibold text-base">Historique complet</h2>
                  <p className="text-xs text-[hsl(var(--muted-foreground))]">{events.length} événements</p>
                </div>
              </div>
              <button
                onClick={() => setShowAll(false)}
                className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-[hsl(var(--muted))] transition-colors text-[hsl(var(--muted-foreground))]"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 max-h-[60vh] overflow-y-auto">
              <div className="relative pl-6 border-l-2 border-[hsl(var(--border))] space-y-8">
                {events.map((event) => (
                  <EventItem key={event.id} event={event} />
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
