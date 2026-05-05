"use client";

import { useState, useEffect, useCallback } from "react";
import axios from "axios";
import { ODOO_URL } from "@/lib/config";
import {
  PackageCheck, PackageSearch, ArrowLeft, Inbox, History,
  Check, ChevronDown, ChevronUp, PackageX, Wallet, ClipboardList,
  Warehouse, RefreshCw, Plus, Minus, X, Loader2, ShoppingCart, Truck, Search, Save
} from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";
import ProtectedRoute from "@/components/ProtectedRoute";

// ─── Types ────────────────────────────────────────────────────────────────────

type InventoryLine = {
  id: number;
  ticket_id: number;
  ticket_name: string;
  user_name: string;
  material_id: number;
  material_name: string;
  material_reference: string;
  qty_available: number;
  unit_cost: number;
  status: "requested" | "ready" | "ordered";
  ticket_priority?: "0" | "1" | "2" | "3";
};

type CatalogItem = {
  id: number;
  name: string;
  reference: string;
  category: string;
  qty_available: number;
  unit_cost: number;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const CATEGORY_LABELS: Record<string, string> = {
  hardware: "Matériel",
  software: "Logiciel",
  cable: "Câblage",
  other: "Autre",
};

const getPriorityBadge = (priority?: string) => {
  switch (priority) {
    case "3": return <span className="inline-flex items-center justify-center px-2 py-0.5 text-[10px] font-bold rounded bg-red-500/10 text-red-500 border border-red-500/20">Critique</span>;
    case "2": return <span className="inline-flex items-center justify-center px-2 py-0.5 text-[10px] font-bold rounded bg-orange-500/10 text-orange-500 border border-orange-500/20">Haute</span>;
    case "1": return <span className="inline-flex items-center justify-center px-2 py-0.5 text-[10px] font-bold rounded bg-blue-500/10 text-blue-500 border border-blue-500/20">Moyenne</span>;
    case "0": return <span className="inline-flex items-center justify-center px-2 py-0.5 text-[10px] font-bold rounded bg-slate-500/10 text-slate-500 border border-slate-500/20">Basse</span>;
    default: return null;
  }
};

const getInitials = (name: string) => {
  if (!name) return "?";
  const parts = name.split(" ");
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
};

const fmt = (n: number | undefined | null) =>
  (n ?? 0).toLocaleString("fr-MA", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AdminInventoryPage() {
  const [lines, setLines] = useState<InventoryLine[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const [showHistory, setShowHistory] = useState(false);

  // Catalog state
  const [showCatalog, setShowCatalog] = useState(false);
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [stockLoading, setStockLoading] = useState<number | null>(null);

  // Filters & Draft state
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategories, setActiveCategories] = useState<string[]>([]);
  const [draftStock, setDraftStock] = useState<Record<number, number>>({});

  const catalogCategories = Array.from(new Set(catalog.map(c => CATEGORY_LABELS[c.category] || c.category))).sort();

  const filteredCatalog = catalog.filter((item) => {
    const catLabel = CATEGORY_LABELS[item.category] || item.category;
    const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          (item.reference || "").toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCat = activeCategories.length === 0 || activeCategories.includes(catLabel);
    return matchesSearch && matchesCat;
  });

  // ── Fetch inventory ──────────────────────────────────────────────────────────
  const fetchInventory = useCallback(async () => {
    try {
      const res = await axios.get(`${ODOO_URL}/api/admin/inventory`);
      if (res.data.status === 200) setLines(res.data.data);
    } catch {
      toast.error("Erreur de chargement de l'inventaire.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchInventory(); }, [fetchInventory]);

  // ── Fetch catalog ────────────────────────────────────────────────────────────
  const openCatalog = async () => {
    setShowCatalog(true);
    setCatalogLoading(true);
    try {
      const res = await axios.get(`${ODOO_URL}/api/admin/catalog`);
      if (res.data.status === 200) setCatalog(res.data.data);
    } catch {
      toast.error("Impossible de charger le catalogue.");
    } finally {
      setCatalogLoading(false);
    }
  };

  // ── Mark ready ───────────────────────────────────────────────────────────────
  const handleMarkReady = async (lineId: number) => {
    setActionLoading(lineId);
    try {
      const res = await axios.post(`${ODOO_URL}/api/admin/inventory/${lineId}/ready`);
      if (res.data.status === 200) {
        toast.success("Ressource allouée et stock mis à jour.");
        fetchInventory(); // Rafraîchir tout l'inventaire
      } else {
        toast.error(res.data.message || "Erreur.");
      }
    } catch {
      toast.error("Impossible de mettre à jour.");
    } finally {
      setActionLoading(null);
    }
  };

  // ── Order material ───────────────────────────────────────────────────────────
  const handleOrderMaterial = async (line: InventoryLine) => {
    setActionLoading(line.id);
    try {
      const res = await axios.post(`${ODOO_URL}/api/ticket/${line.ticket_id}/order_material`, {
        material_id: line.material_id
      });
      if (res.data.status === 200) {
        toast.success("La commande de la ressource a été enregistrée dans le système.");
        fetchInventory(); // Rafraîchir tout l'inventaire
      } else {
        toast.error(res.data.message || "Erreur.");
      }
    } catch (err) {
      console.error("Order Material Error:", err);
      toast.error("Impossible d'initier la commande.");
    } finally {
      setActionLoading(null);
    }
  };

  // ── Update stock (Draft & Save) ─────────────────────────────────────────────
  const handleDraftStockDelta = (materialId: number, originalQty: number, delta: number) => {
    setDraftStock(prev => {
      const currentDraft = prev[materialId] !== undefined ? prev[materialId] : originalQty;
      const newDraft = Math.max(0, currentDraft + delta);
      return { ...prev, [materialId]: newDraft };
    });
  };

  const handleSaveStock = async (materialId: number, originalQty: number) => {
    const draftQty = draftStock[materialId];
    if (draftQty === undefined || draftQty === originalQty) return;
    
    setStockLoading(materialId);
    const delta = draftQty - originalQty;
    try {
      const res = await axios.patch(`${ODOO_URL}/api/admin/catalog/${materialId}/stock`, { delta });
      if (res.data.status === 200) {
        toast.success("Stock mis à jour.", { icon: <Save size={16} /> });
        const newQty = res.data.qty_available;
        setCatalog((prev) =>
          prev.map((m) => (m.id === materialId ? { ...m, qty_available: newQty } : m))
        );
        setLines((prev) =>
          prev.map((l) => (l.material_id === materialId ? { ...l, qty_available: newQty } : l))
        );
        setDraftStock(prev => {
          const next = { ...prev };
          delete next[materialId];
          return next;
        });
      } else {
        toast.error(res.data.message || "Erreur de mise à jour du stock.");
      }
    } catch {
      toast.error("Impossible de modifier le stock.");
    } finally {
      setStockLoading(null);
    }
  };

  // ── Derived stats ────────────────────────────────────────────────────────────
  const requestedLines = lines.filter((l) => l.status === "requested" || l.status === "ordered");
  const readyLines = lines.filter((l) => l.status === "ready");
  const ruptures = requestedLines.filter((l) => l.qty_available === 0).length;
  const valeurEngagee = requestedLines.reduce((s, l) => s + (l.unit_cost || 0), 0);

  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <ProtectedRoute roles={["admin"]}>
      <div className="flex-1 overflow-y-auto custom-scrollbar bg-[hsl(var(--background))] p-6 space-y-6">
        <div className="max-w-6xl mx-auto space-y-6 animate-fade-in-up">

          {/* ── Header ────────────────────────────────────────────────────────── */}
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div>
              <Link href="/tickets" className="text-xs font-semibold text-[hsl(var(--muted-foreground))] flex items-center gap-1 hover:text-[hsl(var(--foreground))] transition-colors mb-2 w-fit">
                <ArrowLeft size={14} /> Retour
              </Link>
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-3">
                <PackageSearch className="text-[hsl(var(--primary))]" />
                Gestion des Ressources
              </h1>
              <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1">
                Gérez les demandes de matériel des techniciens et validez leur disponibilité.
              </p>
            </div>
            <button
              onClick={showCatalog ? () => setShowCatalog(false) : openCatalog}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--secondary)/0.3)] hover:bg-[hsl(var(--secondary)/0.6)] text-sm font-semibold transition-all shrink-0"
            >
              {showCatalog ? <><X size={15} /> Fermer l&apos;inventaire</> : <><Warehouse size={15} /> Voir l&apos;Inventaire Complet</>}
            </button>
          </div>

          {/* ── Stat cards ───────────────────────────────────────────────────── */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Demandes actives */}
            <div className="flex items-center gap-3 px-4 py-3 rounded-xl border border-[hsl(var(--border)/0.6)] bg-[hsl(var(--secondary)/0.08)]">
              <ClipboardList size={16} className="text-[hsl(var(--primary))] shrink-0" />
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-[hsl(var(--muted-foreground))]">Demandes actives</p>
                <p className="text-xl font-black text-[hsl(var(--foreground))]">{requestedLines.length}</p>
              </div>
            </div>

            {/* Ruptures */}
            <div className="flex items-center gap-3 px-4 py-3 rounded-xl border border-[hsl(var(--border)/0.6)] bg-[hsl(var(--secondary)/0.08)]">
              <PackageX size={16} className="text-rose-500 shrink-0" />
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-[hsl(var(--muted-foreground))]">Ruptures</p>
                <p className={`text-xl font-black ${ruptures > 0 ? "text-rose-500" : "text-[hsl(var(--foreground))]"}`}>{ruptures}</p>
              </div>
            </div>

            {/* Valeur engagée */}
            <div className="flex items-center gap-3 px-4 py-3 rounded-xl border border-[hsl(var(--border)/0.6)] bg-[hsl(var(--secondary)/0.08)]">
              <Wallet size={16} className="text-emerald-500 shrink-0" />
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-[hsl(var(--muted-foreground))]">Valeur engagée</p>
                <p className="text-xl font-black text-[hsl(var(--foreground))]">{fmt(valeurEngagee)} DH</p>
              </div>
            </div>
          </div>

          {/* ── Catalog View ─────────────────────────────────────────────────── */}
          {showCatalog && (
            <div className="rounded-xl border border-[hsl(var(--border)/0.6)] bg-[hsl(var(--secondary)/0.06)] overflow-hidden">
              <div className="px-5 py-4 border-b border-[hsl(var(--border)/0.4)]">
                <h2 className="text-xs font-black uppercase tracking-[0.2em] text-[hsl(var(--muted-foreground))] flex items-center gap-2">
                  <Warehouse size={14} />
                  Inventaire Complet
                </h2>
              </div>

              {catalogLoading ? (
                <div className="flex justify-center p-10">
                  <Loader2 className="animate-spin text-[hsl(var(--muted-foreground))]" size={28} />
                </div>
              ) : catalog.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-10">
                  <Inbox size={28} className="opacity-20 mb-2" />
                  <p className="text-sm text-[hsl(var(--muted-foreground))]">Aucun article dans le catalogue.</p>
                </div>
              ) : (
                <div className="flex flex-col">
                  {/* Filters Bar */}
                  <div className="px-5 py-4 border-b border-[hsl(var(--border)/0.4)] bg-[hsl(var(--background)/0.5)] space-y-4">
                    <div className="relative w-full md:max-w-md">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[hsl(var(--muted-foreground))]" size={16} />
                      <input
                        type="text"
                        placeholder="Rechercher par nom ou référence..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full bg-[hsl(var(--secondary)/0.5)] border border-[hsl(var(--border)/0.8)] focus:border-[hsl(var(--primary)/0.5)] rounded-lg pl-9 pr-4 py-2 text-sm transition-all focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary)/0.2)] text-[hsl(var(--foreground))]"
                      />
                    </div>
                    
                    <div className="flex flex-wrap gap-2">
                      {catalogCategories.map(cat => {
                        const isActive = activeCategories.includes(cat);
                        return (
                          <button
                            key={cat}
                            onClick={() => setActiveCategories(prev => isActive ? prev.filter(c => c !== cat) : [...prev, cat])}
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 border ${
                              isActive
                                ? "bg-[hsl(var(--primary)/0.12)] border-[hsl(var(--primary)/0.3)] text-[hsl(var(--primary))]"
                                : "bg-[hsl(var(--background)/0.5)] border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))] hover:border-[hsl(var(--primary)/0.2)] hover:text-[hsl(var(--foreground))]"
                            }`}
                          >
                            {cat}
                          </button>
                        );
                      })}
                      {activeCategories.length > 0 && (
                        <button
                          onClick={() => setActiveCategories([])}
                          className="px-3 py-1.5 rounded-lg text-xs font-semibold text-rose-500 hover:text-rose-600 bg-rose-500/10 hover:bg-rose-500/20 transition-colors"
                        >
                          Effacer filtres
                        </button>
                      )}
                    </div>
                  </div>

                  {filteredCatalog.length === 0 ? (
                    <div className="flex flex-col items-center justify-center p-10">
                      <Search size={28} className="opacity-20 mb-2 text-[hsl(var(--muted-foreground))]" />
                      <p className="text-sm text-[hsl(var(--muted-foreground))]">Aucun résultat trouvé pour votre recherche.</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-[hsl(var(--border)/0.3)] max-h-[500px] overflow-y-auto custom-scrollbar">
                      {filteredCatalog.map((item) => {
                        const displayQty = draftStock[item.id] !== undefined ? draftStock[item.id] : item.qty_available;
                        const hasChanges = draftStock[item.id] !== undefined && draftStock[item.id] !== item.qty_available;

                        return (
                          <div key={item.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-5 py-3 hover:bg-[hsl(var(--secondary)/0.12)] transition-colors">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-[hsl(var(--foreground))] truncate">{item.name}</p>
                              <p className="text-[11px] text-[hsl(var(--muted-foreground))] mt-0.5">
                                {item.reference || "—"} &middot; {CATEGORY_LABELS[item.category] || item.category} &middot; {fmt(item.unit_cost)} DH
                              </p>
                            </div>
                            <div className="flex items-center justify-between sm:justify-end gap-4 shrink-0 w-full sm:w-auto mt-2 sm:mt-0">
                              <div className="flex items-center gap-3 bg-[hsl(var(--background))] border border-[hsl(var(--border)/0.6)] rounded-lg p-1">
                                <button
                                  disabled={displayQty === 0 || stockLoading === item.id}
                                  onClick={() => handleDraftStockDelta(item.id, item.qty_available, -1)}
                                  className="h-8 w-8 rounded-md flex items-center justify-center hover:bg-rose-500/10 text-[hsl(var(--foreground))] hover:text-rose-500 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                                >
                                  <Minus size={14} />
                                </button>
                                <span className={`text-sm font-bold tabular-nums min-w-[1.5rem] text-center ${displayQty === 0 ? "text-rose-500" : "text-[hsl(var(--foreground))]"}`}>
                                  {displayQty}
                                </span>
                                <button
                                  disabled={stockLoading === item.id}
                                  onClick={() => handleDraftStockDelta(item.id, item.qty_available, 1)}
                                  className="h-8 w-8 rounded-md flex items-center justify-center hover:bg-emerald-500/10 text-[hsl(var(--foreground))] hover:text-emerald-500 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                                >
                                  <Plus size={14} />
                                </button>
                              </div>
                              
                              <div className="w-[100px] flex justify-end">
                                {hasChanges && (
                                  <button
                                    disabled={stockLoading === item.id}
                                    onClick={() => handleSaveStock(item.id, item.qty_available)}
                                    className="flex items-center gap-1.5 px-3 py-1.5 bg-[hsl(var(--primary))] hover:bg-[hsl(var(--primary)/0.9)] text-primary-foreground text-xs font-bold rounded-lg transition-all shadow-sm disabled:opacity-50"
                                  >
                                    {stockLoading === item.id ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                                    <span className="hidden sm:inline">Enregistrer</span>
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ── Main Inventory ───────────────────────────────────────────────── */}
          {loading ? (
            <div className="flex justify-center p-12">
              <Loader2 className="animate-spin text-[hsl(var(--muted-foreground))]" size={32} />
            </div>
          ) : (
            <div className="space-y-10">
              {/* A PREPARER */}
              <div>
                <h2 className="text-xs font-black uppercase tracking-[0.2em] text-[hsl(var(--muted-foreground))] mb-4 flex items-center gap-2">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-orange-500"></span>
                  </span>
                  À PRÉPARER ({requestedLines.length})
                </h2>

                {requestedLines.length === 0 ? (
                  <div className="flex flex-col items-center justify-center p-12 border border-[hsl(var(--border)/0.5)] rounded-lg bg-[hsl(var(--secondary)/0.05)] border-dashed">
                    <Inbox size={32} className="opacity-20 mb-2 text-[hsl(var(--foreground))]" />
                    <p className="text-sm font-medium text-[hsl(var(--muted-foreground))]">Toutes les ressources sont prêtes.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {requestedLines.map((line) => (
                      <div key={line.id} className="flex flex-col md:flex-row md:items-center justify-between bg-[hsl(var(--secondary)/0.1)] hover:bg-[hsl(var(--secondary)/0.2)] border border-[hsl(var(--border)/0.5)] rounded-lg p-4 transition-all gap-4">

                        {/* Gauche: Matériel + stock + prix */}
                        <div className="flex-1">
                          <div className="text-sm font-bold text-[hsl(var(--foreground))]">{line.material_name}</div>
                          <div className="text-[11px] text-[hsl(var(--muted-foreground))] mt-0.5">{line.material_reference || "N/A"}</div>
                          <div className="flex items-center gap-3 mt-1.5">
                            <span className={`text-[11px] font-semibold ${line.qty_available === 0 ? "text-rose-500" : "text-[hsl(var(--muted-foreground))]"}`}>
                              Stock&nbsp;: {line.qty_available}
                            </span>
                            <span className="text-[11px] text-[hsl(var(--muted-foreground))]">
                              Prix&nbsp;: {fmt(line.unit_cost)} DH
                            </span>
                          </div>
                        </div>

                        {/* Centre: Technicien & Ticket & Priorité */}
                        <div className="flex-1 flex items-center gap-4">
                          <div className="flex items-center gap-2">
                            <div className="h-8 w-8 rounded-full bg-[hsl(var(--primary)/0.1)] text-[hsl(var(--primary))] flex items-center justify-center text-xs font-bold shrink-0">
                              {getInitials(line.user_name)}
                            </div>
                            <span className="text-sm font-medium text-[hsl(var(--muted-foreground))]">{line.user_name}</span>
                          </div>

                          <div className="w-px h-6 bg-[hsl(var(--border)/0.5)] hidden md:block"></div>

                          <div className="flex items-center gap-2">
                            <span className="inline-flex items-center px-2.5 py-1 rounded-md bg-[hsl(var(--secondary)/0.5)] text-[hsl(var(--foreground))] text-xs font-mono">
                              {line.ticket_name}
                            </span>
                            {getPriorityBadge(line.ticket_priority)}
                          </div>
                        </div>

                        {/* Droite: Action */}
                        <div className="shrink-0 flex justify-end">
                          {line.qty_available > 0 ? (
                            <button
                              onClick={() => handleMarkReady(line.id)}
                              disabled={actionLoading === line.id}
                              className="inline-flex items-center bg-emerald-600/20 text-emerald-500 border border-emerald-500/30 hover:bg-emerald-600 hover:text-white text-xs font-bold px-4 py-2 rounded-md transition-all disabled:opacity-50"
                            >
                              {actionLoading === line.id ? (
                                <RefreshCw size={14} className="animate-spin mr-2" />
                              ) : (
                                <PackageCheck size={16} className="mr-2" />
                              )}
                              Confirmer la sortie
                            </button>
                          ) : line.status === "ordered" ? (
                            <span className="inline-flex items-center bg-indigo-500/10 text-indigo-400 font-bold text-xs px-4 py-2 rounded-md border border-indigo-500/20">
                              <Truck size={16} className="mr-2 animate-pulse" />
                              En commande
                            </span>
                          ) : (
                            <button
                              onClick={() => handleOrderMaterial(line)}
                              disabled={actionLoading === line.id}
                              className="inline-flex items-center bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 hover:bg-indigo-600 hover:text-white text-xs font-bold px-4 py-2 rounded-md transition-all disabled:opacity-50"
                            >
                              {actionLoading === line.id ? (
                                <RefreshCw size={14} className="animate-spin mr-2" />
                              ) : (
                                <ShoppingCart size={16} className="mr-2" />
                              )}
                              Commander la pièce
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Historique */}
              {readyLines.length > 0 && (
                <div>
                  <button
                    onClick={() => setShowHistory((v) => !v)}
                    className="flex items-center gap-2 text-xs font-semibold text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] border border-[hsl(var(--border)/0.5)] hover:border-[hsl(var(--border))] rounded-lg px-4 py-2 transition-all duration-200"
                  >
                    <History size={16} className="mr-1" />
                    {showHistory ? "Masquer l'historique" : "Afficher l'historique"}
                    <span className="ml-1 inline-flex items-center justify-center h-4 w-4 rounded-full bg-[hsl(var(--muted)/0.4)] text-[10px] font-bold">{readyLines.length}</span>
                    {showHistory ? <ChevronUp size={14} className="ml-1" /> : <ChevronDown size={14} className="ml-1" />}
                  </button>

                  <div className={`overflow-hidden transition-all duration-300 ${showHistory ? "max-h-[2000px] opacity-100 mt-4" : "max-h-0 opacity-0"}`}>
                    <h2 className="text-xs font-black uppercase tracking-[0.2em] text-[hsl(var(--muted-foreground))] mb-4">
                      HISTORIQUE — Ressources Remises
                    </h2>
                    <div className="space-y-3">
                      {readyLines.map((line) => (
                        <div key={line.id} className="opacity-60 flex flex-col md:flex-row md:items-center justify-between bg-[hsl(var(--secondary)/0.05)] border border-[hsl(var(--border)/0.3)] rounded-lg p-4 gap-4">
                          <div className="flex-1">
                            <div className="text-sm font-bold text-[hsl(var(--foreground))]">{line.material_name}</div>
                            <div className="text-[11px] text-[hsl(var(--muted-foreground))] mt-0.5">{line.material_reference || "N/A"}</div>
                          </div>
                          <div className="flex-1 flex items-center gap-4">
                            <div className="flex items-center gap-2">
                              <div className="h-8 w-8 rounded-full bg-[hsl(var(--muted)/0.3)] text-[hsl(var(--muted-foreground))] flex items-center justify-center text-xs font-bold shrink-0">
                                {getInitials(line.user_name)}
                              </div>
                              <span className="text-sm font-medium text-[hsl(var(--muted-foreground))]">{line.user_name}</span>
                            </div>
                            <div className="w-px h-6 bg-[hsl(var(--border)/0.5)] hidden md:block"></div>
                            <div className="flex items-center gap-2">
                              <span className="inline-flex items-center px-2.5 py-1 rounded-md bg-[hsl(var(--secondary)/0.3)] text-[hsl(var(--muted-foreground))] text-xs font-mono">
                                {line.ticket_name}
                              </span>
                              {getPriorityBadge(line.ticket_priority)}
                            </div>
                          </div>
                          <div className="shrink-0 flex justify-end">
                            <span className="inline-flex items-center text-[10px] font-bold px-3 py-1.5 rounded-md border border-emerald-500/20 bg-emerald-500/5 text-emerald-500/80">
                              <Check size={12} className="mr-1.5" />
                              REMIS
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </ProtectedRoute>
  );
}
