"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import axios from "axios";
import {
  ClipboardList,
  RefreshCw,
  AlertTriangle,
  Clock,
  User2,
  CheckCircle2,
  Filter,
  ChevronDown,
  Calendar,
  Tag,
  History,
  Inbox,
} from "lucide-react";
import ProtectedRoute from "@/components/ProtectedRoute";
import { useAuth } from "@/lib/auth";
import Link from "next/link";

import { ODOO_URL } from "@/lib/config";

const PRIORITY_MAP: Record<
  string,
  { label: string; dot: string; badge: string; border: string; order: number }
> = {
  "3": {
    label: "Critique",
    dot: "bg-rose-500",
    badge: "bg-rose-500/10 text-rose-500 border-rose-500/20",
    border: "border-l-rose-500",
    order: 0,
  },
  "2": {
    label: "Haute",
    dot: "bg-amber-500",
    badge: "bg-amber-500/10 text-amber-500 border-amber-500/20",
    border: "border-l-amber-500",
    order: 1,
  },
  "1": {
    label: "Moyenne",
    dot: "bg-blue-500",
    badge: "bg-blue-500/10 text-blue-500 border-blue-500/20",
    border: "border-l-blue-500",
    order: 2,
  },
  "0": {
    label: "Basse",
    dot: "bg-slate-400",
    badge: "bg-slate-500/10 text-slate-500 border-slate-500/20",
    border: "border-l-slate-400",
    order: 3,
  },
};

const STATE_MAP: Record<string, { label: string; color: string }> = {
  new: { label: "Nouveau", color: "text-gray-500" },
  assigned: { label: "Assigné", color: "text-blue-500" },
  in_progress: { label: "En cours", color: "text-indigo-500" },
  waiting: { label: "En attente client", color: "text-amber-500" },
  waiting_material: { label: "En attente matériel", color: "text-sky-500" },
  blocked: { label: "Bloqué", color: "text-red-500" },
  escalated: { label: "Escaladé", color: "text-purple-500" },
  resolved: { label: "Résolu", color: "text-emerald-500" },
  closed: { label: "Fermé", color: "text-gray-400" },
};

const ACTIVE_STATES = [
  "new",
  "assigned",
  "in_progress",
  "waiting",
  "waiting_material",
  "blocked",
  "escalated",
];
const RESOLVED_STATES = ["resolved", "closed"];

type Ticket = {
  id: number;
  name: string;
  description: string;
  priority: string;
  state: string;
  create_date: string | null;
  write_date: string | null;
  sla_deadline: string | null;
  sla_status: string | null;
  user_id: string | null;
  assigned_to_id?: string | null;
  category?: string | null;
};

// ── Glow styles injected once ─────────────────────────────────────────────────
const GLOW_STYLE = `
@keyframes successGlow {
  0%   { box-shadow: 0 0 0 0 rgba(16,185,129,0); background: rgba(16,185,129,0.15); }
  30%  { box-shadow: 0 0 20px 4px rgba(16,185,129,0.5); background: rgba(16,185,129,0.12); }
  100% { box-shadow: 0 0 0 0 rgba(16,185,129,0); background: transparent; }
}
.ticket-glow { animation: successGlow 3s ease-out forwards; }

@keyframes tabSlideIn {
  from { opacity: 0; transform: translateY(8px); }
  to   { opacity: 1; transform: translateY(0); }
}
.tab-content { animation: tabSlideIn 0.25s ease-out; }
`;

