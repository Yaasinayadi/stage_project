"use client";

import {
  Globe, Key, Laptop, HardDrive, Mail, Server, HelpCircle,
  Pencil, Trash2, User, Calendar, ExternalLink, Eye,
} from "lucide-react";

export type KbTag = { id: number; name: string };

export type KbArticle = {
  id: number;
  title: string;
  solution: string | null;
  solution_preview: string;
  category: string | null;
  tags: KbTag[];
  author: string | null;
  author_id: number | null;
  is_published: boolean;
  source_ticket_id: number | null;
  source_ticket_name: string | null;
  create_date: string | null;
  write_date: string | null;
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

export function getCategoryIcon(cat: string | null) {
  const c = (cat || "").toLowerCase();
  if (c.includes("réseau"))         return <Globe       size={16} />;
  if (c.includes("accès"))          return <Key         size={16} />;
  if (c.includes("logiciel"))       return <Laptop      size={16} />;
  if (c.includes("matériel"))       return <HardDrive   size={16} />;
  if (c.includes("messagerie"))     return <Mail        size={16} />;
  if (c.includes("infrastructure")) return <Server      size={16} />;
  return                                   <HelpCircle  size={16} />;
}

export function getCategoryColor(cat: string | null): string {
  const c = (cat || "").toLowerCase();
  if (c.includes("réseau"))         return "#6366f1";
  if (c.includes("accès"))         return "#f59e0b";
  if (c.includes("logiciel"))       return "#8b5cf6";
  if (c.includes("matériel"))       return "#10b981";
  if (c.includes("messagerie"))     return "#ec4899";
  if (c.includes("infrastructure")) return "#06b6d4";
  return "#71717a";
}

function formatDate(iso: string | null): string {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleDateString("fr-FR", {
      day: "2-digit", month: "short", year: "numeric",
    });
  } catch { return iso; }
}

// ─── Component ───────────────────────────────────────────────────────────────

type Props = {
  article: KbArticle;
  index?: number;
  currentUserId?: number | null;
  currentUserRole?: string;
  onRead:   (a: KbArticle) => void;
  onEdit?:  (a: KbArticle) => void;
  onDelete?:(a: KbArticle) => void;
};

export default function KnowledgeCard({
  article,
  index = 0,
  currentUserId,
  currentUserRole,
  onRead,
  onEdit,
  onDelete,
}: Props) {
  const color = getCategoryColor(article.category);

  // Un tech peut modifier uniquement ses propres articles
  const canEdit =
    currentUserRole === "admin" ||
    (currentUserRole === "tech" && currentUserId === article.author_id);

  const canDelete = currentUserRole === "admin";

  return (
    <div
      className="glass-card p-5 cursor-pointer group animate-fade-in hover:-translate-y-1 transition-all duration-300 flex flex-col gap-3"
      style={{ animationDelay: `${index * 50}ms` }}
      onClick={() => onRead(article)}
    >
      {/* ── Top row ── */}
      <div className="flex items-start justify-between gap-2">
        {/* Category icon + badge */}
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: `${color}18`, color }}
          >
            {getCategoryIcon(article.category)}
          </div>
          {article.category && (
            <span
              className="text-[0.65rem] font-semibold px-2 py-0.5 rounded-full border"
              style={{
                background: `${color}12`,
                color,
                borderColor: `${color}30`,
              }}
            >
              {article.category}
            </span>
          )}
        </div>

        {/* Status badge */}
        <span
          className={`text-[0.6rem] font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${
            article.is_published
              ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20"
              : "bg-amber-500/10 text-amber-500 border border-amber-500/20"
          }`}
        >
          {article.is_published ? "Publié" : "Brouillon"}
        </span>
      </div>

      {/* ── Title ── */}
      <h3 className="font-semibold text-[0.95rem] leading-snug line-clamp-2 group-hover:text-[hsl(var(--primary))] transition-colors">
        {article.title}
      </h3>

      {/* ── Preview ── */}
      <p className="text-sm text-[hsl(var(--muted-foreground))] line-clamp-3 leading-relaxed flex-1">
        {article.solution_preview || "Aucun aperçu disponible."}
      </p>

      {/* ── Tags ── */}
      {article.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {article.tags.slice(0, 4).map((tag) => (
            <span
              key={tag.id}
              className="text-[0.6rem] font-semibold px-2 py-0.5 rounded-full bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))] border border-[hsl(var(--border))]"
            >
              {tag.name}
            </span>
          ))}
          {article.tags.length > 4 && (
            <span className="text-[0.6rem] text-[hsl(var(--muted-foreground))]">
              +{article.tags.length - 4}
            </span>
          )}
        </div>
      )}

      {/* ── Footer ── */}
      <div className="pt-3 border-t border-[hsl(var(--border)/0.5)] flex items-center justify-between gap-2">
        {/* Author + date */}
        <div className="flex items-center gap-3 text-[0.65rem] text-[hsl(var(--muted-foreground))]">
          {article.author && (
            <span className="flex items-center gap-1">
              <User size={11} />
              {article.author}
            </span>
          )}
          {article.write_date && (
            <span className="flex items-center gap-1">
              <Calendar size={11} />
              {formatDate(article.write_date)}
            </span>
          )}
        </div>

        {/* Action icons */}
        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          {/* Source ticket link */}
          {article.source_ticket_id && (
            <span
              className="text-[0.6rem] text-[hsl(var(--muted-foreground))] flex items-center gap-0.5 mr-1"
              title={`Ticket source: ${article.source_ticket_name || "#" + article.source_ticket_id}`}
            >
              <ExternalLink size={11} />#{article.source_ticket_id}
            </span>
          )}

          <button
            onClick={() => onRead(article)}
            className="w-7 h-7 rounded-md flex items-center justify-center text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--primary))] hover:bg-[hsl(var(--primary)/0.08)] transition-colors"
            title="Lire"
          >
            <Eye size={14} />
          </button>

          {canEdit && onEdit && (
            <button
              onClick={() => onEdit(article)}
              className="w-7 h-7 rounded-md flex items-center justify-center text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--primary))] hover:bg-[hsl(var(--primary)/0.08)] transition-colors"
              title="Modifier"
            >
              <Pencil size={14} />
            </button>
          )}

          {canDelete && onDelete && (
            <button
              onClick={() => onDelete(article)}
              className="w-7 h-7 rounded-md flex items-center justify-center text-[hsl(var(--muted-foreground))] hover:text-red-500 hover:bg-red-500/08 transition-colors"
              title="Supprimer"
            >
              <Trash2 size={14} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
