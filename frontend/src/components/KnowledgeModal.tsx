"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { X, Loader2, CheckCircle2, BookOpen, ArrowLeft } from "lucide-react";
import axios from "axios";
import type { KbArticle, KbTag } from "./KnowledgeCard";

const ODOO_URL = "http://localhost:8069";

type Props = {
  article?: KbArticle | null;
  initialTitle?: string;
  initialContent?: string;
  fromTicket?: string | number | null;
  onClose: () => void;
  onSaved: (toastMsg?: string) => void;
  userId?: number | null;
  userRole?: string;
};

type Step = "form" | "saving" | "success";

export default function KnowledgeModal({
  article,
  initialTitle,
  initialContent,
  fromTicket,
  onClose,
  onSaved,
  userId,
  userRole,
}: Props) {
  const router = useRouter();
  const isEditing = !!article;

  // ─── State ────────────────────────────────────────────────────────────────
  const [step, setStep] = useState<Step>("form");
  const [title, setTitle] = useState(article?.title ?? initialTitle ?? "");
  const [category, setCategory] = useState(article?.category ?? "");
  const [tagInput, setTagInput] = useState(
    article?.tags.map((t) => t.name).join(", ") ?? "",
  );
  const [content, setContent] = useState(initialContent ?? "");
  const [isPublished, setIsPublished] = useState(
    article?.is_published ?? false,
  );
  const [availableTags, setAvailableTags] = useState<KbTag[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [categories, setCategories] = useState<string[]>([
    "Réseau",
    "Logiciel",
    "Matériel",
    "Accès",
    "Messagerie",
    "Sécurité",
    "Infrastructure",
    "Autre",
  ]);

  // Charger les catégories depuis Odoo
  useEffect(() => {
    axios
      .get(`${ODOO_URL}/api/categories`)
      .then((res) => {
        if (res.data?.data?.length) setCategories(res.data.data);
      })
      .catch(() => {}); // garde les catégories par défaut si erreur
  }, []);

  // On édition, on charge le HTML complet via l'endpoint détail
  useEffect(() => {
    if (article) {
      axios
        .get(`${ODOO_URL}/api/knowledge/${article.id}`)
        .then((res) => {
          if (res.data.status === 200) {
            setContent(res.data.data.solution ?? "");
          }
        })
        .catch(() => setContent(""));
    }
  }, [article]);

  // Charger les tags existants pour l'autocomplétion
  useEffect(() => {
    // Pas de route dédiée pour les tags, on pourrait en ajouter une plus tard.
    // Pour l'instant on parse les tags de l'article + saisie libre.
    if (article) {
      setAvailableTags(article.tags);
    }
  }, [article]);

  const handleClose = useCallback(() => {
    onClose();
  }, [onClose]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError(null);

      if (!title.trim() || !content.trim()) {
        setError("Le titre et le contenu sont requis.");
        return;
      }

      setStep("saving");
      try {
        const tagNames = tagInput
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);

        if (isEditing && article) {
          // PUT — mise à jour
          const res = await axios.put(
            `${ODOO_URL}/api/knowledge/${article.id}`,
            {
              title,
              solution: content,
              category: category || undefined,
              is_published: isPublished,
              requester_id: userId,
              requester_role: userRole,
              tag_names: tagNames,
            },
            { headers: { "Content-Type": "application/json" } },
          );
          if (res.data.status !== 200 && res.data.status !== "200")
            throw new Error(res.data.message || "Erreur mise à jour");
        } else {
          // POST — création
          const res = await axios.post(
            `${ODOO_URL}/api/knowledge/create`,
            {
              title,
              solution: content,
              category: category || undefined,
              is_published: isPublished,
              author_id: userId,
              tag_names: tagNames,
            },
            { headers: { "Content-Type": "application/json" } },
          );
          if (res.data.status !== 201 && res.data.status !== "201")
            throw new Error(res.data.message || "Erreur création");

          const toastMsg =
            res.data.message ||
            `L'article "${title}" a été publié avec succès.`;
          setStep("success");
          setTimeout(() => {
            if (fromTicket) {
              router.back();
            } else {
              onSaved(toastMsg);
              handleClose();
            }
          }, 1500);
          return;
        }

        setStep("success");
        setTimeout(() => {
          if (fromTicket) {
            router.back();
          } else {
            onSaved();
            handleClose();
          }
        }, 1500);
      } catch (err: unknown) {
        const msg =
          err instanceof Error
            ? err.message
            : "Erreur lors de l'enregistrement.";
        setError(msg);
        setStep("form");
      }
    },
    [
      title,
      content,
      category,
      tagInput,
      isPublished,
      isEditing,
      article,
      userId,
      userRole,
      onSaved,
      handleClose,
    ],
  );

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
    >
      <div
        className="glass-card w-full max-w-xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Header ── */}
        {fromTicket && (
          <div className="p-4 pb-0">
            <a 
              href={`/tech/tickets/${fromTicket}`} 
              onClick={(e) => {
                e.preventDefault();
                router.back();
              }}
              className="btn-ghost text-sm flex items-center gap-1.5 w-fit"
            >
              <ArrowLeft size={15} /> Retour
            </a>
          </div>
        )}
        <div className="flex items-center justify-between p-5 border-b border-[hsl(var(--border)/0.5)]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg accent-gradient flex items-center justify-center">
              <BookOpen size={15} className="text-white" />
            </div>
            <div>
              <h2 className="text-base font-bold">
                {isEditing ? "Modifier l'article" : "Nouvel article KB"}
              </h2>
              <p className="text-[0.65rem] text-[hsl(var(--muted-foreground))]">
                {isEditing
                  ? "Modifiez les informations ci-dessous"
                  : "Documentez une solution pour l'équipe"}
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))] transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* ── Form ── */}
        {step === "form" && (
          <form
            onSubmit={handleSubmit}
            className="flex flex-col flex-1 overflow-hidden"
          >
            <div className="flex-1 overflow-y-auto custom-scrollbar p-5 space-y-4">
              {/* Titre */}
              <div>
                <label className="block text-sm font-semibold mb-1.5">
                  Titre de l&apos;article{" "}
                  <span className="text-red-500">*</span>
                </label>
                <input
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="input-field focus-ring w-full"
                  placeholder="Ex: Configuration du VPN client sur Windows 11"
                />
              </div>

              {/* Catégorie */}
              <div>
                <label className="block text-sm font-semibold mb-1.5">
                  Catégorie IT
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="input-field focus-ring w-full"
                >
                  <option value="">— Choisir une catégorie —</option>
                  {categories.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              {/* Tags */}
              <div>
                <label className="block text-sm font-semibold mb-1.5">
                  Tags / Mots-clés
                  <span className="text-[hsl(var(--muted-foreground))] font-normal ml-1.5 text-xs">
                    (séparés par des virgules)
                  </span>
                </label>
                <input
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  className="input-field focus-ring w-full"
                  placeholder="VPN, connexion, réseau, Windows..."
                />
              </div>

              {/* Contenu */}
              <div>
                <label className="block text-sm font-semibold mb-1.5">
                  Contenu / Solution <span className="text-red-500">*</span>
                </label>
                <textarea
                  required
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  className="input-field focus-ring w-full resize-y"
                  style={{ minHeight: "180px" }}
                  placeholder="Décrivez les étapes de résolution, commandes, liens utiles..."
                />
                <p className="text-[0.65rem] text-[hsl(var(--muted-foreground))] mt-1">
                  Vous pouvez utiliser du HTML basique : &lt;b&gt;, &lt;ul&gt;,
                  &lt;li&gt;, &lt;p&gt;, &lt;h3&gt;
                </p>
              </div>

              {/* Toggle publication */}
              <div className="flex items-center justify-between p-3 rounded-xl bg-[hsl(var(--muted)/0.4)] border border-[hsl(var(--border)/0.5)]">
                <div>
                  <p className="text-sm font-semibold">
                    Publier l&apos;article
                  </p>
                  <p className="text-[0.65rem] text-[hsl(var(--muted-foreground))]">
                    Les articles publiés sont visibles par tous les utilisateurs
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsPublished((v) => !v)}
                  className={`relative w-11 h-6 rounded-full transition-colors duration-200 flex-shrink-0 ${
                    isPublished
                      ? "bg-[hsl(var(--primary))]"
                      : "bg-[hsl(var(--muted-foreground)/0.3)]"
                  }`}
                >
                  <span
                    className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform duration-200 ${
                      isPublished ? "translate-x-5" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>

              {/* Error */}
              {error && (
                <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 text-sm">
                  {error}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-[hsl(var(--border)/0.5)] flex justify-end gap-2 flex-shrink-0">
              <button type="button" onClick={handleClose} className="btn-ghost">
                Annuler
              </button>
              <button
                type="submit"
                className="btn-primary flex items-center gap-2"
              >
                {isEditing ? "Enregistrer" : "Publier l'article"}
              </button>
            </div>
          </form>
        )}

        {/* ── Saving ── */}
        {step === "saving" && (
          <div className="flex flex-col items-center justify-center py-16 gap-4 animate-fade-in">
            <div className="w-14 h-14 rounded-2xl accent-gradient flex items-center justify-center animate-pulse-glow">
              <Loader2 size={24} className="text-white animate-spin" />
            </div>
            <p className="text-sm font-medium">Enregistrement en cours...</p>
          </div>
        )}

        {/* ── Success ── */}
        {step === "success" && (
          <div className="flex flex-col items-center justify-center py-16 gap-4 animate-fade-in">
            <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 flex items-center justify-center">
              <CheckCircle2 size={28} className="text-emerald-500" />
            </div>
            <div className="text-center">
              <h3 className="font-bold text-base mb-1">
                {isEditing
                  ? "Article mis à jour !"
                  : "Article créé avec succès !"}
              </h3>
              <p className="text-sm text-[hsl(var(--muted-foreground))]">
                {isPublished
                  ? "L'article est maintenant visible par tous."
                  : "L'article est enregistré en brouillon."}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
