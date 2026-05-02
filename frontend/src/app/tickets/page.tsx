"use client";

import { useState, useEffect } from "react";
import axios from "axios";
import {
  PlusCircle,
  Search,
  LayoutGrid,
  List,
  Ticket,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Inbox,
  Filter,
  ChevronDown,
  XCircle,
  Activity,
  ArrowUpRight,
  ClipboardList,
  History,
  Users,
} from "lucide-react";
import StatsCard from "@/components/StatsCard";
import TicketCard, { getStatusInfo } from "@/components/TicketCard";
import TicketTable from "@/components/TicketTable";
import TicketModal from "@/components/TicketModal";
import ProtectedRoute from "@/components/ProtectedRoute";
import { useAuth } from "@/lib/auth";
import { ODOO_URL } from "@/lib/config";

type TicketType = {
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

type AgentType = {
  id: number;
  name: string;
  email: string;
  role?: string;
};

const ACTIVE_STATES = [
  "new",
  "assigned",
  "in_progress",
  "waiting",
  "blocked",
  "escalated",
];
const RESOLVED_STATES = ["resolved", "closed"];

function Dashboard() {
  const { user } = useAuth();
  const [tickets, setTickets] = useState<TicketType[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"active" | "resolved">("active");

  // View mode
  const [viewMode, setViewMode] = useState<"cards" | "table">("cards");

  // Advanced Filtering State
  const [activeFilters, setActiveFilters] = useState<{
    search: string;
    categories: string[];
    statuses: string[];
    priorities: string[];
  }>({
    search: "",
    categories: [],
    statuses: [],
    priorities: [],
  });

  const [openDropdown, setOpenDropdown] = useState<
    "status" | "priority" | "agent" | null
  >(null);

  const [agents, setAgents] = useState<AgentType[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<string>("");

  const [categories, setCategories] = useState<string[]>([]);
  const statuses = ["Nouveau", "En cours", "En attente", "Résolu"];
  const priorities = [
    { value: "0", label: "Basse" },
    { value: "1", label: "Moyenne" },
    { value: "2", label: "Haute" },
    { value: "3", label: "Critique" },
  ];

  const fetchTickets = async () => {
    try {
      const params: Record<string, any> = {};
      if (user?.x_support_role === "user") params.user_id = user.id;

      const res = await axios.get(`${ODOO_URL}/api/tickets`, { params });

      if (res.data.status === 200) {
        setTickets(res.data.data);
      }
    } catch (e) {
      console.error("Erreur backend Odoo", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Fetch categories dynamically
    axios
      .get(`${ODOO_URL}/api/categories`)
      .then((res) => {
        if (res.data.status === 200) {
          setCategories(res.data.data);
        } else {
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
        }
      })
      .catch((e) => {
        console.warn("Categories fetch failed, using fallback:", e.message);
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

    // Fetch all users list (for admin / tech views to filter by any person)
    if (user?.x_support_role !== "user") {
      axios
        .get(`${ODOO_URL}/api/admin/users`)
        .then((res) => {
          if (res.data.status === 200) setAgents(res.data.data);
        })
        .catch(() => {});
    }

    fetchTickets();
  }, [user]);

  // ── Polling automatique toutes les 30s (sans loading spinner) ──
  useEffect(() => {
    const poll = async () => {
      try {
        const url =
          user?.x_support_role === "user"
            ? `${ODOO_URL}/api/tickets?user_id=${user.id}`
            : `${ODOO_URL}/api/tickets`;

        const res = await axios.get(url);
        if (res.data.status === 200) {
          setTickets(res.data.data);
        }
      } catch {
        // silent — polling failure shouldn't interrupt UX
      }
    };

    const interval = setInterval(poll, 30000);
    return () => clearInterval(interval);
  }, [user]);

  const toggleFilter = (
    key: "categories" | "statuses" | "priorities",
    value: string,
  ) => {
    setActiveFilters((prev) => {
      const current = prev[key];
      const updated = current.includes(value)
        ? current.filter((v) => v !== value)
        : [...current, value];
      return { ...prev, [key]: updated };
    });
  };

  const resetFilters = () => {
    setActiveFilters({
      search: "",
      categories: [],
      statuses: [],
      priorities: [],
    });
    setSelectedAgent("");
    setOpenDropdown(null);
  };

  const hasActiveFilters =
    activeFilters.search !== "" ||
    activeFilters.categories.length > 0 ||
    activeFilters.statuses.length > 0 ||
    activeFilters.priorities.length > 0 ||
    selectedAgent !== "";

  // Filter logic (Cumulative Intersection)
  const filteredTickets = tickets.filter((ticket) => {
    // 1. Search
    const safeName = (ticket.name || "").toLowerCase();
    const safeDesc = (ticket.description || "").toLowerCase();
    const safeSearch = activeFilters.search.toLowerCase();
    const matchesSearch =
      !safeSearch ||
      safeName.includes(safeSearch) ||
      safeDesc.includes(safeSearch);

    // 2. Categories (Already filtered by the backend if one is selected, but kept for consistency)
    const ticketCat = ticket.category ? ticket.category.toLowerCase() : "autre";
    const matchesCategory =
      activeFilters.categories.length === 0 ||
      activeFilters.categories.some((cat) =>
        ticketCat.includes(cat.toLowerCase()),
      );

    // 3. Statuses
    const sInfo = getStatusInfo(ticket.state);
    const matchesStatus =
      activeFilters.statuses.length === 0 ||
      activeFilters.statuses.includes(sInfo.label);

    // 4. Priorities
    const matchesPriority =
      activeFilters.priorities.length === 0 ||
      activeFilters.priorities.includes(ticket.priority);

    // 5. Agent Filter
    const matchesAgent =
      selectedAgent === "" ||
      (selectedAgent === "__unassigned__"
        ? !ticket.assigned_to
        : ticket.assigned_to === selectedAgent);

    return (
      matchesSearch &&
      matchesCategory &&
      matchesStatus &&
      matchesPriority &&
      matchesAgent
    );
  });

  // ── Tab split ────────────────────────────────────────────────────────────
  const activeTabTickets = filteredTickets.filter((t) =>
    ACTIVE_STATES.includes(t.state),
  );
  const resolvedTabTickets = filteredTickets.filter((t) =>
    RESOLVED_STATES.includes(t.state),
  );
  const tabFilteredTickets =
    activeTab === "active" ? activeTabTickets : resolvedTabTickets;

  // KPI calculations
  const totalTickets = tickets.length;
  const resolvedCount = tickets.filter((t) =>
    ["resolved", "closed"].includes(t.state),
  ).length;
  const breachedCount = tickets.filter(
    (t) =>
      !["resolved", "closed"].includes(t.state) && t.sla_status === "breached",
  ).length;
  const inProgressCount = tickets.filter(
    (t) =>
      !["resolved", "closed"].includes(t.state) && t.sla_status !== "breached",
  ).length;
  const escalatedCount = tickets.filter((t) => t.state === "escalated").length;

  const isUser = user?.x_support_role === "user" || !user?.x_support_role;

  return (
    <div
      className="p-6 lg:p-8 max-w-[1400px] mx-auto space-y-6"
      onClick={() => setOpenDropdown(null)}
    >
      {/* ─── Header ─── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-fade-in">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {user
              ? `Bonjour, ${user.name.split(" ")[0].charAt(0).toUpperCase() + user.name.split(" ")[0].slice(1)} `
              : "Mes Tickets"}
          </h1>
          <br />
          <h1 className="text-2xl font-bold tracking-tight">
            Gestion des Tickets
          </h1>

          <p className="text-sm text-[hsl(var(--muted-foreground))] mt-0.5">
            Gérez vos demandes de support IT
          </p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="btn-primary shadow-md hover:shadow-lg transition-all shadow-[hsl(var(--primary)/0.2)]"
          id="new-ticket-btn"
        >
          <PlusCircle size={18} />
          Nouveau ticket
        </button>
      </div>

      {/* ─── KPI Stats Row ─── */}
      <div
        className={`grid gap-4 ${isUser ? "grid-cols-2 lg:grid-cols-4" : "grid-cols-2 lg:grid-cols-5"}`}
      >
        <StatsCard
          title="Total Tickets"
          value={totalTickets}
          icon={<Ticket size={20} />}
          color="#6366f1"
          loading={loading}
          delay={0}
        />
        <StatsCard
          title="Dépassé"
          value={breachedCount}
          icon={<AlertTriangle size={20} />}
          color="#ef4444"
          loading={loading}
          delay={80}
        />
        {!isUser && (
          <StatsCard
            title="Tickets Escaladés"
            value={escalatedCount}
            icon={<ArrowUpRight size={20} />}
            color="#f59e0b"
            loading={loading}
            delay={160}
          />
        )}
        <StatsCard
          title="En Cours"
          value={inProgressCount}
          icon={<Activity size={20} />}
          color="#3b82f6"
          loading={loading}
          delay={isUser ? 160 : 240}
        />
        <StatsCard
          title="Résolus"
          value={resolvedCount}
          icon={<CheckCircle2 size={20} />}
          color="#10b981"
          loading={loading}
          delay={isUser ? 240 : 320}
        />
      </div>

      {/* ─── Filters Bar ─── */}
      <div
        className="glass-card relative z-50 p-4 space-y-4 shadow-sm animate-fade-in"
        style={{ animationDelay: "0.2s" }}
      >
        <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
          {/* Top Row: Search & View Toggle */}
          <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto flex-1">
            <div className="relative flex-1 w-full max-w-md">
              <Search
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[hsl(var(--muted-foreground))]"
                size={16}
              />
              <input
                type="text"
                value={activeFilters.search}
                onChange={(e) =>
                  setActiveFilters({ ...activeFilters, search: e.target.value })
                }
                placeholder="Rechercher un ticket..."
                className="input-field focus-ring !pl-11 h-10 bg-[hsl(var(--background)/0.5)]"
                id="search-input"
              />
            </div>
          </div>

          <div className="flex items-center justify-between w-full lg:w-auto gap-4">
            {/* Secondary Filters Dropdowns */}
            <div className="flex flex-wrap gap-2 items-center">
              <div className="relative" onClick={(e) => e.stopPropagation()}>
                <button
                  onClick={() =>
                    setOpenDropdown(openDropdown === "status" ? null : "status")
                  }
                  className={`flex items-center gap-1.5 h-10 px-3.5 rounded-lg text-sm font-semibold transition-all duration-200 border ${
                    activeFilters.statuses.length > 0 ||
                    openDropdown === "status"
                      ? "bg-[hsl(var(--primary)/0.12)] border-[hsl(var(--primary)/0.3)] text-[hsl(var(--primary))]"
                      : "bg-transparent border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))] hover:border-[hsl(var(--primary)/0.2)] hover:text-[hsl(var(--foreground))]"
                  }`}
                >
                  <Filter size={14} />
                  Statut{" "}
                  {activeFilters.statuses.length > 0 &&
                    `(${activeFilters.statuses.length})`}
                  <ChevronDown
                    size={14}
                    className={`transition-transform ${openDropdown === "status" ? "rotate-180" : ""}`}
                  />
                </button>
                {openDropdown === "status" && (
                  <div className="absolute top-11 right-0 sm:left-0 sm:right-auto mt-1 w-56 bg-white dark:bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-xl shadow-xl z-[100] animate-fade-in flex flex-col gap-1 p-2">
                    {statuses.map((st) => (
                      <label
                        key={st}
                        className="flex items-center gap-2.5 p-2 hover:bg-[hsl(var(--muted))] rounded-md cursor-pointer text-sm font-medium transition-colors"
                      >
                        <input
                          type="checkbox"
                          checked={activeFilters.statuses.includes(st)}
                          onChange={() => toggleFilter("statuses", st)}
                          className="accent-[hsl(var(--primary))] w-4 h-4 cursor-pointer"
                        />
                        {st}
                      </label>
                    ))}
                  </div>
                )}
              </div>

              <div className="relative" onClick={(e) => e.stopPropagation()}>
                <button
                  onClick={() =>
                    setOpenDropdown(
                      openDropdown === "priority" ? null : "priority",
                    )
                  }
                  className={`flex items-center gap-1.5 h-10 px-3.5 rounded-lg text-sm font-semibold transition-all duration-200 border ${
                    activeFilters.priorities.length > 0 ||
                    openDropdown === "priority"
                      ? "bg-[hsl(var(--primary)/0.12)] border-[hsl(var(--primary)/0.3)] text-[hsl(var(--primary))]"
                      : "bg-transparent border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))] hover:border-[hsl(var(--primary)/0.2)] hover:text-[hsl(var(--foreground))]"
                  }`}
                >
                  <AlertTriangle size={14} />
                  Priorité{" "}
                  {activeFilters.priorities.length > 0 &&
                    `(${activeFilters.priorities.length})`}
                  <ChevronDown
                    size={14}
                    className={`transition-transform ${openDropdown === "priority" ? "rotate-180" : ""}`}
                  />
                </button>
                {openDropdown === "priority" && (
                  <div className="absolute top-11 right-0 w-56 bg-white dark:bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-xl shadow-xl z-[100] animate-fade-in flex flex-col gap-1 p-2">
                    {priorities.map((prio) => (
                      <label
                        key={prio.value}
                        className="flex items-center gap-2.5 p-2 hover:bg-[hsl(var(--muted))] rounded-md cursor-pointer text-sm font-medium transition-colors"
                      >
                        <input
                          type="checkbox"
                          checked={activeFilters.priorities.includes(
                            prio.value,
                          )}
                          onChange={() =>
                            toggleFilter("priorities", prio.value)
                          }
                          className="accent-[hsl(var(--primary))] w-4 h-4 cursor-pointer"
                        />
                        {prio.label}
                      </label>
                    ))}
                  </div>
                )}
              </div>

              {/* Agent Filter — admin/tech only */}
              {!isUser && agents.length > 0 && (
                <div className="relative" onClick={(e) => e.stopPropagation()}>
                  <button
                    onClick={() =>
                      setOpenDropdown(openDropdown === "agent" ? null : "agent")
                    }
                    className={`flex items-center gap-1.5 h-10 px-3.5 rounded-lg text-sm font-semibold transition-all duration-200 border ${
                      selectedAgent !== "" || openDropdown === "agent"
                        ? "bg-[hsl(var(--primary)/0.12)] border-[hsl(var(--primary)/0.3)] text-[hsl(var(--primary))]"
                        : "bg-transparent border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))] hover:border-[hsl(var(--primary)/0.2)] hover:text-[hsl(var(--foreground))]"
                    }`}
                    id="agent-filter-btn"
                  >
                    <Users size={14} />
                    Agent {selectedAgent !== "" && `(•)`}
                    <ChevronDown
                      size={14}
                      className={`transition-transform ${openDropdown === "agent" ? "rotate-180" : ""}`}
                    />
                  </button>
                  {openDropdown === "agent" && (
                    <div className="absolute top-11 right-0 sm:left-0 sm:right-auto mt-1 w-56 bg-white dark:bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-xl shadow-xl z-[100] animate-fade-in flex flex-col gap-1 p-2">
                      {/* Option: tous */}
                      <button
                        onClick={() => {
                          setSelectedAgent("");
                          setOpenDropdown(null);
                        }}
                        className={`flex items-center gap-2 w-full text-left px-2.5 py-2 rounded-md text-sm font-medium transition-colors ${
                          selectedAgent === ""
                            ? "bg-[hsl(var(--primary)/0.1)] text-[hsl(var(--primary))]"
                            : "hover:bg-[hsl(var(--muted))] text-[hsl(var(--foreground))]"
                        }`}
                      >
                        <span className="w-5 h-5 rounded-full bg-[hsl(var(--muted))] flex items-center justify-center text-[9px] font-bold">
                          ✓
                        </span>
                        Tous les agents
                      </button>
                      {/* Option: non assigné */}
                      <button
                        onClick={() => {
                          setSelectedAgent("__unassigned__");
                          setOpenDropdown(null);
                        }}
                        className={`flex items-center gap-2 w-full text-left px-2.5 py-2 rounded-md text-sm font-medium transition-colors ${
                          selectedAgent === "__unassigned__"
                            ? "bg-[hsl(var(--primary)/0.1)] text-[hsl(var(--primary))]"
                            : "hover:bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]"
                        }`}
                      >
                        <span className="w-5 h-5 rounded-full border-2 border-dashed border-[hsl(var(--border))] flex items-center justify-center text-[9px]">
                          −
                        </span>
                        <span className="italic">Non assigné</span>
                      </button>
                      <div className="my-1 border-t border-[hsl(var(--border)/0.5)]" />
                      {agents
                        .filter(
                          (agent) =>
                            agent.role === "admin" ||
                            agent.role === "agent" ||
                            agent.role === "tech",
                        )
                        .map((agent) => {
                          const initials = agent.name
                            .trim()
                            .split(" ")
                            .filter(Boolean)
                            .map((p: any) => p[0])
                            .join("")
                            .toUpperCase()
                            .slice(0, 2);
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
                          for (let i = 0; i < agent.name.length; i++)
                            hash =
                              agent.name.charCodeAt(i) + ((hash << 5) - hash);
                          const color = colors[Math.abs(hash) % colors.length];

                          const roleLabel =
                            agent.role === "admin"
                              ? "ADMINISTRATEUR"
                              : "TECHNICIEN";
                          const roleColor =
                            agent.role === "admin"
                              ? "text-indigo-500 dark:text-indigo-400"
                              : "text-emerald-500 dark:text-emerald-400";

                          return (
                            <button
                              key={agent.id}
                              onClick={() => {
                                setSelectedAgent(agent.name);
                                setOpenDropdown(null);
                              }}
                              className={`flex items-center gap-2 w-full text-left px-2.5 py-2 rounded-md text-sm font-medium transition-colors ${
                                selectedAgent === agent.name
                                  ? "bg-[hsl(var(--primary)/0.1)] text-[hsl(var(--primary))]"
                                  : "hover:bg-[hsl(var(--muted))] text-[hsl(var(--foreground))]"
                              }`}
                            >
                              <span
                                className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold text-white flex-shrink-0"
                                style={{ background: color }}
                              >
                                {initials}
                              </span>
                              <div className="flex flex-col min-w-0">
                                <span className="truncate">{agent.name}</span>
                                <span
                                  className={`text-[9px] uppercase font-bold tracking-wider ${roleColor}`}
                                >
                                  {roleLabel}
                                </span>
                              </div>
                            </button>
                          );
                        })}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* View Toggle */}
            <div className="view-toggle flex-shrink-0 ml-auto lg:ml-0 bg-[hsl(var(--background)/0.5)] border border-[hsl(var(--border)/0.5)]">
              <button
                onClick={() => setViewMode("cards")}
                className={viewMode === "cards" ? "active" : ""}
                title="Vue cartes"
              >
                <LayoutGrid size={15} />
              </button>
              <button
                onClick={() => setViewMode("table")}
                className={viewMode === "table" ? "active" : ""}
                title="Vue tableau"
              >
                <List size={15} />
              </button>
            </div>
          </div>
        </div>

        {/* Category Range (Multi-Select) & Reset */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-[hsl(var(--border)/0.5)]">
          <div className="flex flex-wrap gap-2">
            {categories.map((cat) => {
              const isSelected = activeFilters.categories.includes(cat);
              return (
                <button
                  key={cat}
                  onClick={() => toggleFilter("categories", cat)}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 cursor-pointer border ${
                    isSelected
                      ? "bg-[hsl(var(--primary)/0.12)] border-[hsl(var(--primary)/0.3)] text-[hsl(var(--primary))]"
                      : "bg-[hsl(var(--background)/0.5)] border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))] hover:border-[hsl(var(--primary)/0.2)] hover:text-[hsl(var(--foreground))]"
                  }`}
                >
                  {cat}
                </button>
              );
            })}
          </div>

          {/* Reset Button & Dynamic Counter */}
          <div className="flex items-center gap-4 w-full sm:w-auto ml-auto">
            <span className="text-xs font-medium text-[hsl(var(--muted-foreground))] bg-[hsl(var(--muted)/0.5)] px-3 py-1.5 rounded-md">
              <span className="text-[hsl(var(--foreground))] font-bold">
                {filteredTickets.length}
              </span>{" "}
              ticket{filteredTickets.length !== 1 ? "s" : ""}{" "}
              {hasActiveFilters && "trouvé(s)"}
            </span>

            {hasActiveFilters && (
              <button
                onClick={resetFilters}
                className="flex items-center gap-1.5 text-xs font-semibold text-red-500 hover:text-red-600 bg-red-500/10 hover:bg-red-500/20 px-3 py-1.5 rounded-md transition-colors"
              >
                <XCircle size={14} />
                Réinitialiser
              </button>
            )}

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
                  {activeTabTickets.length}
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
                  {resolvedTabTickets.length}
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ─── Ticket List ─── */}
      {tabFilteredTickets.length === 0 ? (
        <div
          className="glass-card flex flex-col items-center justify-center py-20 text-center animate-fade-in"
          style={{ animationDelay: "0.3s" }}
        >
          <div className="w-16 h-16 rounded-2xl bg-[hsl(var(--muted))] flex items-center justify-center mb-4">
            {activeTab === "active" ? (
              <ClipboardList
                size={28}
                className="text-[hsl(var(--muted-foreground)/0.5)]"
              />
            ) : (
              <History
                size={28}
                className="text-[hsl(var(--muted-foreground)/0.5)]"
              />
            )}
          </div>
          <h3 className="text-lg font-semibold mb-1">
            {activeTab === "active"
              ? "Aucun ticket actif"
              : "Aucun ticket résolu"}
          </h3>
          <p className="text-sm text-[hsl(var(--muted-foreground))] max-w-sm">
            {tickets.length === 0
              ? 'Créez votre premier ticket en cliquant sur le bouton "Nouveau ticket" ci-dessus.'
              : activeTab === "active"
                ? "Tous les tickets sont résolus ou aucun ne correspond à vos filtres."
                : "Aucun ticket résolu ne correspond à vos filtres."}
          </p>
          {hasActiveFilters && (
            <button
              onClick={resetFilters}
              className="mt-6 btn-ghost text-sm font-semibold text-[hsl(var(--primary))] hover:text-[hsl(var(--primary)/0.9)] hover:bg-[hsl(var(--primary)/0.1)] border border-[hsl(var(--primary)/0.2)]"
            >
              Effacer tous les filtres
            </button>
          )}
        </div>
      ) : viewMode === "cards" ? (
        <div
          key={activeTab}
          className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4"
        >
          {tabFilteredTickets.map((ticket, idx) => (
            <TicketCard
              key={ticket.id}
              ticket={ticket}
              index={idx}
              onRefresh={fetchTickets}
            />
          ))}
        </div>
      ) : (
        <TicketTable tickets={tabFilteredTickets} onRefresh={fetchTickets} />
      )}

      {/* ─── Modal ─── */}
      <TicketModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={fetchTickets}
      />
    </div>
  );
}

// Wrap with ProtectedRoute
export default function Home() {
  return (
    <ProtectedRoute>
      <Dashboard />
    </ProtectedRoute>
  );
}
