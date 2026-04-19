"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import axios from "axios";
import {
  BookOpen,
  Search,
  RefreshCw,
  Plus,
  ChevronLeft,
  ChevronRight,
  Filter,
  X,
} from "lucide-react";
import ProtectedRoute from "@/components/ProtectedRoute";
import { useAuth } from "@/lib/auth";
import KnowledgeCard, { type KbArticle } from "@/components/KnowledgeCard";
import KnowledgeReadModal from "@/components/KnowledgeReadModal";
import KnowledgeModal from "@/components/KnowledgeModal";

const ODOO_URL = "http://localhost:8069";

const CATEGORIES = [
  "Réseau",
  "Logiciel",
  "Matériel",
  "Accès",
  "Messagerie",
  "Infrastructure",
  "Autre",
];

type Pagination = { page: number; limit: number; total: number; pages: number };

// ─── Page ────────────────────────────────────────────────────────────────────
function KnowledgePage() {
  const { user } = useAuth();
  const role = user?.x_support_role ?? "user";
  const canWrite = role === "admin" || role === "tech";

  // ── Data ──────────────────────────────────────────────────────────────────
  const [articles, setArticles] = useState<KbArticle[]>([]);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: 12,
    total: 0,
    pages: 1,
  });
  const [loading, setLoading] = useState(true);

  // ── Filters ───────────────────────────────────────────────────────────────
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Modals ────────────────────────────────────────────────────────────────
  const [readArticle, setReadArticle] = useState<KbArticle | null>(null);
  const [editArticle, setEditArticle] = useState<KbArticle | null | undefined>(
    undefined,
  );
  // undefined = modal fermé, null = création, KbArticle = édition

  // ── Fetch ─────────────────────────────────────────────────────────────────
  const fetchArticles = useCallback(
    async (p = 1, q = search, cat = catFilter) => {
      setLoading(true);
      try {
        const params = new URLSearchParams({
          page: String(p),
          limit: "12",
          ...(q ? { search: q } : {}),
          ...(cat ? { category: cat } : {}),
          // Regular users only see published articles
          ...(role === "user" ? { published_only: "1" } : {}),
        });
        const res = await axios.get(`${ODOO_URL}/api/knowledge?${params}`);
        if (res.data.status === 200) {
          setArticles(res.data.data);
          setPagination(res.data.pagination);
        }
      } catch (err) {
        console.error("Erreur KB:", err);
      } finally {
        setLoading(false);
      }
    },
    [search, catFilter, role],
  );

  useEffect(() => {
    fetchArticles(1);
  }, [catFilter]); // eslint-disable-line
  useEffect(() => {
    fetchArticles(page);
  }, [page]); // eslint-disable-line

  // Debounced search
  const handleSearchChange = (val: string) => {
    setSearch(val);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      setPage(1);
      fetchArticles(1, val, catFilter);
    }, 400);
  };

  // ── Delete handler ────────────────────────────────────────────────────────
  const handleDelete = useCallback(
    async (art: KbArticle) => {
      if (
        !confirm(
          `Supprimer l'article "${art.title}" ? Cette action est irréversible.`,
        )
      )
        return;
      try {
        await axios.delete(`${ODOO_URL}/api/knowledge/${art.id}`, {
          data: { requester_role: role },
          headers: { "Content-Type": "application/json" },
        });
        fetchArticles(page);
      } catch {
        alert("Erreur lors de la suppression.");
      }
    },
    [role, page, fetchArticles],
  );

  const resetFilters = () => {
    setSearch("");
    setCatFilter(null);
    setPage(1);
    fetchArticles(1, "", null);
  };
  const hasFilters = search !== "" || catFilter !== null;

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <BookOpen size={24} className="text-[hsl(var(--primary))]" />
            Base de Connaissances
          </h1>
          <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1">
            Solutions documentées par l&apos;équipe IT —{" "}
            <span className="font-semibold">{pagination.total}</span> article
            {pagination.total !== 1 ? "s" : ""}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => fetchArticles(page)}
            className="btn-ghost flex items-center gap-2 text-sm"
          >
            <RefreshCw size={14} />
            Actualiser
          </button>
          {canWrite && (
            <button
              onClick={() => setEditArticle(null)}
              className="btn-primary flex items-center gap-2 text-sm"
            >
              <Plus size={16} />
              Nouvel article
            </button>
          )}
        </div>
      </div>

      {/* ── Search + Filters ── */}
      <div className="glass-card p-4 space-y-3">
        {/* Search bar */}
        <div className="relative">
          <Search
            size={15}
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[hsl(var(--muted-foreground))]"
          />
          <input
            type="text"
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder="Rechercher par titre ou contenu…"
            className="input-field w-full !pl-10 h-10"
          />
          {search && (
            <button
              onClick={() => handleSearchChange("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Category pills */}
        <div className="flex flex-wrap items-center gap-2">
          <Filter size={13} className="text-[hsl(var(--muted-foreground))]" />
          <button
            onClick={() => {
              setCatFilter(null);
              setPage(1);
            }}
            className={`px-3 py-1 rounded-lg text-xs font-semibold border transition-all ${
              !catFilter
                ? "bg-[hsl(var(--primary)/0.12)] border-[hsl(var(--primary)/0.3)] text-[hsl(var(--primary))]"
                : "border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))] hover:border-[hsl(var(--primary)/0.3)]"
            }`}
          >
            Toutes
          </button>
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => {
                setCatFilter(catFilter === cat ? null : cat);
                setPage(1);
              }}
              className={`px-3 py-1 rounded-lg text-xs font-semibold border transition-all ${
                catFilter === cat
                  ? "bg-[hsl(var(--primary)/0.12)] border-[hsl(var(--primary)/0.3)] text-[hsl(var(--primary))]"
                  : "border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))] hover:border-[hsl(var(--primary)/0.3)]"
              }`}
            >
              {cat}
            </button>
          ))}
          {hasFilters && (
            <button
              onClick={resetFilters}
              className="flex items-center gap-1 text-xs text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] ml-auto"
            >
              <X size={12} /> Réinitialiser
            </button>
          )}
        </div>
      </div>

      {/* ── Grid ── */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="glass-card h-52 animate-pulse opacity-50" />
          ))}
        </div>
      ) : articles.length === 0 ? (
        <div className="glass-card flex flex-col items-center justify-center py-20 text-center">
          <BookOpen
            size={40}
            className="text-[hsl(var(--muted-foreground)/0.3)] mb-3"
          />
          <h3 className="text-lg font-semibold">Aucun article trouvé</h3>
          <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1 max-w-xs">
            {pagination.total === 0
              ? "La base de connaissances est vide. Commencez par créer un article."
              : "Modifiez votre recherche ou supprimez les filtres actifs."}
          </p>
          {canWrite && pagination.total === 0 && (
            <button
              onClick={() => setEditArticle(null)}
              className="btn-primary mt-4 flex items-center gap-2"
            >
              <Plus size={16} /> Créer le premier article
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {articles.map((art, i) => (
            <KnowledgeCard
              key={art.id}
              article={art}
              index={i}
              currentUserId={user?.id}
              currentUserRole={role}
              onRead={setReadArticle}
              onEdit={canWrite ? (a) => setEditArticle(a) : undefined}
              onDelete={role === "admin" ? handleDelete : undefined}
            />
          ))}
        </div>
      )}

      {/* ── Pagination ── */}
      {pagination.pages > 1 && (
        <div className="flex items-center justify-center gap-3 pt-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="btn-ghost disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1 text-sm"
          >
            <ChevronLeft size={16} /> Précédent
          </button>
          <span className="text-sm text-[hsl(var(--muted-foreground))]">
            Page{" "}
            <span className="font-semibold text-[hsl(var(--foreground))]">
              {page}
            </span>{" "}
            sur <span className="font-semibold">{pagination.pages}</span>
          </span>
          <button
            onClick={() => setPage((p) => Math.min(pagination.pages, p + 1))}
            disabled={page === pagination.pages}
            className="btn-ghost disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1 text-sm"
          >
            Suivant <ChevronRight size={16} />
          </button>
        </div>
      )}

      {/* ── Modals ── */}
      {readArticle && (
        <KnowledgeReadModal
          article={readArticle}
          currentUserId={user?.id}
          currentUserRole={role}
          onClose={() => setReadArticle(null)}
          onEdit={
            canWrite
              ? (a) => {
                  setReadArticle(null);
                  setEditArticle(a);
                }
              : undefined
          }
          onDelete={
            role === "admin"
              ? (a) => {
                  setReadArticle(null);
                  handleDelete(a);
                }
              : undefined
          }
        />
      )}

      {editArticle !== undefined && (
        <KnowledgeModal
          article={editArticle}
          userId={user?.id}
          userRole={role}
          onClose={() => setEditArticle(undefined)}
          onSaved={() => {
            setEditArticle(undefined);
            fetchArticles(page);
          }}
        />
      )}
    </div>
  );
}

// ─── Route Guard ──────────────────────────────────────────────────────────────
export default function KnowledgePageRoute() {
  return (
    <ProtectedRoute>
      {" "}
      {/* accessible à TOUS les rôles */}
      <KnowledgePage />
    </ProtectedRoute>
  );
}
