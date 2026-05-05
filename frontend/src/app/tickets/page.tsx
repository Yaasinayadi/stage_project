"use client";

import { useState, useEffect } from "react";
import axios from "axios";
import {
  PlusCircle,
  Search,
  LayoutGrid,
  List,
  Ticket,
  CheckCircle2,
  AlertTriangle,
  Inbox,
  Filter,
  ChevronDown,
  XCircle,
  X,
  Activity,
  ArrowUpRight,
  ClipboardList,
  History,
  Users,
  Calendar,
  SlidersHorizontal,
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
  "waiting_material",
  "blocked",
  "escalated",
];
const RESOLVED_STATES = ["resolved", "closed"];

const VISIBLE_PERIODS = [
  { id: "today", label: "Aujourd'hui" },
  { id: "week", label: "7 Jours" },
  { id: "month", label: "Mois" },
  { id: "all", label: "Global" },
];
const MORE_PERIODS = [
  { id: "yesterday", label: "Hier" },
  { id: "30days", label: "30 Jours" },
];

function Dashboard() {
  const { user } = useAuth();
  const [tickets, setTickets] = useState<TicketType[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"active" | "resolved">("active");
  const [period, setPeriod] = useState("month");
  const [customStartDate, setCustomStartDate] = useState("");
  const [customEndDate, setCustomEndDate] = useState("");
  const [isMorePeriodsOpen, setIsMorePeriodsOpen] = useState(false);

  const customDateError = (() => {
    if (!customStartDate && !customEndDate) return null;
    const todayStr = new Date().toISOString().split('T')[0];
    if ((customStartDate && customStartDate > todayStr) || (customEndDate && customEndDate > todayStr)) {
      return "La date ne peut pas être dans le futur.";
    }
    if (customStartDate && customEndDate && customStartDate > customEndDate) {
      return "La date 'Du' doit être avant 'Au'.";
    }
    return null;
  })();

  // View mode
  const [viewMode, setViewMode] = useState<"cards" | "table">("cards");

  // Quick Filters from Stats Cards
  const [activeQuickFilter, setActiveQuickFilter] = useState<"breached" | "escalated" | "in_progress" | null>(null);

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
    "status" | "priority" | "agent" | "category" | null
  >(null);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);

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
    setActiveQuickFilter(null);
  };

  const hasActiveFilters =
    activeFilters.search !== "" ||
    activeFilters.categories.length > 0 ||
    activeFilters.statuses.length > 0 ||
    activeFilters.priorities.length > 0 ||
    selectedAgent !== "" ||
    activeQuickFilter !== null;

  const mobileFilterCount =
    activeFilters.categories.length +
    activeFilters.statuses.length +
    activeFilters.priorities.length +
    (selectedAgent !== "" ? 1 : 0);

  // ── Global Temporal Filter (Admin Only) ──
  const periodFilteredTickets = tickets.filter((ticket) => {
    if (user?.x_support_role !== "admin" || period === "all") return true;
    const ticketDate = ticket.create_date ? new Date(ticket.create_date) : new Date();
    const now = new Date();
    if (period === "today") {
      return ticketDate.toDateString() === now.toDateString();
    } else if (period === "yesterday") {
      const yesterday = new Date();
      yesterday.setDate(now.getDate() - 1);
      return ticketDate.toDateString() === yesterday.toDateString();
    } else if (period === "week") {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(now.getDate() - 7);
      return ticketDate >= sevenDaysAgo;
    } else if (period === "month") {
      return ticketDate.getMonth() === now.getMonth() && ticketDate.getFullYear() === now.getFullYear();
    } else if (period === "30days") {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(now.getDate() - 30);
      return ticketDate >= thirtyDaysAgo;
    } else if (period === "custom") {
      if (customStartDate && customEndDate) {
        const start = new Date(customStartDate);
        start.setHours(0, 0, 0, 0);
        const end = new Date(customEndDate);
        end.setHours(23, 59, 59, 999);
        return ticketDate >= start && ticketDate <= end;
      }
      return true;
    }
    return true;
  });

  // Filter logic (Cumulative Intersection)
  const filteredTickets = periodFilteredTickets.filter((ticket) => {
    // 0. Quick Filters
    if (activeQuickFilter === "breached" && (ticket.sla_status !== "breached" || ticket.state === "resolved" || ticket.state === "closed")) return false;
    if (activeQuickFilter === "escalated" && ticket.state !== "escalated") return false;
    if (activeQuickFilter === "in_progress" && ticket.state !== "assigned" && ticket.state !== "in_progress") return false;

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
  const totalTickets = periodFilteredTickets.length;
  const resolvedCount = periodFilteredTickets.filter((t) =>
    ["resolved", "closed"].includes(t.state),
  ).length;
  const breachedCount = periodFilteredTickets.filter(
    (t) =>
      !["resolved", "closed"].includes(t.state) && t.sla_status === "breached",
  ).length;
  const inProgressCount = periodFilteredTickets.filter(
    (t) =>
      !["resolved", "closed"].includes(t.state) && t.sla_status !== "breached",
  ).length;
  const escalatedCount = periodFilteredTickets.filter((t) => t.state === "escalated").length;

  const isUser = user?.x_support_role === "user" || !user?.x_support_role;

  return (
    <div
      className="p-4 sm:p-6 lg:p-8 max-w-[1400px] mx-auto space-y-4 sm:space-y-6"
      onClick={() => {
        setOpenDropdown(null);
        setIsMorePeriodsOpen(false);
      }}
    >
      {/* ─── Header ─── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-fade-in relative z-50">
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
        {user?.x_support_role !== "admin" ? (
          <button
            onClick={() => setIsModalOpen(true)}
            className="btn-primary shadow-md hover:shadow-lg transition-all shadow-[hsl(var(--primary)/0.2)]"
            id="new-ticket-btn"
          >
            <PlusCircle size={18} />
            Nouveau ticket
          </button>
        ) : (
          <div className="flex items-center gap-2 relative z-50">
            <div className="flex bg-[hsl(var(--muted)/0.3)] p-1.5 rounded-xl border border-[hsl(var(--border)/0.5)] shadow-sm w-max">
              {/* Primary Tabs */}
              {VISIBLE_PERIODS.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setPeriod(p.id)}
                  className={`px-3 sm:px-4 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                    period === p.id
                      ? "bg-[hsl(var(--background))] text-[hsl(var(--primary))] shadow-sm border border-[hsl(var(--border)/0.5)]"
                      : "text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] border border-transparent"
                  }`}
                >
                  {p.label}
                </button>
              ))}
              
              {/* More button */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setIsMorePeriodsOpen(!isMorePeriodsOpen);
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap ${
                  MORE_PERIODS.some(p => p.id === period) || period === "custom"
                    ? "bg-[hsl(var(--background))] text-[hsl(var(--primary))] shadow-sm border border-[hsl(var(--border)/0.5)]"
                    : "text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] border border-transparent"
                }`}
              >
                {period === "custom" ? (
                  <><Calendar size={13} /> {customStartDate && customEndDate ? `${new Date(customStartDate).toLocaleDateString('fr-FR', {day: '2-digit', month: 'short'})} - ${new Date(customEndDate).toLocaleDateString('fr-FR', {day: '2-digit', month: 'short'})}` : "Personnalisé"}</>
                ) : (
                  MORE_PERIODS.find(p => p.id === period)?.label || <><Calendar size={13} /> Plus</>
                )}
                <ChevronDown size={13} className={`transition-transform ${isMorePeriodsOpen ? "rotate-180" : ""}`} />
              </button>
            </div>

            {isMorePeriodsOpen && (
              <div 
                className="absolute top-[calc(100%+8px)] right-0 w-64 bg-[hsl(var(--popover))] border border-[hsl(var(--border))] rounded-xl shadow-2xl z-[100] p-2 animate-fade-in text-[hsl(var(--popover-foreground))]"
                onClick={e => e.stopPropagation()}
              >
                <div className="space-y-1 mb-2 pb-2 border-b border-[hsl(var(--border)/0.5)]">
                  {MORE_PERIODS.map(p => (
                    <button
                      key={p.id}
                      onClick={() => { setPeriod(p.id); setIsMorePeriodsOpen(false); }}
                      className={`w-full text-left text-xs px-3 py-2 rounded-md font-semibold transition-colors
                        ${period === p.id ? "bg-[hsl(var(--primary)/0.1)] text-[hsl(var(--primary))]" : "hover:bg-[hsl(var(--muted))] text-[hsl(var(--foreground))]"}`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
                
                <div className="px-1 pt-1 space-y-2">
                  <span className="text-[0.65rem] font-bold text-[hsl(var(--muted-foreground))] uppercase tracking-wide px-2">Personnalisé</span>
                  <div className="flex flex-col gap-2 px-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-[hsl(var(--muted-foreground))] w-6">Du</span>
                      <input 
                        type="date" 
                        max={new Date().toISOString().split('T')[0]}
                        className={`flex-1 bg-[hsl(var(--background))] border rounded text-[10px] p-1.5 outline-none transition-colors ${
                          customDateError && customStartDate && (!customEndDate || customStartDate > customEndDate || customStartDate > new Date().toISOString().split('T')[0])
                            ? "border-red-500/50 focus:border-red-500" 
                            : "border-[hsl(var(--border))] focus:border-[hsl(var(--primary))]"
                        }`}
                        value={customStartDate}
                        onChange={e => setCustomStartDate(e.target.value)}
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-[hsl(var(--muted-foreground))] w-6">Au</span>
                      <input 
                        type="date" 
                        max={new Date().toISOString().split('T')[0]}
                        className={`flex-1 bg-[hsl(var(--background))] border rounded text-[10px] p-1.5 outline-none transition-colors ${
                          customDateError && customEndDate && (customStartDate > customEndDate || customEndDate > new Date().toISOString().split('T')[0])
                            ? "border-red-500/50 focus:border-red-500" 
                            : "border-[hsl(var(--border))] focus:border-[hsl(var(--primary))]"
                        }`}
                        value={customEndDate}
                        onChange={e => setCustomEndDate(e.target.value)}
                      />
                    </div>
                  </div>
                  {customDateError && (
                    <div className="text-[10px] text-red-500 font-medium px-1 mt-2 leading-tight flex items-start gap-1.5 animate-fade-in">
                      <AlertTriangle size={12} className="flex-shrink-0 mt-0.5" /> 
                      <span>{customDateError}</span>
                    </div>
                  )}
                  <button
                    disabled={!customStartDate || !customEndDate || !!customDateError}
                    onClick={() => { setPeriod("custom"); setIsMorePeriodsOpen(false); }}
                    className="w-full mt-2 py-1.5 rounded-lg bg-[hsl(var(--primary))] text-white text-[11px] font-bold disabled:opacity-50 disabled:cursor-not-allowed transition-all hover:opacity-90"
                  >
                    Appliquer la période
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ─── KPI Stats Row ─── */}
      <div
        className={`grid gap-2 sm:gap-4 ${isUser ? "grid-cols-2 lg:grid-cols-4" : "grid-cols-2 lg:grid-cols-5"}`}
      >
        <StatsCard
          title="Total Tickets"
          value={totalTickets}
          icon={<Ticket size={20} />}
          color="#6366f1"
          loading={loading}
          delay={0}
          onClick={() => {
            resetFilters();
            setActiveTab("active");
          }}
          isActive={activeQuickFilter === null && activeTab === "active" && !hasActiveFilters}
        />
        <StatsCard
          title="Dépassé"
          value={breachedCount}
          icon={<AlertTriangle size={20} />}
          color="#ef4444"
          loading={loading}
          delay={80}
          onClick={() => {
            setActiveQuickFilter(activeQuickFilter === "breached" ? null : "breached");
            setActiveTab("active");
          }}
          isActive={activeQuickFilter === "breached"}
        />
        {!isUser && (
          <StatsCard
            title="Tickets Escaladés"
            value={escalatedCount}
            icon={<ArrowUpRight size={20} />}
            color="#f59e0b"
            loading={loading}
            delay={160}
            onClick={() => {
              setActiveQuickFilter(activeQuickFilter === "escalated" ? null : "escalated");
              setActiveTab("active");
            }}
            isActive={activeQuickFilter === "escalated"}
          />
        )}
        <StatsCard
          title="En Cours"
          value={inProgressCount}
          icon={<Activity size={20} />}
          color="#3b82f6"
          loading={loading}
          delay={isUser ? 160 : 240}
          onClick={() => {
            setActiveQuickFilter(activeQuickFilter === "in_progress" ? null : "in_progress");
            if (activeQuickFilter !== "in_progress") {
              setActiveFilters(prev => ({ ...prev, statuses: ["En cours"] }));
            } else {
              setActiveFilters(prev => ({ ...prev, statuses: prev.statuses.filter(s => s !== "En cours") }));
            }
            setActiveTab("active");
          }}
          isActive={activeQuickFilter === "in_progress"}
        />
        <StatsCard
          title="Résolus"
          value={resolvedCount}
          icon={<CheckCircle2 size={20} />}
          color="#10b981"
          loading={loading}
          delay={isUser ? 240 : 320}
          onClick={() => {
            setActiveFilters(prev => ({ ...prev, statuses: [] }));
            setActiveQuickFilter(null);
            setActiveTab("resolved");
          }}
          isActive={activeTab === "resolved" && activeQuickFilter === null}
        />
      </div>

      {/* ─── Unified Toolbar ─── */}
      <div
        className="glass-card relative z-20 shadow-sm animate-fade-in"
        style={{ animationDelay: "0.2s" }}
        onClick={() => setOpenDropdown(null)}
      >
        <div className="flex items-center gap-2 p-2.5 sm:p-3 flex-wrap sm:flex-nowrap">

          {/* ── SEARCH: icon-only on mobile, full bar on desktop ── */}
          <div className="relative flex items-center" onClick={(e) => e.stopPropagation()}>
            {/* Mobile collapsed icon */}
            {!mobileSearchOpen && (
              <button
                className="md:hidden flex items-center justify-center w-9 h-9 rounded-lg border border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))] hover:border-[hsl(var(--primary)/0.3)] transition-all"
                onClick={() => setMobileSearchOpen(true)}
                aria-label="Rechercher"
              >
                <Search size={16} />
              </button>
            )}
            {/* Mobile expanded + desktop always visible */}
            <div className={`${mobileSearchOpen ? "flex" : "hidden"} md:flex`}>
              <div className="relative w-52 lg:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[hsl(var(--muted-foreground))]" size={15} />
                <input
                  type="text"
                  value={activeFilters.search}
                  onChange={(e) => setActiveFilters({ ...activeFilters, search: e.target.value })}
                  placeholder="Rechercher..."
                  autoFocus={mobileSearchOpen}
                  className="input-field focus-ring !pl-9 h-9 text-sm bg-[hsl(var(--background)/0.5)] w-full"
                  id="search-input"
                />
              </div>
              {mobileSearchOpen && (
                <button
                  className="md:hidden ml-1 w-9 h-9 rounded-lg flex items-center justify-center text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))]"
                  onClick={() => setMobileSearchOpen(false)}
                >
                  <X size={16} />
                </button>
              )}
            </div>
          </div>

          {/* ── DESKTOP DROPDOWNS (hidden on mobile) ── */}
          <div className="hidden md:flex items-center gap-2 flex-wrap" onClick={(e) => e.stopPropagation()}>
            {/* Categories */}
            <div className="relative">
              <button
                onClick={() => setOpenDropdown(openDropdown === "category" ? null : "category")}
                className={`flex items-center gap-1.5 h-9 px-3 rounded-lg text-sm font-semibold transition-all border ${
                  activeFilters.categories.length > 0 || openDropdown === "category"
                    ? "bg-[hsl(var(--primary)/0.12)] border-[hsl(var(--primary)/0.3)] text-[hsl(var(--primary))]"
                    : "bg-transparent border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))] hover:border-[hsl(var(--primary)/0.2)] hover:text-[hsl(var(--foreground))]"
                }`}
              >
                <Inbox size={14} />
                Catégories{activeFilters.categories.length > 0 && ` (${activeFilters.categories.length})`}
                <ChevronDown size={13} className={`transition-transform ${openDropdown === "category" ? "rotate-180" : ""}`} />
              </button>
              {openDropdown === "category" && (
                <div className="absolute top-10 left-0 mt-1 w-52 bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-xl shadow-xl z-[200] animate-fade-in flex flex-col gap-1 p-2 max-h-60 overflow-y-auto">
                  {categories.map((cat) => (
                    <label key={cat} className="flex items-center gap-2.5 p-2 hover:bg-[hsl(var(--muted))] rounded-md cursor-pointer text-sm font-medium transition-colors">
                      <input type="checkbox" checked={activeFilters.categories.includes(cat)} onChange={() => toggleFilter("categories", cat)} className="accent-[hsl(var(--primary))] w-4 h-4 cursor-pointer" />
                      {cat}
                    </label>
                  ))}
                </div>
              )}
            </div>

            {/* Status */}
            <div className="relative">
              <button
                onClick={() => setOpenDropdown(openDropdown === "status" ? null : "status")}
                className={`flex items-center gap-1.5 h-9 px-3 rounded-lg text-sm font-semibold transition-all border ${
                  activeFilters.statuses.length > 0 || openDropdown === "status"
                    ? "bg-[hsl(var(--primary)/0.12)] border-[hsl(var(--primary)/0.3)] text-[hsl(var(--primary))]"
                    : "bg-transparent border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))] hover:border-[hsl(var(--primary)/0.2)] hover:text-[hsl(var(--foreground))]"
                }`}
              >
                <Filter size={14} />
                Statut{activeFilters.statuses.length > 0 && ` (${activeFilters.statuses.length})`}
                <ChevronDown size={13} className={`transition-transform ${openDropdown === "status" ? "rotate-180" : ""}`} />
              </button>
              {openDropdown === "status" && (
                <div className="absolute top-10 left-0 mt-1 w-52 bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-xl shadow-xl z-[200] animate-fade-in flex flex-col gap-1 p-2 max-h-60 overflow-y-auto">
                  {statuses.map((st) => (
                    <label key={st} className="flex items-center gap-2.5 p-2 hover:bg-[hsl(var(--muted))] rounded-md cursor-pointer text-sm font-medium transition-colors">
                      <input type="checkbox" checked={activeFilters.statuses.includes(st)} onChange={() => toggleFilter("statuses", st)} className="accent-[hsl(var(--primary))] w-4 h-4 cursor-pointer" />
                      {st}
                    </label>
                  ))}
                </div>
              )}
            </div>

            {/* Priority */}
            <div className="relative">
              <button
                onClick={() => setOpenDropdown(openDropdown === "priority" ? null : "priority")}
                className={`flex items-center gap-1.5 h-9 px-3 rounded-lg text-sm font-semibold transition-all border ${
                  activeFilters.priorities.length > 0 || openDropdown === "priority"
                    ? "bg-[hsl(var(--primary)/0.12)] border-[hsl(var(--primary)/0.3)] text-[hsl(var(--primary))]"
                    : "bg-transparent border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))] hover:border-[hsl(var(--primary)/0.2)] hover:text-[hsl(var(--foreground))]"
                }`}
              >
                <AlertTriangle size={14} />
                Priorité{activeFilters.priorities.length > 0 && ` (${activeFilters.priorities.length})`}
                <ChevronDown size={13} className={`transition-transform ${openDropdown === "priority" ? "rotate-180" : ""}`} />
              </button>
              {openDropdown === "priority" && (
                <div className="absolute top-10 left-0 mt-1 w-48 bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-xl shadow-xl z-[200] animate-fade-in flex flex-col gap-1 p-2 max-h-60 overflow-y-auto">
                  {priorities.map((prio) => (
                    <label key={prio.value} className="flex items-center gap-2.5 p-2 hover:bg-[hsl(var(--muted))] rounded-md cursor-pointer text-sm font-medium transition-colors">
                      <input type="checkbox" checked={activeFilters.priorities.includes(prio.value)} onChange={() => toggleFilter("priorities", prio.value)} className="accent-[hsl(var(--primary))] w-4 h-4 cursor-pointer" />
                      {prio.label}
                    </label>
                  ))}
                </div>
              )}
            </div>

            {/* Agent */}
            {!isUser && agents.length > 0 && (
              <div className="relative">
                <button
                  onClick={() => setOpenDropdown(openDropdown === "agent" ? null : "agent")}
                  className={`flex items-center gap-1.5 h-9 px-3 rounded-lg text-sm font-semibold transition-all border ${
                    selectedAgent !== "" || openDropdown === "agent"
                      ? "bg-[hsl(var(--primary)/0.12)] border-[hsl(var(--primary)/0.3)] text-[hsl(var(--primary))]"
                      : "bg-transparent border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))] hover:border-[hsl(var(--primary)/0.2)] hover:text-[hsl(var(--foreground))]"
                  }`}
                >
                  <Users size={14} />
                  Agent{selectedAgent !== "" && " (•)"}
                  <ChevronDown size={13} className={`transition-transform ${openDropdown === "agent" ? "rotate-180" : ""}`} />
                </button>
                {openDropdown === "agent" && (
                  <div className="absolute top-10 left-0 mt-1 w-56 bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-xl shadow-xl z-[200] animate-fade-in flex flex-col gap-1 p-2 max-h-72 overflow-y-auto">
                    <button onClick={() => { setSelectedAgent(""); setOpenDropdown(null); }} className={`flex items-center gap-2 w-full text-left px-2.5 py-2 rounded-md text-sm font-medium transition-colors ${selectedAgent === "" ? "bg-[hsl(var(--primary)/0.1)] text-[hsl(var(--primary))]" : "hover:bg-[hsl(var(--muted))] text-[hsl(var(--foreground))]"}`}>
                      <span className="w-5 h-5 rounded-full bg-[hsl(var(--muted))] flex items-center justify-center text-[9px] font-bold">✓</span>
                      Tous les agents
                    </button>
                    <button onClick={() => { setSelectedAgent("__unassigned__"); setOpenDropdown(null); }} className={`flex items-center gap-2 w-full text-left px-2.5 py-2 rounded-md text-sm font-medium transition-colors ${selectedAgent === "__unassigned__" ? "bg-[hsl(var(--primary)/0.1)] text-[hsl(var(--primary))]" : "hover:bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]"}`}>
                      <span className="w-5 h-5 rounded-full border-2 border-dashed border-[hsl(var(--border))] flex items-center justify-center text-[9px]">−</span>
                      <span className="italic">Non assigné</span>
                    </button>
                    <div className="my-1 border-t border-[hsl(var(--border)/0.5)]" />
                    {agents.filter((a) => ["admin","agent","tech"].includes(a.role || "")).map((agent) => {
                      const initials = agent.name.trim().split(" ").filter(Boolean).map((p: any) => p[0]).join("").toUpperCase().slice(0, 2);
                      const colors = ["#6366f1","#8b5cf6","#ec4899","#10b981","#f59e0b","#06b6d4","#3b82f6","#ef4444"];
                      let hash = 0; for (let i = 0; i < agent.name.length; i++) hash = agent.name.charCodeAt(i) + ((hash << 5) - hash);
                      const color = colors[Math.abs(hash) % colors.length];
                      const roleLabel = agent.role === "admin" ? "ADMINISTRATEUR" : "TECHNICIEN";
                      const roleColor = agent.role === "admin" ? "text-indigo-500" : "text-emerald-500";
                      return (
                        <button key={agent.id} onClick={() => { setSelectedAgent(agent.name); setOpenDropdown(null); }} className={`flex items-center gap-2 w-full text-left px-2.5 py-2 rounded-md text-sm font-medium transition-colors ${selectedAgent === agent.name ? "bg-[hsl(var(--primary)/0.1)] text-[hsl(var(--primary))]" : "hover:bg-[hsl(var(--muted))] text-[hsl(var(--foreground))]"}`}>
                          <span className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold text-white flex-shrink-0" style={{ background: color }}>{initials}</span>
                          <div className="flex flex-col min-w-0"><span className="truncate">{agent.name}</span><span className={`text-[9px] uppercase font-bold tracking-wider ${roleColor}`}>{roleLabel}</span></div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Reset */}
            {hasActiveFilters && (
              <button onClick={resetFilters} className="flex items-center gap-1.5 h-9 px-3 text-xs font-semibold text-red-500 hover:text-red-600 bg-red-500/10 hover:bg-red-500/20 rounded-lg transition-colors border border-red-500/20">
                <XCircle size={14} />
                Réinitialiser
              </button>
            )}
          </div>

          {/* ── MOBILE: Single "Filtres" button ── */}
          <button
            className={`md:hidden flex items-center gap-1.5 h-9 px-3 rounded-lg text-sm font-semibold transition-all border ${
              mobileFilterCount > 0
                ? "bg-[hsl(var(--primary)/0.12)] border-[hsl(var(--primary)/0.3)] text-[hsl(var(--primary))]"
                : "bg-transparent border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))]"
            }`}
            onClick={(e) => { e.stopPropagation(); setMobileFiltersOpen(true); }}
          >
            <SlidersHorizontal size={15} />
            Filtres
            {mobileFilterCount > 0 && (
              <span className="w-5 h-5 rounded-full bg-[hsl(var(--primary))] text-white text-[10px] font-bold flex items-center justify-center">{mobileFilterCount}</span>
            )}
          </button>

          {/* ── SPACER ── */}
          <div className="flex-1" />

          {/* ── Ticket count (desktop) ── */}
          <span className="hidden md:flex text-xs font-medium text-[hsl(var(--muted-foreground))] bg-[hsl(var(--muted)/0.5)] px-2.5 py-1.5 rounded-md whitespace-nowrap">
            <span className="text-[hsl(var(--foreground))] font-bold mr-1">{filteredTickets.length}</span>
            ticket{filteredTickets.length !== 1 ? "s" : ""}
          </span>

          {/* ── TABS ── */}
          <div className="flex items-center gap-0.5 p-0.5 bg-[hsl(var(--muted)/0.5)] rounded-lg border border-[hsl(var(--border)/0.4)]">
            <button
              onClick={() => setActiveTab("active")}
              title="En attente"
              className={`flex items-center gap-1 h-7 px-2 rounded-md text-xs font-semibold transition-all ${activeTab === "active" ? "bg-[hsl(var(--card))] text-[hsl(var(--foreground))] shadow-sm" : "text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"}`}
            >
              <ClipboardList size={13} />
              <span className="hidden sm:inline">En attente</span>
              <span className={`text-[10px] font-bold w-4 h-4 flex items-center justify-center rounded-full ${activeTab === "active" ? "bg-[hsl(var(--primary))] text-white" : "bg-[hsl(var(--border))] text-[hsl(var(--muted-foreground))]"}`}>{activeTabTickets.length}</span>
            </button>
            <button
              onClick={() => { setActiveFilters(prev => ({ ...prev, statuses: [] })); setActiveQuickFilter(null); setActiveTab("resolved"); }}
              title="Terminés"
              className={`flex items-center gap-1 h-7 px-2 rounded-md text-xs font-semibold transition-all ${activeTab === "resolved" ? "bg-[hsl(var(--card))] text-[hsl(var(--foreground))] shadow-sm" : "text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"}`}
            >
              <History size={13} />
              <span className="hidden sm:inline">Terminés</span>
              <span className={`text-[10px] font-bold w-4 h-4 flex items-center justify-center rounded-full ${activeTab === "resolved" ? "bg-emerald-500 text-white" : "bg-[hsl(var(--border))] text-[hsl(var(--muted-foreground))]"}`}>{resolvedTabTickets.length}</span>
            </button>
          </div>

          {/* ── VIEW TOGGLE ── */}
          <div className="view-toggle bg-[hsl(var(--background)/0.5)] border border-[hsl(var(--border)/0.5)]">
            <button onClick={() => setViewMode("cards")} className={viewMode === "cards" ? "active" : ""} title="Vue cartes"><LayoutGrid size={15} /></button>
            <button onClick={() => setViewMode("table")} className={viewMode === "table" ? "active" : ""} title="Vue tableau"><List size={15} /></button>
          </div>
        </div>
      </div>

      {/* ── MOBILE BOTTOM SHEET ── */}
      {mobileFiltersOpen && (
        <div className="fixed inset-0 z-[9998] md:hidden" onClick={() => setMobileFiltersOpen(false)}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div className="absolute bottom-0 left-0 right-0 bg-[hsl(var(--card))] rounded-t-2xl max-h-[85vh] overflow-y-auto animate-slide-up" onClick={(e) => e.stopPropagation()}>
            <div className="p-5">
              {/* Handle */}
              <div className="w-10 h-1 bg-[hsl(var(--border))] rounded-full mx-auto mb-4" />
              <div className="flex items-center justify-between mb-5">
                <h3 className="font-bold text-base">Filtres</h3>
                <div className="flex items-center gap-2">
                  {hasActiveFilters && (
                    <button onClick={() => { resetFilters(); setMobileFiltersOpen(false); }} className="text-xs font-semibold text-red-500 hover:text-red-600 bg-red-500/10 px-3 py-1.5 rounded-lg transition-colors">Réinitialiser</button>
                  )}
                  <button onClick={() => setMobileFiltersOpen(false)} className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-[hsl(var(--muted))]"><X size={18} className="text-[hsl(var(--muted-foreground))]" /></button>
                </div>
              </div>

              {/* Search */}
              <div className="mb-5">
                <p className="text-xs font-bold uppercase tracking-wide text-[hsl(var(--muted-foreground))] mb-2">Recherche</p>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[hsl(var(--muted-foreground))]" size={15} />
                  <input type="text" value={activeFilters.search} onChange={(e) => setActiveFilters({ ...activeFilters, search: e.target.value })} placeholder="Rechercher un ticket..." className="input-field focus-ring !pl-9 h-10 text-sm w-full" />
                </div>
              </div>

              {/* Categories */}
              <div className="mb-5">
                <p className="text-xs font-bold uppercase tracking-wide text-[hsl(var(--muted-foreground))] mb-2">Catégories</p>
                <div className="flex flex-wrap gap-2">
                  {categories.map((cat) => (
                    <button key={cat} onClick={() => toggleFilter("categories", cat)} className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${activeFilters.categories.includes(cat) ? "bg-[hsl(var(--primary)/0.12)] border-[hsl(var(--primary)/0.3)] text-[hsl(var(--primary))]" : "border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))]"}`}>{cat}</button>
                  ))}
                </div>
              </div>

              {/* Status */}
              <div className="mb-5">
                <p className="text-xs font-bold uppercase tracking-wide text-[hsl(var(--muted-foreground))] mb-2">Statut</p>
                <div className="flex flex-wrap gap-2">
                  {statuses.map((st) => (
                    <button key={st} onClick={() => toggleFilter("statuses", st)} className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${activeFilters.statuses.includes(st) ? "bg-[hsl(var(--primary)/0.12)] border-[hsl(var(--primary)/0.3)] text-[hsl(var(--primary))]" : "border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))]"}`}>{st}</button>
                  ))}
                </div>
              </div>

              {/* Priority */}
              <div className="mb-5">
                <p className="text-xs font-bold uppercase tracking-wide text-[hsl(var(--muted-foreground))] mb-2">Priorité</p>
                <div className="flex flex-wrap gap-2">
                  {priorities.map((prio) => (
                    <button key={prio.value} onClick={() => toggleFilter("priorities", prio.value)} className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${activeFilters.priorities.includes(prio.value) ? "bg-[hsl(var(--primary)/0.12)] border-[hsl(var(--primary)/0.3)] text-[hsl(var(--primary))]" : "border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))]"}`}>{prio.label}</button>
                  ))}
                </div>
              </div>

              {/* Agent */}
              {!isUser && agents.length > 0 && (
                <div className="mb-5">
                  <p className="text-xs font-bold uppercase tracking-wide text-[hsl(var(--muted-foreground))] mb-2">Agent</p>
                  <div className="flex flex-wrap gap-2">
                    <button onClick={() => setSelectedAgent("")} className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${selectedAgent === "" ? "bg-[hsl(var(--primary)/0.12)] border-[hsl(var(--primary)/0.3)] text-[hsl(var(--primary))]" : "border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))]"}`}>Tous</button>
                    {agents.filter((a) => ["admin","agent","tech"].includes(a.role || "")).map((agent) => (
                      <button key={agent.id} onClick={() => setSelectedAgent(selectedAgent === agent.name ? "" : agent.name)} className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${selectedAgent === agent.name ? "bg-[hsl(var(--primary)/0.12)] border-[hsl(var(--primary)/0.3)] text-[hsl(var(--primary))]" : "border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))]"}`}>{agent.name}</button>
                    ))}
                  </div>
                </div>
              )}

              <button onClick={() => setMobileFiltersOpen(false)} className="w-full btn-primary mt-2">
                Voir {filteredTickets.length} résultat{filteredTickets.length !== 1 ? "s" : ""}
              </button>
            </div>
          </div>
        </div>
      )}



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
