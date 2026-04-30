"use client";

import {
  useState,
  useEffect,
  useCallback,
  useRef,
  type FormEvent,
} from "react";
import { useParams, useRouter } from "next/navigation";
import axios from "axios";
import {
  ArrowLeft,
  Sparkles,
  Clock,
  CheckCircle2,
  ArrowUpCircle,
  RefreshCw,
  Send,
  BookOpen,
  Loader2,
  ChevronRight,
  MessageSquare,
  Paperclip,
  Download,
  FileText,
  Image as ImageIcon,
  File,
  Upload,
  X,
  Tag,
  AlertTriangle,
  ExternalLink,
  ShieldAlert,
  ShieldCheck,
  UploadCloud
} from "lucide-react";
import SlaBadge from "@/components/SlaBadge";
import ProtectedRoute from "@/components/ProtectedRoute";
import { useAuth } from "@/lib/auth";
import Link from "next/link";
import { ODOO_URL } from "@/lib/config";
import { toast } from "sonner";
import KnowledgeModal from "@/components/KnowledgeModal";

// @ts-expect-error: Ignore missing types



const FLASK_URL = "http://localhost:8000";

// ── Inline markdown renderer (no external dependency) ──────────────────────
function renderMarkdown(text: string): string {
  if (!text) return "";
  return text
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    // Headings
    .replace(/^### (.+)$/gm, "<h3>$1</h3>")
    .replace(/^## (.+)$/gm, "<h2>$1</h2>")
    .replace(/^# (.+)$/gm, "<h1>$1</h1>")
    // Bold & italic
    .replace(/\*\*\*(.+?)\*\*\*/g, "<strong><em>$1</em></strong>")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    // Bullet lists
    .replace(/^[-*] (.+)$/gm, "<li>$1</li>")
    .replace(/(<li>[\s\S]*?<\/li>)/g, "<ul>$1</ul>")
    // Numbered lists
    .replace(/^\d+\. (.+)$/gm, "<li>$1</li>")
    // Code inline
    .replace(/`(.+?)`/g, "<code>$1</code>")
    // Line breaks
    .replace(/\n\n/g, "</p><p>")
    .replace(/\n/g, "<br/>")
    .replace(/^(.+)$/, "<p>$1</p>");
}
// ───────────────────────────────────────────────────────────────────────────

const PRIORITY_MAP: Record<
  string,
  { label: string; badge: string; dot: string }
> = {
  "3": {
    label: "Critique",
    badge: "bg-red-500/10 text-red-500 border-red-500/20",
    dot: "bg-red-500",
  },
  "2": {
    label: "Haute",
    badge: "bg-orange-500/10 text-orange-500 border-orange-500/20",
    dot: "bg-orange-500",
  },
  "1": {
    label: "Moyenne",
    badge: "bg-amber-500/10 text-amber-600 border-amber-500/20",
    dot: "bg-amber-500",
  },
  "0": {
    label: "Basse",
    badge: "bg-sky-500/10 text-sky-600 border-sky-500/20",
    dot: "bg-sky-400",
  },
};

const STATE_MAP: Record<string, { label: string; badge: string }> = {
  new: {
    label: "Nouveau",
    badge: "bg-gray-500/10 text-gray-400 border-gray-500/20",
  },
  assigned: {
    label: "Assigné",
    badge: "bg-blue-400/10 text-blue-400 border-blue-400/20",
  },
  in_progress: {
    label: "En cours",
    badge: "bg-blue-500/15 text-blue-500 border-blue-500/20",
  },
  waiting: {
    label: "En attente",
    badge: "bg-orange-500/15 text-orange-500 border-orange-500/20",
  },
  blocked: {
    label: "Bloqué",
    badge: "bg-red-500/15 text-red-500 border-red-500/20",
  },
  escalated: {
    label: "Escaladé",
    badge: "bg-purple-500/15 text-purple-500 border-purple-500/20",
  },
  resolved: {
    label: "Résolu",
    badge: "bg-emerald-500/15 text-emerald-600 border-emerald-500/20",
  },
  closed: {
    label: "Fermé",
    badge: "bg-gray-500/10 text-gray-400 border-gray-500/20",
  },
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
  user_id: number | null;
  user_name: string | null;
  user_email: string | null;
  assigned_to_id?: number | null;
  assigned_to?: string | null;
  category?: string | null;
  ai_suggested_solution?: string | null;
  ai_confidence?: number | null;
  resolution?: string | null;
  escalated_by_id?: number | null;
  date_resolved?: string | null;
};

type AiSuggestion = {
  summary?: string;
  procedure?: string[];
  kb_article_id?: number;
  kb_article_title?: string;
  confidence?: number;
  category?: string;
  suggested_solution?: string;
  analysis_markdown?: string;
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
  if (mimetype.startsWith("image/"))
    return <ImageIcon size={14} className="text-blue-400" />;
  if (mimetype === "application/pdf")
    return <FileText size={14} className="text-red-400" />;
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

  // KB draft modal state (opened automatically after resolve when toggle is ON)
  const [kbDraftData, setKbDraftData] = useState<{
    title: string;
    category: string;
    content: string;
    sourceTicketId: number;
  } | null>(null);

  // Wait modal state
  const [showWaitModal, setShowWaitModal] = useState(false);
  const [waitJustification, setWaitJustification] = useState("");
  const [waiting, setWaiting] = useState(false);

  // Drag & drop state
  const [isDragging, setIsDragging] = useState(false);

  // Action states
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  // Removed custom showToast

  const fetchTicket = useCallback(async () => {
    try {
      const res = await axios.get(`${ODOO_URL}/api/tickets`, {
        withCredentials: true,
      });
      if (res.data.status === 200) {
        const found = res.data.data.find((t: Ticket) => t.id === parseInt(id));
        if (found) {
          setTicket(found);
          // Pre-load AI suggestion from stored data if any
          if (found.ai_suggested_solution) {
            setAiSuggestion({
              category: found.category ?? undefined,
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
      const res = await axios.get(`${ODOO_URL}/api/ticket/${id}/comments`, {
        withCredentials: true,
      });
      if (res.data.status === 200) setComments(res.data.data);
    } catch {
      /* silent */
    } finally {
      setCommentsLoading(false);
    }
  }, [id]);

  const fetchAttachments = useCallback(async () => {
    setAttachLoading(true);
    try {
      const res = await axios.get(`${FLASK_URL}/api/ticket/${id}/attachments`);
      if (res.data.status === 200) setAttachments(res.data.data);
    } catch {
      /* silent */
    } finally {
      setAttachLoading(false);
    }
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
      await axios.post(
        `${ODOO_URL}/api/ticket/${id}/comment`,
        {
          params: {
            body: newComment,
            author: u?.name || "Technicien",
            user_id: u?.id || null,
          },
        },
        { withCredentials: true },
      );
      setNewComment("");
      fetchComments();
      toast.error("Erreur lors de l'envoi du commentaire.");
    } finally {
      setPostingComment(false);
    }
  };

  const handleUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploadError(null);
    setUploading(true);
    try {
      const formData = new FormData();
      Array.from(files).forEach((f) => formData.append("files", f));
      const res = await axios.post(
        `${FLASK_URL}/api/ticket/${id}/upload`,
        formData,
        {
          headers: { "Content-Type": "multipart/form-data" },
        },
      );
      if (res.data.status === 201) {
        toast.success(`${res.data.data.length} fichier(s) ajouté(s)`, { icon: <UploadCloud size={18} /> });
        fetchAttachments();
      }
    } catch {
      setUploadError("Erreur lors du téléversement.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const fetchAiSuggestion = async () => {
    setAiLoading(true);
    setAiAsked(true);
    try {
      const res = await axios.get(`${ODOO_URL}/api/ticket/${id}/ai-analyze`, {
        withCredentials: true,
      });
      if (res.data.status === "success") {
        setAiSuggestion(res.data.data);
        toast.success("Diagnostic IA généré avec succès", { icon: <Sparkles size={18} /> });
      } else {
        toast.error("L'IA n'a pas pu analyser ce ticket.");
      }
    } catch (err) {
      console.error("AI Analysis Error:", err);
      toast.error("Erreur lors de l'analyse IA.");
    } finally {
      setAiLoading(false);
    }
  };

  const handleEscalate = async () => {
    setActionLoading("escalate");
    try {
      await axios.post(
        `${ODOO_URL}/api/ticket/${id}/escalate`,
        { tech_id: user?.id },
        { withCredentials: true },
      );
      toast.success("Ticket escaladé. L'admin a été notifié.", { icon: <ArrowUpCircle size={18} /> });
      fetchTicket();
    } catch {
      toast.error("Erreur lors de l'escalade.");
    } finally {
      setActionLoading(null);
    }
  };

  const handleUnescalate = async () => {
    setActionLoading("unescalate");
    try {
      await axios.post(
        `${ODOO_URL}/api/ticket/${id}/unescalate`,
        { user_id: user?.id },
        { withCredentials: true },
      );
      toast.success("L'escalade a été annulée. Vous avez repris la main sur le ticket.");
      fetchTicket();
      fetchComments();
    } catch {
      toast.error("Erreur lors de l'annulation de l'escalade.");
    } finally {
      setActionLoading(null);
    }
  };

  const handleWait = async () => {
    if (!waitJustification.trim()) return;
    setWaiting(true);
    try {
      console.log("WAIT TICKET:", {
        id,
        userId: user?.id,
        justification: waitJustification,
      });
      await axios.post(
        `${ODOO_URL}/api/ticket/${id}/wait`,
        { justification: waitJustification, user_id: user?.id },
        { withCredentials: true },
      );
      toast.success("Ticket mis en attente. Notification envoyée.", { icon: <Clock size={18} /> });
      setShowWaitModal(false);
      setWaitJustification("");
      fetchTicket();
      fetchComments();
    } catch (err) {
      console.error("Wait Error:", err);
      toast.error("Erreur lors de la mise en attente.");
    } finally {
      setWaiting(false);
    }
  };

  const handleResume = async () => {
    setActionLoading("resume");
    try {
      console.log("RESUME TICKET:", { id, userId: user?.id });
      await axios.post(
        `${ODOO_URL}/api/ticket/${id}/resume`,
        { user_id: user?.id },
        { withCredentials: true },
      );
      toast.success("Travail repris sur le ticket.", { icon: <RefreshCw size={18} /> });
      fetchTicket();
      fetchComments();
    } catch (err) {
      console.error("Resume Error:", err);
      toast.error("Erreur lors de la reprise du travail.");
    } finally {
      setActionLoading(null);
    }
  };

  const handleResolve = async () => {
    if (!resolution.trim()) return;
    setResolving(true);
    try {
      // ── Étape A : Persister la résolution du ticket (toujours) ──
      await axios.post(
        `${ODOO_URL}/api/ticket/${id}/resolve`,
        // When addToKb is ON, we do NOT auto-create the KB here; modal handles it
        { resolution, add_to_kb: false, user_id: user?.id },
        { withCredentials: true },
      );

      setShowResolveModal(false);

      if (addToKb && ticket) {
        // ── Cas 2 (Toggle ON) : Ouvrir le modal KB pré-rempli ──
        // Étape B : Préparer les données fusionnées
        const mergedContent = [
          "<h3>📋 Description du problème</h3>",
          `<p>${ticket.description.replace(/\n/g, "<br/>")}</p>`,
          "<hr/>",
          "<h3>Solution apportée</h3>",
          `<p>${resolution.replace(/\n/g, "<br/>")}</p>`,
        ].join("\n");

        setKbDraftData({
          title: ticket.name,
          category: ticket.category ?? "",
          content: mergedContent,
          sourceTicketId: ticket.id,
        });

        // Refresh ticket state in background
        fetchTicket();
        toast.success("Ticket résolu — Rédigez votre article KB ci-dessous !", { icon: <ShieldCheck size={18} /> });
      } else {
        // ── Cas 1 (Toggle OFF) : Comportement classique ──
        toast.success("Ticket résolu !", { icon: <ShieldCheck size={18} /> });
        setResolution("");
        setAddToKb(false);
        sessionStorage.setItem("resolved_ticket_id", String(id));
        setTimeout(() => router.push("/tech/tickets"), 1200);
      }
    } catch (err) {
      console.error("Resolve Error:", err);
      toast.error("Erreur lors de la résolution.");
    } finally {
      setResolving(false);
    }
  };

  const handleKbSaved = (toastMsg?: string) => {
    setKbDraftData(null);
    toast.success(toastMsg ?? "Article KB enregistré !", { icon: <ShieldCheck size={18} /> });
    // Navigate to tickets list after KB is saved
    sessionStorage.setItem("resolved_ticket_id", String(id));
    setTimeout(() => router.push("/tech/tickets"), 1500);
  };

  const handleKbClose = () => {
    setKbDraftData(null);
    // Even if they discard the KB, ticket is already resolved — go to list
    sessionStorage.setItem("resolved_ticket_id", String(id));
    router.push("/tech/tickets");
  };

  const handleCreateKb = () => {
    if (!ticket) return;
    sessionStorage.setItem(
      "kb_draft",
      JSON.stringify({
        title: ticket.name,
        content: aiSuggestion?.analysis_markdown,
      }),
    );
    router.push(`/tech/knowledge?create=true&fromTicket=${ticket.id}`);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2
          size={28}
          className="animate-spin text-[hsl(var(--primary))]"
        />
      </div>
    );
  }

  if (!ticket) {
    return (
      <div className="p-8 text-center">
        <p className="text-[hsl(var(--muted-foreground))]">
          Ticket introuvable.
        </p>
        <Link
          href="/tech/tickets"
          className="mt-4 btn-ghost text-sm inline-flex items-center gap-1"
        >
          <ArrowLeft size={14} /> Retour
        </Link>
      </div>
    );
  }

  const pCfg = PRIORITY_MAP[ticket.priority] ?? PRIORITY_MAP["1"];
  const sCfg = STATE_MAP[ticket.state] ?? {
    label: ticket.state,
    badge: "bg-gray-500/10 text-gray-400 border-gray-500/20",
  };
  const isResolved = ["resolved", "closed"].includes(ticket.state);

  // Initiales de l'avatar
  const requesterInitials = ticket.user_name
    ? ticket.user_name
        .split(" ")
        .map((w) => w[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "??";

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-4">

      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-xs text-[hsl(var(--muted-foreground))]">
        <Link
          href="/tech/tickets"
          className="hover:text-[hsl(var(--foreground))] transition-colors"
        >
          Mes Tickets
        </Link>
        <ChevronRight size={12} />
        <span className="text-[hsl(var(--foreground))] font-medium">
          #{ticket.id}
        </span>
      </nav>

      {/* Back button */}
      <button
        onClick={() => router.back()}
        className="btn-ghost text-sm flex items-center gap-1.5"
      >
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
                <h1 className="text-xl font-bold tracking-tight">
                  {ticket.name}
                </h1>
                <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1">
                  Ticket #{ticket.id}
                </p>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {ticket.category && (
                  <span className="inline-flex items-center gap-1 text-[11px] bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 px-2.5 py-0.5 rounded-full">
                    <Tag size={10} />
                    {ticket.category}
                  </span>
                )}
                <span
                  className={`text-xs font-bold px-2.5 py-1 rounded-full border ${pCfg.badge}`}
                >
                  {pCfg.label}
                </span>
                <span
                  className={`flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full border ${sCfg.badge}`}
                >
                  ● {sCfg.label}
                </span>
              </div>
            </div>

            {/* Meta info */}
            <div className="grid grid-cols-2 gap-3 pt-3 border-t border-[hsl(var(--border)/0.5)]">
              {/* Profil demandeur */}
              {(ticket.user_name || ticket.user_id) && (
                <div className="col-span-2 flex items-center gap-3 p-3 rounded-xl bg-[hsl(var(--muted)/0.4)] border border-[hsl(var(--border)/0.5)]">
                  <div className="w-9 h-9 rounded-full accent-gradient flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                    {requesterInitials}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[0.6rem] font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wider mb-0.5">
                      Demandeur
                    </p>
                    <p className="text-sm font-semibold truncate">
                      {ticket.user_name ?? `Utilisateur #${ticket.user_id}`}
                    </p>
                    {ticket.user_email && (
                      <p className="text-[0.65rem] text-[hsl(var(--muted-foreground))] truncate">
                        {ticket.user_email}
                      </p>
                    )}
                  </div>
                </div>
              )}
              {ticket.create_date && (
                <div className="flex items-center gap-2 text-sm">
                  <Clock
                    size={14}
                    className="text-[hsl(var(--muted-foreground))]"
                  />
                  <div>
                    <p className="text-[0.65rem] text-[hsl(var(--muted-foreground))]">
                      Créé le
                    </p>
                    <p className="font-medium text-xs">
                      {new Date(ticket.create_date).toLocaleString("fr-FR")}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* SLA */}
            <div className="pt-2">
              <p className="text-[0.65rem] text-[hsl(var(--muted-foreground))] mb-1.5 font-semibold uppercase tracking-wider">
                Deadline SLA
              </p>
              <SlaBadge
                slaDeadline={ticket.sla_deadline}
                slaStatus={ticket.sla_status}
                ticketState={ticket.state}
                dateResolved={ticket.date_resolved}
              />
            </div>
          </div>

          {/* Description */}
          <div className="glass-card p-5">
            <h2 className="text-sm font-semibold mb-3 text-[hsl(var(--muted-foreground))] uppercase tracking-wider">
              Description
            </h2>
            <p className="text-sm leading-relaxed whitespace-pre-wrap">
              {ticket.description}
            </p>
          </div>

          {/* Quick Actions */}
          {!isResolved && (
            <div className="glass-card p-4">
              <h2 className="text-sm font-semibold mb-3 text-[hsl(var(--muted-foreground))] uppercase tracking-wider">
                Actions rapides
              </h2>
              <div className="flex flex-wrap gap-2">
                {/* Bouton Toggle : En attente / Reprendre */}
                {ticket.state === "waiting" ? (
                  <button
                    disabled={actionLoading === "resume"}
                    onClick={handleResume}
                    className="flex items-center gap-1.5 text-xs font-semibold px-4 py-2 rounded-lg border border-blue-500/30
                      bg-blue-500/10 text-blue-500 hover:bg-blue-500/20 transition-colors disabled:opacity-60"
                  >
                    {actionLoading === "resume" ? (
                      <Loader2 size={13} className="animate-spin" />
                    ) : (
                      <RefreshCw size={13} />
                    )}
                    Reprendre le travail
                  </button>
                ) : (
                  <button
                    onClick={() => setShowWaitModal(true)}
                    className="flex items-center gap-1.5 text-xs font-semibold px-4 py-2 rounded-lg border border-orange-500/30
                      bg-orange-500/10 text-orange-500 hover:bg-orange-500/20 transition-colors"
                  >
                    <Clock size={13} />
                    En attente
                  </button>
                )}

                {/* Escalader / Annuler Escalade */}
                {ticket.state === "escalated" && ticket.escalated_by_id === user?.id ? (
                  <button
                    disabled={actionLoading === "unescalate"}
                    onClick={handleUnescalate}
                    className="flex items-center gap-1.5 text-xs font-semibold px-4 py-2 rounded-lg border border-[hsl(var(--muted-foreground)/0.3)]
                      bg-[hsl(var(--muted)/0.5)] text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))] transition-colors disabled:opacity-60"
                  >
                    {actionLoading === "unescalate" ? (
                      <Loader2 size={13} className="animate-spin" />
                    ) : (
                      <ArrowLeft size={13} />
                    )}
                    Annuler l'escalade
                  </button>
                ) : ticket.state !== "escalated" && (
                  <button
                    disabled={actionLoading === "escalate"}
                    onClick={handleEscalate}
                    className="flex items-center gap-1.5 text-xs font-semibold px-4 py-2 rounded-lg border border-purple-500/30
                      bg-purple-500/10 text-purple-500 hover:bg-purple-500/20 transition-colors disabled:opacity-60"
                  >
                    {actionLoading === "escalate" ? (
                      <Loader2 size={13} className="animate-spin" />
                    ) : (
                      <ArrowUpCircle size={13} />
                    )}
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
                <span className="text-sm font-semibold">
                  Ce ticket est résolu.
                </span>
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
                <p className="text-[0.65rem] text-[hsl(var(--muted-foreground))]">
                  Propulsé par Groq LLaMA-3
                </p>
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
                <p className="text-sm text-[hsl(var(--muted-foreground))]">
                  L&apos;IA analyse le ticket…
                </p>
              </div>
            )}

            {/* AI Result */}
            {!aiLoading && aiSuggestion && (
              <div className="space-y-4 animate-fade-in">
                {/* Markdown AI response */}
                {aiSuggestion.analysis_markdown && (
                  <div
                    className="p-4 rounded-xl bg-indigo-500/5 border border-indigo-500/10 prose prose-sm max-w-none prose-p:text-xs prose-p:leading-relaxed prose-headings:text-indigo-400 prose-headings:text-[10px] prose-headings:font-bold prose-headings:uppercase prose-li:text-xs"
                    dangerouslySetInnerHTML={{ __html: renderMarkdown(aiSuggestion.analysis_markdown) }}
                  />
                )}

                {/* KB Recommendation */}
                {aiSuggestion.kb_article_id ? (
                  <Link
                    href={`/tech/knowledge?id=${aiSuggestion.kb_article_id}&fromTicket=${ticket.id}`}
                    className="block p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/10 hover:bg-emerald-500/10 transition-all hover:scale-105 group"
                  >
                    <p className="text-[10px] font-bold uppercase text-emerald-500 mb-1">
                      Article recommandé
                    </p>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-emerald-600 truncate mr-2">
                        {aiSuggestion.kb_article_title ||
                          "Consulter l'article lié"}
                      </span>
                      <ExternalLink
                        size={12}
                        className="text-emerald-500 flex-shrink-0 group-hover:translate-x-0.5 transition-transform"
                      />
                    </div>
                  </Link>
                ) : (
                  <button
                    onClick={handleCreateKb}
                    className="w-full text-left p-3 rounded-xl bg-blue-500/5 border border-blue-500/10 hover:bg-blue-500/10 transition-all hover:scale-105 group"
                  >
                    <p className="text-[10px] font-bold uppercase text-blue-500 mb-1 flex items-center gap-1.5">
                      💡 Documenter cette solution
                    </p>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-blue-600 truncate mr-2">
                        Créer un article dans la base de connaissances
                      </span>
                      <ExternalLink
                        size={12}
                        className="text-blue-500 flex-shrink-0 group-hover:translate-x-0.5 transition-transform"
                      />
                    </div>
                  </button>
                )}

                {/* Re-analyze */}
                <button
                  onClick={fetchAiSuggestion}
                  className="w-full btn-ghost text-[10px] flex items-center justify-center gap-1.5 opacity-60 hover:opacity-100 transition-opacity"
                >
                  <RefreshCw size={10} /> Relancer l&apos;analyse
                </button>
              </div>
            )}

            {/* KB Link */}
            <div className="pt-3 border-t border-[hsl(var(--border)/0.5)]">
              <Link
                href="/tech/knowledge"
                className="flex items-center gap-2 text-xs text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors group"
              >
                <BookOpen
                  size={13}
                  className="group-hover:text-[hsl(var(--primary))]"
                />
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
                      <span className="font-semibold text-xs">
                        {c.author_name}
                      </span>
                      {c.x_support_role && (
                        <span className="text-[0.6rem] bg-[hsl(var(--primary)/0.1)] text-[hsl(var(--primary))] px-1.5 py-0.5 rounded-full font-semibold">
                          {c.x_support_role}
                        </span>
                      )}
                      <span className="text-[0.6rem] text-[hsl(var(--muted-foreground))] ml-auto">
                        {new Date(c.date).toLocaleString("fr-FR", {
                          day: "2-digit",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                    <p className="text-xs leading-relaxed whitespace-pre-wrap">
                      {c.body}
                    </p>
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
              {postingComment ? (
                <Loader2 size={13} className="animate-spin" />
              ) : (
                <Send size={13} />
              )}
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
            <p className="text-xs text-[hsl(var(--muted-foreground))]">
              Aucun fichier joint.
            </p>
          ) : (
            <div className="space-y-2">
              {attachments.map((a) => (
                <div
                  key={a.id}
                  className="flex items-center gap-3 p-2.5 rounded-xl bg-[hsl(var(--muted)/0.4)] hover:bg-[hsl(var(--muted)/0.7)] transition-colors group"
                >
                  <span className="flex-shrink-0">
                    {getFileIcon(a.mimetype)}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate">{a.name}</p>
                    <p className="text-[0.6rem] text-[hsl(var(--muted-foreground))]">
                      {formatBytes(a.file_size)}
                    </p>
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
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setIsDragging(false);
              handleUpload(e.dataTransfer.files as any);
            }}
            className={`flex flex-col items-center justify-center gap-2 border-2 border-dashed rounded-xl p-4 cursor-pointer transition-all text-center
              ${uploading ? "opacity-50 pointer-events-none" : "hover:border-[hsl(var(--primary)/0.4)] hover:bg-[hsl(var(--primary)/0.03)]"}
              ${isDragging ? "border-[hsl(var(--primary))] bg-[hsl(var(--primary)/0.05)] scale-[1.02]" : "border-[hsl(var(--border))]"} shadow-sm`}
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
              <Loader2
                size={18}
                className="animate-spin text-[hsl(var(--primary))]"
              />
            ) : (
              <Upload
                size={18}
                className={`${isDragging ? "text-[hsl(var(--primary))]" : "text-[hsl(var(--muted-foreground))]"}`}
              />
            )}
            <span className="text-xs font-medium text-[hsl(var(--muted-foreground))]">
              {uploading
                ? "Envoi en cours…"
                : isDragging
                  ? "Relâcher pour envoyer !"
                  : "Glisser-déposer ou cliquer pour ajouter un fichier"}
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

      {/* ══════════ WAIT MODAL ══════════ */}
      {showWaitModal && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4"
          onClick={() => setShowWaitModal(false)}
        >
          <div
            className="glass-card w-full max-w-lg p-6 space-y-4 animate-scale-in shadow-2xl border-[hsl(var(--border))]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-orange-500/10 text-orange-500">
                <Clock size={20} />
              </div>
              <h2 className="text-base font-bold">
                Mettre en attente #{ticket.id}
              </h2>
            </div>

            <div>
              <label className="text-[10px] font-bold uppercase text-[hsl(var(--muted-foreground))] mb-2 block">
                Motif de la mise en attente
              </label>
              <textarea
                autoFocus
                value={waitJustification}
                onChange={(e) => setWaitJustification(e.target.value)}
                rows={3}
                placeholder="Ex: En attente de pièces détachées ou d'informations client..."
                className="input-field w-full resize-none text-sm p-4"
              />
              <p className="text-[10px] text-[hsl(var(--muted-foreground))] mt-2 italic">
                Ce motif sera ajouté à la discussion et visible par le client.
              </p>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setShowWaitModal(false)}
                className="flex-1 btn-ghost text-sm"
              >
                Annuler
              </button>
              <button
                disabled={!waitJustification.trim() || waiting}
                onClick={handleWait}
                className="flex-1 bg-orange-600 hover:bg-orange-700 text-white rounded-xl text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {waiting ? (
                  <Loader2 size={15} className="animate-spin" />
                ) : (
                  <Send size={15} />
                )}
                Confirmer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════ RESOLVE MODAL ══════════ */}
      {showResolveModal && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4"
          onClick={() => setShowResolveModal(false)}
        >
          <div
            className="glass-card w-full max-w-lg p-6 space-y-5 animate-scale-in shadow-2xl border-[hsl(var(--border))]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* ── Header ── */}
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-500">
                <CheckCircle2 size={20} />
              </div>
              <div>
                <h2 className="text-base font-bold leading-tight">
                  Résoudre le ticket #{ticket.id}
                </h2>
                <p className="text-[10px] text-[hsl(var(--muted-foreground))] mt-0.5">
                  Documentez la solution avant de clôturer
                </p>
              </div>
            </div>

            {/* ── Note de clôture ── */}
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-[hsl(var(--muted-foreground))] mb-2 block">
                Note de clôture <span className="text-red-400">*</span>
              </label>
              <textarea
                autoFocus
                value={resolution}
                onChange={(e) => setResolution(e.target.value)}
                rows={5}
                placeholder="Décrivez précisément comment vous avez résolu le problème..."
                className="input-field w-full resize-none text-sm p-4"
              />
            </div>

            {/* ── Toggle KB ── */}
            <div
              onClick={() => setAddToKb((v) => !v)}
              className={`flex items-start gap-3 cursor-pointer p-4 rounded-xl border-2 transition-all duration-200
                ${addToKb
                  ? "border-emerald-500/40 bg-emerald-500/8 shadow-sm shadow-emerald-500/10"
                  : "border-[hsl(var(--border))] bg-[hsl(var(--muted)/0.2)] hover:border-emerald-500/20 hover:bg-emerald-500/4"
                }`}
            >
              {/* Toggle switch */}
              <div className="relative flex-shrink-0 mt-0.5">
                <div
                  className={`w-10 h-5.5 h-[22px] rounded-full transition-colors duration-300 flex items-center ${
                    addToKb ? "bg-emerald-500" : "bg-[hsl(var(--muted-foreground)/0.3)]"
                  }`}
                >
                  <div
                    className={`w-4 h-4 bg-white rounded-full shadow-md transition-transform duration-300 ml-0.5 ${
                      addToKb ? "translate-x-[18px]" : "translate-x-0"
                    }`}
                  />
                </div>
              </div>

              {/* Text */}
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-bold flex items-center gap-1.5 transition-colors ${
                  addToKb ? "text-emerald-600" : "text-[hsl(var(--foreground))]"
                }`}>
                  <BookOpen size={14} />
                  Transformer en article KB
                </p>
                <p className="text-[10px] mt-1 leading-relaxed text-[hsl(var(--muted-foreground))]">
                  {addToKb
                    ? "✨ Après la clôture, un formulaire pré-rempli s'ouvrira pour rédiger et publier l'article."
                    : "Activer pour ouvrir automatiquement le formulaire KB après la clôture."}
                </p>
              </div>

              {/* Status pill */}
              {addToKb && (
                <span className="flex-shrink-0 text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 border border-emerald-500/30 animate-fade-in">
                  ON
                </span>
              )}
            </div>

            {/* ── Footer ── */}
            <div className="flex gap-3">
              <button
                onClick={() => setShowResolveModal(false)}
                className="flex-1 btn-ghost text-sm"
              >
                Annuler
              </button>
              <button
                disabled={!resolution.trim() || resolving}
                onClick={handleResolve}
                className={`flex-1 text-white rounded-xl text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-50 transition-all py-2 ${
                  addToKb
                    ? "bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 shadow-md shadow-emerald-500/20"
                    : "bg-emerald-600 hover:bg-emerald-700"
                }`}
              >
                {resolving ? (
                  <Loader2 size={15} className="animate-spin" />
                ) : addToKb ? (
                  <BookOpen size={15} />
                ) : (
                  <Send size={15} />
                )}
                {addToKb ? "Clôturer & Rédiger KB" : "Clôturer le ticket"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════ KB DRAFT MODAL (auto-opened after resolve with toggle ON) ══════════ */}
      {kbDraftData && (
        <KnowledgeModal
          initialTitle={kbDraftData.title}
          initialContent={kbDraftData.content}
          initialCategory={kbDraftData.category}
          fromTicket={kbDraftData.sourceTicketId}
          onClose={handleKbClose}
          onSaved={handleKbSaved}
          userId={user?.id}
          userRole={user?.x_support_role}
        />
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
