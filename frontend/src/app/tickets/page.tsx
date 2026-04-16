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
  XCircle
} from "lucide-react";
import StatsCard from "@/components/StatsCard";
import TicketCard, { getStatusInfo } from "@/components/TicketCard";
import TicketTable from "@/components/TicketTable";
import TicketModal from "@/components/TicketModal";
import ProtectedRoute from "@/components/ProtectedRoute";
import { useAuth } from "@/lib/auth";

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

function Dashboard() {
  const { user } = useAuth();
  const [tickets, setTickets] = useState<TicketType[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);

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
  
  const [openDropdown, setOpenDropdown] = useState<"status" | "priority" | null>(null);

  const categories = ["Logiciel", "Matériel", "Accès", "Réseau", "Messagerie", "Infrastructure", "Autre"];
  const statuses = ["Nouveau", "En cours", "En attente", "Résolu"];
  const priorities = [
    { value: "0", label: "Basse" },
    { value: "1", label: "Moyenne" },
    { value: "2", label: "Haute" },
    { value: "3", label: "Critique" }
  ];

  const fetchTickets = async () => {
    try {
      const url = user?.x_support_role === "user"
        ? `http://localhost:8069/api/tickets?user_id=${user.id}`
        : "http://localhost:8069/api/tickets";
      const res = await axios.get(url);
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
    fetchTickets();
  }, []);

  // ── Polling automatique toutes les 30s (sans loading spinner) ──
  useEffect(() => {
    const poll = async () => {
      try {
        const url = user?.x_support_role === "user"
          ? `http://localhost:8069/api/tickets?user_id=${user.id}`
          : "http://localhost:8069/api/tickets";
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

  const toggleFilter = (key: "categories" | "statuses" | "priorities", value: string) => {
    setActiveFilters((prev) => {
      const current = prev[key];
      const updated = current.includes(value)
        ? current.filter((v) => v !== value)
        : [...current, value];
      return { ...prev, [key]: updated };
    });
  };

  const resetFilters = () => {
    setActiveFilters({ search: "", categories: [], statuses: [], priorities: [] });
    setOpenDropdown(null);
  };

  const hasActiveFilters = 
    activeFilters.search !== "" || 
    activeFilters.categories.length > 0 || 
    activeFilters.statuses.length > 0 || 
    activeFilters.priorities.length > 0;

  // Filter logic (Cumulative Intersection)
  const filteredTickets = tickets.filter((ticket) => {
    // 1. Search
    const safeName = (ticket.name || "").toLowerCase();
    const safeDesc = (ticket.description || "").toLowerCase();
    const safeSearch = activeFilters.search.toLowerCase();
    const matchesSearch = !safeSearch || safeName.includes(safeSearch) || safeDesc.includes(safeSearch);

    // 2. Categories
    const ticketCat = ticket.category ? ticket.category.toLowerCase() : "autre";
    const matchesCategory =
      activeFilters.categories.length === 0 ||
      activeFilters.categories.some((cat) => ticketCat.includes(cat.toLowerCase()));

    // 3. Statuses
    const sInfo = getStatusInfo(ticket.state);
    const matchesStatus =
      activeFilters.statuses.length === 0 ||
      activeFilters.statuses.includes(sInfo.label);

    // 4. Priorities
    const matchesPriority =
      activeFilters.priorities.length === 0 ||
      activeFilters.priorities.includes(ticket.priority);

    return matchesSearch && matchesCategory && matchesStatus && matchesPriority;
  });

  // KPI calculations
  const totalTickets = tickets.length;
  const openCount = tickets.filter((t) => {
    const s = (t.state || "").toLowerCase();
    return s.includes("nouveau") || s.includes("new") || s.includes("ouvert");
  }).length;
  const inProgressCount = tickets.filter((t) => {
    const s = (t.state || "").toLowerCase();
    return s.includes("cours") || s.includes("progress") || s.includes("attente");
  }).length;
  const resolvedCount = tickets.filter((t) => {
    const s = (t.state || "").toLowerCase();
    return s.includes("résolu") || s.includes("resolved") || s.includes("done") || s.includes("fermé");
  }).length;

  return (
    <div className="p-6 lg:p-8 max-w-[1400px] mx-auto space-y-6" onClick={() => setOpenDropdown(null)}>
      {/* ─── Header ─── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-fade-in">
        <div>

          <h1 className="text-2xl font-bold tracking-tight">
            {user ? `Bonjour, ${user.name.split(" ")[0].charAt(0).toUpperCase() + user.name.split(" ")[0].slice(1)} ` : "Mes Tickets"}
          </h1>
          <br />
          <h1 className="text-2xl font-bold tracking-tight">Gestion des Tickets</h1>

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
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard title="Total Tickets" value={totalTickets} icon={<Ticket size={20} />} color="#6366f1" loading={loading} delay={0} />
        <StatsCard title="Ouverts" value={openCount} icon={<AlertTriangle size={20} />} color="#f59e0b" loading={loading} delay={80} />
        <StatsCard title="En Cours" value={inProgressCount} icon={<Clock size={20} />} color="#ff6d5a" loading={loading} delay={160} />
        <StatsCard title="Résolus" value={resolvedCount} icon={<CheckCircle2 size={20} />} color="#10b981" loading={loading} delay={240} />
      </div>

      {/* ─── Filters Bar ─── */}
      <div className="glass-card relative z-50 p-4 space-y-4 shadow-sm animate-fade-in" style={{ animationDelay: "0.2s" }}>
        <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
          
          {/* Top Row: Search & View Toggle */}
          <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto flex-1">
            <div className="relative flex-1 w-full max-w-md">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[hsl(var(--muted-foreground))]" size={16} />
              <input
                type="text"
                value={activeFilters.search}
                onChange={(e) => setActiveFilters({ ...activeFilters, search: e.target.value })}
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
                  onClick={() => setOpenDropdown(openDropdown === "status" ? null : "status")}
                  className={`flex items-center gap-1.5 h-10 px-3.5 rounded-lg text-sm font-semibold transition-all duration-200 border ${
                    activeFilters.statuses.length > 0 || openDropdown === "status"
                      ? "bg-[hsl(var(--primary)/0.12)] border-[hsl(var(--primary)/0.3)] text-[hsl(var(--primary))]"
                      : "bg-transparent border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))] hover:border-[hsl(var(--primary)/0.2)] hover:text-[hsl(var(--foreground))]"
                  }`}
                >
                  <Filter size={14} />
                  Statut {activeFilters.statuses.length > 0 && `(${activeFilters.statuses.length})`}
                  <ChevronDown size={14} className={`transition-transform ${openDropdown === "status" ? "rotate-180" : ""}`} />
                </button>
                {openDropdown === "status" && (
                  <div className="absolute top-11 right-0 sm:left-0 sm:right-auto mt-1 w-56 bg-white dark:bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-xl shadow-xl z-[100] animate-fade-in flex flex-col gap-1 p-2">
                    {statuses.map(st => (
                      <label key={st} className="flex items-center gap-2.5 p-2 hover:bg-[hsl(var(--muted))] rounded-md cursor-pointer text-sm font-medium transition-colors">
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
                  onClick={() => setOpenDropdown(openDropdown === "priority" ? null : "priority")}
                  className={`flex items-center gap-1.5 h-10 px-3.5 rounded-lg text-sm font-semibold transition-all duration-200 border ${
                    activeFilters.priorities.length > 0 || openDropdown === "priority"
                      ? "bg-[hsl(var(--primary)/0.12)] border-[hsl(var(--primary)/0.3)] text-[hsl(var(--primary))]"
                      : "bg-transparent border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))] hover:border-[hsl(var(--primary)/0.2)] hover:text-[hsl(var(--foreground))]"
                  }`}
                >
                  <AlertTriangle size={14} />
                  Priorité {activeFilters.priorities.length > 0 && `(${activeFilters.priorities.length})`}
                  <ChevronDown size={14} className={`transition-transform ${openDropdown === "priority" ? "rotate-180" : ""}`} />
                </button>
                {openDropdown === "priority" && (
                  <div className="absolute top-11 right-0 w-56 bg-white dark:bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-xl shadow-xl z-[100] animate-fade-in flex flex-col gap-1 p-2">
                    {priorities.map(prio => (
                      <label key={prio.value} className="flex items-center gap-2.5 p-2 hover:bg-[hsl(var(--muted))] rounded-md cursor-pointer text-sm font-medium transition-colors">
                        <input
                          type="checkbox"
                          checked={activeFilters.priorities.includes(prio.value)}
                          onChange={() => toggleFilter("priorities", prio.value)}
                          className="accent-[hsl(var(--primary))] w-4 h-4 cursor-pointer"
                        />
                        {prio.label}
                      </label>
                    ))}
                  </div>
                )}
              </div>
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
          <div className="flex items-center gap-4 w-full sm:w-auto">
            <span className="text-xs font-medium text-[hsl(var(--muted-foreground))] bg-[hsl(var(--muted)/0.5)] px-3 py-1.5 rounded-md">
              <span className="text-[hsl(var(--foreground))] font-bold">{filteredTickets.length}</span> ticket{filteredTickets.length !== 1 ? 's' : ''} {hasActiveFilters && "trouvé(s)"}
            </span>
            
            {hasActiveFilters && (
              <button 
                onClick={resetFilters}
                className="flex items-center gap-1.5 text-xs font-semibold text-red-500 hover:text-red-600 bg-red-500/10 hover:bg-red-500/20 px-3 py-1.5 rounded-md transition-colors ml-auto sm:ml-0"
              >
                <XCircle size={14} />
                Réinitialiser
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ─── Ticket List ─── */}
      {filteredTickets.length === 0 ? (
        <div className="glass-card flex flex-col items-center justify-center py-20 text-center animate-fade-in" style={{ animationDelay: "0.3s" }}>
          <div className="w-16 h-16 rounded-2xl bg-[hsl(var(--muted))] flex items-center justify-center mb-4">
            <Inbox size={28} className="text-[hsl(var(--muted-foreground)/0.5)]" />
          </div>
          <h3 className="text-lg font-semibold mb-1">Aucun ticket trouvé</h3>
          <p className="text-sm text-[hsl(var(--muted-foreground))] max-w-sm">
            {tickets.length === 0
              ? "Créez votre premier ticket en cliquant sur le bouton \"Nouveau ticket\" ci-dessus."
              : "Essayez de modifier votre recherche ou vos filtres pour voir d'autres tickets."}
          </p>
          {hasActiveFilters && (
            <button onClick={resetFilters} className="mt-6 btn-ghost text-sm font-semibold text-[hsl(var(--primary))] hover:text-[hsl(var(--primary)/0.9)] hover:bg-[hsl(var(--primary)/0.1)] border border-[hsl(var(--primary)/0.2)]">
              Effacer tous les filtres
            </button>
          )}
        </div>
      ) : viewMode === "cards" ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredTickets.map((ticket, idx) => (
            <TicketCard key={ticket.id} ticket={ticket} index={idx} onRefresh={fetchTickets} />
          ))}
        </div>
      ) : (
        <TicketTable tickets={filteredTickets} />
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
