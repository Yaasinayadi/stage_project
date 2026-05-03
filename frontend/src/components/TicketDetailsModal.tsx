"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import axios from "axios";
import {
  X,
  Edit2,
  Trash2,
  Save,
  Sparkles,
  Loader2,
  Paperclip,
  Upload,
  FileText,
  Image,
  File,
  Download,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Clock,
  User,
  CalendarDays,
  ShieldCheck,
  ShieldAlert,
  ShieldX,
  RefreshCw,
  Check,
  ChevronDown,
} from "lucide-react";
import {
  getCategoryColor,
  getCategoryIcon,
  getPriorityBadge,
  getStatusInfo,
  formatTicketRef,
} from "./TicketCard";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { ODOO_URL as ODOO_BASE } from "@/lib/config";

// ─── Types ───

type Ticket = {
  id: number;
  name: string;
  description: string;
  state: string;
  priority: string;
  category: string;
  assigned_to_id?: number | null;
  assigned_to?: string | null;
  assigned_by_id?: number | null;
  assigned_by?: string | null;
  create_date?: string | null;
  write_date?: string | null;
  sla_deadline?: string | null;
  sla_status?: string | null;
  date_resolved?: string | null;
};

type Attachment = {
  id: number;
  name: string;
  mimetype: string;
  file_size: number;
  create_date: string | null;
  url: string;
};

type Comment = {
  id: number;
  author_name: string;
  x_support_role?: string;
  date: string;
  body: string;
};

type TicketDetailsModalProps = {
  isOpen: boolean;
  ticket: Ticket;
  onClose: () => void;
  onRefresh?: () => void;
};

// ─── Constants ───

const ALLOWED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "application/pdf",
  "text/plain",
  "text/csv",
  "application/zip",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];
const MAX_SIZE = 10 * 1024 * 1024;
const MAX_FILES = 5;

const POLL_INTERVAL = 30000; // 30 seconds

// ─── Helpers ───

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}

function formatDate(dateStr: string | null) {
  if (!dateStr) return "";
  return new Date(dateStr).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

/** Parse Odoo UTC datetime (no Z suffix) into a proper Date */
function parseOdooDate(raw: string): Date {
  const sanitized = raw.trim().replace(" ", "T");
  return new Date(sanitized.endsWith("Z") ? sanitized : sanitized + "Z");
}

function formatFullDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  const d = parseOdooDate(dateStr);
  return (
    d.toLocaleDateString("fr-FR", {
      day: "numeric",
      month: "long",
      year: "numeric",
    }) +
    " à " +
    d.toLocaleTimeString("fr-FR", {
      hour: "2-digit",
      minute: "2-digit",
    })
  );
}

function getFileIcon(mimetype: string, size = 16) {
  if (mimetype.startsWith("image/"))
    return <Image size={size} className="text-blue-400" />;
  if (mimetype === "application/pdf")
    return <FileText size={size} className="text-red-400" />;
  return <File size={size} className="text-gray-400" />;
}

function isImageMime(mimetype: string) {
  return mimetype.startsWith("image/");
}

// ─── SLA Helpers ───

function getSlaInfo(status: string | null | undefined): {
  label: string;
  color: string;
  icon: React.ReactNode;
  bgClass: string;
} {
  switch (status) {
    case "on_track":
      return {
        label: "Dans les temps",
        color: "#10b981",
        icon: <ShieldCheck size={14} />,
        bgClass: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
      };
    case "at_risk":
      return {
        label: "À risque",
        color: "#f59e0b",
        icon: <ShieldAlert size={14} />,
        bgClass: "bg-amber-500/10 text-amber-500 border-amber-500/20",
      };
    case "breached":
      return {
        label: "Dépassé",
        color: "#ef4444",
        icon: <ShieldX size={14} />,
        bgClass: "bg-red-500/10 text-red-500 border-red-500/20",
      };
    default:
      return {
        label: "Non défini",
        color: "#71717a",
        icon: <Clock size={14} />,
        bgClass: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20",
      };
  }
}

function computeSlaProgress(
  createDate: string | null | undefined,
  deadline: string | null | undefined,
  state: string,
  dateResolved: string | null | undefined,
): number {
  if (!createDate || !deadline) return 0;
  const start = parseOdooDate(createDate).getTime();
  const end = parseOdooDate(deadline).getTime();

  let now = Date.now();
  if ((state === "resolved" || state === "closed") && dateResolved) {
    now = parseOdooDate(dateResolved).getTime();
  }

  const total = end - start;
  if (total <= 0) return 100;
  const elapsed = now - start;
  return Math.min(100, Math.max(0, Math.round((elapsed / total) * 100)));
}

function getRemainingTime(
  deadline: string | null | undefined,
  state: string,
  dateResolved: string | null | undefined,
): string {
  if (!deadline) return "—";
  const end = parseOdooDate(deadline).getTime();

  let now = Date.now();
  const isResolved = state === "resolved" || state === "closed";
  if (isResolved && dateResolved) {
    now = parseOdooDate(dateResolved).getTime();
  }

  const diff = end - now;

  if (diff <= 0) {
    const over = Math.abs(diff);
    const hours = Math.floor(over / 3600000);
    const mins = Math.floor((over % 3600000) / 60000);
    let timeStr = "";
    if (hours >= 24) {
      const days = Math.floor(hours / 24);
      const remH = hours % 24;
      timeStr = `${days}j ${remH}h`;
    } else {
      timeStr = `${hours}h ${mins}min`;
    }

    if (isResolved) {
      return `Dépassé de ${timeStr} lors de la clôture`;
    }
    return `Dépassé de ${timeStr}`;
  }

  const hours = Math.floor(diff / 3600000);
  const mins = Math.floor((diff % 3600000) / 60000);
  if (hours >= 24) {
    const days = Math.floor(hours / 24);
    const remH = hours % 24;
    return `${days}j ${remH}h restant`;
  }
  return `${hours}h ${mins}min restant`;
}

// ─── Status Timeline ───

const TIMELINE_STEPS = [
  { key: "new", label: "Nouveau", stateMatch: ["new", "nouveau"] },
  {
    key: "in_progress",
    label: "En cours",
    stateMatch: ["in_progress", "cours", "progress"],
  },
  { key: "waiting", label: "En attente", stateMatch: ["waiting", "attente"] },
  {
    key: "resolved",
    label: "Résolu",
    stateMatch: ["resolved", "résolu", "done", "closed", "fermé"],
  },
];

