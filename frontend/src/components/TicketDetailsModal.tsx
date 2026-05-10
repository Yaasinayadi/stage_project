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
  // SLA v2
  sla_response_deadline?: string | null;
  sla_response_status?: string | null;
  date_first_assigned?: string | null;
  date_escalated?: string | null;
  escalation_sla_bonus_hours?: number;
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

  const isResolved = state === "resolved" || state === "closed" || dateResolved != null;
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
          Temps consommé : {consumedH}h {consumedM.toString().padStart(2, "0")}min
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
    msg.includes("reprise") ||
    msg.includes("prise en charge") ||
    evt.type === "acceptance" ||
    msg.includes("cours")
  ) {
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
    .replace(/[*✅❌⚠️🔄📦⏰]/g, "")
    .replace(/TICKET RÉSOLU\s*:/gi, "")
    .replace(/Pause SLA\s*—\s*/gi, "");

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
      /mise en pause\s*[—-]\s*attente client/gi,
      "Mise en pause — Attente client",
    ],
    [
      /mise en pause\s*[—-]\s*attente mat[eé]riel/gi,
      "Mise en pause — Attente matériel",
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
    // Fusionner assignation + changement de statut "Assigné" dans la même minute
    if (
      diff < 60000 &&
      ((last.type === "assignment" && evt.type === "status_change") ||
        (last.type === "status_change" && evt.type === "assignment"))
    ) {
      // Garder l'événement d'assignation comme référence, enrichir le message
      const assign = last.type === "assignment" ? last : evt;
      out[out.length - 1] = {
        ...assign,
        detail: { ...last.detail, ...evt.detail },
      };
      continue;
    }
    // Dédupliquer les événements identiques dans la même minute
    if (diff < 60000 && last.type === evt.type && last.message === evt.message)
      continue;
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
  };
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [showDetail, setShowDetail] = useState(false); // for report view toggle

  const processedEvents = useMemo(() => {
    if (!events || events.length === 0) return [];

    // 1. Clean + humanize messages
    let filtered: TimelineEvent[] = events.map((e) => ({
      ...e,
      message: humanizeMessage(e.message, e.type),
    }));

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
      // quand un événement humain existe dans la même fenêtre de 5s.
      // L'événement humain (waiting/escalation/acceptance) a l'auteur réel.
      if (e.type === "status_change") {
        const humanShadow = arr.find(
          (a) =>
            a.id !== e.id &&
            ["waiting", "escalation", "acceptance", "resolved"].includes(
              a.type,
            ) &&
            Math.abs(new Date(a.date).getTime() - new Date(e.date).getTime()) <
              5000,
        );
        if (humanShadow) return false;
      }

      return true;
    });

    // 3. Semantic grouping: merge events in the same minute
    filtered = mergeByMinute(filtered);

    // 4. Compute durations (only show if > 59s)
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

    // ── Group events within 10s for Report View ──
    const groupedForReport: TimelineEvent[] = [];
    for (const evt of processedEvents) {
      const last = groupedForReport[groupedForReport.length - 1];
      if (last) {
        const diff = Math.abs(
          new Date(evt.date).getTime() - new Date(last.date).getTime(),
        );
        if (diff <= 10000) {
          // Priority to human actions (like waiting/comment/acceptance) over automated status_change
          const isLastTech = last.type === "status_change";
          const isEvtHuman =
            evt.type === "waiting" ||
            evt.type === "comment" ||
            evt.type === "acceptance" ||
            evt.message.toLowerCase().includes("pause") ||
            evt.message.toLowerCase().includes("attente");
          if (isLastTech && isEvtHuman) {
            groupedForReport[groupedForReport.length - 1] = {
              ...evt,
              date: last.date,
            };
          }
          continue; // skip duplicate/secondary event
        }
      }
      groupedForReport.push(evt);
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
        // eslint-disable-next-line
        : Date.now();
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

    // 1. Assignation
    const evtAssign = groupedForReport.find((e) => e.type === "assignment");
    if (evtAssign) {
      addIntermediate(
        "assign",
        evtAssign.id,
        evtAssign.date,
        <MRow
          bgClass="bg-indigo-500/15"
          icon={<UserPlus size={14} className="text-indigo-500" />}
          label="Assignation"
          author={evtAssign.author}
          date={evtAssign.date}
          durationFromPrev={null}
        />,
      );
    }

    // 2. Début des travaux (Prise en charge / Acceptance)
    const evtStart = groupedForReport.find(
      (e) =>
        e.type === "acceptance" ||
        (e.type === "status_change" &&
          (e.message.toLowerCase().includes("prise en charge") ||
            e.message.toLowerCase().includes("cours"))),
    );
    if (evtStart) {
      addIntermediate(
        "start",
        evtStart.id,
        evtStart.date,
        <MRow
          bgClass="bg-sky-500/15"
          icon={<PlayCircle size={14} className="text-sky-500" />}
          label={
            evtStart.type === "acceptance"
              ? "Mission acceptée"
              : "Prise en charge"
          }
          author={evtStart.author}
          date={evtStart.date}
          durationFromPrev={null}
        />,
      );
    }

    // 3. Pauses logistiques (toutes variantes)
    pauseIntervals.forEach((interval, i) => {
      const note = interval.resume
        ? `Durée : ${fmtSec(interval.durationSec)}`
        : "Pause toujours en cours";

      addIntermediate(
        `pause_${i}`,
        interval.pause.id,
        interval.pause.date,
        <MRow
          bgClass="bg-amber-500/15"
          icon={<PauseCircle size={14} className="text-amber-500" />}
          label={`Mise en pause \u2014 ${interval.pauseKind}`}
          author={interval.pause.author}
          date={interval.pause.date}
          note={note}
          durationFromPrev={null}
        />,
      );

      if (interval.resume) {
        addIntermediate(
          `resume_${i}`,
          interval.resume.id,
          interval.resume.date,
          <MRow
            bgClass="bg-sky-500/15"
            icon={<PlayCircle size={14} className="text-sky-500" />}
            label="Reprise de l'intervention"
            author={interval.resume.author}
            date={interval.resume.date}
            durationFromPrev={null}
          />,
        );
      }
    });

    // 4. Escalade comme milestone
    const evtEscalation = groupedForReport.find((e) => e.type === "escalation");
    if (evtEscalation) {
      const newTech = evtEscalation.detail?.nouveau_technicien;
      addIntermediate(
        "escalation",
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
    }

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
          <div className="space-y-1">
            {/* ── Always visible: Ouverture ── */}
            <MRow
              bgClass="bg-blue-500/15"
              icon={<Flag size={14} className="text-blue-500" />}
              label="Ouverture du ticket"
              author={evtCreation?.author}
              date={evtCreation?.date ?? null}
            />

            {/* ── Toggle button ── */}
            {intermediates.length > 0 && (
              <div className="pl-7 py-1">
                <button
                  onClick={() => setShowDetail((v) => !v)}
                  className="flex items-center gap-2 text-xs font-semibold text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] border border-[hsl(var(--border)/0.5)] hover:border-[hsl(var(--border))] rounded-lg px-3 py-1.5 transition-all duration-200"
                >
                  <History size={13} />
                  {showDetail
                    ? "Masquer le parcours"
                    : "Afficher le parcours détaillé"}
                  <span className="inline-flex items-center justify-center h-4 min-w-4 px-1 rounded-full bg-[hsl(var(--muted)/0.4)] text-[10px] font-bold">
                    {intermediates.length}
                  </span>
                  {showDetail ? (
                    <ChevronUp size={11} />
                  ) : (
                    <ChevronDown size={11} />
                  )}
                </button>
              </div>
            )}

            {/* ── Intermediate milestones (animated) ── */}
            <AnimatePresence initial={false}>
              {showDetail &&
                intermediates.map((m) => (
                  <motion.div
                    key={m.id}
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.22 }}
                    className="overflow-hidden"
                  >
                    {m.node}
                  </motion.div>
                ))}
            </AnimatePresence>

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
                    const w = window.open("", "_blank", "width=800,height=900");
                    if (!w) return;
                    const mats =
                      (ticket.materials || [])
                        .map(
                          (m) =>
                            `<tr><td>${m.name}</td><td style="text-align:center">${m.status}</td><td style="text-align:right;font-family:monospace">${(m.unit_cost || 0).toFixed(2)}</td></tr>`,
                        )
                        .join("") ||
                      `<tr><td colspan="3" style="text-align:center;color:#888">Aucun matériel</td></tr>`;
                    const slaAdj =
                      (ticket.x_total_paused_duration || 0) > 0
                        ? `<p>Deadline ajustée : <strong>${ticket.sla_deadline ? new Date(ticket.sla_deadline + "Z").toLocaleString("fr-FR") : "—"}</strong> <em>(+${((ticket.x_total_paused_duration ?? 0) * 60).toFixed(0)} min de pause)</em></p>`
                        : "";
                    w.document.write(
                      `<!DOCTYPE html><html><head><title>Rapport ${formatTicketRef(ticket.id)}</title><style>body{font-family:system-ui,sans-serif;padding:40px;color:#111;background:#fff}h1{font-size:22px;font-weight:900;margin:0 0 4px}.ref{font-size:13px;color:#555;margin-bottom:24px}.section{margin-bottom:20px;border:1px solid #e5e7eb;border-radius:8px;padding:16px}.section h2{font-size:11px;text-transform:uppercase;letter-spacing:.1em;color:#888;margin:0 0 12px;font-weight:700}table{width:100%;border-collapse:collapse}th{text-align:left;font-size:10px;text-transform:uppercase;color:#888;padding:6px 8px;border-bottom:1px solid #e5e7eb}td{padding:8px;font-size:12px;border-bottom:1px solid #f3f4f6}.total{font-weight:900;font-size:15px;color:#059669}.badge-ok{background:#d1fae5;color:#065f46;padding:3px 10px;border-radius:20px;font-weight:700;font-size:11px}.badge-bad{background:#fee2e2;color:#991b1b;padding:3px 10px;border-radius:20px;font-weight:700;font-size:11px}</style></head><body><h1>Fiche de Clôture — PFE IT Support</h1><div class="ref">Réf. ${formatTicketRef(ticket.id)} · ${ticket.category || "—"} · Priorité ${ticket.priority}</div><div class="section"><h2>Aperçu de la Demande</h2><table style="margin-bottom:0"><tr><td style="border:none;padding:0 0 8px 0;width:33%"><strong>Sujet :</strong><br/>${ticket.name}</td><td style="border:none;padding:0 0 8px 0;width:33%"><strong>Date de création :</strong><br/>${ticket.create_date ? new Date(ticket.create_date + "Z").toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—"}</td><td style="border:none;padding:0 0 8px 0;width:33%"><strong>Auteur :</strong><br/>${(ticket as any).user_name || "Utilisateur"}</td></tr></table></div><div class="section"><h2>Note de Résolution</h2><p style="font-style:italic">${ticket.resolution || "Aucune note."}</p></div><div class="section"><h2>Ressources Utilisées</h2><table><thead><tr><th>Matériel</th><th style="text-align:center">Statut</th><th style="text-align:right">Coût (MAD)</th></tr></thead><tbody>${mats}</tbody></table><div style="text-align:right;margin-top:12px">Total : <span class="total">${(ticket.total_material_cost || 0).toFixed(2)} MAD</span></div></div><div class="section"><h2>Conformité SLA</h2><p>Deadline initiale : <strong>${ticket.sla_deadline_initial ? new Date(ticket.sla_deadline_initial + "Z").toLocaleString("fr-FR") : "—"}</strong></p>${slaAdj}<p>Statut : <span class="${ticket.sla_status === "on_track" ? "badge-ok" : "badge-bad"}">${ticket.sla_status === "on_track" ? "SLA Respecté" : "SLA Dépassé"}</span></p></div><div class="section"><h2>Dates Clés</h2><p>Créé : ${ticket.create_date ? new Date(ticket.create_date + "Z").toLocaleString("fr-FR") : "—"}</p><p>Résolu : ${ticket.date_resolved ? new Date(ticket.date_resolved + "Z").toLocaleString("fr-FR") : "—"}</p><p>Technicien : ${ticket.assigned_to || "—"}</p></div><script>window.onload=()=>window.print()</script></body></html>`,
                    );
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
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 rounded-lg bg-[hsl(var(--muted)/0.2)] border border-[hsl(var(--border)/0.5)]">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
                        Deadline Initiale
                      </p>
                      <p className="text-xs font-semibold mt-0.5">
                        {ticket.sla_deadline_initial
                          ? formatFullDate(ticket.sla_deadline_initial)
                          : "—"}
                      </p>
                    </div>
                    <span className="text-[10px] text-[hsl(var(--muted-foreground))] italic">
                      Sans pauses
                    </span>
                  </div>
                  {(ticket.x_total_paused_duration || 0) > 0 && (
                    <>
                      <div className="flex items-center gap-2 justify-center">
                        <div className="flex-1 h-px border-t border-dashed border-blue-500/40" />
                        <span className="text-[10px] font-bold text-blue-500 bg-blue-500/10 border border-blue-500/20 px-2 py-0.5 rounded-full flex items-center gap-1">
                          <PauseCircle size={9} /> +
                          {((ticket.x_total_paused_duration ?? 0) * 60).toFixed(
                            0,
                          )}{" "}
                          min pause matériel
                        </span>
                        <div className="flex-1 h-px border-t border-dashed border-blue-500/40" />
                      </div>
                      <div className="flex items-center justify-between p-3 rounded-lg bg-blue-500/5 border border-blue-500/20">
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-wide text-blue-500">
                            Deadline Ajustée
                          </p>
                          <p className="text-xs font-semibold mt-0.5">
                            {ticket.sla_deadline
                              ? formatFullDate(ticket.sla_deadline)
                              : "—"}
                          </p>
                        </div>
                        <span className="text-[10px] text-blue-500 italic">
                          Après pauses
                        </span>
                      </div>
                    </>
                  )}
                  <div className="flex justify-center pt-1">
                    {ticket.sla_status === "on_track" ? (
                      <div className="flex items-center gap-2 bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 px-5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider">
                        <ShieldCheck size={16} /> SLA Respecté
                      </div>
                    ) : ticket.sla_status === "breached" ? (
                      <div className="flex items-center gap-2 bg-red-500/10 text-red-500 border border-red-500/20 px-5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider">
                        <ShieldX size={16} /> SLA Dépassé
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))] px-5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider">
                        <ShieldAlert size={16} /> Non calculé
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="p-4 rounded-xl border border-[hsl(var(--border)/0.5)] bg-[hsl(var(--card))]">
                <h4 className="text-xs font-black uppercase tracking-widest text-[hsl(var(--muted-foreground))] flex items-center gap-2 mb-4">
                  <CalendarDays size={13} /> Synthèse de l&apos;intervention
                </h4>
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
