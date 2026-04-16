"use client";

import { useState, useEffect, useCallback } from "react";
import axios from "axios";
import { BookOpen, Search, RefreshCw, Tag, ExternalLink, Plus, X } from "lucide-react";
import ProtectedRoute from "@/components/ProtectedRoute";
import { useAuth } from "@/lib/auth";

const ODOO_URL = "http://localhost:8069";

type KbEntry = {
  id: number;
  title: string;
  solution: string;
  category: string | null;
  source_ticket_id: number | null;
};

function KnowledgePage() {
  const { user } = useAuth();
  const [entries, setEntries] = useState<KbEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState<string | null>(null);

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newCategory, setNewCategory] = useState("");
  const [newSolution, setNewSolution] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  const fetch = useCallback(async () => {
    try {
      const res = await axios.get(`${ODOO_URL}/api/knowledge`, { withCredentials: true });
      if (res.data.status === "success") setEntries(res.data.data);
    } catch {
      console.error("Erreur KB");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetch();
  }, [fetch]);

  const categories = [...new Set(entries.map((e) => e.category).filter(Boolean))] as string[];

  const filtered = entries.filter((e) => {
    const q = search.toLowerCase();
    const matchSearch = !q || e.title.toLowerCase().includes(q) || e.solution.toLowerCase().includes(q);
    const matchCat = !catFilter || e.category === catFilter;
    return matchSearch && matchCat;
  });

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle || !newSolution) return;
    setIsCreating(true);
    try {
      const res = await axios.post(
        `${ODOO_URL}/api/knowledge/create`,
        { title: newTitle, category: newCategory, solution: newSolution },
        { headers: { "Content-Type": "application/json" } }
      );
      if (res.data.status === "success") {
        setNewTitle("");
        setNewCategory("");
        setNewSolution("");
        setIsModalOpen(false);
        fetch(); // Refresh list
      }
    } catch (err) {
      console.error("Erreur création KB:", err);
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="p-6 lg:p-8 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <BookOpen size={24} className="text-[hsl(var(--primary))]" />
            Base de Connaissances
          </h1>
          <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1">
            Solutions documentées par l&apos;équipe IT — {entries.length} article{entries.length !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 mt-4 sm:mt-0">
          <button onClick={fetch} className="btn-ghost text-sm flex items-center justify-center gap-2">
            <RefreshCw size={14} /> Actualiser
          </button>
          {user?.x_support_role === "admin" && (
            <button
              onClick={() => setIsModalOpen(true)}
              className="btn-primary flex items-center justify-center gap-2 text-sm px-4 py-2 rounded-lg"
            >
              <Plus size={16} /> Nouvel Article
            </button>
          )}
        </div>
      </div>

      {/* Search + Category filters */}
      <div className="glass-card p-4 space-y-3">
        <div className="relative">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[hsl(var(--muted-foreground))]" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher un problème ou une solution…"
            className="input-field w-full !pl-10 h-10"
          />
        </div>
        {categories.length > 0 && (
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setCatFilter(null)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all
                ${!catFilter ? "bg-[hsl(var(--primary)/0.12)] border-[hsl(var(--primary)/0.3)] text-[hsl(var(--primary))]"
                  : "border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))] hover:border-[hsl(var(--primary)/0.2)]"}`}
            >
              Tout
            </button>
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setCatFilter(catFilter === cat ? null : cat)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all flex items-center gap-1
                  ${catFilter === cat ? "bg-[hsl(var(--primary)/0.12)] border-[hsl(var(--primary)/0.3)] text-[hsl(var(--primary))]"
                    : "border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))] hover:border-[hsl(var(--primary)/0.2)]"}`}
              >
                <Tag size={10} /> {cat}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* List */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <div key={i} className="glass-card h-28 animate-pulse opacity-50" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="glass-card flex flex-col items-center justify-center py-20 text-center">
          <BookOpen size={40} className="text-[hsl(var(--muted-foreground)/0.3)] mb-3" />
          <h3 className="text-lg font-semibold">Aucun article trouvé</h3>
          <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1">
            {entries.length === 0
              ? "La base de connaissances est vide. Résolvez des tickets et publiez-les pour les voir ici."
              : "Essayez de modifier votre recherche ou vos filtres."}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((entry) => (
            <div key={entry.id} className="glass-card p-5 hover:shadow-md transition-all duration-200 group space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-sm group-hover:text-[hsl(var(--primary))] transition-colors">
                    {entry.title}
                  </h3>
                  <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                    {entry.category && (
                      <span className="inline-flex items-center gap-1 text-[0.65rem] font-semibold px-2 py-0.5 rounded-full bg-[hsl(var(--primary)/0.1)] text-[hsl(var(--primary))] border border-[hsl(var(--primary)/0.2)]">
                        <Tag size={9} /> {entry.category}
                      </span>
                    )}
                    {entry.source_ticket_id && (
                      <span className="text-[0.65rem] text-[hsl(var(--muted-foreground))] flex items-center gap-1">
                        <ExternalLink size={9} /> Ticket #{entry.source_ticket_id}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div className="bg-[hsl(var(--muted)/0.4)] rounded-xl p-3 text-sm leading-relaxed border border-[hsl(var(--border)/0.5)]">
                {entry.solution}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal Création Article */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
          <div
            className="glass-card w-full max-w-xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden scale-in"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 border-b border-[hsl(var(--border)/0.5)]">
              <h2 className="text-lg font-bold">Nouvel Article KB</h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded-md hover:bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]"
              >
                <X size={18} />
              </button>
            </div>
            
            <form onSubmit={handleCreate} className="p-5 overflow-y-auto space-y-4">
              <div>
                <label className="block text-sm font-semibold mb-1">Titre de l'article *</label>
                <input
                  type="text"
                  required
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="input-field w-full"
                  placeholder="Ex: Configuration du VPN client..."
                />
              </div>
              
              <div>
                <label className="block text-sm font-semibold mb-1">Catégorie</label>
                <input
                  type="text"
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  className="input-field w-full"
                  placeholder="Ex: Réseau, Matériel, Logiciel..."
                />
              </div>
              
              <div>
                <label className="block text-sm font-semibold mb-1">Solution / Contenu *</label>
                <textarea
                  required
                  value={newSolution}
                  onChange={(e) => setNewSolution(e.target.value)}
                  className="input-field w-full min-h-[150px] resize-y"
                  placeholder="Décrivez les étapes de résolution..."
                />
              </div>

              <div className="pt-2 flex gap-3 justify-end">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="btn-ghost"
                  disabled={isCreating}
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isCreating || !newTitle || !newSolution}
                  className="btn-primary"
                >
                  {isCreating ? "Création..." : "Publier l'article"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default function TechKnowledgePage() {
  return (
    <ProtectedRoute roles={["tech", "admin"]}>
      <KnowledgePage />
    </ProtectedRoute>
  );
}
