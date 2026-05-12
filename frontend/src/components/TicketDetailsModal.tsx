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
  ChevronUp,
  ChevronRight,
  Users,
  PauseCircle,
  Cpu,
  Wallet,
  Info,
  MessageCircle,
  Package,
  UserPlus,
  ArrowUpCircle,
  Timer,
  TrendingUp,
  GitBranch,
  Printer,
  UserCheck,
  History,
  Flag,
  Target,
  CheckCircle2 as CheckCircleFilled,
  PlayCircle,
  MessageSquare,
} from "lucide-react";
// @ts-expect-error - framer-motion types missing
import { motion, AnimatePresence } from "framer-motion";
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
  sla_deadline_initial?: string | null;
  sla_status?: string | null;
  date_resolved?: string | null;
  resolution?: string | null;
  materials?: { id: number; name: string; status: string; unit_cost: number }[];
  total_material_cost?: number;
  x_total_paused_duration?: number;
  x_actual_paused_duration?: number;

  // SLA v2
  sla_response_deadline?: string | null;
  sla_response_status?: string | null;
  date_first_assigned?: string | null;
  date_escalated?: string | null;
  escalation_sla_bonus_hours?: number;
  x_accepted?: boolean;
};

type TimelineEvent = {
  id: string;
  type:
    | "creation"
    | "assignment"
    | "status_change"
    | "waiting"
    | "escalation"
    | "resolved"
    | "comment"
    | "acceptance";
  date: string;
  author: string;
  author_role?: string;
  message: string;
  duration_from_prev_minutes?: number | null;
  duration_label?: string | null;
  detail?: Record<string, string>;
};

type TimelineData = {
  events: TimelineEvent[];
  sla_deadline_initial: string | null;
  sla_deadline_adjusted: string | null;
  total_paused_hours: number;
  actual_paused_hours: number;
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
  viewType?: "default" | "live" | "report";
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
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }) +
    " " +
    d.toLocaleTimeString("fr-FR", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
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
    case "met":
      return {
        label: "Respecté",
        color: "#10b981",
        icon: <ShieldCheck size={14} />,
        bgClass: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
      };
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
    case "failed":
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

function SlaCountdown({
  deadline,
  state,
  dateResolved,
  createDate,
  totalPausedHours = 0,
}: {
  deadline: string | null | undefined;
  state: string;
  dateResolved: string | null | undefined;
  createDate?: string | null | undefined;
  totalPausedHours?: number;
}) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    // Si en pause ou résolu, le chronomètre visuel s'arrête de tourner
    const isPaused = state === "waiting_material";
    const isResolved = state === "resolved" || state === "closed";
    if (isPaused || isResolved) return;

    const interval = setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => clearInterval(interval);
  }, [state]);

  if (!deadline)
    return <span className="text-[hsl(var(--muted-foreground))]">—</span>;

  const end = parseOdooDate(deadline).getTime();
  let timeToCompare = now;

  const isResolved =
    state === "resolved" || state === "closed" || dateResolved != null;
  if (isResolved && dateResolved) {
    timeToCompare = parseOdooDate(dateResolved).getTime();

    if (createDate) {
      const start = parseOdooDate(createDate).getTime();
      let consumedMs = timeToCompare - start;
      if (totalPausedHours > 0) consumedMs -= totalPausedHours * 3600000;
      if (consumedMs < 0) consumedMs = 0;

      const consumedH = Math.floor(consumedMs / 3600000);
      const consumedM = Math.floor((consumedMs % 3600000) / 60000);
      return (
        <span className="text-[hsl(var(--foreground))] font-bold font-mono tracking-wider text-sm bg-[hsl(var(--muted)/0.5)] px-2 py-1 rounded">
          Temps consommé : {consumedH}h {consumedM.toString().padStart(2, "0")}
          min
        </span>
      );
    }
  }

  const diff = end - timeToCompare;
  const isOverdue = diff <= 0;
  const absDiff = Math.abs(diff);

  const hours = Math.floor(absDiff / 3600000);
  const mins = Math.floor((absDiff % 3600000) / 60000);
  const secs = Math.floor((absDiff % 60000) / 1000);

  const formatUnit = (u: number) => u.toString().padStart(2, "0");
  const timeStr = `${formatUnit(hours)}:${formatUnit(mins)}:${formatUnit(secs)}`;

  if (state === "waiting_material") {
    return (
      <div className="flex flex-col items-end">
        <span className="text-blue-400 font-bold font-mono tracking-wider flex items-center gap-1.5 text-sm">
          <PauseCircle size={15} className="animate-pulse" />
          {timeStr}
        </span>
        <span className="text-[0.6rem] text-blue-400/80 font-medium mt-0.5">
          Chrono suspendu (Attente matériel)
        </span>
      </div>
    );
  }

  if (isOverdue) {
    return (
      <div className="flex flex-col items-end">
        <span className="text-red-500 font-bold font-mono tracking-wider text-sm">
          - {timeStr}
        </span>
        <span className="text-[0.6rem] text-red-500/80 font-medium mt-0.5">
          SLA Dépassé
        </span>
      </div>
    );
  }

  return (
    <span className="text-[hsl(var(--foreground))] font-bold font-mono tracking-wider text-sm">
      {timeStr}
    </span>
  );
}

// ─── Vertical Timeline Hook ───

function useTimeline(ticketId: number, isOpen: boolean) {
  const [data, setData] = useState<TimelineData | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isOpen || !ticketId) return;
    setLoading(true);
    axios
      .get(`${ODOO_BASE}/api/ticket/${ticketId}/timeline`)
      .then((res) => {
        if (res.data.status === 200) {
          setData({
            events: res.data.data || [],
            sla_deadline_initial: res.data.sla_deadline_initial || null,
            sla_deadline_adjusted: res.data.sla_deadline_adjusted || null,
            total_paused_hours: res.data.total_paused_hours || 0,
            actual_paused_hours: res.data.actual_paused_hours || 0,
          });
        }
      })
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [ticketId, isOpen]);

  return { data, loading };
}

function TimelineIcon({ type }: { type: TimelineEvent["type"] }) {
  const base =
    "w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 border-2";
  switch (type) {
    case "creation":
      return (
        <div className={`${base} border-blue-500 bg-blue-500/10 text-blue-400`}>
          <GitBranch size={14} />
        </div>
      );
    case "assignment":
      return (
        <div
          className={`${base} border-violet-500 bg-violet-500/10 text-violet-400`}
        >
          <UserPlus size={14} />
        </div>
      );
    case "status_change":
      return (
        <div className={`${base} border-sky-400 bg-sky-400/10 text-sky-400`}>
          <TrendingUp size={14} />
        </div>
      );
    case "waiting":
      return (
        <div
          className={`${base} border-amber-400 bg-amber-400/10 text-amber-400`}
        >
          <Timer size={14} />
        </div>
      );
    case "escalation":
      return (
        <div
          className={`${base} border-orange-500 bg-orange-500/10 text-orange-400`}
        >
          <ArrowUpCircle size={14} />
        </div>
      );
    case "resolved":
      return (
        <div
          className={`${base} border-emerald-500 bg-emerald-500/10 text-emerald-400`}
        >
          <CheckCircle2 size={14} />
        </div>
      );
    case "acceptance":
      return (
        <div
          className={`${base} border-indigo-400 bg-indigo-400/10 text-indigo-400`}
        >
          <UserCheck size={14} />
        </div>
      );
    default:
      return (
        <div className={`${base} border-zinc-500 bg-zinc-500/10 text-zinc-400`}>
          <MessageCircle size={14} />
        </div>
      );
  }
}

// ── Color config by event type ──
function getEventConfig(evt: TimelineEvent): {
  bgClass: string;
  icon: React.ReactNode;
} {
  const msg = evt.message.toLowerCase();

  if (evt.type === "creation") {
    return {
      bgClass: "bg-blue-500/15",
      icon: <Flag size={14} className="text-blue-500" />,
    };
  }
  if (evt.type === "assignment") {
    return {
      bgClass: "bg-indigo-500/15",
      icon: <UserPlus size={14} className="text-indigo-500" />,
    };
  }
  if (evt.type === "escalation" || msg.includes("escaladé")) {
    return {
      bgClass: "bg-purple-500/15",
      icon: <ArrowUpCircle size={14} className="text-purple-500" />,
    };
  }
  if (evt.type === "resolved" || msg.includes("résolu")) {
    return {
      bgClass: "bg-emerald-500/15",
      icon: <CheckCircle2 size={14} className="text-emerald-500" />,
    };
  }
  if (
    evt.type === "waiting" ||
    msg.includes("pause") ||
    msg.includes("attente")
  ) {
    return {
      bgClass: "bg-amber-500/15",
      icon: <PauseCircle size={14} className="text-amber-500" />,
    };
  }
  if (
    msg.toLowerCase().includes("prise en charge") ||
    evt.type === "acceptance" ||
    msg.includes("accepté")
  ) {
    return {
      bgClass: "bg-indigo-500/15",
      icon: <UserCheck size={14} className="text-indigo-500" />,
    };
  }
  if (msg.includes("reprise") || msg.includes("cours")) {
    return {
      bgClass: "bg-sky-500/15",
      icon: <PlayCircle size={14} className="text-sky-500" />,
    };
  }

  // Default Message / Discussion / Fallback
  return {
    bgClass: "bg-zinc-500/15",
    icon: <MessageSquare size={14} className="text-zinc-400" />,
  };
}

