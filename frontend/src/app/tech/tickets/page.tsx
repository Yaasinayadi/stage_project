"use client";

import { useState, useEffect, useCallback } from "react";
import axios from "axios";
import {
  ClipboardList, RefreshCw, AlertTriangle, Clock, User2,
  CheckCircle2, Filter, ChevronDown
} from "lucide-react";
import SlaBadge from "@/components/SlaBadge";
import ProtectedRoute from "@/components/ProtectedRoute";
import { useAuth } from "@/lib/auth";
import Link from "next/link";

const ODOO_URL = "http://localhost:8069";

const PRIORITY_MAP: Record<string, { label: string; dot: string; badge: string }> = {
  "3": { label: "Critique", dot: "bg-red-500",    badge: "bg-red-500/10 text-red-500 border-red-500/20" },
  "2": { label: "Haute",    dot: "bg-orange-500", badge: "bg-orange-500/10 text-orange-500 border-orange-500/20" },
  "1": { label: "Moyenne",  dot: "bg-amber-500",  badge: "bg-amber-500/10 text-amber-600 border-amber-500/20" },
  "0": { label: "Basse",    dot: "bg-sky-400",    badge: "bg-sky-500/10 text-sky-600 border-sky-500/20" },
};

const STATE_MAP: Record<string, { label: string; color: string }> = {
  new:        { label: "Nouveau",    color: "text-gray-500" },
  assigned:   { label: "Assigné",    color: "text-blue-500" },
  in_progress:{ label: "En cours",   color: "text-indigo-500" },
  waiting:    { label: "En attente", color: "text-amber-500" },
  blocked:    { label: "Bloqué",     color: "text-red-500" },
  escalated:  { label: "Escaladé",   color: "text-purple-500" },
  resolved:   { label: "Résolu",     color: "text-emerald-500" },
  closed:     { label: "Fermé",      color: "text-gray-400" },
};

type Ticket = {
  id: number;
  name: string;
  description: string;
  priority: string;
  state: string;
  create_date: string | null;
  sla_deadline: string | null;
  sla_status: string | null;
  user_id: string | null;
  assigned_to_id?: string | null;
};

