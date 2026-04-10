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
} from "lucide-react";
import StatsCard from "@/components/StatsCard";
import TicketCard from "@/components/TicketCard";
import TicketTable from "@/components/TicketTable";
import TicketModal from "@/components/TicketModal";

type TicketType = {
  id: number;
  name: string;
  description: string;
  state: string;
  priority: string;
  category: string;
};

export default function Home() {
  const [tickets, setTickets] = useState<TicketType[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // View mode
  const [viewMode, setViewMode] = useState<"cards" | "table">("cards");

  // Search & Filter
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("Tous");

  const categories = [
    "Tous",
    "Logiciel",
    "Matériel",
    "Accès",
    "Réseau",
    "Messagerie",
    "Infrastructure",
    "Autre",
  ];

  const fetchTickets = async () => {
    try {
      const res = await axios.get("http://localhost:8069/api/tickets");
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

  // Filtered tickets
  const filteredTickets = tickets.filter((ticket) => {
    const safeName = (ticket.name || "").toLowerCase();
    const safeDesc = (ticket.description || "").toLowerCase();
    const safeSearch = (searchTerm || "").toLowerCase();

    const matchesSearch =
      safeName.includes(safeSearch) || safeDesc.includes(safeSearch);

    const ticketCat = ticket.category
      ? ticket.category.toLowerCase()
      : "autre";
    const matchesCategory =
      selectedCategory === "Tous" ||
      ticketCat.includes(selectedCategory.toLowerCase());

    return matchesSearch && matchesCategory;
  });

  // KPI calculations
  const totalTickets = tickets.length;
  const openTickets = tickets.filter((t) => {
    const s = (t.state || "").toLowerCase();
    return s.includes("nouveau") || s.includes("new") || s.includes("ouvert");
  }).length;
  const inProgress = tickets.filter((t) => {
    const s = (t.state || "").toLowerCase();
    return s.includes("cours") || s.includes("progress") || s.includes("attente");
  }).length;
  const resolved = tickets.filter((t) => {
    const s = (t.state || "").toLowerCase();
    return s.includes("résolu") || s.includes("resolved") || s.includes("done") || s.includes("fermé");
  }).length;

  return (
    <div className="p-6 lg:p-8 max-w-[1400px] mx-auto space-y-6">
      {/* ─── Header ─── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-fade-in">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Tableau de bord
          </h1>
          <p className="text-sm text-[hsl(var(--muted-foreground))] mt-0.5">
            Vue d&apos;ensemble de vos demandes de support IT
          </p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="btn-primary"
          id="new-ticket-btn"
        >
          <PlusCircle size={18} />
          Nouveau ticket
        </button>
      </div>

      {/* ─── KPI Stats Row ─── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard
          title="Total Tickets"
          value={totalTickets}
          icon={<Ticket size={20} />}
          color="#6366f1"
          loading={loading}
          delay={0}
        />
        <StatsCard
          title="Ouverts"
          value={openTickets}
          icon={<AlertTriangle size={20} />}
          color="#f59e0b"
          loading={loading}
          delay={80}
        />
        <StatsCard
          title="En Cours"
          value={inProgress}
          icon={<Clock size={20} />}
          color="#ff6d5a"
          loading={loading}
          delay={160}
        />
        <StatsCard
          title="Résolus"
          value={resolved}
          icon={<CheckCircle2 size={20} />}
          color="#10b981"
          loading={loading}
          delay={240}
        />
      </div>

      {/* ─── Filters Bar ─── */}
      <div className="glass-card p-4 space-y-4 animate-fade-in" style={{ animationDelay: "0.2s" }}>
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
          {/* Search */}
          <div className="relative flex-1 w-full">
            <Search
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[hsl(var(--muted-foreground))]"
              size={16}
            />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Rechercher un ticket..."
              className="input-field focus-ring pl-10"
              id="search-input"
            />
          </div>

          {/* View Toggle */}
          <div className="view-toggle flex-shrink-0">
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

        {/* Category Pills */}
        <div className="flex flex-wrap gap-2">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 cursor-pointer border ${
                selectedCategory === cat
                  ? "bg-[hsl(var(--primary)/0.12)] border-[hsl(var(--primary)/0.3)] text-[hsl(var(--primary))]"
                  : "bg-transparent border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))] hover:border-[hsl(var(--primary)/0.2)] hover:text-[hsl(var(--foreground))]"
              }`}
            >
              {cat}
            </button>
          ))}
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
              : "Essayez de modifier votre recherche ou changez le filtre de catégorie."}
          </p>
        </div>
      ) : viewMode === "cards" ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredTickets.map((ticket, idx) => (
            <TicketCard key={ticket.id} ticket={ticket} index={idx} />
          ))}
        </div>
      ) : (
        <TicketTable tickets={filteredTickets} />
      )}

      {/* ─── Ticket Count ─── */}
      {filteredTickets.length > 0 && (
        <div className="text-center animate-fade-in">
          <p className="text-xs text-[hsl(var(--muted-foreground))]">
            {filteredTickets.length} ticket{filteredTickets.length > 1 ? "s" : ""} affiché{filteredTickets.length > 1 ? "s" : ""}
            {selectedCategory !== "Tous" && ` · Catégorie: ${selectedCategory}`}
          </p>
        </div>
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