function MyTicketsPage() {
  const { user } = useAuth();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"active" | "resolved">("active");
  const [resolvedId, setResolvedId] = useState<number | null>(null);

  const [priorityFilter, setPriorityFilter] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [categories, setCategories] = useState<string[]>([]);
  const [openDropdown, setOpenDropdown] = useState<
    "priority" | "category" | null
  >(null);

  const glowTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Inject glow keyframes once ────────────────────────────────────────────
  useEffect(() => {
    if (document.getElementById("ticket-glow-style")) return;
    const el = document.createElement("style");
    el.id = "ticket-glow-style";
    el.textContent = GLOW_STYLE;
    document.head.appendChild(el);
  }, []);

  // ── Pick up resolved ticket ID from previous page ─────────────────────────
  useEffect(() => {
    const stored = sessionStorage.getItem("resolved_ticket_id");
    if (stored) {
      const rid = parseInt(stored);
      setResolvedId(rid);
      setActiveTab("resolved"); // switch to history tab
      sessionStorage.removeItem("resolved_ticket_id");
      // Remove glow after 3 s
      glowTimerRef.current = setTimeout(() => setResolvedId(null), 3500);
    }
    return () => {
      if (glowTimerRef.current) clearTimeout(glowTimerRef.current);
    };
  }, []);

  // ── Categories ────────────────────────────────────────────────────────────
  useEffect(() => {
    axios
      .get(`${ODOO_URL}/api/categories`)
      .then((res) => {
        setCategories(
          res.data.status === 200 && res.data.data.length > 0
            ? res.data.data
            : [
                "Logiciel",
                "Matériel",
                "Accès",
                "Réseau",
                "Messagerie",
                "Sécurité",
                "Infrastructure",
                "Autre",
              ],
        );
      })
      .catch(() => {
        setCategories([
          "Logiciel",
          "Matériel",
          "Accès",
          "Réseau",
          "Messagerie",
          "Sécurité",
          "Infrastructure",
          "Autre",
        ]);
      });
  }, []);

  // ── Fetch ─────────────────────────────────────────────────────────────────
  const fetchMyTickets = useCallback(async () => {
    try {
      if (!user?.id) return;
      const params: Record<string, any> = { assigned_to: user.id };
      if (categoryFilter) params.category = categoryFilter;
      const res = await axios.get(`${ODOO_URL}/api/tickets`, {
        params,
        withCredentials: true,
      });
      if (res.data.status === 200) setTickets(res.data.data);
    } catch {
      console.error("Erreur chargement");
    }
  }, [user, categoryFilter]);

  // Silent version for polling and initial load (manages its own loading state)
  const fetchMyTicketsSilent = useCallback(async () => {
    try {
      if (!user?.id) return;
      const params: Record<string, any> = { assigned_to: user.id };
      if (categoryFilter) params.category = categoryFilter;
      const res = await axios.get(`${ODOO_URL}/api/tickets`, {
        params,
        withCredentials: true,
      });
      if (res.data.status === 200) setTickets(res.data.data);
    } catch {
      console.error("Erreur chargement");
    } finally {
      setLoading(false);
    }
  }, [user, categoryFilter]);

  useEffect(() => {
    fetchMyTicketsSilent();
    const id = setInterval(fetchMyTicketsSilent, 30000);
    return () => clearInterval(id);
  }, [fetchMyTicketsSilent]);

  // ── Derived lists ─────────────────────────────────────────────────────────
  const applyPriority = (list: Ticket[]) =>
    priorityFilter ? list.filter((t) => t.priority === priorityFilter) : list;

  const activeTickets = applyPriority(
    tickets
      .filter((t) => ACTIVE_STATES.includes(t.state))
      .sort((a, b) => {
        const dateA = a.write_date ? new Date(a.write_date).getTime() : 0;
        const dateB = b.write_date ? new Date(b.write_date).getTime() : 0;
        if (dateA !== dateB) return dateB - dateA;
        return b.id - a.id;
      }),
  );

  const resolvedTickets = applyPriority(
    tickets
      .filter((t) => RESOLVED_STATES.includes(t.state))
      .sort((a, b) => {
        // most recently resolved first
        const da = new Date(a.write_date ?? 0).getTime();
        const db = new Date(b.write_date ?? 0).getTime();
        return db - da;
      }),
  );

  const currentList = activeTab === "active" ? activeTickets : resolvedTickets;

  // ── KPIs (always based on raw tickets) ───────────────────────────────────
  const inProgress = tickets.filter(
    (t) =>
      ACTIVE_STATES.includes(t.state) &&
      t.sla_status !== "breached" &&
      t.sla_status !== "at_risk",
  ).length;
  const atRisk = tickets.filter(
    (t) => ACTIVE_STATES.includes(t.state) && t.sla_status === "at_risk",
  ).length;
  const breached = tickets.filter(
    (t) => ACTIVE_STATES.includes(t.state) && t.sla_status === "breached",
  ).length;
  const resolved = tickets.filter((t) =>
    RESOLVED_STATES.includes(t.state),
  ).length;

  // ── Row renderer ──────────────────────────────────────────────────────────
  const renderRow = (ticket: Ticket) => {
    const pCfg = PRIORITY_MAP[ticket.priority] ?? PRIORITY_MAP["1"];
    const sCfg = STATE_MAP[ticket.state] ?? {
      label: ticket.state,
      color: "text-gray-400",
    };
    const isGlow = ticket.id === resolvedId;
    const isUrgent =
      ticket.sla_status === "at_risk" || ticket.sla_status === "breached";
    const isResolved = RESOLVED_STATES.includes(ticket.state);

    return (
      <Link
        key={ticket.id}
        href={`/tech/tickets/${ticket.id}`}
        className={`flex items-start justify-between p-4 border border-[hsl(var(--border)/0.5)] rounded-xl
          transition-all duration-200 shadow-sm border-l-4 group
          ${
            isResolved
              ? "border-l-emerald-500/50 bg-emerald-500/5 opacity-80 hover:opacity-100 hover:bg-emerald-500/10"
              : `${pCfg.border} bg-[hsl(var(--secondary)/0.2)] hover:bg-[hsl(var(--secondary)/0.4)]`
          }
          ${isGlow ? "ticket-glow" : ""}`}
      >
        {/* Left */}
        <div className="flex-1 min-w-0 pr-4">
          <span className="inline-block text-[10px] font-mono text-[hsl(var(--muted-foreground))] bg-[hsl(var(--muted))] px-1.5 py-0.5 rounded uppercase mb-1">
            #{ticket.id}
          </span>
          <h3
            className={`text-base font-bold tracking-tight mt-1 line-clamp-1 transition-colors flex items-center gap-1.5
            ${
              isResolved
                ? "text-[hsl(var(--muted-foreground)/0.8)] group-hover:text-[hsl(var(--foreground))]"
                : "text-[hsl(var(--foreground))] group-hover:text-[hsl(var(--primary))]"
            }`}
          >
            {isResolved && (
              <CheckCircle2
                size={13}
                className="text-emerald-500 flex-shrink-0"
              />
            )}
            {ticket.name}
          </h3>
          <p className="text-sm text-[hsl(var(--muted-foreground)/0.8)] line-clamp-1 mt-1">
            {ticket.description}
          </p>
          <div className="flex items-center flex-wrap gap-3 mt-3 text-xs text-[hsl(var(--muted-foreground))]">
            {ticket.user_id && (
              <div className="flex items-center gap-1">
                <User2 size={12} />
                {ticket.user_id}
              </div>
            )}
            {ticket.create_date && (
              <div className="flex items-center gap-1">
                <Calendar size={12} />
                {new Date(ticket.create_date).toLocaleDateString("fr-FR")}
              </div>
            )}
            {ticket.category && (
              <span className="inline-flex items-center bg-blue-500/10 text-blue-500 border border-blue-500/20 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider">
                <Tag size={10} className="mr-1" />
                {ticket.category}
              </span>
            )}
            {/* Priority badge: hide for resolved tickets */}
            {!isResolved && (
              <span
                className={`inline-flex items-center px-1.5 py-0.5 rounded-full border text-[10px] uppercase tracking-wider font-semibold ${pCfg.badge}`}
              >
                {pCfg.label}
              </span>
            )}
            {/* Status badge: premium emerald for resolved, normal for active */}
            {isResolved ? (
              <span className="inline-flex items-center gap-1 bg-emerald-500 text-white px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider">
                <CheckCircle2 size={9} /> Résolu
              </span>
            ) : (
              <span
                className={`inline-flex items-center px-1.5 py-0.5 rounded-full border text-[10px] uppercase tracking-wider font-semibold bg-[hsl(var(--muted)/0.3)] border-[hsl(var(--border))] ${sCfg.color}`}
              >
                {sCfg.label}
              </span>
            )}
          </div>
        </div>

        {/* Right: SLA */}
        <div className="flex-shrink-0 flex flex-col items-end gap-2">
          {ticket.sla_status === "breached" ? (
            <div className="bg-rose-500/10 text-rose-500 border border-rose-500/20 px-2 py-1 rounded-full text-[11px] font-medium flex items-center gap-1">
              <AlertTriangle size={12} /> SLA Dépassé
            </div>
          ) : ticket.sla_status === "at_risk" ? (
            <div className="bg-amber-500/10 text-amber-500 border border-amber-500/20 px-2 py-1 rounded-full text-[11px] font-medium flex items-center gap-1">
              <Clock size={12} /> À risque
            </div>
          ) : isResolved ? null : ticket.sla_deadline ? (
            <div className="bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 px-2 py-1 rounded-full text-[11px] font-medium flex items-center gap-1">
              <CheckCircle2 size={12} /> Dans les temps
            </div>
          ) : null}
        </div>
      </Link>
    );
  };

  return (
    <div
      className="p-6 lg:p-8 max-w-5xl mx-auto space-y-6"
      onClick={() => setOpenDropdown(null)}
    >
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
        <button
          onClick={async () => {
            setLoading(true);
            await Promise.all([
              fetchMyTickets(),
              new Promise((r) => setTimeout(r, 500)),
            ]);
            setLoading(false);
          }}
          className="btn-ghost flex items-center gap-2 text-sm"
          title="Actualiser"
        >
          <RefreshCw size={15} /> Actualiser
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          {
            label: "En cours",
            count: inProgress,
            icon: <Clock size={16} />,
            color: "text-indigo-500",
          },
          {
            label: "À risque",
            count: atRisk,
            icon: <AlertTriangle size={16} />,
            color: "text-amber-500",
          },
          {
            label: "Dépassé",
            count: breached,
            icon: <AlertTriangle size={16} />,
            color: "text-red-500",
          },
          {
            label: "Résolus",
            count: resolved,
            icon: <CheckCircle2 size={16} />,
            color: "text-emerald-500",
          },
        ].map((kpi) => (
          <div
            key={kpi.label}
            className="glass-card px-4 py-3 flex items-center gap-3"
          >
            <span className={kpi.color}>{kpi.icon}</span>
            <div>
              <p className="text-xs text-[hsl(var(--muted-foreground))]">
                {kpi.label}
              </p>
              <p className="text-xl font-bold">{kpi.count}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filters + Tabs (top-right segmented control) */}
      <div
        className="glass-card p-3 flex flex-wrap gap-2 items-center"
        onClick={(e) => e.stopPropagation()}
      >
        <Filter size={14} className="text-[hsl(var(--muted-foreground))]" />
        <span className="text-xs font-medium text-[hsl(var(--muted-foreground))]">
          Filtrer :
        </span>

        {/* Priority */}
        <div className="relative">
          <button
            onClick={() =>
              setOpenDropdown(openDropdown === "priority" ? null : "priority")
            }
            className={`flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-semibold transition-all border
              ${
                priorityFilter
                  ? "bg-[hsl(var(--primary)/0.12)] border-[hsl(var(--primary)/0.3)] text-[hsl(var(--primary))]"
                  : "border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))] hover:border-[hsl(var(--primary)/0.2)]"
              }`}
          >
            <AlertTriangle size={12} />
            {priorityFilter ? PRIORITY_MAP[priorityFilter]?.label : "Priorité"}
            <ChevronDown
              size={12}
              className={`transition-transform ${openDropdown === "priority" ? "rotate-180" : ""}`}
            />
          </button>
          {openDropdown === "priority" && (
            <div className="absolute top-9 left-0 w-40 bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-xl shadow-xl z-50 p-1.5 space-y-0.5 animate-fade-in">
              <button
                onClick={() => {
                  setPriorityFilter(null);
                  setOpenDropdown(null);
                }}
                className="w-full text-left text-xs px-3 py-1.5 rounded-md hover:bg-[hsl(var(--muted))] font-medium"
              >
                Toutes
              </button>
              {Object.entries(PRIORITY_MAP).map(([v, c]) => (
                <button
                  key={v}
                  onClick={() => {
                    setPriorityFilter(v);
                    setOpenDropdown(null);
                  }}
                  className={`w-full text-left text-xs px-3 py-1.5 rounded-md hover:bg-[hsl(var(--muted))] font-medium flex items-center gap-2
                    ${priorityFilter === v ? "text-[hsl(var(--primary))]" : ""}`}
                >
                  <span className={`w-2 h-2 rounded-full ${c.dot}`} /> {c.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Category */}
        <div className="relative">
          <button
            onClick={() =>
              setOpenDropdown(openDropdown === "category" ? null : "category")
            }
            className={`flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-semibold transition-all border
              ${
                categoryFilter
                  ? "bg-[hsl(var(--primary)/0.12)] border-[hsl(var(--primary)/0.3)] text-[hsl(var(--primary))]"
                  : "border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))] hover:border-[hsl(var(--primary)/0.2)]"
              }`}
          >
            <Tag size={12} />
            {categoryFilter ?? "Catégorie"}
            <ChevronDown
              size={12}
              className={`transition-transform ${openDropdown === "category" ? "rotate-180" : ""}`}
            />
          </button>
          {openDropdown === "category" && (
            <div className="absolute top-9 left-0 w-44 bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-xl shadow-xl z-50 p-1.5 space-y-0.5 animate-fade-in max-h-60 overflow-y-auto">
              <button
                onClick={() => {
                  setCategoryFilter(null);
                  setOpenDropdown(null);
                }}
                className="w-full text-left text-xs px-3 py-1.5 rounded-md hover:bg-[hsl(var(--muted))] font-medium"
              >
                Toutes
              </button>
              {categories.map((k) => (
                <button
                  key={k}
                  onClick={() => {
                    setCategoryFilter(k);
                    setOpenDropdown(null);
                  }}
                  className={`w-full text-left text-xs px-3 py-1.5 rounded-md hover:bg-[hsl(var(--muted))] font-medium
                    ${categoryFilter === k ? "text-[hsl(var(--primary))]" : ""}`}
                >
                  {k}
                </button>
              ))}
            </div>
          )}
        </div>

        <span className="text-xs text-[hsl(var(--muted-foreground))]">
          <b>{currentList.length}</b> ticket
          {currentList.length !== 1 ? "s" : ""}
        </span>

        {/* ── Segmented control tabs (right-aligned) ── */}
        <div className="ml-auto flex items-center gap-0.5 p-0.5 bg-[hsl(var(--muted)/0.5)] rounded-lg border border-[hsl(var(--border)/0.4)]">
          <button
            onClick={() => setActiveTab("active")}
            title="En attente de traitement"
            className={`flex items-center gap-1.5 h-7 px-2.5 rounded-md text-xs font-semibold transition-all duration-150
              ${
                activeTab === "active"
                  ? "bg-[hsl(var(--card))] text-[hsl(var(--foreground))] shadow-sm"
                  : "text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
              }`}
          >
            <ClipboardList size={13} />
            <span className="hidden sm:inline">En attente</span>
            <span
              className={`text-[10px] font-bold w-4 h-4 flex items-center justify-center rounded-full transition-colors
              ${activeTab === "active" ? "bg-[hsl(var(--primary))] text-white" : "bg-[hsl(var(--border))] text-[hsl(var(--muted-foreground))]"}`}
            >
              {activeTickets.length}
            </span>
          </button>
          <button
            onClick={() => setActiveTab("resolved")}
            title="Terminés / Résolus"
            className={`flex items-center gap-1.5 h-7 px-2.5 rounded-md text-xs font-semibold transition-all duration-150
              ${
                activeTab === "resolved"
                  ? "bg-[hsl(var(--card))] text-[hsl(var(--foreground))] shadow-sm"
                  : "text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
              }`}
          >
            <History size={13} />
            <span className="hidden sm:inline">Terminés</span>
            <span
              className={`text-[10px] font-bold w-4 h-4 flex items-center justify-center rounded-full transition-colors
              ${activeTab === "resolved" ? "bg-emerald-500 text-white" : "bg-[hsl(var(--border))] text-[hsl(var(--muted-foreground))]"}`}
            >
              {resolvedTickets.length}
            </span>
          </button>
        </div>
      </div>

      {/* ── Ticket List ── */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="glass-card h-24 animate-pulse opacity-50" />
          ))}
        </div>
      ) : currentList.length === 0 ? (
        <div className="glass-card flex flex-col items-center justify-center py-20 text-center tab-content">
          {activeTab === "active" ? (
            <>
              <ClipboardList
                size={40}
                className="text-[hsl(var(--muted-foreground)/0.3)] mb-3"
              />
              <h3 className="text-lg font-semibold">Aucun ticket actif</h3>
              <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1">
                Vous n&apos;avez aucun ticket en attente. Prenez-en un dans la
                file.
              </p>
              <Link
                href="/tech/queue"
                className="mt-5 btn-primary text-sm px-5"
              >
                Voir la file d&apos;attente
              </Link>
            </>
          ) : (
            <>
              <History
                size={40}
                className="text-[hsl(var(--muted-foreground)/0.3)] mb-3"
              />
              <h3 className="text-lg font-semibold">Aucun ticket résolu</h3>
              <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1">
                Votre historique de résolutions apparaîtra ici.
              </p>
            </>
          )}
        </div>
      ) : (
        <div key={activeTab} className="space-y-2.5 animate-fade-in">
          {currentList.map((ticket, idx) => (
            <div
              key={ticket.id}
              style={{ animationDelay: `${idx * 40}ms` }}
              className="animate-fade-in"
            >
              {renderRow(ticket)}
            </div>
          ))}
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
