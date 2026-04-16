"use client";

import { useState, useEffect, useCallback, useRef, type FormEvent } from "react";
import { useParams, useRouter } from "next/navigation";
import axios from "axios";
import {
  ArrowLeft, Sparkles, User2, Clock, AlertTriangle, CheckCircle2,
  ArrowUpCircle, UserCheck, RefreshCw, Send, BookOpen, Loader2, ChevronRight,
  MessageSquare, Paperclip, Download, FileText, Image as ImageIcon, File,
  Upload, X
} from "lucide-react";
import SlaBadge from "@/components/SlaBadge";
import ProtectedRoute from "@/components/ProtectedRoute";
import { useAuth } from "@/lib/auth";
import Link from "next/link";

const ODOO_URL  = "http://localhost:8069";
const FLASK_URL = "http://localhost:8000";

const PRIORITY_MAP: Record<string, { label: string; badge: string; dot: string }> = {
  "3": { label: "Critique", badge: "bg-red-500/10 text-red-500 border-red-500/20",    dot: "bg-red-500" },
  "2": { label: "Haute",    badge: "bg-orange-500/10 text-orange-500 border-orange-500/20", dot: "bg-orange-500" },
  "1": { label: "Moyenne",  badge: "bg-amber-500/10 text-amber-600 border-amber-500/20",  dot: "bg-amber-500" },
  "0": { label: "Basse",    badge: "bg-sky-500/10 text-sky-600 border-sky-500/20",    dot: "bg-sky-400" },
};

const STATE_MAP: Record<string, { label: string; color: string }> = {
  new:        { label: "Nouveau",    color: "text-gray-500" },
  assigned:   { label: "Assigné",    color: "text-blue-500" },
  in_progress:{ label: "En cours",   color: "text-indigo-500" },
  waiting:    { label: "En attente", color: "text-amber-500" },
  blocked:    { label: "Bloqué",     color: "text-red-500" },
  escalated:  { label: "Escaladé",   color: "text-purple-500" },
  resolved:   { label: "Résolu",     color: "text-emerald-500" },
  closed:     { label: "Fermé",      color: "text-gray-400" },
};

type Ticket = {
  id: number;
  name: string;
  description: string;
  priority: string;
  state: string;
  create_date: string | null;
  sla_deadline: string | null;
  sla_status: string | null;
  user_id: string | null;
  assigned_to_id?: string | null;
  ai_classification?: string | null;
  ai_suggested_solution?: string | null;
  ai_confidence?: number | null;
};

type AiSuggestion = {
  category?: string;
  priority?: string;
  confidence?: number;
  suggested_solution?: string;
};

type Comment = {
  id: number;
  author_name: string;
  x_support_role?: string;
  date: string;
  body: string;
};

type Attachment = {
  id: number;
  name: string;
  mimetype: string;
  file_size: number;
  create_date: string | null;
  url: string;
};

function getFileIcon(mimetype: string) {
  if (mimetype.startsWith("image/")) return <ImageIcon size={14} className="text-blue-400" />;
  if (mimetype === "application/pdf")  return <FileText size={14} className="text-red-400" />;
  return <File size={14} className="text-gray-400" />;
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}

function TicketDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();

  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [loading, setLoading] = useState(true);
  const [aiSuggestion, setAiSuggestion] = useState<AiSuggestion | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiAsked, setAiAsked] = useState(false);

  // Discussion
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [newComment, setNewComment] = useState("");
  const [postingComment, setPostingComment] = useState(false);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [attachLoading, setAttachLoading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Resolution modal state
  const [showResolveModal, setShowResolveModal] = useState(false);
  const [resolution, setResolution] = useState("");
  const [addToKb, setAddToKb] = useState(false);
  const [resolving, setResolving] = useState(false);

  // Action states
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: "ok" | "err" } | null>(null);

  const showToast = (msg: string, type: "ok" | "err") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  const fetchTicket = useCallback(async () => {
    try {
      const res = await axios.get(`${ODOO_URL}/api/tickets`, { withCredentials: true });
      if (res.data.status === 200) {
        const found = res.data.data.find((t: Ticket) => t.id === parseInt(id));
        if (found) {
          setTicket(found);
          // Pre-load AI suggestion from stored data if any
          if (found.ai_suggested_solution) {
            setAiSuggestion({
              category: found.ai_classification ?? undefined,
              confidence: found.ai_confidence ?? undefined,
              suggested_solution: found.ai_suggested_solution,
            });
            setAiAsked(true);
          }
        }
      }
    } catch {
      console.error("Erreur fetch ticket");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchTicket();
  }, [fetchTicket]);

  // ── Discussion Handlers ──
  const fetchComments = useCallback(async () => {
    setCommentsLoading(true);
    try {
      const res = await axios.get(`${ODOO_URL}/api/ticket/${id}/comments`, { withCredentials: true });
      if (res.data.status === 200) setComments(res.data.data);
    } catch { /* silent */ } finally { setCommentsLoading(false); }
  }, [id]);

  const fetchAttachments = useCallback(async () => {
    setAttachLoading(true);
    try {
      const res = await axios.get(`${FLASK_URL}/api/ticket/${id}/attachments`);
      if (res.data.status === 200) setAttachments(res.data.data);
    } catch { /* silent */ } finally { setAttachLoading(false); }
  }, [id]);

  useEffect(() => {
    fetchComments();
    fetchAttachments();
  }, [fetchComments, fetchAttachments]);

  const handlePostComment = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!newComment.trim()) return;
    setPostingComment(true);
    try {
      const stored = localStorage.getItem("it_support_user");
      const u = stored ? JSON.parse(stored) : null;
      await axios.post(`${ODOO_URL}/api/ticket/${id}/comment`, {
        params: { body: newComment, author: u?.name || "Technicien", user_id: u?.id || null }
      }, { withCredentials: true });
      setNewComment("");
      fetchComments();
    } catch {
      showToast("Erreur lors de l'envoi du commentaire.", "err");
    } finally {
      setPostingComment(false); }
  };

  const handleUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploadError(null);
    setUploading(true);
    try {
      const formData = new FormData();
      Array.from(files).forEach((f) => formData.append("files", f));
      const res = await axios.post(`${FLASK_URL}/api/ticket/${id}/upload`, formData, {
        headers: { "Content-Type": "multipart/form-data" }
      });
      if (res.data.status === 201) {
        showToast(`✅ ${res.data.data.length} fichier(s) ajouté(s)`, "ok");
        fetchAttachments();
      }
    } catch { setUploadError("Erreur lors du téléversement."); }
    finally { setUploading(false); if (fileInputRef.current) fileInputRef.current.value = ""; }
  };

  const fetchAiSuggestion = async () => {
    setAiLoading(true);
    setAiAsked(true);
    try {
      const res = await axios.get(`${ODOO_URL}/api/ticket/${id}/ai-suggest`, { withCredentials: true });
      if (res.data.status === "success") {
        setAiSuggestion(res.data.data);
      } else {
        showToast("L'IA n'a pas pu générer de suggestion.", "err");
      }
    } catch {
      showToast("Erreur lors de l'appel IA.", "err");
    } finally {
      setAiLoading(false);
    }
  };

  const handleAssign = async () => {
    setActionLoading("assign");
    try {
      await axios.patch(`${ODOO_URL}/api/ticket/${id}/assign`, {}, { withCredentials: true });
      showToast("✅ Ticket pris en charge !", "ok");
      fetchTicket();
    } catch {
      showToast("Erreur lors de l'assignation.", "err");
    } finally {
      setActionLoading(null);
    }
  };

  const handleEscalate = async () => {
    setActionLoading("escalate");
    try {
      await axios.patch(`${ODOO_URL}/api/ticket/${id}/transfer`, { escalate: true }, { withCredentials: true });
      showToast("⬆️ Ticket escaladé à l'administrateur.", "ok");
      fetchTicket();
    } catch {
      showToast("Erreur lors de l'escalade.", "err");
    } finally {
      setActionLoading(null);
    }
  };

  const handleResolve = async () => {
    if (!resolution.trim()) return;
    setResolving(true);
    try {
      await axios.patch(
        `${ODOO_URL}/api/ticket/${id}/resolve`,
        { resolution, add_to_kb: addToKb },
        { withCredentials: true }
      );
      showToast(addToKb ? "✅ Résolu et publié dans la KB !" : "✅ Ticket résolu !", "ok");
      setShowResolveModal(false);
      setResolution("");
      setAddToKb(false);
      fetchTicket();
    } catch {
      showToast("Erreur lors de la résolution.", "err");
    } finally {
      setResolving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={28} className="animate-spin text-[hsl(var(--primary))]" />
      </div>
    );
  }

  if (!ticket) {
    return (
      <div className="p-8 text-center">
        <p className="text-[hsl(var(--muted-foreground))]">Ticket introuvable.</p>
        <Link href="/tech/tickets" className="mt-4 btn-ghost text-sm inline-flex items-center gap-1">
          <ArrowLeft size={14} /> Retour
        </Link>
      </div>
    );
  }

  const pCfg = PRIORITY_MAP[ticket.priority] ?? PRIORITY_MAP["1"];
  const sCfg = STATE_MAP[ticket.state] ?? { label: ticket.state, color: "text-gray-400" };
  const isResolved = ["resolved", "closed"].includes(ticket.state);
  const isAssignedToMe = ticket.assigned_to_id === user?.name;

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-4">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-5 right-5 z-[200] px-5 py-3 rounded-xl shadow-xl text-sm font-semibold animate-fade-in
          ${toast.type === "ok" ? "bg-emerald-600 text-white" : "bg-red-600 text-white"}`}>
          {toast.msg}
        </div>
      )}

      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-xs text-[hsl(var(--muted-foreground))]">
        <Link href="/tech/tickets" className="hover:text-[hsl(var(--foreground))] transition-colors">Mes Tickets</Link>
        <ChevronRight size={12} />
        <span className="text-[hsl(var(--foreground))] font-medium">#{ticket.id}</span>
      </nav>

      {/* Back button */}
      <button onClick={() => router.back()} className="btn-ghost text-sm flex items-center gap-1.5">
        <ArrowLeft size={15} /> Retour
      </button>

      {/* DOUBLE PANEL LAYOUT */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">

        {/* ══════════ LEFT PANEL: Ticket Detail ══════════ */}
        <div className="lg:col-span-3 space-y-4">

          {/* Ticket Header Card */}
          <div className="glass-card p-5 space-y-4">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div className="flex-1 min-w-0">
                <h1 className="text-xl font-bold tracking-tight">{ticket.name}</h1>
                <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1">Ticket #{ticket.id}</p>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${pCfg.badge}`}>
                  {pCfg.label}
                </span>
                <span className={`text-xs font-semibold ${sCfg.color}`}>● {sCfg.label}</span>
              </div>
            </div>

            {/* Meta info */}
            <div className="grid grid-cols-2 gap-3 pt-3 border-t border-[hsl(var(--border)/0.5)]">
              {ticket.user_id && (
                <div className="flex items-center gap-2 text-sm">
                  <User2 size={14} className="text-[hsl(var(--muted-foreground))]" />
                  <div>
                    <p className="text-[0.65rem] text-[hsl(var(--muted-foreground))]">Demandeur</p>
                    <p className="font-medium text-xs">{ticket.user_id}</p>
                  </div>
                </div>
              )}
              {ticket.create_date && (
                <div className="flex items-center gap-2 text-sm">
                  <Clock size={14} className="text-[hsl(var(--muted-foreground))]" />
                  <div>
                    <p className="text-[0.65rem] text-[hsl(var(--muted-foreground))]">Créé le</p>
                    <p className="font-medium text-xs">{new Date(ticket.create_date).toLocaleString("fr-FR")}</p>
                  </div>
                </div>
              )}
            </div>

            {/* SLA */}
            <div className="pt-2">
              <p className="text-[0.65rem] text-[hsl(var(--muted-foreground))] mb-1.5 font-semibold uppercase tracking-wider">
                Deadline SLA
              </p>
              <SlaBadge slaDeadline={ticket.sla_deadline} slaStatus={ticket.sla_status} />
            </div>
          </div>

          {/* Description */}
          <div className="glass-card p-5">
            <h2 className="text-sm font-semibold mb-3 text-[hsl(var(--muted-foreground))] uppercase tracking-wider">
              Description
            </h2>
            <p className="text-sm leading-relaxed whitespace-pre-wrap">{ticket.description}</p>
          </div>

          {/* Quick Actions */}
          {!isResolved && (
            <div className="glass-card p-4">
              <h2 className="text-sm font-semibold mb-3 text-[hsl(var(--muted-foreground))] uppercase tracking-wider">
                Actions rapides
              </h2>
              <div className="flex flex-wrap gap-2">
                {/* Prendre en charge */}
                {!isAssignedToMe && (
                  <button
                    disabled={actionLoading === "assign"}
                    onClick={handleAssign}
                    className="btn-primary text-xs px-4 py-2 flex items-center gap-1.5 rounded-lg disabled:opacity-60"
                  >
                    {actionLoading === "assign"
                      ? <Loader2 size={13} className="animate-spin" />
                      : <UserCheck size={13} />}
                    Prendre en charge
                  </button>
                )}

                {/* Escalader */}
                {ticket.state !== "escalated" && (
                  <button
                    disabled={actionLoading === "escalate"}
                    onClick={handleEscalate}
                    className="flex items-center gap-1.5 text-xs font-semibold px-4 py-2 rounded-lg border border-purple-500/30
                      bg-purple-500/10 text-purple-500 hover:bg-purple-500/20 transition-colors disabled:opacity-60"
                  >
                    {actionLoading === "escalate"
                      ? <Loader2 size={13} className="animate-spin" />
                      : <ArrowUpCircle size={13} />}
                    Escalader
                  </button>
                )}

                {/* Résoudre */}
                <button
                  onClick={() => setShowResolveModal(true)}
                  className="flex items-center gap-1.5 text-xs font-semibold px-4 py-2 rounded-lg border border-emerald-500/30
                    bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 transition-colors"
                >
                  <CheckCircle2 size={13} />
                  Résoudre
                </button>
              </div>
            </div>
          )}

          {isResolved && (
            <div className="glass-card p-4 border border-emerald-500/20 bg-emerald-500/5">
              <div className="flex items-center gap-2 text-emerald-600">
                <CheckCircle2 size={16} />
                <span className="text-sm font-semibold">Ce ticket est résolu.</span>
              </div>
            </div>
          )}
        </div>

        {/* ══════════ RIGHT PANEL: AI Suggestions ══════════ */}
        <div className="lg:col-span-2 space-y-4">
          <div className="glass-card p-5 h-full space-y-4">
            {/* AI Header */}
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg accent-gradient flex items-center justify-center">
                <Sparkles size={15} className="text-white" />
              </div>
              <div>
                <h2 className="text-sm font-bold">Diagnostic IA</h2>
                <p className="text-[0.65rem] text-[hsl(var(--muted-foreground))]">Propulsé par Groq LLaMA-3</p>
              </div>
            </div>

            {/* Trigger Button */}
            {!aiAsked && (
              <button
                onClick={fetchAiSuggestion}
                className="w-full btn-primary text-sm flex items-center justify-center gap-2"
              >
                <Sparkles size={15} />
                Analyser avec l&apos;IA
              </button>
            )}

            {/* Loading state */}
            {aiLoading && (
              <div className="flex flex-col items-center justify-center py-10 gap-3 text-center">
                <div className="w-10 h-10 rounded-full accent-gradient flex items-center justify-center animate-pulse">
                  <Sparkles size={18} className="text-white" />
                </div>
                <p className="text-sm text-[hsl(var(--muted-foreground))]">L&apos;IA analyse le ticket…</p>
              </div>
            )}

            {/* AI Result */}
            {!aiLoading && aiSuggestion && (
              <div className="space-y-3">
                {/* Confidence */}
                {aiSuggestion.confidence && (
                  <div>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-[hsl(var(--muted-foreground))]">Confiance</span>
                      <span className="font-bold text-[hsl(var(--primary))]">{aiSuggestion.confidence}%</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-[hsl(var(--muted))] overflow-hidden">
                      <div
                        className="h-full rounded-full accent-gradient transition-all duration-700"
                        style={{ width: `${aiSuggestion.confidence}%` }}
                      />
                    </div>
                  </div>
                )}

                {/* Category */}
                {aiSuggestion.category && (
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-[hsl(var(--muted-foreground))]">Catégorie détectée</span>
                    <span className="text-xs font-semibold bg-[hsl(var(--primary)/0.1)] text-[hsl(var(--primary))] px-2 py-0.5 rounded-full">
                      {aiSuggestion.category}
                    </span>
                  </div>
                )}

                {/* Suggested solution */}
                <div className="pt-3 border-t border-[hsl(var(--border)/0.5)]">
                  <p className="text-xs font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wider mb-2">
                    Solution suggérée
                  </p>
                  <div className="bg-[hsl(var(--muted)/0.5)] rounded-xl p-3 text-sm leading-relaxed">
                    {aiSuggestion.suggested_solution}
                  </div>
                </div>

                {/* Re-analyze */}
                <button
                  onClick={fetchAiSuggestion}
                  className="w-full btn-ghost text-xs flex items-center justify-center gap-1.5"
                >
                  <RefreshCw size={12} /> Relancer l&apos;analyse
                </button>
              </div>
            )}

            {/* KB Link */}
            <div className="pt-3 border-t border-[hsl(var(--border)/0.5)]">
              <Link
                href="/tech/knowledge"
                className="flex items-center gap-2 text-xs text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors group"
              >
                <BookOpen size={13} className="group-hover:text-[hsl(var(--primary))]" />
                Consulter la Base de Connaissances
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* ══════════ DISCUSSION PANEL ══════════ */}
      <div className="space-y-4">

        {/* Comments */}
        <div className="glass-card p-5 space-y-4">
          <h2 className="text-sm font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wider flex items-center gap-2">
            <MessageSquare size={14} />
            Discussion ({comments.length})
          </h2>

          {/* Comment list */}
          <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
            {commentsLoading ? (
              <div className="h-16 animate-pulse bg-[hsl(var(--muted)/0.5)] rounded-xl" />
            ) : comments.length === 0 ? (
              <p className="text-xs text-[hsl(var(--muted-foreground))] text-center py-4">
                Aucun commentaire pour l&apos;instant.
              </p>
            ) : (
              comments.map((c) => (
                <div key={c.id} className="flex gap-3">
                  <div className="w-7 h-7 rounded-full accent-gradient flex items-center justify-center text-white text-[0.6rem] font-bold flex-shrink-0">
                    {c.author_name.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="flex-1 bg-[hsl(var(--muted)/0.4)] rounded-xl p-3 text-sm">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold text-xs">{c.author_name}</span>
                      {c.x_support_role && (
                        <span className="text-[0.6rem] bg-[hsl(var(--primary)/0.1)] text-[hsl(var(--primary))] px-1.5 py-0.5 rounded-full font-semibold">
                          {c.x_support_role}
                        </span>
                      )}
                      <span className="text-[0.6rem] text-[hsl(var(--muted-foreground))] ml-auto">
                        {new Date(c.date).toLocaleString("fr-FR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                    <p className="text-xs leading-relaxed whitespace-pre-wrap">{c.body}</p>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* New comment form */}
          <form onSubmit={handlePostComment} className="flex gap-2">
            <input
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder="Ajouter un commentaire…"
              className="input-field flex-1 text-sm h-9"
              disabled={postingComment}
            />
            <button
              type="submit"
              disabled={!newComment.trim() || postingComment}
              className="btn-primary text-xs px-3 h-9 disabled:opacity-60 flex items-center gap-1"
            >
              {postingComment ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
            </button>
          </form>
        </div>

        {/* Attachments */}
        <div className="glass-card p-5 space-y-3">
          <h2 className="text-sm font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wider flex items-center gap-2">
            <Paperclip size={14} />
            Pièces jointes ({attachments.length})
          </h2>

          {/* File list */}
          {attachLoading ? (
            <div className="h-12 animate-pulse bg-[hsl(var(--muted)/0.5)] rounded-xl" />
          ) : attachments.length === 0 ? (
            <p className="text-xs text-[hsl(var(--muted-foreground))]">Aucun fichier joint.</p>
          ) : (
            <div className="space-y-2">
              {attachments.map((a) => (
                <div key={a.id} className="flex items-center gap-3 p-2.5 rounded-xl bg-[hsl(var(--muted)/0.4)] hover:bg-[hsl(var(--muted)/0.7)] transition-colors group">
                  <span className="flex-shrink-0">{getFileIcon(a.mimetype)}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate">{a.name}</p>
                    <p className="text-[0.6rem] text-[hsl(var(--muted-foreground))]">{formatBytes(a.file_size)}</p>
                  </div>
                  <a
                    href={`${FLASK_URL}${a.url}`}
                    target="_blank"
                    rel="noreferrer"
                    className="opacity-0 group-hover:opacity-100 transition-opacity text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
                    title="Télécharger"
                  >
                    <Download size={14} />
                  </a>
                </div>
              ))}
            </div>
          )}

          {/* Upload zone */}
          <label
            className={`flex flex-col items-center justify-center gap-2 border-2 border-dashed rounded-xl p-4 cursor-pointer transition-colors text-center
              ${uploading ? "opacity-50 pointer-events-none" : "hover:border-[hsl(var(--primary)/0.4)] hover:bg-[hsl(var(--primary)/0.03)]"}
              border-[hsl(var(--border))]`}
          >
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="sr-only"
              onChange={(e) => handleUpload(e.target.files)}
              accept=".jpg,.jpeg,.png,.gif,.webp,.pdf,.txt,.csv,.zip,.xls,.xlsx,.doc,.docx"
            />
            {uploading ? (
              <Loader2 size={18} className="animate-spin text-[hsl(var(--primary))]" />
            ) : (
              <Upload size={18} className="text-[hsl(var(--muted-foreground))]" />
            )}
            <span className="text-xs text-[hsl(var(--muted-foreground))]">
              {uploading ? "Upload en cours…" : "Glisser-déposer ou cliquer pour ajouter un fichier"}
            </span>
          </label>

          {uploadError && (
            <div className="flex items-center gap-2 text-xs text-red-500 bg-red-500/10 px-3 py-2 rounded-lg">
              <X size={12} />
              {uploadError}
            </div>
          )}
        </div>
      </div>

      {/* ══════════ RESOLVE MODAL ══════════ */}
      {showResolveModal && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4"
          onClick={() => setShowResolveModal(false)}
        >
          <div
            className="glass-card w-full max-w-lg p-6 space-y-4 animate-fade-in"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2">
              <CheckCircle2 size={20} className="text-emerald-500" />
              <h2 className="text-base font-bold">Résoudre le ticket #{ticket.id}</h2>
            </div>

            <div>
              <label className="text-xs font-semibold text-[hsl(var(--muted-foreground))] mb-1.5 block">
                Résolution apportée *
              </label>
              <textarea
                value={resolution}
                onChange={(e) => setResolution(e.target.value)}
                rows={5}
                placeholder="Décrivez la solution appliquée pour résoudre ce problème…"
                className="input-field w-full resize-none text-sm"
              />
            </div>

            {/* Add to KB toggle */}
            <label className="flex items-start gap-3 cursor-pointer group">
              <div className="relative flex-shrink-0 mt-0.5">
                <input
                  type="checkbox"
                  checked={addToKb}
                  onChange={(e) => setAddToKb(e.target.checked)}
                  className="sr-only"
                />
                <div className={`w-9 h-5 rounded-full transition-colors duration-200 ${addToKb ? "bg-[hsl(var(--primary))]" : "bg-[hsl(var(--muted))]"}`}>
                  <div className={`w-3.5 h-3.5 bg-white rounded-full shadow transition-transform duration-200 mt-[3px] ${addToKb ? "translate-x-4" : "translate-x-0.5"}`} />
                </div>
              </div>
              <div>
                <p className="text-sm font-semibold flex items-center gap-1">
                  <BookOpen size={13} className="text-[hsl(var(--primary))]" />
                  Publier dans la Base de Connaissances
                </p>
                <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">
                  La solution sera disponible pour toute l&apos;équipe
                </p>
              </div>
            </label>

            {/* Actions */}
            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setShowResolveModal(false)}
                className="flex-1 btn-ghost text-sm"
              >
                Annuler
              </button>
              <button
                disabled={!resolution.trim() || resolving}
                onClick={handleResolve}
                className="flex-1 btn-primary text-sm flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {resolving ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
                {addToKb ? "Résoudre & Publier" : "Confirmer la résolution"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function TechTicketDetailPage() {
  return (
    <ProtectedRoute roles={["tech", "admin"]}>
      <TicketDetailPage />
    </ProtectedRoute>
  );
}