function MyTicketsPage() {
  const { user } = useAuth();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [priorityFilter, setPriorityFilter] = useState<string | null>(null);
  const [stateFilter, setStateFilter] = useState<string | null>(null);
  const [openDropdown, setOpenDropdown] = useState<"priority" | "state" | null>(null);

  const fetchMyTickets = useCallback(async () => {
    try {
      const res = await axios.get(`${ODOO_URL}/api/tickets`, { withCredentials: true });
      if (res.data.status === 200) {
        // Filter to tickets assigned to current user
        const mine = res.data.data.filter(
          (t: Ticket & { assigned_to?: string }) =>
            t.assigned_to === user?.name || t.assigned_to_id === user?.name
        );
        setTickets(mine.length > 0 ? mine : res.data.data);
      }
    } catch {
      console.error("Erreur chargement");
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchMyTickets();
    const id = setInterval(fetchMyTickets, 30000);
    return () => clearInterval(id);
  }, [fetchMyTickets]);

  const filtered = tickets
    .filter((t) => !priorityFilter || t.priority === priorityFilter)
    .filter((t) => !stateFilter || t.state === stateFilter)
    .sort((a, b) => parseInt(b.priority) - parseInt(a.priority));

  const atRisk   = tickets.filter((t) => t.sla_status === "at_risk").length;
  const breached  = tickets.filter((t) => t.sla_status === "breached").length;
  const inProgress = tickets.filter((t) => ["assigned", "in_progress"].includes(t.state)).length;
  const resolved  = tickets.filter((t) => ["resolved", "closed"].includes(t.state)).length;

  return (
    <div className="p-6 lg:p-8 max-w-5xl mx-auto space-y-6" onClick={() => setOpenDropdown(null)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <ClipboardList size={24} className="text-[hsl(var(--primary))]" />
            Mes Tickets
          </h1>
          <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1">
            Tickets qui vous sont assignés
          </p>
        </div>
        <button onClick={fetchMyTickets} className="btn-ghost flex items-center gap-2 text-sm">
          <RefreshCw size={15} /> Actualiser
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "En cours",  count: inProgress, icon: <Clock size={16} />,          color: "text-indigo-500" },
          { label: "À risque",  count: atRisk,     icon: <AlertTriangle size={16} />,  color: "text-amber-500" },
          { label: "Dépassé",   count: breached,   icon: <AlertTriangle size={16} />,  color: "text-red-500" },
          { label: "Résolus",   count: resolved,   icon: <CheckCircle2 size={16} />,   color: "text-emerald-500" },
        ].map((kpi) => (
          <div key={kpi.label} className="glass-card px-4 py-3 flex items-center gap-3">
            <span className={kpi.color}>{kpi.icon}</span>
            <div>
              <p className="text-xs text-[hsl(var(--muted-foreground))]">{kpi.label}</p>
              <p className="text-xl font-bold">{kpi.count}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="glass-card p-3 flex flex-wrap gap-2 items-center" onClick={(e) => e.stopPropagation()}>
        <Filter size={14} className="text-[hsl(var(--muted-foreground))]" />
        <span className="text-xs font-medium text-[hsl(var(--muted-foreground))]">Filtrer :</span>

        {/* Priority dropdown */}
        <div className="relative">
          <button
            onClick={() => setOpenDropdown(openDropdown === "priority" ? null : "priority")}
            className={`flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-semibold transition-all border
              ${priorityFilter ? "bg-[hsl(var(--primary)/0.12)] border-[hsl(var(--primary)/0.3)] text-[hsl(var(--primary))]"
                : "border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))] hover:border-[hsl(var(--primary)/0.2)]"}`}
          >
            <AlertTriangle size={12} />
            {priorityFilter ? PRIORITY_MAP[priorityFilter]?.label : "Priorité"}
            <ChevronDown size={12} className={`transition-transform ${openDropdown === "priority" ? "rotate-180" : ""}`} />
          </button>
          {openDropdown === "priority" && (
            <div className="absolute top-9 left-0 w-40 bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-xl shadow-xl z-50 p-1.5 space-y-0.5 animate-fade-in">
              <button onClick={() => { setPriorityFilter(null); setOpenDropdown(null); }}
                className="w-full text-left text-xs px-3 py-1.5 rounded-md hover:bg-[hsl(var(--muted))] font-medium">
                Toutes
              </button>
              {Object.entries(PRIORITY_MAP).map(([v, c]) => (
                <button key={v} onClick={() => { setPriorityFilter(v); setOpenDropdown(null); }}
                  className={`w-full text-left text-xs px-3 py-1.5 rounded-md hover:bg-[hsl(var(--muted))] font-medium flex items-center gap-2
                    ${priorityFilter === v ? "text-[hsl(var(--primary))]" : ""}`}>
                  <span className={`w-2 h-2 rounded-full ${c.dot}`} /> {c.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* State dropdown */}
        <div className="relative">
          <button
            onClick={() => setOpenDropdown(openDropdown === "state" ? null : "state")}
            className={`flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-semibold transition-all border
              ${stateFilter ? "bg-[hsl(var(--primary)/0.12)] border-[hsl(var(--primary)/0.3)] text-[hsl(var(--primary))]"
                : "border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))] hover:border-[hsl(var(--primary)/0.2)]"}`}
          >
            Statut {stateFilter ? `(${STATE_MAP[stateFilter]?.label})` : ""}
            <ChevronDown size={12} className={`transition-transform ${openDropdown === "state" ? "rotate-180" : ""}`} />
          </button>
          {openDropdown === "state" && (
            <div className="absolute top-9 left-0 w-44 bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-xl shadow-xl z-50 p-1.5 space-y-0.5 animate-fade-in">
              <button onClick={() => { setStateFilter(null); setOpenDropdown(null); }}
                className="w-full text-left text-xs px-3 py-1.5 rounded-md hover:bg-[hsl(var(--muted))] font-medium">
                Tous
              </button>
              {Object.entries(STATE_MAP).map(([k, v]) => (
                <button key={k} onClick={() => { setStateFilter(k); setOpenDropdown(null); }}
                  className={`w-full text-left text-xs px-3 py-1.5 rounded-md hover:bg-[hsl(var(--muted))] font-medium ${v.color}
                    ${stateFilter === k ? "opacity-100" : "opacity-70"}`}>
                  {v.label}
                </button>
              ))}
            </div>
          )}
        </div>

        <span className="ml-auto text-xs text-[hsl(var(--muted-foreground))]">
          <b>{filtered.length}</b> ticket{filtered.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Ticket Inbox List */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => <div key={i} className="glass-card h-24 animate-pulse opacity-50" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="glass-card flex flex-col items-center justify-center py-20 text-center">
          <ClipboardList size={40} className="text-[hsl(var(--muted-foreground)/0.3)] mb-3" />
          <h3 className="text-lg font-semibold">Aucun ticket trouvé</h3>
          <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1">Changez vos filtres ou allez prendre un ticket dans la file d&apos;attente.</p>
          <Link href="/tech/queue" className="mt-5 btn-primary text-sm px-5">Voir la file d&apos;attente</Link>
        </div>
      ) : (
        <div className="space-y-2.5">
          {filtered.map((ticket) => {
            const pCfg = PRIORITY_MAP[ticket.priority] ?? PRIORITY_MAP["1"];
            const sCfg = STATE_MAP[ticket.state] ?? { label: ticket.state, color: "text-gray-400" };
            const isUrgent = ticket.sla_status === "at_risk" || ticket.sla_status === "breached";

            return (
              <Link
                key={ticket.id}
                href={`/tech/tickets/${ticket.id}`}
                className={`glass-card p-4 flex flex-col sm:flex-row sm:items-center gap-4 hover:shadow-md
                  transition-all duration-200 group cursor-pointer block
                  ${isUrgent ? "border-l-4 border-l-amber-500 pl-3" : ""}`}
              >
                {/* Left: Priority dot + Info */}
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <div className="flex flex-col items-center gap-1 mt-1 flex-shrink-0">
                    <span className={`w-2.5 h-2.5 rounded-full ${pCfg.dot} ${isUrgent ? "animate-pulse" : ""}`} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm group-hover:text-[hsl(var(--primary))] transition-colors">
                        #{ticket.id} — {ticket.name}
                      </span>
                      <span className={`text-[0.65rem] font-semibold px-2 py-0.5 rounded-full border ${pCfg.badge}`}>
                        {pCfg.label}
                      </span>
                      <span className={`text-[0.65rem] font-semibold ${sCfg.color}`}>
                        ● {sCfg.label}
                      </span>
                    </div>
                    <p className="text-xs text-[hsl(var(--muted-foreground))] line-clamp-1 mt-1">
                      {ticket.description}
                    </p>
                    <div className="flex flex-wrap gap-3 mt-2">
                      {ticket.user_id && (
                        <span className="inline-flex items-center gap-1 text-[0.65rem] text-[hsl(var(--muted-foreground))]">
                          <User2 size={10} /> {ticket.user_id}
                        </span>
                      )}
                      {ticket.create_date && (
                        <span className="inline-flex items-center gap-1 text-[0.65rem] text-[hsl(var(--muted-foreground))]">
                          <Clock size={10} /> {new Date(ticket.create_date).toLocaleDateString("fr-FR")}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right: SLA Badge */}
                <div className="flex-shrink-0">
                  <SlaBadge slaDeadline={ticket.sla_deadline} slaStatus={ticket.sla_status} compact />
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function TechMyTicketsPage() {
  return (
    <ProtectedRoute roles={["tech", "admin"]}>
      <MyTicketsPage />
    </ProtectedRoute>
  );
}