function getStepIndex(state: string): number {
  const s = (state || "").toLowerCase();
  for (let i = 0; i < TIMELINE_STEPS.length; i++) {
    if (TIMELINE_STEPS[i].stateMatch.some((m) => s.includes(m))) return i;
  }
  return 0;
}

// ─── Inline Selects (Ghost Dropdowns) ───

const PRIORITIES = [
  { value: "0", label: "Basse" },
  { value: "1", label: "Moyenne" },
  { value: "2", label: "Haute" },
  { value: "3", label: "Urgente" },
];

function InlinePrioritySelect({
  priority,
  canEdit,
  isUpdating,
  onUpdate,
}: {
  priority: string;
  canEdit: boolean;
  isUpdating: boolean;
  onUpdate: (val: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node))
        setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={ref} className="relative inline-block">
      <div
        onClick={() => canEdit && !isUpdating && setOpen(!open)}
        className={`flex items-center gap-1.5 w-fit ${canEdit && !isUpdating ? "cursor-pointer hover:opacity-80 transition-opacity" : ""}`}
      >
        {getPriorityBadge(priority)}
        {canEdit && !isUpdating && (
          <ChevronDown
            size={12}
            className={`text-[hsl(var(--muted-foreground))] transition-transform ${open ? "rotate-180" : ""}`}
          />
        )}
        {isUpdating && (
          <Loader2
            size={12}
            className="text-[hsl(var(--muted-foreground))] animate-spin"
          />
        )}
      </div>
      {open && (
        <div className="absolute top-[calc(100%+6px)] left-0 z-[200] w-48 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] shadow-2xl backdrop-blur-lg overflow-hidden animate-fade-in flex flex-col p-1.5 space-y-0.5">
          {PRIORITIES.map((p) => (
            <button
              key={p.value}
              onClick={(e) => {
                e.preventDefault();
                setOpen(false);
                if (p.value !== priority) onUpdate(p.value);
              }}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-semibold transition-all
                ${
                  p.value === priority
                    ? "bg-[hsl(var(--primary)/0.12)] text-[hsl(var(--primary))] border border-[hsl(var(--primary)/0.2)]"
                    : "hover:bg-[hsl(var(--muted)/0.5)] text-[hsl(var(--foreground))] border border-transparent"
                }`}
            >
              {p.label}
              {p.value === priority && <Check size={12} className="ml-2" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

const CATEGORIES = [
  "Réseau",
  "Logiciel",
  "Matériel",
  "Accès",
  "Messagerie",
  "Infrastructure",
  "Sécurité",
  "Autre",
];

function InlineCategorySelect({
  category,
  canEdit,
  isUpdating,
  onUpdate,
}: {
  category: string;
  canEdit: boolean;
  isUpdating: boolean;
  onUpdate: (val: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node))
        setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const catColor = getCategoryColor(category);

  return (
    <div ref={ref} className="relative inline-block w-full">
      <div
        onClick={() => canEdit && !isUpdating && setOpen(!open)}
        className={`flex items-center gap-1.5 w-fit rounded-md ${canEdit && !isUpdating ? "cursor-pointer hover:opacity-80 transition-opacity" : ""}`}
      >
        <span
          className="text-sm font-semibold truncate block"
          style={{ color: catColor }}
        >
          {category || "Non classé"}
        </span>
        {canEdit && !isUpdating && (
          <ChevronDown
            size={12}
            className={`text-[hsl(var(--muted-foreground))] transition-transform ${open ? "rotate-180" : ""}`}
          />
        )}
        {isUpdating && (
          <Loader2
            size={12}
            className="text-[hsl(var(--muted-foreground))] animate-spin"
          />
        )}
      </div>
      {open && (
        <div className="absolute top-[calc(100%+6px)] left-0 z-[200] w-48 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] shadow-2xl backdrop-blur-lg overflow-hidden animate-fade-in flex flex-col p-1.5 max-h-56 overflow-y-auto custom-scrollbar">
          {CATEGORIES.map((c) => {
            const cColor = getCategoryColor(c);
            return (
              <button
                key={c}
                onClick={(e) => {
                  e.preventDefault();
                  setOpen(false);
                  if (c !== category) onUpdate(c);
                }}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-semibold transition-all
                  ${
                    c === category
                      ? "bg-[hsl(var(--primary)/0.12)] border border-[hsl(var(--primary)/0.2)]"
                      : "hover:bg-[hsl(var(--muted)/0.5)] border border-transparent"
                  }`}
                style={{
                  color: c === category ? cColor : "hsl(var(--foreground))",
                }}
              >
                {c}
                {c === category && <Check size={12} className="ml-2" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function InlineAgentSelect({
  value,
  agents,
  isUpdating,
  onUpdate,
}: {
  value: number | string;
  agents: { id: number; name: string }[];
  isUpdating: boolean;
  onUpdate: (val: number | string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node))
        setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const selectedAgent = agents.find((a) => String(a.id) === String(value));
  const displayName = selectedAgent ? selectedAgent.name : "Non assigné";

  return (
    <div ref={ref} className="relative inline-block w-full mt-0.5">
      <div
        onClick={() => !isUpdating && setOpen(!open)}
        className={`flex items-center gap-1.5 w-fit rounded-md px-1 py-0.5 -ml-1 ${!isUpdating ? "cursor-pointer hover:bg-[hsl(var(--muted)/0.5)] transition-colors" : "opacity-50"}`}
      >
        <span className="text-xs font-semibold truncate block">
          {displayName}
        </span>
        {!isUpdating && (
          <ChevronDown
            size={12}
            className={`text-[hsl(var(--muted-foreground))] transition-transform ${open ? "rotate-180" : ""}`}
          />
        )}
      </div>
      {open && (
        <div className="absolute top-[calc(100%+6px)] left-0 z-[200] w-56 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] shadow-2xl backdrop-blur-lg overflow-hidden animate-fade-in flex flex-col p-1.5 max-h-56 overflow-y-auto custom-scrollbar">
          <button
            onClick={(e) => {
              e.preventDefault();
              setOpen(false);
              if (value !== "") onUpdate("");
            }}
            className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-semibold transition-all
              ${
                value === ""
                  ? "bg-[hsl(var(--primary)/0.12)] border border-[hsl(var(--primary)/0.2)] text-[hsl(var(--primary))]"
                  : "hover:bg-[hsl(var(--muted)/0.5)] border border-transparent text-[hsl(var(--foreground))]"
              }`}
          >
            Non assigné
            {value === "" && <Check size={12} className="ml-2" />}
          </button>
          {agents.map((a) => {
            const isSelected = String(a.id) === String(value);
            return (
              <button
                key={a.id}
                onClick={(e) => {
                  e.preventDefault();
                  setOpen(false);
                  if (String(a.id) !== String(value)) onUpdate(a.id);
                }}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-semibold transition-all
                  ${
                    isSelected
                      ? "bg-[hsl(var(--primary)/0.12)] border border-[hsl(var(--primary)/0.2)] text-[hsl(var(--primary))]"
                      : "hover:bg-[hsl(var(--muted)/0.5)] border border-transparent text-[hsl(var(--foreground))]"
                  }`}
              >
                {a.name}
                {isSelected && <Check size={12} className="ml-2" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Component ───

export default function TicketDetailsModal({
  isOpen,
  ticket: initialTicket,
  onClose,
  onRefresh,
}: TicketDetailsModalProps) {
  // ══════════════════════════════════════════
  //  HOOKS — tous AVANT le return conditionnel
  // ══════════════════════════════════════════

  const { user } = useAuth();
  const [ticket, setTicket] = useState<Ticket>(initialTicket);
  const [isEditing, setIsEditing] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const [editForm, setEditForm] = useState({
    name: initialTicket.name,
    description: initialTicket.description,
    assigned_to: initialTicket.assigned_to_id || "",
    category: initialTicket.category || "",
    priority: initialTicket.priority || "",
  });

  const [pendingUploads, setPendingUploads] = useState<File[]>([]);
  const [pendingDeletes, setPendingDeletes] = useState<number[]>([]);

  // Agents
  const [agents, setAgents] = useState<
    { id: number; name: string; it_domains: string[] }[]
  >([]);

  // Attachments
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [attachLoading, setAttachLoading] = useState(true);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  // Polling visual indicator
  const [lastPolled, setLastPolled] = useState<Date | null>(null);

  // Commentaires
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(true);
  const [newComment, setNewComment] = useState("");
  const [postingComment, setPostingComment] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync ticket prop to state when modal opens or prop changes
  useEffect(() => {
    setTicket(initialTicket);
  }, [initialTicket]);

  // Sync ticket prop to state when modal opens or prop changes
  useEffect(() => {
    setTicket(initialTicket);
  }, [initialTicket]);

  // Chargement des pièces jointes et commentaires
  const fetchAttachments = useCallback(async () => {
    setAttachLoading(true);
    try {
      const res = await axios.get(
        `${ODOO_BASE}/api/ticket/${ticket.id}/attachments`,
      );
      if (res.data.status === 200) setAttachments(res.data.data);
    } catch {
      // silently ignore
    } finally {
      setAttachLoading(false);
    }
  }, [ticket.id]);

  const fetchComments = useCallback(async () => {
    setCommentsLoading(true);
    try {
      const res = await axios.get(
        `${ODOO_BASE}/api/ticket/${ticket.id}/comments`,
      );
      console.log("DATA_RECUE_DE_ODOO:", res.data.data);
      if (res.data.status === 200) setComments(res.data.data);
    } catch {
      // silently ignore
    } finally {
      setCommentsLoading(false);
    }
  }, [ticket.id]);

  useEffect(() => {
    if (isOpen) {
      fetchAttachments();
      fetchComments();
    }
  }, [isOpen, fetchAttachments, fetchComments]);

  // Synchroniser le formulaire avec les données initiales, sauf si l'utilisateur est en train d'éditer ou si l'animation de succès est en cours
  useEffect(() => {
    if (isOpen && !isEditing && !saveSuccess) {
      setIsEditing(false);
      setEditForm({
        name: initialTicket.name,
        description: initialTicket.description,
        assigned_to: initialTicket.assigned_to_id || "",
        category: initialTicket.category || "",
        priority: initialTicket.priority || "",
      });
      setUploadError(null);
      setUploadSuccess(null);
      setPendingUploads([]);
      setPendingDeletes([]);
      setNewComment("");

      // Fetch agents if user is admin or agent
      if (user?.x_support_role === "admin" || user?.x_support_role === "tech") {
        axios
          .get(`${ODOO_BASE}/api/agents`)
          .then((res) => {
            if (res.data.status === 200) {
              setAgents(res.data.data);
            }
          })
          .catch((err) => console.error("Error fetching agents", err));
      }
    }
  }, [
    isOpen,
    initialTicket.name,
    initialTicket.description,
    initialTicket.assigned_to_id,
    user?.x_support_role,
    isEditing,
    saveSuccess,
  ]);

  // ══ POLLING — Refresh ticket data every 30s ══
  useEffect(() => {
    if (!isOpen) return;

    const poll = async () => {
      try {
        const res = await axios.get(`${ODOO_BASE}/api/tickets`);
        if (res.data.status === 200) {
          const fresh = (res.data.data as Ticket[]).find(
            (t: Ticket) => t.id === ticket.id,
          );
          if (fresh) {
            setTicket(fresh);
            setLastPolled(new Date());
          }
        }
      } catch {
        // silent — polling failure shouldn't interrupt UX
      }
    };

    const interval = setInterval(poll, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [isOpen, ticket.id]);

  // Handlers
  const handleClose = useCallback(() => {
    if (isAnalyzing || isUploading || postingComment) return;
    setIsEditing(false);
    onClose();
  }, [isAnalyzing, isUploading, postingComment, onClose]);

  const handleCancelEdit = useCallback(() => {
    setIsEditing(false);
    setEditForm({
      name: ticket.name,
      description: ticket.description,
      assigned_to: ticket.assigned_to_id || "",
      category: ticket.category || "",
      priority: ticket.priority || "",
    });
    setUploadError(null);
    setUploadSuccess(null);
    setPendingUploads([]);
    setPendingDeletes([]);
  }, [ticket]);

  const handleDelete = useCallback(async () => {
    if (!confirm("Êtes-vous sûr de vouloir supprimer ce ticket ?")) return;
    try {
      await axios.delete(`${ODOO_BASE}/api/ticket/${ticket.id}`, { withCredentials: true });
      onRefresh?.();
      onClose();
    } catch {
      alert("Erreur lors de la suppression.");
    }
  }, [ticket.id, onRefresh, onClose]);

  const hasChanges = useMemo(() => {
    return (
      editForm.name !== ticket.name ||
      editForm.description !== ticket.description ||
      String(editForm.assigned_to) !== String(ticket.assigned_to_id || "") ||
      editForm.category !== (ticket.category || "") ||
      editForm.priority !== (ticket.priority || "") ||
      pendingUploads.length > 0 ||
      pendingDeletes.length > 0
    );
  }, [editForm, ticket, pendingUploads, pendingDeletes]);

  const handleGroupedSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!hasChanges) return;
    setIsAnalyzing(true);
    try {
      const changesMsg = [];
      const fieldUpdates: any = {};

      if (editForm.name !== ticket.name) {
        fieldUpdates.name = editForm.name;
        changesMsg.push("Sujet");
      }
      if (editForm.description !== ticket.description) {
        fieldUpdates.description = editForm.description;
        changesMsg.push("Description");
      }
      if (
        String(editForm.assigned_to) !== String(ticket.assigned_to_id || "")
      ) {
        fieldUpdates.assigned_to_id = editForm.assigned_to || false;
        changesMsg.push("Agent");
      }
      if (editForm.category !== (ticket.category || "")) {
        fieldUpdates.category = editForm.category;
        changesMsg.push("Catégorie");
      }
      if (editForm.priority !== (ticket.priority || "")) {
        fieldUpdates.priority = editForm.priority;
        changesMsg.push("Priorité");
      }

      if (Object.keys(fieldUpdates).length > 0) {
        const res = await axios.put(
          `${ODOO_BASE}/api/ticket/update/${ticket.id}`,
          fieldUpdates,
          { withCredentials: true },
        );
        if (res.data.status === 200) {
          setTicket((prev) => ({
            ...prev,
            ...fieldUpdates,
            assigned_to_id: editForm.assigned_to || null,
          }));
        }
      }

      let filesChanged = false;
      if (pendingDeletes.length > 0) {
        await Promise.all(
          pendingDeletes.map((id) =>
            axios.delete(`${ODOO_BASE}/api/attachment/${id}`, { withCredentials: true }),
          ),
        );
        filesChanged = true;
      }
      if (pendingUploads.length > 0) {
        const formData = new FormData();
        pendingUploads.forEach((f) => formData.append("files", f));
        await axios.post(
          `${ODOO_BASE}/api/ticket/${ticket.id}/upload`,
          formData,
          { headers: { "Content-Type": "multipart/form-data" }, withCredentials: true },
        );
        filesChanged = true;
      }
      if (filesChanged) changesMsg.push("Pièces jointes");

      onRefresh?.();
      fetchAttachments();
      setPendingUploads([]);
      setPendingDeletes([]);

      if (changesMsg.length > 0) {
        setSaveSuccess(true);
        toast.success(
          `Modification réussie : ${changesMsg.join(", ")} mis à jour.`,
        );
        setTimeout(() => {
          setSaveSuccess(false);
          setIsEditing(false);
        }, 3000);
      } else {
        setIsEditing(false);
      }
    } catch (err) {
      toast.error("Erreur lors de la sauvegarde.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handlePostComment = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!newComment.trim()) return;
      setPostingComment(true);
      try {
        const userStr = localStorage.getItem("it_support_user");
        let author = "";
        let user_id = null;
        if (userStr) {
          const u = JSON.parse(userStr);
          author = u.name;
          user_id = u.id;
        }

        const payload: any = { body: newComment.trim() };
        if (user_id) payload.user_id = user_id;
        payload.author = author ? author : "Utilisateur Inconnu";

        await axios.post(
          `${ODOO_BASE}/api/ticket/${ticket.id}/comment`,
          payload,
          {
            withCredentials: true,
          },
        );
        setNewComment("");
        await fetchComments();
      } catch {
        toast.error("Erreur lors de l'ajout du commentaire.");
      } finally {
        setPostingComment(false);
      }
    },
    [newComment, ticket.id, fetchComments],
  );

  const uploadFiles = useCallback(
    (files: FileList | File[]) => {
      setUploadError(null);
      const arr = Array.from(files);

      if (
        attachments.length -
          pendingDeletes.length +
          pendingUploads.length +
          arr.length >
        MAX_FILES
      ) {
        setUploadError(`Maximum ${MAX_FILES} fichiers par ticket.`);
        return;
      }
      for (const f of arr) {
        if (!ALLOWED_TYPES.includes(f.type)) {
          setUploadError(`Type non autorisé : ${f.name}`);
          return;
        }
        if (f.size > MAX_SIZE) {
          setUploadError(`"${f.name}" dépasse 10 Mo.`);
          return;
        }
      }

      setPendingUploads((p) => [...p, ...arr]);
    },
    [attachments.length, pendingDeletes.length, pendingUploads.length],
  );

  const handleDeleteAttachment = useCallback((attId: number) => {
    setPendingDeletes((p) => [...p, attId]);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);
  const handleDragLeave = useCallback(() => setIsDragging(false), []);
  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      uploadFiles(e.dataTransfer.files);
    },
    [uploadFiles],
  );

  // ══════════════════════════════════════════
  //  RETURN CONDITIONNEL — après tous les hooks
  // ══════════════════════════════════════════
  if (!isOpen) return null;

  const status = getStatusInfo(ticket.state);
  const catColor = getCategoryColor(ticket.category);
  // Agents and admins can edit tickets until they are resolved, normal users can only edit when new
  const canEdit =
    status.dotClass === "new" ||
    ((user?.x_support_role === "admin" || user?.x_support_role === "tech") &&
      status.dotClass !== "resolved");
  const activeStep = getStepIndex(ticket.state);
  const slaInfo = getSlaInfo(ticket.sla_status);
  const slaProgress = computeSlaProgress(
    ticket.create_date,
    ticket.sla_deadline,
    ticket.state,
    ticket.date_resolved,
  );
  const slaRemaining = getRemainingTime(
    ticket.sla_deadline,
    ticket.state,
    ticket.date_resolved,
  );

  // ─── Render ───
  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div
        className="modal-content overflow-hidden flex flex-col"
        style={{ maxHeight: "92vh", maxWidth: "640px" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ══ HEADER ══ */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[hsl(var(--border))] bg-[hsl(var(--background)/0.5)] flex-shrink-0">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ background: `${catColor}14`, color: catColor }}
            >
              {getCategoryIcon(ticket.category)}
            </div>
            <div>
              <h2 className="text-lg font-bold leading-tight">
                Détails du ticket
              </h2>
              <div className="flex items-center gap-2 mt-0.5">
                <p className="text-xs font-mono font-semibold tracking-wide text-[hsl(var(--muted-foreground))]">
                  Réf. {formatTicketRef(ticket.id)}
                </p>
                {/* Badge mode */}
                {isEditing && (
                  <span className="text-[0.6rem] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-md bg-[hsl(var(--primary)/0.12)] text-[hsl(var(--primary))] animate-fade-in">
                    Mode édition
                  </span>
                )}
                {/* Polling indicator */}
                {lastPolled && !isEditing && (
                  <span
                    className="text-[0.6rem] font-medium text-[hsl(var(--muted-foreground))] flex items-center gap-1 opacity-60"
                    title={`Dernière mise à jour: ${lastPolled.toLocaleTimeString("fr-FR")}`}
                  >
                    <RefreshCw size={9} />
                    Live
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Bouton MODIFIER — uniquement en mode lecture */}
            {!isEditing && canEdit && (
              <button
                onClick={() => setIsEditing(true)}
                className="flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-semibold text-[hsl(var(--primary))] hover:bg-[hsl(var(--primary)/0.1)] border border-[hsl(var(--primary)/0.2)] transition-all"
                title="Passer en mode édition"
              >
                <Edit2 size={13} />
                Modifier
              </button>
            )}
            {/* Bouton SUPPRIMER ticket — uniquement en lecture, si Nouveau */}
            {!isEditing && canEdit && (
              <button
                onClick={handleDelete}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-red-500 hover:bg-red-500/10 transition-colors"
                title="Supprimer le ticket"
              >
                <Trash2 size={15} />
              </button>
            )}
            {/* Fermer */}
            <button
              onClick={handleClose}
              disabled={isAnalyzing || isUploading}
              className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
                isAnalyzing || isUploading
                  ? "opacity-50 cursor-not-allowed text-[hsl(var(--muted-foreground))]"
                  : "hover:bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
              }`}
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* ══ CORPS SCROLLABLE ══ */}
        <div className="flex-1 overflow-y-auto custom-scrollbar">
          <form onSubmit={handleGroupedSave} className="p-6 space-y-6">
            {/* ── Titre ── */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))] mb-2">
                Sujet
              </label>
              {isEditing ? (
                <input
                  required
                  disabled={isAnalyzing}
                  value={editForm.name}
                  onChange={(e) =>
                    setEditForm({ ...editForm, name: e.target.value })
                  }
                  className="input-field focus-ring disabled:opacity-50 text-base font-semibold animate-fade-in"
                />
              ) : (
                <h3 className="text-xl font-bold">{ticket.name}</h3>
              )}
            </div>

            {/* ── Description ── */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))] mb-2">
                Description
              </label>
              {isEditing ? (
                <div className="relative animate-fade-in">
                  <textarea
                    required
                    disabled={isAnalyzing}
                    value={editForm.description}
                    onChange={(e) =>
                      setEditForm({ ...editForm, description: e.target.value })
                    }
                    className="input-field focus-ring resize-none disabled:opacity-50 w-full"
                    style={{ height: "130px" }}
                  />
                  {isAnalyzing && (
                    <div className="absolute inset-0 bg-[hsl(var(--background)/0.8)] backdrop-blur-sm rounded-xl flex items-center justify-center gap-2">
                      <Loader2
                        size={18}
                        className="text-[hsl(var(--primary))] animate-spin"
                      />
                      <span className="text-xs font-semibold text-[hsl(var(--primary))] flex items-center gap-1">
                        <Sparkles size={11} /> Analyse IA...
                      </span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="whitespace-pre-wrap text-[hsl(var(--muted-foreground))] text-sm leading-relaxed bg-[hsl(var(--muted)/0.2)] p-4 rounded-xl border border-[hsl(var(--border)/0.5)]">
                  {ticket.description}
                </div>
              )}
            </div>

            {/* ── Statut + Priorité + Catégorie ── */}
            <div className="grid grid-cols-3 gap-3">
              <div className="p-3 rounded-xl border border-[hsl(var(--border)/0.5)] bg-[hsl(var(--card))]">
                <span className="block text-xs font-semibold mb-1.5 opacity-60">
                  Statut
                </span>
                <div className="flex items-center gap-1.5">
                  <span className={`status-dot ${status.dotClass}`} />
                  <span className="text-sm font-semibold">{status.label}</span>
                </div>
              </div>
              <div className="p-3 rounded-xl border border-[hsl(var(--border)/0.5)] bg-[hsl(var(--card))] overflow-visible">
                <span className="block text-xs font-semibold mb-1.5 opacity-60">
                  Priorité
                </span>
                <InlinePrioritySelect
                  priority={isEditing ? editForm.priority : ticket.priority}
                  canEdit={isEditing && user?.x_support_role === "admin"}
                  isUpdating={false}
                  onUpdate={(val) =>
                    setEditForm((prev) => ({ ...prev, priority: val }))
                  }
                />
              </div>
              <div className="p-3 rounded-xl border border-[hsl(var(--border)/0.5)] bg-[hsl(var(--card))] overflow-visible">
                <span className="block text-xs font-semibold mb-1.5 opacity-60">
                  Catégorie
                </span>
                <InlineCategorySelect
                  category={isEditing ? editForm.category : ticket.category}
                  canEdit={isEditing && user?.x_support_role === "admin"}
                  isUpdating={false}
                  onUpdate={(val) =>
                    setEditForm((prev) => ({ ...prev, category: val }))
                  }
                />
              </div>
            </div>

            {/* ══════════════════════════════════════
                SECTION SUIVI DU TICKET (NOUVEAU)
            ══════════════════════════════════════ */}
            <div className="space-y-4">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))] flex items-center gap-2">
                <Clock size={13} />
                Suivi du ticket
              </h4>

              {/* ── Timeline Visuelle ── */}
              <div className="p-4 rounded-xl border border-[hsl(var(--border)/0.5)] bg-[hsl(var(--card))]">
                <div className="flex items-center justify-between relative">
                  {/* Connecting line behind the dots */}
                  <div className="absolute top-[13px] left-[16px] right-[16px] h-[2px] bg-[hsl(var(--border))]" />
                  <div
                    className="absolute top-[13px] left-[16px] h-[2px] transition-all duration-700 ease-out"
                    style={{
                      width: `${(activeStep / (TIMELINE_STEPS.length - 1)) * 100}%`,
                      maxWidth: "calc(100% - 32px)",
                      background:
                        activeStep === TIMELINE_STEPS.length - 1
                          ? "#10b981"
                          : "hsl(var(--primary))",
                    }}
                  />

                  {TIMELINE_STEPS.map((step, idx) => {
                    const isActive = idx === activeStep;
                    const isPast = idx < activeStep;
                    const isResolved = activeStep === TIMELINE_STEPS.length - 1;

                    return (
                      <div
                        key={step.key}
                        className="flex flex-col items-center relative z-10"
                        style={{ flex: 1 }}
                      >
                        {/* Dot */}
                        <div
                          className={`w-[26px] h-[26px] rounded-full flex items-center justify-center border-2 transition-all duration-500 ${
                            isActive
                              ? isResolved
                                ? "border-emerald-500 bg-emerald-500 text-white shadow-lg shadow-emerald-500/30"
                                : "border-[hsl(var(--primary))] bg-[hsl(var(--primary))] text-white shadow-lg shadow-[hsl(var(--primary)/0.3)]"
                              : isPast
                                ? isResolved
                                  ? "border-emerald-500 bg-emerald-500/20 text-emerald-500"
                                  : "border-[hsl(var(--primary))] bg-[hsl(var(--primary)/0.15)] text-[hsl(var(--primary))]"
                                : "border-[hsl(var(--border))] bg-[hsl(var(--background))] text-[hsl(var(--muted-foreground)/0.4)]"
                          }`}
                        >
                          {isPast ? (
                            <CheckCircle2 size={12} />
                          ) : isActive ? (
                            <div className="w-2 h-2 rounded-full bg-white" />
                          ) : (
                            <div className="w-2 h-2 rounded-full bg-current opacity-30" />
                          )}
                        </div>
                        {/* Label */}
                        <span
                          className={`text-[0.65rem] font-semibold mt-2 text-center leading-tight ${
                            isActive
                              ? isResolved
                                ? "text-emerald-500"
                                : "text-[hsl(var(--primary))]"
                              : isPast
                                ? "text-[hsl(var(--foreground))]"
                                : "text-[hsl(var(--muted-foreground)/0.5)]"
                          }`}
                        >
                          {step.label}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* ── SLA Progress ── */}
              {ticket.sla_deadline && (
                <div className="p-4 rounded-xl border border-[hsl(var(--border)/0.5)] bg-[hsl(var(--card))] space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span
                        className={`flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-lg border ${slaInfo.bgClass}`}
                      >
                        {slaInfo.icon}
                        SLA : {slaInfo.label}
                      </span>
                    </div>
                    <span className="text-xs font-semibold text-[hsl(var(--muted-foreground))]">
                      {slaRemaining}
                    </span>
                  </div>

                  {/* Progress bar */}
                  <div className="relative h-2.5 rounded-full bg-[hsl(var(--muted))] overflow-hidden">
                    <div
                      className="absolute inset-y-0 left-0 rounded-full transition-all duration-1000 ease-out"
                      style={{
                        width: `${slaProgress}%`,
                        background:
                          slaProgress < 60
                            ? "#10b981"
                            : slaProgress < 85
                              ? "#f59e0b"
                              : "#ef4444",
                      }}
                    />
                  </div>

                  <div className="flex items-center justify-between text-[0.65rem] text-[hsl(var(--muted-foreground))]">
                    <span>Créé le {formatFullDate(ticket.create_date)}</span>
                    <span className="font-semibold">{slaProgress}%</span>
                  </div>
                </div>
              )}

              {/* ── Métadonnées ── */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-xl border border-[hsl(var(--border)/0.5)] bg-[hsl(var(--card))] flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-[hsl(var(--primary)/0.1)] flex items-center justify-center flex-shrink-0">
                    <CalendarDays
                      size={14}
                      className="text-[hsl(var(--primary))]"
                    />
                  </div>
                  <div>
                    <span className="block text-[0.65rem] font-semibold opacity-50 uppercase tracking-wide">
                      Créé le
                    </span>
                    <span className="text-xs font-semibold">
                      {formatFullDate(ticket.create_date)}
                    </span>
                  </div>
                </div>
                <div className="p-3 rounded-xl border border-[hsl(var(--border)/0.5)] bg-[hsl(var(--card))] flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center flex-shrink-0">
                    <RefreshCw size={14} className="text-amber-500" />
                  </div>
                  <div>
                    <span className="block text-[0.65rem] font-semibold opacity-50 uppercase tracking-wide">
                      Mis à jour
                    </span>
                    <span className="text-xs font-semibold">
                      {formatFullDate(ticket.write_date)}
                    </span>
                  </div>
                </div>
                <div className="p-3 rounded-xl border border-[hsl(var(--border)/0.5)] bg-[hsl(var(--card))] flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center flex-shrink-0">
                    <User size={14} className="text-indigo-500" />
                  </div>
                  <div>
                    <span className="block text-[0.65rem] font-semibold opacity-50 uppercase tracking-wide">
                      Agent assigné
                    </span>
                    {isEditing &&
                    (user?.x_support_role === "admin" ||
                      user?.x_support_role === "tech") ? (
                      <InlineAgentSelect
                        value={editForm.assigned_to}
                        agents={agents.filter((agent) => {
                          if (
                            !ticket.category ||
                            ticket.category.toLowerCase() === "autre"
                          )
                            return true;
                          if (agent.it_domains && agent.it_domains.length > 0) {
                            return agent.it_domains.some(
                              (d) =>
                                d.toLowerCase() ===
                                ticket.category.toLowerCase(),
                            );
                          }
                          return false;
                        })}
                        isUpdating={isAnalyzing}
                        onUpdate={(val) =>
                          setEditForm((prev) => ({ ...prev, assigned_to: val }))
                        }
                      />
                    ) : (
                      <div className="flex flex-col mt-0.5 gap-0.5">
                        <span className="text-xs font-semibold">{ticket.assigned_to || "Non assigné"}</span>
                        {ticket.assigned_to && (
                          <span className="text-[10px] text-muted-foreground/80 font-medium italic">
                            {ticket.assigned_by_id === ticket.assigned_to_id 
                              ? "Auto-assigné" 
                              : `Assigné par : ${ticket.assigned_by || 'Admin'}`}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
                {ticket.sla_deadline && (
                  <div className="p-3 rounded-xl border border-[hsl(var(--border)/0.5)] bg-[hsl(var(--card))] flex items-start gap-3">
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{ background: `${slaInfo.color}15` }}
                    >
                      <Clock size={14} style={{ color: slaInfo.color }} />
                    </div>
                    <div>
                      <span className="block text-[0.65rem] font-semibold opacity-50 uppercase tracking-wide">
                        Deadline SLA
                      </span>
                      <span className="text-xs font-semibold">
                        {formatFullDate(ticket.sla_deadline)}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* ══════════════════════════════════════
                SECTION PIÈCES JOINTES
                Comportement conditionnel selon isEditing
            ══════════════════════════════════════ */}
            <div className="space-y-3">
              {/* En-tête section */}
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))] flex items-center gap-2">
                  <Paperclip size={13} />
                  Pièces jointes
                  {!attachLoading && (
                    <span className="normal-case font-normal bg-[hsl(var(--muted))] px-2 py-0.5 rounded-full text-[0.65rem]">
                      {attachments.length}/{MAX_FILES}
                    </span>
                  )}
                </h4>
                {/* Indication de mode */}
                {!isEditing && (
                  <span className="text-[0.65rem] text-[hsl(var(--muted-foreground))] flex items-center gap-1 italic">
                    Lecture seule
                  </span>
                )}
              </div>

              {/* ── ZONE UPLOAD — visible uniquement en mode Édition ── */}
              {isEditing && attachments.length < MAX_FILES && (
                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={() => !isUploading && fileInputRef.current?.click()}
                  className={`
                    border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-all duration-200 animate-fade-in
                    ${
                      isDragging
                        ? "border-[hsl(var(--primary))] bg-[hsl(var(--primary)/0.08)] scale-[1.01]"
                        : "border-[hsl(var(--border))] hover:border-[hsl(var(--primary)/0.4)] hover:bg-[hsl(var(--muted)/0.3)]"
                    }
                    ${isUploading ? "pointer-events-none opacity-60" : ""}
                  `}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    className="hidden"
                    accept={ALLOWED_TYPES.join(",")}
                    onChange={(e) =>
                      e.target.files && uploadFiles(e.target.files)
                    }
                  />
                  <div className="flex items-center justify-center gap-3">
                    {isUploading ? (
                      <Loader2
                        size={20}
                        className="text-[hsl(var(--primary))] animate-spin"
                      />
                    ) : (
                      <Upload
                        size={18}
                        className={
                          isDragging
                            ? "text-[hsl(var(--primary))]"
                            : "text-[hsl(var(--muted-foreground))]"
                        }
                      />
                    )}
                    <div className="text-left">
                      <p className="text-sm font-semibold">
                        {isUploading
                          ? "Upload en cours..."
                          : isDragging
                            ? "Déposez ici"
                            : "Ajouter des fichiers"}
                      </p>
                      <p className="text-xs text-[hsl(var(--muted-foreground))]">
                        Images, PDF, Word, Excel, TXT, ZIP — max 10 Mo
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Feedback upload */}
              {uploadError && (
                <div className="flex items-center gap-2 p-2.5 rounded-lg bg-red-500/10 text-red-500 text-xs font-medium animate-fade-in">
                  <AlertCircle size={14} /> {uploadError}
                </div>
              )}
              {uploadSuccess && (
                <div className="flex items-center gap-2 p-2.5 rounded-lg bg-green-500/10 text-green-500 text-xs font-medium animate-fade-in">
                  <CheckCircle2 size={14} /> {uploadSuccess}
                </div>
              )}

              {/* ── LISTE DES FICHIERS — toujours visible ── */}
              {attachLoading ? (
                <div className="flex items-center justify-center py-6">
                  <Loader2
                    size={20}
                    className="text-[hsl(var(--muted-foreground))] animate-spin"
                  />
                </div>
              ) : attachments.length === 0 ? (
                <div className="text-center py-5 text-[hsl(var(--muted-foreground))] text-xs border border-dashed border-[hsl(var(--border))] rounded-xl">
                  {isEditing
                    ? "Utilisez la zone ci-dessus pour ajouter des fichiers."
                    : "Aucune pièce jointe pour ce ticket."}
                </div>
              ) : (
                <div className="space-y-2">
                  {attachments.map((att) => (
                    <div
                      key={att.id}
                      className={`
                        flex items-center gap-3 p-3 rounded-xl border transition-colors
                        ${
                          isEditing
                            ? "border-[hsl(var(--primary)/0.15)] bg-[hsl(var(--primary)/0.03)] hover:border-[hsl(var(--primary)/0.3)]"
                            : "border-[hsl(var(--border))] bg-[hsl(var(--card))] hover:bg-[hsl(var(--muted)/0.2)]"
                        }
                      `}
                    >
                      {/* Miniature ou icône */}
                      <div className="w-10 h-10 flex-shrink-0 rounded-lg overflow-hidden bg-[hsl(var(--muted))] flex items-center justify-center border border-[hsl(var(--border)/0.5)]">
                        {isImageMime(att.mimetype) ? (
                          <img
                            src={`${ODOO_BASE}${att.url}`}
                            alt={att.name}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              (e.target as HTMLImageElement).style.display =
                                "none";
                            }}
                          />
                        ) : (
                          getFileIcon(att.mimetype, 18)
                        )}
                      </div>

                      {/* Infos */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold truncate">
                          {att.name}
                        </p>
                        <p className="text-xs text-[hsl(var(--muted-foreground))]">
                          {formatBytes(att.file_size)}
                          {att.create_date &&
                            ` · ${formatDate(att.create_date)}`}
                        </p>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-1 flex-shrink-0">
                        {/* Télécharger — toujours visible */}
                        <a
                          href={`${ODOO_BASE}${att.url}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="w-7 h-7 rounded-md flex items-center justify-center text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--primary))] hover:bg-[hsl(var(--primary)/0.1)] transition-colors"
                          title="Télécharger"
                        >
                          <Download size={14} />
                        </a>

                        {/* Supprimer fichier — visible UNIQUEMENT en mode Édition */}
                        {isEditing && (
                          <button
                            type="button"
                            onClick={() => handleDeleteAttachment(att.id)}
                            disabled={deletingId === att.id}
                            className="w-7 h-7 rounded-md flex items-center justify-center text-[hsl(var(--muted-foreground))] hover:text-red-500 hover:bg-red-500/10 disabled:opacity-40 transition-colors animate-fade-in"
                            title="Supprimer ce fichier"
                          >
                            {deletingId === att.id ? (
                              <Loader2 size={13} className="animate-spin" />
                            ) : (
                              <Trash2 size={13} />
                            )}
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* ── Info IA en mode édition ── */}
            {isEditing && (
              <div className="flex items-start gap-2.5 p-3 rounded-xl bg-[hsl(var(--primary)/0.05)] border border-[hsl(var(--primary)/0.1)] animate-fade-in">
                <Sparkles
                  size={14}
                  className="text-[hsl(var(--primary))] flex-shrink-0 mt-0.5"
                />
                <p className="text-xs text-[hsl(var(--primary))] leading-relaxed">
                  À l&apos;enregistrement, la <strong>catégorie</strong> et la{" "}
                  <strong>priorité</strong> seront automatiquement réévaluées
                  par l&apos;IA selon la nouvelle description.
                </p>
              </div>
            )}

            {/* ── Boutons Annuler / Enregistrer — visibles uniquement en mode Édition ── */}
            {isEditing && (
              <div className="flex justify-end gap-2 pt-1 animate-fade-in">
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  disabled={isAnalyzing}
                  className="btn-ghost disabled:opacity-50 flex items-center gap-1.5"
                >
                  <XCircle size={15} />
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isAnalyzing || !hasChanges}
                  className={`min-w-[150px] flex items-center justify-center gap-2 h-10 px-5 rounded-xl text-sm font-bold transition-all duration-300 disabled:opacity-40 disabled:cursor-not-allowed
                    ${
                      saveSuccess
                        ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/30 scale-105"
                        : hasChanges
                          ? "bg-[hsl(var(--primary))] text-white hover:bg-[hsl(var(--primary)/0.85)] shadow-md shadow-[hsl(var(--primary)/0.2)]"
                          : "bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]"
                    }`}
                >
                  {isAnalyzing ? (
                    <>
                      <Loader2 size={15} className="animate-spin" />{" "}
                      Sauvegarde...
                    </>
                  ) : saveSuccess ? (
                    <>
                      <CheckCircle2 size={15} className="animate-bounce-in" />{" "}
                      Enregistré !
                    </>
                  ) : (
                    <>
                      <Save size={15} /> Enregistrer
                    </>
                  )}
                </button>
              </div>
            )}
          </form>

          {/* ══════════════════════════════════════
              SECTION COMMENTAIRES
          ══════════════════════════════════════ */}
          <div className="px-6 pb-6 pt-0 space-y-4">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))] flex items-center gap-2 border-t border-[hsl(var(--border)/0.5)] pt-6">
              Commentaires
              {!commentsLoading && (
                <span className="normal-case font-normal bg-[hsl(var(--muted))] px-2 py-0.5 rounded-full text-[0.65rem]">
                  {comments.length}
                </span>
              )}
            </h4>

            {commentsLoading ? (
              <div className="flex justify-center py-4">
                <Loader2
                  size={20}
                  className="text-[hsl(var(--muted-foreground))] animate-spin"
                />
              </div>
            ) : comments.length === 0 ? (
              <div className="text-center py-5 text-[hsl(var(--muted-foreground))] text-xs rounded-xl bg-[hsl(var(--muted)/0.2)] border border-[hsl(var(--border)/0.5)]">
                Aucun commentaire pour le moment.
              </div>
            ) : (
              <div className="space-y-4">
                {comments.map((c) => (
                  <div key={c.id} className="flex gap-3">
                    <div className="w-8 h-8 rounded-full bg-[hsl(var(--primary)/0.1)] text-[hsl(var(--primary))] flex items-center justify-center font-bold text-xs flex-shrink-0 uppercase">
                      {c.author_name
                        ? c.author_name.substring(0, 2).toUpperCase()
                        : "??"}
                    </div>
                    <div className="flex-1 bg-[hsl(var(--card))] border border-[hsl(var(--border)/0.5)] rounded-xl rounded-tl-none p-4 shadow-sm">
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm tracking-tight">
                            {c.author_name}
                          </span>
                          {c.x_support_role === "admin" ? (
                            <span className="px-1.5 py-0.5 rounded-md text-[0.6rem] font-bold uppercase tracking-wide bg-red-500/10 text-red-500 border border-red-500/20">
                              Administrateur
                            </span>
                          ) : (
                            <span className="px-1.5 py-0.5 rounded-md text-[0.6rem] font-bold uppercase tracking-wide bg-[hsl(var(--primary)/0.1)] text-[hsl(var(--primary))] border border-[hsl(var(--primary)/0.2)]">
                              Utilisateur
                            </span>
                          )}
                        </div>
                        <span className="text-[0.65rem] text-[hsl(var(--muted-foreground))] font-medium bg-[hsl(var(--muted)/0.3)] px-1.5 py-0.5 rounded-md">
                          {c.date
                            ? new Date(c.date).toLocaleString("fr-FR", {
                                day: "2-digit",
                                month: "short",
                                hour: "2-digit",
                                minute: "2-digit",
                              })
                            : ""}
                        </span>
                      </div>
                      <div
                        className="text-sm text-[hsl(var(--foreground))] whitespace-pre-wrap leading-relaxed opacity-90 prose prose-sm max-w-none prose-p:my-1 prose-a:text-[hsl(var(--primary))]"
                        dangerouslySetInnerHTML={{ __html: c.body }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Zone d'ajout de commentaire */}
            {!isEditing && (
              <form
                onSubmit={handlePostComment}
                className="flex gap-3 mt-5 items-start"
              >
                <div className="flex-1">
                  <textarea
                    required
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    placeholder="Répondre à ce ticket..."
                    disabled={postingComment}
                    className="input-field focus-ring resize-none w-full text-sm py-3 px-4 rounded-xl"
                    style={{ height: "60px" }}
                  />
                </div>
                <button
                  type="submit"
                  disabled={postingComment || !newComment.trim()}
                  className="btn-primary h-[60px] px-5 flex-shrink-0 disabled:opacity-50 flex items-center justify-center rounded-xl font-bold shadow-sm"
                >
                  {postingComment ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    "Envoyer"
                  )}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