function humanizeMessage(msg: string, type: string): string {
  // Strip HTML, asterisks, emojis, technical labels
  let t = msg
    .replace(/<[^>]+>/g, " ")
    .replace(
      /[*✅❌⚠️🔄📦⏰▶\u25A0\u25C6\u2665\u2666\u2663\u2660\u2022\u25CF\u26A0]/g,
      "",
    )
    .replace(/TICKET RÉSOLU\s*:/gi, "")
    .replace(/Pause SLA\s*—\s*/gi, "")
    .replace(/SLA R[eé]solution mis en pause\.?/gi, "")
    .replace(/SLA R[eé]ponse r[eé]activ[eé]\.?/gi, "")
    .replace(/Bonus de \d+(?:\.\d+)?h\.?/gi, "")
    .replace(/Dur[eé]e\s*:\s*\d+[smh]?\d*[smh]?\.?/gi, "")
    .replace(/Pause SLA termin[eé]e[^.]*\.?/gi, "")
    .replace(/Escalade N\d\s*—?/gi, "")
    .replace(/Motif\s*:?/i, "Raison :")
    .replace(/&nbsp;/g, " ");

  const MAP: [RegExp, string | ((m: string) => string)][] = [
    // New backend format (direct, passthrough / light clean)
    [/^Mise en pause — Attente client$/i, "Mise en pause — Attente client"],
    [
      /^Mise en pause — Attente mat[eé]riel$/i,
      "Mise en pause — Attente matériel",
    ],
    [/^Reprise de l'intervention$/i, "Reprise de l'intervention"],
    [/^Ticket r[eé]solu$/i, "Ticket résolu"],
    [/^Ticket escalad[eé](\s*→.*)?$/i, (m: string) => m], // preserve "→ Tech"
    // Legacy/chatter messages — escalation with new tech name
    [
      /a escalad[eé] le ticket\s*(→\s*.+)?/gi,
      (m: string) => {
        const arrow = m.match(/→\s*(.+)/i);
        return arrow
          ? `Ticket escaladé → ${arrow[1].trim()}`
          : "Ticket escaladé";
      },
    ],
    // Legacy/chatter messages — other patterns
    [
      /^mise en pause\s*[—-]\s*attente client/gi,
      "Mise en pause — Attente client",
    ],
    [
      /^mise en pause\s*[—-]\s*attente mat[eé]riel/gi,
      "Mise en pause — Attente matériel",
    ],
    [
      /mise en pause\s*[—-]\s*(attente client|attente mat[eé]riel)\s*:\s*(.+)/gi,
      (m: string) => {
        const parts = m.split(":");
        return `Mise en pause — Raison : ${parts.slice(1).join(":").trim()}`;
      },
    ],
    [
      /^(attente client|en attente client)\s*:\s*(.+)/gi,
      (m: string) => {
        const parts = m.split(":");
        return `Mise en pause — Raison : ${parts.slice(1).join(":").trim()}`;
      },
    ],
    [
      /^(attente mat[eé]riel|en attente mat[eé]riel)\s*:\s*(.+)/gi,
      (m: string) => {
        const parts = m.split(":");
        return `Mise en pause — Raison : ${parts.slice(1).join(":").trim()}`;
      },
    ],
    [
      /statut\s*[:\-→]+\s*en attente mat[eé]riel/gi,
      "Mise en pause — Attente matériel",
    ],
    [
      /statut\s*[:\-→]+\s*en attente client/gi,
      "Mise en pause — Attente client",
    ],
    [/statut\s*[:\-→]+\s*en cours/gi, "Reprise de l'intervention"],
    [/statut\s*[:\-→]+\s*r[eé]solu/gi, "Ticket résolu"],
    [/statut\s*[:\-→]+\s*assign[eé]/gi, "Ticket assigné"],
    [/statut\s*[:\-→]+\s*escalad[eé]/gi, "Ticket escaladé"],
    [
      /a pass[eé] le statut à en attente mat[eé]riel/gi,
      "Mise en pause — Attente matériel",
    ],
    [/a pass[eé] le statut à en attente/gi, "Mise en pause — Attente client"],
    [
      /a mis le ticket en attente mat[eé]riel/gi,
      "Mise en pause — Attente matériel",
    ],
    [/a mis le ticket en attente client/gi, "Mise en pause — Attente client"],
    [/a pass[eé] le statut à en cours/gi, "Reprise de l'intervention"],
    [/a pass[eé] le statut à r[eé]solu/gi, "Ticket résolu"],
    [/a r[eé]solu le ticket/gi, "Ticket résolu"],
    [/sla repris/gi, "Reprise de l'intervention"],
    [/reprise du travail.*/gi, "Reprise de l'intervention"],
    [
      /en attente mat[eé]riel\s*(attente de\s*)?/gi,
      "Mise en pause — Attente matériel",
    ],
    [
      /^Motif\s*:\s*(.+)/gi,
      (m: string) => {
        const match = m.match(/^Motif\s*:\s*(.+)/i);
        return match ? `Mise en pause — Raison : ${match[1].trim()}` : m;
      },
    ],
    [/^\s*en attente client\s*$/gi, "Mise en pause — Attente client"],
  ];
  for (const [re, rep] of MAP) {
    if (re.test(t)) {
      t = typeof rep === "function" ? rep(t) : t.replace(re, rep);
      break;
    }
  }

  t = t.replace(/\s{2,}/g, " ").trim();
  return t.charAt(0).toUpperCase() + t.slice(1);
}

function formatDuration(diffSec: number): string | null {
  if (diffSec < 60) return null; // < 1 min → masqué
  if (diffSec < 3600) {
    const m = Math.floor(diffSec / 60);
    const s = diffSec % 60;
    return s > 0 ? `${m} min ${s} s` : `${m} min`;
  }
  if (diffSec < 86400) {
    const h = Math.floor(diffSec / 3600);
    const m = Math.floor((diffSec % 3600) / 60);
    return m > 0 ? `${h} h ${m} min` : `${h} h`;
  }
  const d = Math.floor(diffSec / 86400);
  const h = Math.floor((diffSec % 86400) / 3600);
  return h > 0 ? `${d} j ${h} h` : `${d} j`;
}

function mergeByMinute(events: TimelineEvent[]): TimelineEvent[] {
  const out: TimelineEvent[] = [];
  for (const evt of events) {
    const last = out[out.length - 1];
    if (!last) {
      out.push(evt);
      continue;
    }
    const diff = Math.abs(
      new Date(evt.date).getTime() - new Date(last.date).getTime(),
    );
    const msg1 = last.message.toLowerCase().trim();
    const msg2 = evt.message.toLowerCase().trim();

    // Fusionner assignation + changement de statut "Assigné" dans la même minute
    // Mais NE PAS fusionner si c'est une transition vers "En cours" (reprise)
    if (
      diff < 60000 &&
      ((last.type === "assignment" && evt.type === "status_change") ||
        (last.type === "status_change" && evt.type === "assignment")) &&
      !msg1.includes("reprise") &&
      !msg2.includes("reprise")
    ) {
      const assign = last.type === "assignment" ? last : evt;
      out[out.length - 1] = {
        ...assign,
        detail: { ...last.detail, ...evt.detail },
      };
      continue;
    }

    // Dédupliquer agressivement les "Reprise de l'intervention" (fenêtre de 2 minutes)
    if (diff < 120000 && msg1.includes("reprise") && msg2.includes("reprise")) {
      continue;
    }

    // Dédupliquer les événements ayant le même message dans la même minute
    if (diff < 60000 && msg1 === msg2) {
      continue;
    }

    out.push(evt);
  }
  return out;
}

function VerticalTimeline({
  events,
  loading,
  viewType = "live",
  ticket: ticketProp,
}: {
  events: TimelineEvent[];
  loading: boolean;
  viewType?: string;
  ticket?: {
    date_resolved?: string | null;
    assigned_to?: string | null;
    resolution?: string | null;
    x_accepted?: boolean;
  };
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [showDetail, setShowDetail] = useState(false); // for report view toggle

  const processedEvents = useMemo(() => {
    if (!events || events.length === 0) return [];

    // 1. Clean + humanize messages, filter out redundant status changes and system noise
    let filtered: TimelineEvent[] = events
      .filter((e) => {
        const mL = e.message.toLowerCase();
        if (mL.includes("pause sla terminée")) return false;
        if (
          mL.includes("a passé le statut à assigné") ||
          mL === "statut : assigné"
        )
          return false;
        if (
          mL.includes("a passé le statut à nouveau") ||
          mL === "statut : nouveau"
        )
          return false;

        // Exclure les changements de statut fantômes
        if (e.type === "status_change" && mL.includes("a passé le statut à")) {
          if (mL.trim().endsWith("à")) return false;
        }

        return true;
      })
      .map((e) => ({
        ...e,
        message: humanizeMessage(e.message, e.type),
      }))
      .filter((e) => {
        // Exclure les messages qui sont devenus vides ou inutiles (ex: juste "Raison : ")
        const cleanL = e.message.toLowerCase().trim();
        if (!cleanL || cleanL.length < 2 || cleanL === "raison :") return false;
        return true;
      });

    // 2. Remove noise: comments that duplicate a milestone in the same minute
    filtered = filtered.filter((e, _i, arr) => {
      if (e.type === "comment") {
        const msgL = e.message.toLowerCase();
        if (["resolu", "résolu", "nouveau", "resolvé"].includes(msgL))
          return false;
        const dup = arr.find(
          (a) =>
            a.id !== e.id &&
            a.type !== "comment" &&
            Math.abs(new Date(a.date).getTime() - new Date(e.date).getTime()) <
              60000,
        );
        if (dup) return false;
      }

      // Supprime les status_change (tracking auto Odoo = auteur admin)
      // quand un événement humain existe dans la même fenêtre.
      // Fenêtre élargie à 60s pour l'acceptation (deux champs écrits dans le même write()).
      if (e.type === "status_change") {
        const humanShadow = arr.find(
          (a) =>
            a.id !== e.id &&
            ["waiting", "escalation", "acceptance", "resolved"].includes(
              a.type,
            ) &&
            Math.abs(new Date(a.date).getTime() - new Date(e.date).getTime()) <
              (a.type === "acceptance" ? 60000 : 5000),
        );
        if (humanShadow) return false;

        // Filtre aussi les "Reprise de l'intervention" qui tombent juste après
        // une acceptation (même fenêtre 60s) — doublon du status in_progress
        const msgL = e.message.toLowerCase();
        if (msgL.includes("reprise") || msgL.includes("en cours")) {
          const nearAcceptance = arr.find(
            (a) =>
              a.id !== e.id &&
              a.type === "acceptance" &&
              Math.abs(
                new Date(a.date).getTime() - new Date(e.date).getTime(),
              ) < 60000,
          );
          if (nearAcceptance) return false;
        }
      }

      return true;
    });

    // 2b. Override authors for escalations and operational actions (since backend gives admin)
    let currentTechTracker: string | null = null;
    filtered = filtered.map((e, _, arr) => {
      // 1. Mettre à jour le technicien en charge si c'est une assignation
      if (e.type === "assignment" && e.detail && e.detail.vers) {
        currentTechTracker = e.detail.vers;
      }

      let realAuthor = e.author;

      // 2. Extraire l'auteur depuis le message d'escalade
      const match = e.message.match(
        /ESCALADE par\s+([A-Za-z\u00C0-\u00FF\s\-']+?)(?:\s+(?:Motif|Raison)\b|$)/i,
      );
      if (match && match[1]) {
        realAuthor = match[1].trim();
      } else if (
        e.type === "escalation" ||
        e.message.toLowerCase().includes("escalade")
      ) {
        const related = arr.find(
          (a) =>
            a.id !== e.id &&
            Math.abs(new Date(a.date).getTime() - new Date(e.date).getTime()) <
              60000 &&
            a.message.match(
              /ESCALADE par\s+([A-Za-z\u00C0-\u00FF\s\-']+?)(?:\s+(?:Motif|Raison)\b|$)/i,
            ),
        );
        if (related) {
          const rMatch = related.message.match(
            /ESCALADE par\s+([A-Za-z\u00C0-\u00FF\s\-']+?)(?:\s+(?:Motif|Raison)\b|$)/i,
          );
          if (rMatch) realAuthor = rMatch[1].trim();
        } else if (currentTechTracker) {
          realAuthor = currentTechTracker;
        }
      } else if (
        ["waiting", "status_change", "acceptance", "resolved"].includes(
          e.type,
        ) ||
        e.message.toLowerCase().includes("reprise") ||
        e.message.toLowerCase().includes("pause") ||
        e.message.toLowerCase().includes("résolu")
      ) {
        // Pour les actions opérationnelles, forcer l'auteur au technicien en charge,
        // à moins que l'auteur actuel ne soit explicitement un client/système,
        // mais souvent c'est l'admin qui fait l'action pour le compte du tech.
        if (currentTechTracker) {
          realAuthor = currentTechTracker;
        }
      }

      return { ...e, author: realAuthor };
    });

    // 2c. Injection automatique de la "Prise en charge" si manquante après une assignation
    const injected: TimelineEvent[] = [];
    for (let i = 0; i < filtered.length; i++) {
      const e = filtered[i];
      injected.push(e);
      if (e.type === "assignment") {
        if (!ticketProp?.x_accepted) continue;

        const next = filtered[i + 1];
        const newTech = e.detail?.vers || e.author;
        // Si le prochain événement n'est pas une reprise/acceptation, on l'injecte
        if (
          !next ||
          (next.type !== "acceptance" &&
            !next.message.toLowerCase().includes("reprise"))
        ) {
          injected.push({
            id: `synth_accept_${e.id}`,
            type: "acceptance",
            date: new Date(new Date(e.date).getTime() + 1000).toISOString(), // +1 sec
            author: newTech,
            author_role: "technician",
            message: "Prise en charge du ticket", // Directement le bon label
            detail: { par: newTech },
          });
        }
      }
    }
    filtered = injected;

    // 3. Semantic grouping: merge events in the same minute
    filtered = mergeByMinute(filtered);

    // 4. Distinction "Prise en charge" (1ère fois par technicien) vs "Reprise" (fois suivantes)
    // hasStarted se réinitialise après chaque escalade ou nouvelle assignation,
    // pour que chaque nouveau technicien ait sa propre "Prise en charge du ticket".
    let hasStarted = false;
    let lastAssignedTech: string | null = null;
    filtered = filtered.map((e, index, arr) => {
      // Réinitialiser si c'est une nouvelle assignation à un technicien différent
      if (e.type === "assignment") {
        const newTech = e.detail?.vers || null;
        if (newTech && newTech !== lastAssignedTech) {
          lastAssignedTech = newTech;
          hasStarted = false; // Nouveau technicien → attendre sa prise en charge
        }
        return e;
      }

      // Réinitialiser aussi sur une escalade (un nouveau tech va prendre en charge)
      if (e.type === "escalation") {
        hasStarted = false;
        return e;
      }

      const msgL = e.message.toLowerCase();
      const isStartAction =
        e.type === "acceptance" ||
        msgL.includes("accepté la mission") ||
        msgL === "reprise de l'intervention" ||
        msgL === "prise en charge du ticket";

      if (isStartAction) {
        if (!hasStarted) {
          hasStarted = true;

          // L'auteur de la "Prise en charge" doit toujours être le technicien assigné.
          // On cherche la dernière assignation qui a eu lieu avant cet événement.
          let realTech = e.author;
          for (let j = index - 1; j >= 0; j--) {
            if (arr[j].type === "assignment") {
              const asgn = arr[j];
              if (asgn.detail && asgn.detail.vers) {
                realTech = asgn.detail.vers;
              }
              break;
            }
          }

          return {
            ...e,
            message: "Prise en charge du ticket",
            author: realTech,
          };
        }
      }
      return e;
    });

    // 4.5. Logical reordering: "Prise en charge" must precede "En attente" or "Pause"
    for (let i = 1; i < filtered.length; i++) {
      if (filtered[i].message === "Prise en charge du ticket") {
        let j = i - 1;
        while (
          j >= 0 &&
          (filtered[j].message.toUpperCase().includes("ATTENTE") ||
            filtered[j].message.includes("Mise en pause") ||
            filtered[j].type === "waiting")
        ) {
          // Swap elements
          const temp = filtered[i];
          filtered[i] = filtered[j];
          filtered[j] = temp;

          // Swap dates so the timeline remains chronologically correct visually
          const tempDate = filtered[i].date;
          filtered[i].date = filtered[j].date;
          filtered[j].date = tempDate;

          i = j;
          j--;
        }
      }
    }

    // 5. Compute durations (only show if > 59s)
    return filtered.map((e, i) => {
      if (i === 0) return { ...e, duration_label: null as string | null };
      const diffSec = Math.max(
        0,
        Math.floor(
          (new Date(e.date).getTime() -
            new Date(filtered[i - 1].date).getTime()) /
            1000,
        ),
      );
      return { ...e, duration_label: formatDuration(diffSec) };
    });
  }, [events]);

  // ── Report view: Lifecycle-identical layout ──
  if (viewType === "report") {
    const fmtDate = (d: string) =>
      new Date(d).toLocaleString("fr-FR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });

    const fmtSec = (sec: number): string => {
      if (sec < 60) return "Moins d'une minute";
      if (sec < 3600) {
        const m = Math.floor(sec / 60);
        const s = sec % 60;
        return s > 0 ? `${m} min ${s} s` : `${m} min`;
      }
      if (sec < 86400) {
        const h = Math.floor(sec / 3600);
        const m = Math.floor((sec % 3600) / 60);
        return m > 0 ? `${h} h ${m} min` : `${h} h`;
      }
      const d = Math.floor(sec / 86400);
      const h = Math.floor((sec % 86400) / 3600);
      return h > 0 ? `${d} j ${h} h` : `${d} j`;
    };

    // ── Group events for Report View ──
    const groupedForReport: TimelineEvent[] = [];
    for (const evt of processedEvents) {
      const last = groupedForReport[groupedForReport.length - 1];
      if (!last) {
        groupedForReport.push(evt);
        continue;
      }
      const diff = Math.abs(
        new Date(evt.date).getTime() - new Date(last.date).getTime(),
      );
      if (diff <= 10000) {
        // Priority to human actions over automated status_change
        if (last.type === "status_change") {
          const isHuman =
            evt.type === "waiting" ||
            evt.type === "comment" ||
            evt.type === "acceptance" ||
            evt.type === "escalation" ||
            evt.type === "resolved" ||
            evt.message.toLowerCase().includes("pause") ||
            evt.message.toLowerCase().includes("attente");
          if (isHuman) {
            groupedForReport[groupedForReport.length - 1] = {
              ...evt,
              date: last.date,
            };
          } else {
            groupedForReport.push(evt);
          }
        } else if (last.type === evt.type) {
          // skip true duplicate
        } else {
          // Keep different types happening at the same time
          groupedForReport.push(evt);
        }
      } else {
        groupedForReport.push(evt);
      }
    }

    const evtCreation = groupedForReport.find((e) => e.type === "creation");

    // Resolved fallback to ticket prop
    const evtResolved = groupedForReport.find((e) => e.type === "resolved");
    const resolvedDate =
      evtResolved?.date ??
      (ticketProp?.date_resolved
        ? ticketProp.date_resolved +
          (ticketProp.date_resolved.endsWith("Z") ? "" : "Z")
        : null);
    const resolvedAuthor =
      evtResolved?.author || ticketProp?.assigned_to || null;
    const resolutionNote = ticketProp?.resolution ?? null;

    // ── Build chronological intervals (Pauses / Resumes) ──
    const pauseIntervals: {
      pause: TimelineEvent;
      resume: TimelineEvent | null;
      durationSec: number;
      pauseKind: string;
    }[] = [];
    let currentPause: TimelineEvent | null = null;
    let totalPauseSec = 0;

    const isPauseEvent = (evt: TimelineEvent): boolean => {
      const msg = evt.message.toLowerCase();
      return (
        evt.type === "waiting" ||
        msg.includes("pause") ||
        msg.includes("attente client") ||
        msg.includes("attente matériel") ||
        msg.includes("attente de pièces")
      );
    };

    const isResumeEvent = (evt: TimelineEvent): boolean => {
      const msg = evt.message.toLowerCase();
      return (
        (evt.type === "status_change" || evt.type === "acceptance") &&
        (msg.includes("reprise") || msg.includes("cours"))
      );
    };

    const getPauseKind = (evt: TimelineEvent): string => {
      const msg = evt.message.toLowerCase();
      if (msg.includes("client")) return "Attente client";
      if (msg.includes("matériel") || msg.includes("pièces"))
        return "Attente matériel";
      return "En attente";
    };

    groupedForReport.forEach((evt) => {
      if (isPauseEvent(evt) && !currentPause) {
        currentPause = evt;
      } else if (isResumeEvent(evt) && currentPause) {
        const durationSec = Math.max(
          0,
          Math.floor(
            (new Date(evt.date).getTime() -
              new Date(currentPause.date).getTime()) /
              1000,
          ),
        );
        pauseIntervals.push({
          pause: currentPause,
          resume: evt,
          durationSec,
          pauseKind: getPauseKind(currentPause),
        });
        totalPauseSec += durationSec;
        currentPause = null;
      }
    });

    if (currentPause) {
      // Pause sans reprise formelle (ex: résolu directement)
      const endToUse = resolvedDate
        ? new Date(resolvedDate).getTime()
        : // eslint-disable-next-line
          Date.now();
      const durationSec = Math.max(
        0,
        Math.floor(
          (endToUse -
            new Date((currentPause as TimelineEvent).date).getTime()) /
            1000,
        ),
      );
      pauseIntervals.push({
        pause: currentPause,
        resume: null,
        durationSec,
        pauseKind: getPauseKind(currentPause as TimelineEvent),
      });
      totalPauseSec += durationSec;
    }

    // ── Compute total active processing time ──
    let totalActiveSec: number | null = null;
    if (evtCreation && resolvedDate) {
      const raw = Math.floor(
        (new Date(resolvedDate).getTime() -
          new Date(evtCreation.date).getTime()) /
          1000,
      );
      totalActiveSec = Math.max(0, raw - totalPauseSec);
    }

    // ── Duration badge ── (same as Lifecycle, only >59s)
    const durationBadge = (diffSec: number) => {
      const label = formatDuration(diffSec);
      if (!label) return null;
      return (
        <div className="flex items-center gap-1 pl-8 py-0.5">
          <span className="text-[10px] font-mono text-[hsl(var(--muted-foreground))] bg-[hsl(var(--muted)/0.3)] px-2 py-0.5 rounded-full border border-[hsl(var(--border)/0.4)] flex items-center gap-1">
            <Clock size={8} /> {label}
          </span>
        </div>
      );
    };

    // ── Milestone renderer (identical layout to Lifecycle event row) ──
    const MRow = ({
      bgClass,
      icon,
      label,
      author,
      date,
      note,
      isOrange,
      durationFromPrev,
    }: {
      bgClass: string;
      icon: React.ReactNode;
      label: string;
      author?: string | null;
      date: string | null;
      note?: string | null;
      isOrange?: boolean;
      durationFromPrev?: number | null;
    }) => (
      <div>
        {durationFromPrev != null && durationBadge(durationFromPrev)}
        <div
          className={`relative flex items-start gap-3 rounded-xl py-2 px-2 -ml-2`}
        >
          <div
            className={`relative z-10 w-6 h-6 rounded-full ${bgClass} flex items-center justify-center flex-shrink-0 mt-0.5 shadow-sm`}
          >
            {icon}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <p
                className={`text-xs font-semibold leading-snug ${isOrange ? "text-orange-500 dark:text-orange-400" : "text-[hsl(var(--foreground))]"}`}
              >
                {label}
              </p>
              {date && (
                <span className="text-[10px] font-mono text-[hsl(var(--muted-foreground))] whitespace-nowrap flex-shrink-0">
                  {fmtDate(date)}
                </span>
              )}
            </div>
            {author && (
              <p className="text-[10px] text-[hsl(var(--muted-foreground))] mt-0.5">
                Par{" "}
                <span className="font-semibold text-[hsl(var(--foreground))] opacity-80">
                  {author}
                </span>
              </p>
            )}
            {note && (
              <p className="text-[10px] text-[hsl(var(--muted-foreground))] mt-1 italic leading-relaxed border-l-2 border-[hsl(var(--border)/0.5)] pl-2">
                {note}
              </p>
            )}
            {!date && (
              <p className="text-[10px] text-[hsl(var(--muted-foreground))] italic mt-0.5">
                En attente
              </p>
            )}
          </div>
        </div>
      </div>
    );

    // ── Compute durations between milestones ──
    const durBetween = (
      a: string | null | undefined,
      b: string | null | undefined,
    ): number | null => {
      if (!a || !b) return null;
      return Math.max(
        0,
        Math.floor((new Date(b).getTime() - new Date(a).getTime()) / 1000),
      );
    };

    // ── Build ordered intermediate milestones (all important actions) ──
    type IntermediateMilestone = {
      id: string;
      date: string;
      node: React.ReactNode;
    };
    const rawIntermediates: IntermediateMilestone[] = [];
    const usedIds = new Set<string>();

    const addIntermediate = (
      id: string,
      eventId: string,
      date: string,
      node: React.ReactNode,
    ) => {
      if (usedIds.has(eventId)) return;
      usedIds.add(eventId);
      rawIntermediates.push({ id, date, node });
    };

    const evtAssignments = groupedForReport.filter(
      (e) => e.type === "assignment",
    );

    evtAssignments.forEach((evtAssign, idx) => {
      // Le technicien cible est dans detail.vers. S'il n'y est pas, on fallback
      const targetTech = evtAssign.detail?.vers || "Technicien inconnu";
      // L'auteur réel de l'action d'assignation (l'admin)
      const adminAuthor = evtAssign.author;

      addIntermediate(
        `assign_${idx}`,
        evtAssign.id,
        evtAssign.date,
        <MRow
          bgClass="bg-indigo-500/15"
          icon={<UserPlus size={14} className="text-indigo-500" />}
          label={`Attribution du ticket à ${targetTech}`}
          author={adminAuthor}
          date={evtAssign.date}
          durationFromPrev={null}
        />,
      );
    });

    // Commentaires
    const evtComments = groupedForReport.filter((e) => e.type === "comment");
    evtComments.forEach((evtComment, idx) => {
      addIntermediate(
        `comment_${idx}`,
        evtComment.id,
        evtComment.date,
        <MRow
          bgClass="bg-zinc-500/15"
          icon={<MessageSquare size={14} className="text-zinc-400" />}
          label={`Commentaire / Réponse`}
          author={evtComment.author}
          date={evtComment.date}
          note={evtComment.message}
          durationFromPrev={null}
        />,
      );
    });

    // 3. Pauses logistiques (toutes variantes)
    pauseIntervals.forEach((interval, i) => {
      // Nettoyage radical du message de pause
      const cleanMsg = interval.pause.message
        .replace(/<[^>]*>?/gm, "") // Retire HTML (<b>, <br>, etc.)
        .replace(/&nbsp;/g, " ")
        .replace(/[\u25C6\u2665\u2666\u2663\u2660\u2022\u25CF\u26A0]/g, "") // Retire symboles comme ♦
        .replace(/\*+/g, "") // Retire astérisques markdown
        .replace(/SLA R[eé]solution mis en pause\.?/gi, "")
        .replace(/Dur[eé]e\s*:\s*\d+[smh]?\d*[smh]?\.?/gi, "")
        .replace(/Pause SLA termin[eé]e[^.]*\.?/gi, "")
        .trim();

      // Extraction du motif exact
      let motif = cleanMsg;
      const motifMatch = cleanMsg.match(/Motif\s*:?\s*(.+)/i);
      if (motifMatch && motifMatch[1]) {
        motif = motifMatch[1].trim();
      } else {
        // Fallback si pas de mot "Motif" mais un tiret
        const dashParts = cleanMsg.split("—");
        if (dashParts.length > 1) {
          motif = dashParts[dashParts.length - 1].trim();
        }
      }

      // Si le motif est vide après nettoyage
      if (!motif) {
        motif = "Raison non spécifiée";
      }

      addIntermediate(
        `pause_${i}`,
        interval.pause.id,
        interval.pause.date,
        <MRow
          bgClass="bg-amber-500/15"
          icon={<PauseCircle size={14} className="text-amber-500" />}
          label={`Mise en pause — Raison : ${motif}`}
          author={interval.pause.author}
          date={interval.pause.date}
          note={null} // Pas de note technique en dessous, tout est dans le label
          durationFromPrev={null}
        />,
      );
    });

    // 4. Escalade comme milestone
    const evtEscalations = groupedForReport.filter(
      (e) => e.type === "escalation",
    );
    evtEscalations.forEach((evtEscalation, idx) => {
      const newTech = evtEscalation.detail?.nouveau_technicien;
      addIntermediate(
        `escalation_${idx}`,
        evtEscalation.id,
        evtEscalation.date,
        <MRow
          bgClass="bg-purple-500/15"
          icon={<ArrowUpCircle size={14} className="text-purple-500" />}
          label={`Ticket escaladé${newTech ? ` \u2192 ${newTech}` : ""}`}
          author={evtEscalation.author}
          date={evtEscalation.date}
          durationFromPrev={null}
        />,
      );
    });

    // Sort chronologically
    rawIntermediates.sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
    );

    // Attach duration badges: duration from previous milestone (or creation)
    const orderedDates = [
      evtCreation?.date ?? null,
      ...rawIntermediates.map((m) => m.date),
    ].filter(Boolean) as string[];

    const intermediates = rawIntermediates.map((m, i) => {
      const prevDate = orderedDates[i]; // index i because orderedDates[0] = creation
      const diffSec = prevDate
        ? Math.max(
            0,
            Math.floor(
              (new Date(m.date).getTime() - new Date(prevDate).getTime()) /
                1000,
            ),
          )
        : null;
      const badge = diffSec != null ? durationBadge(diffSec) : null;
      return {
        id: m.id,
        node: (
          <div key={m.id}>
            {badge}
            {m.node}
          </div>
        ),
      };
    });

    return (
      <div className="space-y-0">
        <div className="relative pl-3">
          <div className="absolute left-[11px] top-3 bottom-3 w-[1px] bg-[hsl(var(--border)/0.4)]" />
          <div className="space-y-4">
            {/* ── Always visible: Ouverture ── */}
            <MRow
              bgClass="bg-blue-500/15"
              icon={<Flag size={14} className="text-blue-500" />}
              label="Ouverture du ticket"
              author={evtCreation?.author}
              date={evtCreation?.date ?? null}
            />

            {/* ── Toggle button for intermediates ── */}
            {intermediates.length > 0 && !showDetail && (
              <div className="mb-3 flex justify-start pl-7">
                <button
                  onClick={() => setShowDetail(true)}
                  className="flex items-center gap-2 text-xs font-semibold text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] border border-[hsl(var(--border)/0.5)] hover:border-[hsl(var(--border))] rounded-lg px-4 py-2 transition-all duration-200"
                >
                  <History size={14} className="mr-1" />
                  Afficher l&apos;historique
                  <span className="ml-1 inline-flex items-center justify-center h-4 w-4 rounded-full bg-[hsl(var(--muted)/0.4)] text-[10px] font-bold">
                    {intermediates.length}
                  </span>
                  <ChevronDown size={13} className="ml-1" />
                </button>
              </div>
            )}

            {/* ── All milestones (collapsible) ── */}
            {showDetail &&
              intermediates.map((m) => (
                <div
                  key={m.id}
                  className="animate-in fade-in zoom-in-95 duration-300"
                >
                  {m.node}
                </div>
              ))}

            {/* ── Always visible: Résolution ── */}
            <MRow
              bgClass="bg-emerald-500/15"
              icon={<CheckCircle2 size={14} className="text-emerald-500" />}
              label="Ticket résolu"
              author={resolvedAuthor}
              date={resolvedDate}
              note={resolutionNote}
              durationFromPrev={durBetween(
                rawIntermediates.length > 0
                  ? rawIntermediates[rawIntermediates.length - 1].date
                  : evtCreation?.date,
                resolvedDate,
              )}
            />
          </div>
        </div>

        {/* ── Hide button — below the list when expanded ── */}
        {showDetail && intermediates.length > 0 && (
          <div className="mt-3 flex justify-start pl-7">
            <button
              onClick={() => setShowDetail(false)}
              className="flex items-center gap-2 text-xs font-semibold text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] border border-[hsl(var(--border)/0.5)] hover:border-[hsl(var(--border))] rounded-lg px-4 py-2 transition-all duration-200"
            >
              <History size={14} className="mr-1" />
              Masquer l&apos;historique
              <ChevronUp size={13} className="ml-1" />
            </button>
          </div>
        )}

        {/* ── Total processing time footer ── */}
        {totalActiveSec !== null && (
          <div className="mt-4 pt-3 border-t border-[hsl(var(--border)/0.5)] flex items-center justify-between">
            <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
              <Timer size={11} />
              Temps de traitement effectif
              {totalPauseSec > 60 && (
                <span className="font-normal normal-case text-orange-400/70">
                  (hors {fmtSec(totalPauseSec)} de pause)
                </span>
              )}
            </div>
            <span className="text-sm font-black text-[hsl(var(--foreground))] font-mono">
              {fmtSec(totalActiveSec)}
            </span>
          </div>
        )}
      </div>
    );
  }

  // ── Live view ──
  if (loading)
    return (
      <div className="flex items-center justify-center py-8 gap-2 text-[hsl(var(--muted-foreground))]">
        <Loader2 size={16} className="animate-spin" />
        <span className="text-xs">Chargement...</span>
      </div>
    );

  if (processedEvents.length === 0)
    return (
      <div className="text-center py-6 text-xs text-[hsl(var(--muted-foreground))] italic">
        Aucun événement enregistré pour ce ticket.
      </div>
    );

  const visibleEvents = showAll ? processedEvents : processedEvents.slice(-1);
  const hiddenCount = processedEvents.length - visibleEvents.length;
  const fmt = (d: string) =>
    new Date(d).toLocaleString("fr-FR", {
      day: "2-digit",
      month: "2-digit",
      year: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });

  return (
    <div className="relative pl-3">
      <div className="absolute left-[11px] top-3 bottom-3 w-[1px] bg-[hsl(var(--border)/0.4)]" />

      {/* Toggle button — above the list when collapsed */}
      {hiddenCount > 0 && !showAll && (
        <div className="mb-3 flex justify-start pl-7">
          <button
            onClick={() => setShowAll(true)}
            className="flex items-center gap-2 text-xs font-semibold text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] border border-[hsl(var(--border)/0.5)] hover:border-[hsl(var(--border))] rounded-lg px-4 py-2 transition-all duration-200"
          >
            <History size={14} className="mr-1" />
            Afficher l&apos;historique
            <span className="ml-1 inline-flex items-center justify-center h-4 w-4 rounded-full bg-[hsl(var(--muted)/0.4)] text-[10px] font-bold">
              {hiddenCount}
            </span>
            <ChevronDown size={13} className="ml-1" />
          </button>
        </div>
      )}

      <div className="space-y-1">
        <AnimatePresence initial={false}>
          {visibleEvents.map((evt) => {
            const cfg = getEventConfig(evt);
            const isExpanded = expandedId === evt.id;
            const hasDetail =
              evt.detail &&
              Object.keys(evt.detail).filter((k) => k !== "par").length > 0;

            return (
              <motion.div
                key={evt.id}
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.25 }}
                className="overflow-hidden"
              >
                {/* Duration badge — only if > 59s */}
                {evt.duration_label && (
                  <div className="flex items-center gap-2 pl-8 pb-1">
                    <span className="text-[10px] font-mono text-[hsl(var(--muted-foreground))] bg-[hsl(var(--muted)/0.3)] px-2 py-0.5 rounded-full border border-[hsl(var(--border)/0.4)] flex items-center gap-1">
                      <Clock size={8} /> {evt.duration_label}
                    </span>
                  </div>
                )}

                {/* Event row */}
                <div
                  className={`relative flex items-start gap-3 rounded-xl py-2 px-2 -ml-2 transition-all duration-150 ${hasDetail ? "cursor-pointer" : ""} ${isExpanded ? "bg-[hsl(var(--muted)/0.35)] border border-[hsl(var(--border)/0.6)]" : hasDetail ? "hover:bg-[hsl(var(--muted)/0.2)]" : ""}`}
                  onClick={() =>
                    hasDetail && setExpandedId(isExpanded ? null : evt.id)
                  }
                >
                  {/* Colored dot */}
                  <div
                    className={`relative z-10 w-6 h-6 rounded-full ${cfg.bgClass} flex items-center justify-center flex-shrink-0 mt-0.5 shadow-sm`}
                  >
                    {cfg.icon}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-semibold leading-snug text-[hsl(var(--foreground))] truncate">
                        {evt.message}
                      </p>
                      <span className="text-[10px] font-mono text-[hsl(var(--muted-foreground))] whitespace-nowrap flex-shrink-0">
                        {fmt(evt.date)}
                      </span>
                    </div>
                    <p className="text-[10px] text-[hsl(var(--muted-foreground))] mt-0.5">
                      Par{" "}
                      <span className="font-semibold text-[hsl(var(--foreground))] opacity-80">
                        {evt.author}
                      </span>
                    </p>

                    {/* Expanded detail */}
                    {isExpanded && hasDetail && (
                      <div className="mt-2 p-2.5 rounded-lg bg-[hsl(var(--background)/0.6)] border border-[hsl(var(--border)/0.5)] space-y-1">
                        {Object.entries(evt.detail ?? {})
                          .filter(([k]) => k !== "par")
                          .map(([k, v]) => (
                            <div
                              key={k}
                              className="flex items-start gap-2 text-[10px]"
                            >
                              <span className="font-bold text-[hsl(var(--muted-foreground))] uppercase tracking-wide w-20 flex-shrink-0">
                                {k.replace(/_/g, " ")}
                              </span>
                              <span className="text-[hsl(var(--foreground))] break-words">
                                {v as string}
                              </span>
                            </div>
                          ))}
                      </div>
                    )}
                  </div>

                  {hasDetail && (
                    <ChevronDown
                      size={11}
                      className={`text-[hsl(var(--muted-foreground))] transition-transform flex-shrink-0 mt-1.5 ${isExpanded ? "rotate-180" : ""}`}
                    />
                  )}
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {/* Hide button — below the list when expanded */}
      {showAll && processedEvents.length > 1 && (
        <div className="mt-3 flex justify-start pl-7">
          <button
            onClick={() => setShowAll(false)}
            className="flex items-center gap-2 text-xs font-semibold text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] border border-[hsl(var(--border)/0.5)] hover:border-[hsl(var(--border))] rounded-lg px-4 py-2 transition-all duration-200"
          >
            <History size={14} className="mr-1" />
            Masquer l&apos;historique
            <ChevronUp size={13} className="ml-1" />
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Status Timeline ───

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
  viewType = "default",
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

  // ── Timeline verticale ──
  const { data: timelineData, loading: timelineLoading } = useTimeline(
    ticket.id,
    isOpen,
  );

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
      await axios.delete(`${ODOO_BASE}/api/ticket/${ticket.id}`, {
        withCredentials: true,
      });
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
            axios.delete(`${ODOO_BASE}/api/attachment/${id}`, {
              withCredentials: true,
            }),
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
          {
            headers: { "Content-Type": "multipart/form-data" },
            withCredentials: true,
          },
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

  // ── Extraction des données pour la Chaîne de Commandement ──
  const rawEvents = timelineData?.events || [];
  const assignments = rawEvents.filter((e) => e.type === "assignment");

  const chainNodes: {
    action: string;
    name: string;
    badge: string;
    colorType: "slate" | "indigo" | "purple" | "emerald" | "amber" | "sky";
    isIcon?: boolean;
  }[] = [];

  // Node 1: Creator
  chainNodes.push({
    action: "A CRÉÉ",
    name: (ticket as any).user_name || "Utilisateur",
    badge: "UTILISATEUR",
    colorType: "slate",
  });

  if (assignments.length > 0) {
    assignments.forEach((asgn, index) => {
      const isEscalation =
        asgn.message && asgn.message.toLowerCase().includes("escalade");
      const isReassignment = index > 0;

      let adminAction = "A ASSIGNÉ";
      let adminColorType: "slate" | "indigo" | "purple" | "emerald" | "amber" =
        "indigo";

      if (isEscalation) {
        adminAction = "A ESCALADÉ";
        adminColorType = "purple";
      } else if (isReassignment) {
        adminAction = "A RÉ-ASSIGNÉ";
      }

      // Node Admin
      chainNodes.push({
        action: adminAction,
        name: asgn.author,
        badge: "ADMIN",
        colorType: adminColorType,
      });
      // Node Tech
      const techName = asgn.detail?.vers || "Technicien inconnu";
      const isLast = index === assignments.length - 1;

      let action = "ASSIGNÉ";
      let techColor:
        | "slate"
        | "indigo"
        | "purple"
        | "emerald"
        | "amber"
        | "sky" = "sky";
      const techBadge = "TECHNICIEN";

      if (!isLast) {
        // Technicien précédent qui a escaladé
        action = "ESCALADÉ";
        techColor = "purple";
      } else {
        action =
          ticket.state === "resolved" || ticket.state === "closed"
            ? "A RÉSOLU"
            : ticket.state === "escalated" && !isReassignment
              ? "A ESCALADÉ" // Seul tech, c'est lui qui a escaladé
              : !ticket.x_accepted
                ? "EN ATTENTE"
                : ticket.state === "escalated"
                  ? "A ESCALADÉ" // Nouveau tech qui a accepté et a escaladé ensuite
                  : "EN CHARGE";

        techColor =
          ticket.state === "resolved" || ticket.state === "closed"
            ? "emerald"
            : ticket.state === "escalated" && !isReassignment
              ? "purple" // Seul tech escaladé → toujours purple
              : !ticket.x_accepted
                ? "amber"
                : ticket.state === "escalated"
                  ? "purple"
                  : "sky";

      }

      chainNodes.push({
        action: action,
        name: techName,
        badge: techBadge,
        colorType: techColor,
      });
    });
  } else {
    // Not assigned yet
    if (ticket.assigned_to) {
      chainNodes.push({
        action:
          ticket.state === "resolved" || ticket.state === "closed"
            ? "A RÉSOLU"
            : !ticket.x_accepted
              ? "EN ATTENTE"
              : ticket.state === "escalated"
                ? "A ESCALADÉ"
                : "EN CHARGE",
        name: ticket.assigned_to,
        badge: "TECHNICIEN",
        colorType:
          ticket.state === "resolved" || ticket.state === "closed"
            ? "emerald"
            : ticket.x_accepted
              ? "sky"
              : ticket.state === "escalated"
                ? "purple"
                : "amber",
      });
    } else {
      if (ticket.state === "escalated" && (ticket as any).escalated_by_name) {
        chainNodes.push({
          action: "A ESCALADÉ",
          name: (ticket as any).escalated_by_name,
          badge: "TECHNICIEN",
          colorType: "purple",
        });
      } else {
        chainNodes.push({
          action: "EN ATTENTE",
          name: "En attente d'agent",
          badge: "NON ASSIGNÉ",
          colorType: "amber",
          isIcon: true,
        });
      }
    }
  }

  const getColorStyles = (type: string) => {
    switch (type) {
      case "indigo":
        return {
          text: "text-indigo-400",
          bg: "bg-indigo-400/5",
          border: "border-indigo-400/20",
        };
      case "purple":
        return {
          text: "text-purple-400",
          bg: "bg-purple-400/5",
          border: "border-purple-400/20",
        };
      case "emerald":
        return {
          text: "text-emerald-400",
          bg: "bg-emerald-400/5",
          border: "border-emerald-400/20",
        };
      case "amber":
        return {
          text: "text-amber-400",
          bg: "bg-amber-400/5",
          border: "border-amber-400/20",
        };
      case "sky":
        return {
          text: "text-sky-400",
          bg: "bg-sky-500/10",
          border: "border-sky-500/20",
        };
      case "slate":
      default:
        return {
          text: "text-[hsl(var(--muted-foreground))] opacity-80",
          bg: "bg-[hsl(var(--muted)/0.1)]",
          border: "border-[hsl(var(--border)/0.5)]",
        };
    }
  };

  const renderChainOfCommand = () => {
    return (
      <div className="p-4 bg-[hsl(var(--secondary)/0.03)] border border-[hsl(var(--border)/0.5)] rounded-xl mb-6">
        <h4 className="text-[10px] font-black uppercase tracking-widest text-[hsl(var(--muted-foreground))] flex items-center gap-1.5 mb-4">
          <Users size={12} /> Chaîne de commandement
        </h4>

        <div className="flex items-start justify-center flex-wrap gap-y-4 gap-x-0 w-full overflow-hidden">
          {chainNodes.map((node, i) => {
            const isLast = i === chainNodes.length - 1;
            const colors = getColorStyles(node.colorType);
            return [
              <div
                key={`node-${i}`}
                className="flex flex-col items-center w-[85px] flex-shrink-0"
              >
                <span
                  className={`text-[8.5px] font-black tracking-[0.1em] ${colors.text} mb-1.5 uppercase text-center w-full`}
                >
                  {node.action}
                </span>

                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs uppercase shadow-sm ${colors.bg} ${colors.text} border ${colors.border} mb-1.5`}
                >
                  {node.isIcon ? (
                    <UserPlus size={14} />
                  ) : (
                    node.name.substring(0, 2)
                  )}
                </div>

                <span
                  className="text-[10px] font-bold text-[hsl(var(--foreground))] text-center truncate w-[85px] px-0.5 mb-1"
                  title={node.name}
                >
                  {node.name}
                </span>

                <span
                  className={`text-[8px] font-black tracking-widest uppercase px-1.5 py-0.5 rounded-md border ${colors.bg} ${colors.text} ${colors.border}`}
                >
                  {node.badge}
                </span>
              </div>,
              !isLast && (
                <div
                  key={`arrow-${i}`}
                  className="flex items-center justify-center flex-shrink-0 mt-[23px] px-0.5"
                >
                  <ChevronRight
                    size={14}
                    className="text-[hsl(var(--muted-foreground)/0.3)]"
                  />
                </div>
              ),
            ];
          })}
        </div>
      </div>
    );
  };

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
          {(!viewType || viewType === "default") && (
            <>
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
                          setEditForm({
                            ...editForm,
                            description: e.target.value,
                          })
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
                      <span className="text-sm font-semibold">
                        {status.label}
                      </span>
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

                  {/* ── Timeline Verticale Interactive ── */}
                  <div className="p-4 rounded-xl border border-[hsl(var(--border)/0.5)] bg-[hsl(var(--card))]">
                    <div className="flex items-center justify-between mb-3">
                      <h5 className="text-[0.65rem] font-bold uppercase tracking-widest text-[hsl(var(--muted-foreground))] flex items-center gap-1.5">
                        <GitBranch size={11} /> Lifecycle du ticket
                      </h5>
                      <span className="text-[10px] text-[hsl(var(--muted-foreground))] italic">
                        Cliquez sur un événement pour les détails
                      </span>
                    </div>
                    <VerticalTimeline
                      events={timelineData?.events ?? []}
                      loading={timelineLoading}
                      viewType={viewType}
                    />
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
                        <div className="flex items-center justify-end">
                          <SlaCountdown
                            deadline={ticket.sla_deadline}
                            state={ticket.state}
                            dateResolved={ticket.date_resolved}
                          />
                        </div>
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
                        <span>
                          Créé le {formatFullDate(ticket.create_date)}
                        </span>
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
                              if (
                                agent.it_domains &&
                                agent.it_domains.length > 0
                              ) {
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
                              setEditForm((prev) => ({
                                ...prev,
                                assigned_to: val,
                              }))
                            }
                          />
                        ) : (
                          <div className="flex flex-col mt-0.5 gap-0.5">
                            <span className="text-xs font-semibold">
                              {ticket.assigned_to || "Non assigné"}
                            </span>
                            {ticket.assigned_to && (
                              <span className="text-[10px] text-muted-foreground/80 font-medium italic">
                                {ticket.assigned_by_id === ticket.assigned_to_id
                                  ? "Auto-assigné"
                                  : `Assigné par : ${ticket.assigned_by || "Admin"}`}
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
                            {ticket.state === "waiting_material" && (
                              <span className="ml-1.5 text-[0.65rem] font-bold text-amber-500 bg-amber-500/10 px-1.5 py-0.5 rounded-md animate-pulse">
                                (PAUSE)
                              </span>
                            )}
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
                      onClick={() =>
                        !isUploading && fileInputRef.current?.click()
                      }
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
                      À l&apos;enregistrement, la <strong>catégorie</strong> et
                      la <strong>priorité</strong> seront automatiquement
                      réévaluées par l&apos;IA selon la nouvelle description.
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
                          <CheckCircle2
                            size={15}
                            className="animate-bounce-in"
                          />{" "}
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
            </>
          )}

          {/* ══ VUE LIVE / TEMPS RÉEL ══ */}
          {viewType === "live" && (
            <div className="p-6 space-y-5">
              {/* APERÇU DE LA DEMANDE */}
              <div className="p-5 bg-[hsl(var(--secondary)/0.1)] border border-[hsl(var(--border)/0.5)] rounded-xl mb-6">
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center gap-1.5">
                    <FileText
                      size={16}
                      className="text-[hsl(var(--muted-foreground))]"
                    />
                    <span className="text-[10px] font-black uppercase text-[hsl(var(--muted-foreground))]">
                      Sujet
                    </span>
                  </div>
                  <span className="text-base md:text-lg font-bold text-[hsl(var(--foreground))] leading-tight whitespace-normal">
                    {ticket.name}
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-8 mt-4 pt-4 border-t border-[hsl(var(--border)/0.4)]">
                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-center gap-1.5">
                      <User
                        size={14}
                        className="text-[hsl(var(--muted-foreground))]"
                      />
                      <span className="text-[10px] font-black uppercase text-[hsl(var(--muted-foreground))]">
                        Auteur
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-5 h-5 rounded-full bg-[hsl(var(--primary)/0.15)] text-[hsl(var(--primary))] flex items-center justify-center font-bold text-[10px] uppercase shadow-sm">
                        {((ticket as any).user_name || "Utilisateur").substring(
                          0,
                          2,
                        )}
                      </div>
                      <span className="text-sm font-medium">
                        {(ticket as any).user_name || "Utilisateur"}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-center gap-1.5">
                      <CalendarDays
                        size={14}
                        className="text-[hsl(var(--muted-foreground))]"
                      />
                      <span className="text-[10px] font-black uppercase text-[hsl(var(--muted-foreground))]">
                        Date de création
                      </span>
                    </div>
                    <span className="text-sm font-medium text-[hsl(var(--foreground))]">
                      {ticket.create_date
                        ? new Date(ticket.create_date + "Z").toLocaleString(
                            "fr-FR",
                            {
                              day: "2-digit",
                              month: "2-digit",
                              year: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            },
                          )
                        : "—"}
                    </span>
                  </div>
                </div>
              </div>

              {renderChainOfCommand()}

              <div className="p-4 rounded-xl border border-[hsl(var(--border)/0.5)] bg-[hsl(var(--card))]">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-xs font-black uppercase tracking-widest text-[hsl(var(--muted-foreground))] flex items-center gap-2">
                    <GitBranch size={13} /> Lifecycle
                  </h4>
                  <span className="text-[10px] text-[hsl(var(--muted-foreground))] italic">
                    Cliquez pour les détails
                  </span>
                </div>
                <VerticalTimeline
                  events={timelineData?.events ?? []}
                  loading={timelineLoading}
                  viewType={viewType}
                />
              </div>
              <div className="p-4 rounded-xl border border-[hsl(var(--border)/0.5)] bg-[hsl(var(--card))]">
                <h4 className="text-xs font-black uppercase tracking-widest text-[hsl(var(--muted-foreground))] flex items-center gap-2 mb-3">
                  <RefreshCw size={13} /> État actuel
                </h4>
                <div className="flex items-center gap-3">
                  <div className={`status-dot ${status.dotClass} w-3 h-3`} />
                  <span className="text-sm font-semibold">{status.label}</span>
                </div>
                {ticket.state === "waiting_material" &&
                  ticket.materials &&
                  ticket.materials.length > 0 && (
                    <div className="mt-3 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 text-xs font-medium flex items-start gap-2">
                      <Info size={14} className="flex-shrink-0 mt-0.5" />
                      <div>
                        Matériel attendu :{" "}
                        <strong>
                          {ticket.materials.find(
                            (m) => m.status === "requested",
                          )?.name || ticket.materials[0].name}
                        </strong>
                      </div>
                    </div>
                  )}
              </div>
              {ticket.sla_deadline && (
                <div className="p-4 rounded-xl border border-[hsl(var(--border)/0.5)] bg-[hsl(var(--card))]">
                  <h4 className="text-xs font-black uppercase tracking-widest text-[hsl(var(--muted-foreground))] flex items-center gap-2 mb-3">
                    <Clock size={13} /> Transparence SLA
                  </h4>
                  <div className="flex items-center justify-between">
                    <span
                      className={`text-xs font-bold px-2 py-1 rounded border ${slaInfo.bgClass}`}
                    >
                      {slaInfo.label}
                    </span>
                    <SlaCountdown
                      deadline={ticket.sla_deadline}
                      state={ticket.state}
                      dateResolved={ticket.date_resolved}
                    />
                  </div>
                  {(ticket.x_total_paused_duration || 0) > 0 && (
                    <div className="mt-3 p-3 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-600 dark:text-blue-400 text-xs font-medium flex items-start gap-2">
                      <PauseCircle size={14} className="flex-shrink-0 mt-0.5" />
                      <div>
                        Chrono ajusté :{" "}
                        <strong>
                          +
                          {((ticket.x_total_paused_duration ?? 0) * 60).toFixed(
                            0,
                          )}{" "}
                          min
                        </strong>{" "}
                        de pause matériel.
                      </div>
                    </div>
                  )}
                </div>
              )}
              <div className="pt-1">
                <h4 className="text-xs font-black uppercase tracking-widest text-[hsl(var(--muted-foreground))] flex items-center gap-2 mb-3 border-b border-[hsl(var(--border)/0.5)] pb-2">
                  <MessageCircle size={13} /> Derniers Échanges
                </h4>
                {commentsLoading ? (
                  <div className="flex justify-center py-4">
                    <Loader2
                      size={16}
                      className="animate-spin text-[hsl(var(--muted-foreground))]"
                    />
                  </div>
                ) : comments.length === 0 ? (
                  <div className="text-center py-4 text-xs text-[hsl(var(--muted-foreground))] italic">
                    Aucun message.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {comments.map((c, idx) => {
                      const isTech =
                        c.x_support_role === "tech" ||
                        c.x_support_role === "admin";
                      return (
                        <div
                          key={c.id}
                          className={`p-3 rounded-xl border ${isTech && idx === 0 ? "bg-[hsl(var(--primary)/0.05)] border-[hsl(var(--primary)/0.2)]" : "bg-[hsl(var(--card))] border-[hsl(var(--border)/0.5)]"}`}
                        >
                          <div className="flex justify-between items-center mb-1">
                            <span
                              className={`text-xs font-bold ${isTech ? "text-[hsl(var(--primary))]" : "text-[hsl(var(--foreground))]"}`}
                            >
                              {c.author_name}
                            </span>
                            <span className="text-[10px] text-[hsl(var(--muted-foreground))]">
                              {new Date(c.date).toLocaleDateString()}{" "}
                              {new Date(c.date).toLocaleTimeString([], {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </span>
                          </div>
                          <div
                            className="text-xs opacity-90 leading-relaxed"
                            dangerouslySetInnerHTML={{ __html: c.body }}
                          />
                        </div>
                      );
                    })}
                  </div>
                )}
                <form
                  onSubmit={handlePostComment}
                  className="flex gap-2 mt-3 items-start"
                >
                  <textarea
                    required
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    placeholder="Envoyer un message..."
                    disabled={postingComment}
                    className="input-field focus-ring resize-none w-full text-xs py-2 px-3 rounded-lg"
                    style={{ height: "40px" }}
                  />
                  <button
                    type="submit"
                    disabled={postingComment || !newComment.trim()}
                    className="btn-primary h-[40px] px-3 flex-shrink-0 disabled:opacity-50 flex items-center justify-center rounded-lg font-bold text-xs"
                  >
                    {postingComment ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      "Envoyer"
                    )}
                  </button>
                </form>
              </div>
            </div>
          )}

          {/* ══ VUE REPORT / COMPTE-RENDU ══ */}
          {viewType === "report" && (
            <div className="p-6 space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-[hsl(var(--muted-foreground))]">
                    Fiche de Clôture Officielle
                  </p>
                  <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5 font-mono">
                    Réf. {formatTicketRef(ticket.id)}
                  </p>
                </div>
                <button
                  onClick={() => {
                    const fmtDate = (d: string | null | undefined) => {
                      if (!d) return "—";
                      return new Date(
                        d.endsWith("Z") ? d : d + "Z",
                      ).toLocaleString("fr-FR", {
                        day: "2-digit",
                        month: "2-digit",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      });
                    };

                    // Compute SLA metrics
                    const parseDateSafe = (s: string | null | undefined) =>
                      s ? new Date(s.endsWith("Z") ? s : s + "Z").getTime() : 0;
                    const createdTs = parseDateSafe(ticket.create_date);
                    const resolvedTs = parseDateSafe(ticket.date_resolved);
                    const adjustedSlaTs = parseDateSafe(ticket.sla_deadline);
                    const pausedMin =
                      (ticket.x_total_paused_duration || 0) * 60;
                    const totalElapsedMin =
                      createdTs && resolvedTs
                        ? (resolvedTs - createdTs) / 60000
                        : 0;
                    const netMin = Math.max(0, totalElapsedMin - pausedMin);
                    const totalAllowedMin =
                      createdTs && adjustedSlaTs
                        ? (adjustedSlaTs - createdTs) / 60000
                        : 0;
                    const remainingMin =
                      adjustedSlaTs && resolvedTs
                        ? (adjustedSlaTs - resolvedTs) / 60000
                        : 0;
                    const perfPct =
                      totalAllowedMin > 0
                        ? Math.round((remainingMin / totalAllowedMin) * 100)
                        : null;
                    const isSlaOk = remainingMin >= 0;
                    const isActive =
                      ticket.state !== "resolved" && ticket.state !== "closed";
                    const formatDurMin = (mins: number, isNet = false) => {
                      if (isNet && isActive && mins <= 0) return "< 1 min";
                      if (mins > 0 && mins < 1) return "< 1 min";
                      if (mins <= 0) return "0 min";
                      const d = Math.floor(mins / 1440);
                      const h = Math.floor((mins % 1440) / 60);
                      const m = Math.floor(mins % 60);
                      return [
                        d > 0 ? `${d}j` : "",
                        h > 0 ? `${h}h` : "",
                        m > 0 ? `${m}min` : "",
                      ]
                        .filter(Boolean)
                        .join(" ");
                    };

                    const prioMap: Record<string, string> = {
                      "0": "Basse",
                      "1": "Moyenne",
                      "2": "Haute",
                      "3": "Critique",
                    };
                    const prioLabel = ticket.priority
                      ? prioMap[ticket.priority] || ticket.priority
                      : "—";

                    const mats = ticket.materials || [];
                    const matsRows =
                      mats.length > 0
                        ? mats
                            .map(
                              (m) =>
                                `<tr><td>${m.name}</td><td class="center">${m.status === "ready" ? "Disponible" : m.status || "—"}</td><td class="right mono">${(m.unit_cost || 0).toFixed(2)} MAD</td></tr>`,
                            )
                            .join("")
                        : `<tr><td colspan="3" class="center muted">Aucun matériel utilisé</td></tr>`;
                    const totalCost = (ticket.total_material_cost || 0).toFixed(
                      2,
                    );

                    const ref = formatTicketRef(ticket.id);
                    const now = new Date().toLocaleString("fr-FR", {
                      day: "2-digit",
                      month: "2-digit",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    });

                    const resText =
                      ticket.resolution || "Aucune note de résolution fournie.";
                    const formattedRes =
                      resText.charAt(0).toUpperCase() + resText.slice(1);

                    const html = `<!DOCTYPE html>
<html lang="fr"><head>
<meta charset="utf-8"/>
<title>Compte-rendu ${ref}</title>
<style>
  @page { size: A4; margin: 20mm; }
  @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 11px; color: #1a1a1a; background: #fff; }
  
  /* HEADER */
  .header { text-align: center; padding-bottom: 14px; border-bottom: 2px solid #1a1a1a; margin-bottom: 20px; }
  .header-title { font-size: 18px; font-weight: 900; letter-spacing: 0.05em; text-transform: uppercase; }
  .header-ref { font-size: 12px; color: #555; margin-top: 4px; }
  .header-meta { font-size: 10px; color: #888; margin-top: 2px; }
  
  /* SECTIONS */
  .section { margin-bottom: 14px; border: 1px solid #e0e0e0; border-radius: 6px; overflow: hidden; }
  .section-title { background: #f5f5f5; padding: 7px 12px; font-size: 9px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.12em; color: #555; border-bottom: 1px solid #e0e0e0; }
  .section-body { padding: 12px; }
  
  /* GRID */
  .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
  .grid-4 { display: grid; grid-template-columns: 1fr 1fr 1fr 1fr; gap: 10px; }
  .field-label { font-size: 8.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: #888; margin-bottom: 3px; }
  .field-value { font-size: 11px; font-weight: 600; color: #1a1a1a; }
  
  /* TABLE */
  table { width: 100%; border-collapse: collapse; }
  th { text-align: left; font-size: 9px; text-transform: uppercase; color: #777; padding: 6px 8px; border-bottom: 1.5px solid #ddd; font-weight: 700; letter-spacing: 0.08em; }
  td { padding: 7px 8px; font-size: 11px; border-bottom: 1px solid #f0f0f0; }
  tr:last-child td { border-bottom: none; }
  .center { text-align: center; }
  .right { text-align: right; }
  .mono { font-family: monospace; }
  .muted { color: #999; font-style: italic; }
  .total-row td { font-weight: 900; font-size: 12px; background: #f9f9f9; padding: 8px; border-top: 2px solid #ddd; }
  .total-amount { color: #059669; }
  
  /* BADGES */
  .badge { display: inline-block; padding: 2px 10px; border-radius: 20px; font-size: 9.5px; font-weight: 700; }
  .badge-ok { background: #d1fae5; color: #064e3b; border: 1px solid #6ee7b7; font-weight: 900; }
  .badge-bad { background: #fee2e2; color: #991b1b; border: 1px solid #fca5a5; }
  .badge-pri { background: #ede9fe; color: #5b21b6; border: 1px solid #c4b5fd; }
  
  /* SLA GRID */
  .sla-kpi { background: #f9f9f9; border: 1px solid #e5e5e5; border-radius: 5px; padding: 8px 10px; }
  .sla-kpi-val { font-size: 15px; font-weight: 900; color: #1a1a1a; margin-top: 3px; }
  .sla-kpi-val.ok { color: #059669; }
  .sla-kpi-val.sky { color: #0284c7; }
  
  /* RESOLUTION */
  .resolution-box { background: #f9fafb; border-left: 3px solid #6366f1; padding: 10px 14px; border-radius: 4px; font-style: italic; line-height: 1.6; }
  
  /* FOOTER */
  .footer { margin-top: 16px; padding-top: 10px; border-top: 1px solid #e0e0e0; display: flex; justify-content: space-between; font-size: 9px; color: #aaa; }
</style>
</head><body>

<!-- HEADER -->
<div class="header">
  <div class="header-title">Compte-rendu d&apos;intervention IT</div>
  <div class="header-ref">Ticket ${ref}</div>
  <div class="header-meta">Généré le ${now}</div>
</div>

<!-- BLOC 1: INFORMATIONS GÉNÉRALES -->
<div class="section">
  <div class="section-title">Informations Générales</div>
  <div class="section-body">
    <div class="grid-4">
      <div>
        <div class="field-label">Demandeur</div>
        <div class="field-value">${(ticket as any).user_name || "—"}</div>
      </div>
      <div style="grid-column: span 2">
        <div class="field-label">Sujet</div>
        <div class="field-value">${ticket.name}</div>
      </div>
      <div>
        <div class="field-label">Catégorie</div>
        <div class="field-value">${ticket.category || "—"}</div>
      </div>
    </div>
    <div style="margin-top:10px">
      <div class="field-label">Priorité</div>
      <span class="badge badge-pri">${prioLabel}</span>
    </div>
  </div>
</div>

<!-- BLOC 2: CHRONOLOGIE & SLA -->
<div class="section">
  <div class="section-title">Chronologie &amp; Conformité SLA</div>
  <div class="section-body">
    <div class="grid-2" style="margin-bottom:12px">
      <div>
        <div class="field-label">Date de création</div>
        <div class="field-value">${fmtDate(ticket.create_date)}</div>
      </div>
      <div>
        <div class="field-label">Date de résolution</div>
        <div class="field-value">${fmtDate(ticket.date_resolved)}</div>
      </div>
    </div>
    <div class="grid-4">
      <div class="sla-kpi">
        <div class="field-label">Temps total</div>
        <div class="sla-kpi-val">${formatDurMin(totalElapsedMin)}</div>
      </div>
      <div class="sla-kpi">
        <div class="field-label">Temps suspendu</div>
        <div class="sla-kpi-val sky">+${formatDurMin(pausedMin)}</div>
      </div>
      <div class="sla-kpi">
        <div class="field-label">Temps net</div>
        <div class="sla-kpi-val">${formatDurMin(netMin, true)}</div>
      </div>
      <div class="sla-kpi">
        <div class="field-label">Score performance</div>
        <div class="sla-kpi-val ${isSlaOk ? "ok" : ""}">${perfPct !== null ? `${perfPct}%` : "—"}</div>
      </div>
    </div>
    <div style="margin-top:12px;text-align:center">
      <span class="badge ${isSlaOk ? "badge-ok" : "badge-bad"}" style="font-size:11px;padding:5px 20px">${isSlaOk ? "Objectif SLA Atteint" : "Objectif SLA Non Atteint"}</span>
    </div>
  </div>
</div>

<!-- BLOC 3: RESSOURCES UTILISÉES -->
<div class="section">
  <div class="section-title">Ressources Utilisées (Facture Interne)</div>
  <div class="section-body" style="padding:0">
    <table>
      <thead><tr><th>Matériel</th><th class="center">Statut</th><th class="right">Coût</th></tr></thead>
      <tbody>${matsRows}</tbody>
    </table>
    <table>
      <tbody>
        <tr class="total-row">
          <td colspan="2">Total (Facture Interne)</td>
          <td class="right total-amount">${totalCost} MAD</td>
        </tr>
      </tbody>
    </table>
  </div>
</div>

<!-- BLOC 4: RÉSOLUTION FINALE -->
<div class="section">
  <div class="section-title">Résolution Finale</div>
  <div class="section-body">
    <div style="margin-bottom:10px">
      <div class="field-label">Intervention réalisée par :</div>
      <div class="field-value">${ticket.assigned_to || "—"}</div>
    </div>
    <div class="resolution-box">${formattedRes}</div>
  </div>
</div>

<!-- FOOTER -->
<div class="footer">
  <span>PFE IT Support — Document généré automatiquement</span>
  <span>${ref} · ${now}</span>
</div>

<script>window.onload = () => { document.title = "Compte-rendu ${ref}"; window.print(); }</script>
</body></html>`;

                    const w = window.open("", "_blank");
                    if (!w) return;
                    w.document.write(html);
                    w.document.close();
                  }}
                  className="flex items-center gap-2 h-9 px-4 rounded-xl text-xs font-bold bg-[hsl(var(--primary))] text-white hover:bg-[hsl(var(--primary)/0.85)] shadow-md transition-all"
                >
                  <Printer size={14} /> Télécharger le rapport (PDF)
                </button>
              </div>

              {/* APERÇU DE LA DEMANDE */}
              <div className="p-5 bg-[hsl(var(--secondary)/0.1)] border border-[hsl(var(--border)/0.5)] rounded-xl mt-6 mb-6">
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center gap-1.5">
                    <FileText
                      size={16}
                      className="text-[hsl(var(--muted-foreground))]"
                    />
                    <span className="text-[10px] font-black uppercase text-[hsl(var(--muted-foreground))]">
                      Sujet
                    </span>
                  </div>
                  <span className="text-base md:text-lg font-bold text-[hsl(var(--foreground))] leading-tight whitespace-normal">
                    {ticket.name}
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-8 mt-4 pt-4 border-t border-[hsl(var(--border)/0.4)]">
                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-center gap-1.5">
                      <User
                        size={14}
                        className="text-[hsl(var(--muted-foreground))]"
                      />
                      <span className="text-[10px] font-black uppercase text-[hsl(var(--muted-foreground))]">
                        Auteur
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-5 h-5 rounded-full bg-[hsl(var(--primary)/0.15)] text-[hsl(var(--primary))] flex items-center justify-center font-bold text-[10px] uppercase shadow-sm">
                        {((ticket as any).user_name || "Utilisateur").substring(
                          0,
                          2,
                        )}
                      </div>
                      <span className="text-sm font-medium">
                        {(ticket as any).user_name || "Utilisateur"}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-center gap-1.5">
                      <CalendarDays
                        size={14}
                        className="text-[hsl(var(--muted-foreground))]"
                      />
                      <span className="text-[10px] font-black uppercase text-[hsl(var(--muted-foreground))]">
                        Date de création
                      </span>
                    </div>
                    <span className="text-sm font-medium text-[hsl(var(--foreground))]">
                      {ticket.create_date
                        ? new Date(ticket.create_date + "Z").toLocaleString(
                            "fr-FR",
                            {
                              day: "2-digit",
                              month: "2-digit",
                              year: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            },
                          )
                        : "—"}
                    </span>
                  </div>
                </div>
              </div>

              {renderChainOfCommand()}

              <div className="p-4 rounded-xl border border-[hsl(var(--border)/0.5)] bg-[hsl(var(--card))]">
                <h4 className="text-xs font-black uppercase tracking-widest text-[hsl(var(--muted-foreground))] flex items-center gap-2 mb-3">
                  <FileText size={13} /> Note de résolution
                </h4>
                <div className="flex items-start gap-3">
                  <div
                    className={`status-dot ${status.dotClass} w-3 h-3 mt-1 flex-shrink-0`}
                  />
                  <span className="text-sm font-semibold leading-relaxed">
                    {ticket.resolution || "Aucune note de résolution fournie."}
                  </span>
                </div>
              </div>

              <div className="p-4 rounded-xl border border-emerald-500/20 bg-emerald-500/5">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-xs font-black uppercase tracking-widest text-emerald-600 dark:text-emerald-400 flex items-center gap-2">
                    <Package size={13} /> Facture Interne
                  </h4>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-full">
                    VALIDÉ
                  </span>
                </div>
                {ticket.materials && ticket.materials.length > 0 ? (
                  <div className="space-y-2">
                    <div className="grid grid-cols-3 gap-1 text-[10px] font-bold uppercase tracking-wide text-[hsl(var(--muted-foreground))] px-2 pb-1 border-b border-[hsl(var(--border)/0.5)]">
                      <span>Matériel</span>
                      <span className="text-center">Statut</span>
                      <span className="text-right">Coût</span>
                    </div>
                    {ticket.materials.map((m) => (
                      <div
                        key={m.id}
                        className="grid grid-cols-3 gap-1 items-center bg-[hsl(var(--muted)/0.3)] px-3 py-2 rounded-lg border border-[hsl(var(--border)/0.5)]"
                      >
                        <div className="flex items-center gap-2 text-xs font-semibold">
                          <Cpu
                            size={11}
                            className="text-[hsl(var(--primary))]"
                          />
                          {m.name}
                        </div>
                        <span className="text-center text-[10px] font-bold text-emerald-500 bg-emerald-500/10 px-1.5 py-0.5 rounded-full w-fit mx-auto">
                          {m.status}
                        </span>
                        <span className="text-right text-xs font-mono font-bold">
                          {(m.unit_cost || 0).toFixed(2)} MAD
                        </span>
                      </div>
                    ))}
                    <div className="flex items-center justify-between border-t border-[hsl(var(--border)/0.5)] pt-3 mt-1">
                      <div className="flex items-center gap-2 font-bold text-sm">
                        <Wallet size={16} className="text-emerald-500" />
                        Total (Facture Interne)
                      </div>
                      <span className="font-mono text-lg font-black text-emerald-500">
                        {(ticket.total_material_cost || 0).toFixed(2)} MAD
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="text-xs text-[hsl(var(--muted-foreground))] italic text-center py-4">
                    Aucun matériel utilisé.
                  </div>
                )}
              </div>

              <div className="p-4 rounded-xl border border-[hsl(var(--border)/0.5)] bg-[hsl(var(--card))]">
                <h4 className="text-xs font-black uppercase tracking-widest text-[hsl(var(--muted-foreground))] flex items-center gap-2 mb-4">
                  <ShieldCheck size={13} /> Conformité SLA
                </h4>
                {(() => {
                  const parseDateSafe = (dStr: string | null | undefined) => {
                    if (!dStr) return 0;
                    return new Date(
                      dStr.endsWith("Z") ? dStr : dStr + "Z",
                    ).getTime();
                  };

                  const createdDate = parseDateSafe(ticket.create_date);
                  const endDate =
                    (ticket.state === "resolved" ||
                      ticket.state === "closed") &&
                    ticket.date_resolved
                      ? parseDateSafe(ticket.date_resolved)
                      : Date.now();

                  const initialSlaStr =
                    timelineData?.sla_deadline_initial ||
                    (ticket as any).sla_deadline_initial;
                  const adjustedSlaStr =
                    timelineData?.sla_deadline_adjusted || ticket.sla_deadline;

                  const initialSlaDate = parseDateSafe(initialSlaStr);
                  const adjustedSlaDate = parseDateSafe(adjustedSlaStr);

                  let totalElapsedMinutes = 0;
                  if (createdDate && endDate) {
                    // Unité unique : secondes → conversion finale en minutes
                    const totalElapsedSeconds = (endDate - createdDate) / 1000;
                    totalElapsedMinutes = totalElapsedSeconds / 60;
                  }

                  // actual_paused_hours = vraie durée de pause (sans les bonus d'escalade artificielle)
                  // total_paused_hours = durée SLA ajustée (inclut les bonus → NE PAS afficher)
                  const actualPausedHoursRaw =
                    timelineData?.actual_paused_hours ??
                    ticket.x_actual_paused_duration ??
                    null;

                  // Si le nouveau champ est disponible, on l'utilise directement.
                  // Sinon on fallback sur l'ancien champ en loggant un avertissement.
                  let pausedMinutes: number;
                  if (actualPausedHoursRaw !== null) {
                    pausedMinutes = actualPausedHoursRaw * 60;
                  } else {
                    const pausedHoursRaw =
                      timelineData?.total_paused_hours ??
                      ticket.x_total_paused_duration ??
                      0;
                    pausedMinutes = pausedHoursRaw * 60;
                    if (pausedMinutes > totalElapsedMinutes && totalElapsedMinutes > 0) {
                      console.warn(
                        `[SLA] actual_paused_hours non disponible. Utilisation de total_paused_hours ` +
                        `(${pausedMinutes.toFixed(1)} min) qui peut inclure des bonus d'escalade. ` +
                        `Temps total : ${totalElapsedMinutes.toFixed(1)} min.`
                      );
                    }
                    pausedMinutes = Math.min(pausedMinutes, totalElapsedMinutes);
                  }

                  const netMinutes = Math.max(0, totalElapsedMinutes - pausedMinutes);


                  // Temps total imparti = Deadline Ajustée - Create Date
                  let totalAllowedMinutes = 0;
                  if (createdDate && adjustedSlaDate) {
                    totalAllowedMinutes =
                      (adjustedSlaDate - createdDate) / 60000;
                  }

                  let remainingMinutes = 0;
                  if (adjustedSlaDate && endDate) {
                    remainingMinutes = (adjustedSlaDate - endDate) / 60000;
                  }

                  let perfScore = "—";
                  let isPerfPositive = false;

                  if (totalAllowedMinutes > 0) {
                    const percent =
                      (remainingMinutes / totalAllowedMinutes) * 100;
                    if (percent >= 0) {
                      perfScore = `${Math.round(percent)}%`;
                      isPerfPositive = true;
                    } else {
                      perfScore = `${Math.abs(Math.round(percent))}% Dépassé`;
                      isPerfPositive = false;
                    }
                  }

                  const isActive =
                    ticket.state !== "resolved" && ticket.state !== "closed";
                  const formatDur = (
                    mins: number,
                    isNetTime: boolean = false,
                  ) => {
                    if (isNetTime && isActive && mins <= 0) return "< 1 min";
                    if (mins > 0 && mins < 1) return "< 1 min";
                    if (mins <= 0) return "0 min";
                    const d = Math.floor(mins / 1440);
                    const h = Math.floor((mins % 1440) / 60);
                    const m = Math.floor(mins % 60);
                    let r = "";
                    if (d > 0) r += `${d}j `;
                    if (h > 0) r += `${h}h `;
                    if (m > 0 || r === "") r += `${m}min`;
                    return r.trim();
                  };

                  const formatDate24h = (dateStr: string) => {
                    const d = new Date(
                      dateStr.endsWith("Z") ? dateStr : dateStr + "Z",
                    );
                    return (
                      d.toLocaleDateString("fr-FR", {
                        day: "2-digit",
                        month: "2-digit",
                        year: "numeric",
                      }) +
                      " " +
                      d.toLocaleTimeString("fr-FR", {
                        hour: "2-digit",
                        minute: "2-digit",
                        second: "2-digit",
                        hour12: false,
                      })
                    );
                  };

                  const isSlaSuccess = remainingMinutes >= 0;
                  const verdictText =
                    ticket.state === "resolved" || ticket.state === "closed"
                      ? isSlaSuccess
                        ? "Objectif SLA Atteint"
                        : "Objectif SLA Non Atteint"
                      : isSlaSuccess
                        ? "Dans les Temps"
                        : "Objectif SLA Dépassé";

                  return (
                    <div className="space-y-4">
                      {/* Dates */}
                      <div className="flex items-center gap-3">
                        <div className="flex-1 p-3 bg-[hsl(var(--secondary)/0.03)] border border-[hsl(var(--border)/0.5)] rounded-lg">
                          <p className="text-[9px] font-bold uppercase tracking-widest text-[hsl(var(--muted-foreground))] mb-1">
                            Deadline Initiale
                          </p>
                          <p className="text-xs font-semibold text-[hsl(var(--foreground))]">
                            {initialSlaStr ? formatDate24h(initialSlaStr) : "—"}
                          </p>
                        </div>
                        <div className="flex-1 p-3 bg-blue-500/5 border border-blue-500/20 rounded-lg">
                          <p className="text-[9px] font-bold uppercase tracking-widest text-blue-500 mb-1">
                            Deadline Ajustée
                          </p>
                          <p className="text-xs font-semibold text-blue-400">
                            {adjustedSlaStr
                              ? formatDate24h(adjustedSlaStr)
                              : "—"}
                          </p>
                        </div>
                      </div>

                      {/* Grid 2x2 */}
                      <div className="grid grid-cols-2 gap-3">
                        <div className="p-3 bg-[hsl(var(--secondary)/0.03)] border border-[hsl(var(--border)/0.5)] rounded-lg">
                          <div className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-widest text-[hsl(var(--muted-foreground))] mb-1.5">
                            <Clock size={12} /> Temps Total Écoulé
                          </div>
                          <div className="text-sm font-black text-[hsl(var(--foreground))]">
                            {formatDur(totalElapsedMinutes)}
                          </div>
                        </div>
                        <div className="p-3 bg-sky-500/5 border border-sky-500/20 rounded-lg">
                          <div className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-widest text-sky-500 mb-1.5">
                            <History size={12} /> Temps Suspendu
                          </div>
                          <div className="text-sm font-black text-sky-500">
                            +{formatDur(pausedMinutes)}
                          </div>
                        </div>
                        <div className="p-3 bg-[hsl(var(--secondary)/0.03)] border border-[hsl(var(--border)/0.5)] rounded-lg">
                          <div className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-widest text-[hsl(var(--muted-foreground))] mb-1.5">
                            <Timer size={12} /> Temps Net
                          </div>
                          <div className="text-sm font-black text-[hsl(var(--foreground))]">
                            {formatDur(netMinutes, true)}
                          </div>
                        </div>
                        <div className="p-3 bg-[hsl(var(--secondary)/0.03)] border border-[hsl(var(--border)/0.5)] rounded-lg">
                          <div className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-widest text-[hsl(var(--muted-foreground))] mb-1.5">
                            <Target size={12} /> Performance
                          </div>
                          <div
                            className={`text-sm font-black ${perfScore === "—" ? "text-[hsl(var(--muted-foreground))]" : isPerfPositive ? "text-emerald-500" : "text-rose-500"}`}
                          >
                            {perfScore}
                          </div>
                        </div>
                      </div>

                      {/* Verdict */}
                      <div
                        className={`w-full py-3 rounded-xl flex items-center justify-center font-black uppercase tracking-widest text-[11px] border ${isSlaSuccess ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" : "bg-rose-500/10 text-rose-500 border-rose-500/20"}`}
                      >
                        {verdictText}
                      </div>
                    </div>
                  );
                })()}
              </div>

              <div className="p-4 rounded-xl border border-[hsl(var(--border)/0.5)] bg-[hsl(var(--card))]">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-xs font-black uppercase tracking-widest text-[hsl(var(--muted-foreground))] flex items-center gap-2">
                    <CalendarDays size={13} /> Synthèse de l&apos;intervention
                  </h4>
                  <span className="text-[10px] text-[hsl(var(--muted-foreground))] italic">
                    Cliquez pour les détails
                  </span>
                </div>
                <VerticalTimeline
                  events={timelineData?.events ?? []}
                  loading={timelineLoading}
                  viewType={viewType}
                  ticket={{
                    date_resolved: ticket.date_resolved,
                    assigned_to: ticket.assigned_to,
                    resolution: ticket.resolution,
                  }}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
