"use client";

import { useEffect, useRef, useState } from "react";
import {
  X, Calendar, User, Tag, ExternalLink, Pencil, Trash2, BookOpen,
} from "lucide-react";
import type { KbArticle } from "./KnowledgeCard";
import { getCategoryColor } from "./KnowledgeCard";

type Props = {
  article: KbArticle;
  currentUserId?: number | null;
  currentUserRole?: string;
  onClose:  () => void;
  onEdit?:  (a: KbArticle) => void;
  onDelete?:(a: KbArticle) => void;
};

function formatDate(iso: string | null): string {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleDateString("fr-FR", {
      day: "2-digit", month: "long", year: "numeric",
    });
  } catch { return iso; }
}

export default function KnowledgeReadModal({
  article,
  currentUserId,
  currentUserRole,
  onClose,
  onEdit,
  onDelete,
}: Props) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const [safeHtml, setSafeHtml] = useState("");

  // Sanitize HTML client-side (DOMPurify needs browser APIs)
  useEffect(() => {
    if (!article.solution) { setSafeHtml(""); return; }
    import("dompurify").then(({ default: DOMPurify }) => {
      setSafeHtml(DOMPurify.sanitize(article.solution ?? ""));
    });
  }, [article.solution]);

  // Close on overlay click
  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === overlayRef.current) onClose();
  };

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  const color = getCategoryColor(article.category);

  const canEdit =
    currentUserRole === "admin" ||
    (currentUserRole === "tech" && currentUserId === article.author_id);
  const canDelete = currentUserRole === "admin";

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in"
      onClick={handleOverlayClick}
    >
      <div
        className="glass-card w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Header ── */}
        <div className="flex items-start justify-between gap-4 p-5 border-b border-[hsl(var(--border)/0.5)]">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
              {/* Category badge */}
              {article.category && (
                <span
                  className="text-[0.65rem] font-semibold px-2.5 py-0.5 rounded-full border"
                  style={{ background: `${color}14`, color, borderColor: `${color}30` }}
                >
                  {article.category}
                </span>
              )}
              {/* Published status */}
              <span
                className={`text-[0.6rem] font-bold px-2 py-0.5 rounded-full ${
                  article.is_published
                    ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20"
                    : "bg-amber-500/10 text-amber-500 border border-amber-500/20"
                }`}
              >
                {article.is_published ? "Publié" : "Brouillon"}
              </span>
            </div>
            <h2 className="text-lg font-bold leading-snug">{article.title}</h2>

            {/* Meta */}
            <div className="flex items-center gap-4 mt-2 text-[0.65rem] text-[hsl(var(--muted-foreground))] flex-wrap">
              {article.author && (
                <span className="flex items-center gap-1">
                  <User size={11} /> {article.author}
                </span>
              )}
              {article.write_date && (
                <span className="flex items-center gap-1">
                  <Calendar size={11} /> Mis à jour le {formatDate(article.write_date)}
                </span>
              )}
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))] transition-colors flex-shrink-0"
          >
            <X size={18} />
          </button>
        </div>

        {/* ── Body ── */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-5 space-y-5">
          {/* Tags */}
          {article.tags.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              <Tag size={13} className="text-[hsl(var(--muted-foreground))]" />
              {article.tags.map((t) => (
                <span
                  key={t.id}
                  className="text-[0.65rem] font-semibold px-2.5 py-0.5 rounded-full bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))] border border-[hsl(var(--border))]"
                >
                  {t.name}
                </span>
              ))}
            </div>
          )}

          {/* HTML Content */}
          {safeHtml ? (
            <div
              className="prose prose-sm max-w-none text-[hsl(var(--foreground))]
                         prose-headings:font-semibold prose-headings:text-[hsl(var(--foreground))]
                         prose-strong:text-[hsl(var(--foreground))]
                         prose-code:bg-[hsl(var(--muted))] prose-code:px-1 prose-code:rounded
                         prose-ul:my-2 prose-li:my-0.5
                         prose-a:text-[hsl(var(--primary))]"
              dangerouslySetInnerHTML={{ __html: safeHtml }}
            />
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-[hsl(var(--muted-foreground))]">
              <BookOpen size={32} className="mb-2 opacity-30" />
              <p className="text-sm">Contenu non disponible.</p>
            </div>
          )}

          {/* Source ticket */}
          {article.source_ticket_id && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-[hsl(var(--muted)/0.4)] border border-[hsl(var(--border)/0.5)] text-sm">
              <ExternalLink size={14} className="text-[hsl(var(--muted-foreground))] flex-shrink-0" />
              <span className="text-[hsl(var(--muted-foreground))]">
                Issu du ticket{" "}
                <span className="font-semibold text-[hsl(var(--foreground))]">
                  #{article.source_ticket_id}
                  {article.source_ticket_name ? ` — ${article.source_ticket_name}` : ""}
                </span>
              </span>
            </div>
          )}
        </div>

        {/* ── Footer actions ── */}
        {(canEdit || canDelete) && (
          <div className="px-5 py-3 border-t border-[hsl(var(--border)/0.5)] flex justify-end gap-2">
            {canEdit && onEdit && (
              <button
                onClick={() => { onClose(); onEdit(article); }}
                className="btn-ghost flex items-center gap-2 text-sm"
              >
                <Pencil size={14} /> Modifier
              </button>
            )}
            {canDelete && onDelete && (
              <button
                onClick={() => { onClose(); onDelete(article); }}
                className="flex items-center gap-2 text-sm px-3 py-1.5 rounded-lg text-red-500 hover:bg-red-500/08 transition-colors font-medium"
              >
                <Trash2 size={14} /> Supprimer
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
