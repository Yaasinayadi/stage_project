"use client";

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import axios from "axios";
import {
  Inbox,
  RefreshCw,
  AlertTriangle,
  User,
  User2,
  Clock,
  Calendar,
  Tag,
  CheckCircle2,
  ShieldCheck,
  Users,
  Briefcase,
  X,
  ChevronRight,
  ArrowUpCircle,
  Globe,
  ClipboardCheck,
  UserCog
} from "lucide-react";
import SlaBadge from "@/components/SlaBadge";
import ProtectedRoute from "@/components/ProtectedRoute";
import { useAuth } from "@/lib/auth";
import Link from "next/link";

import { ODOO_URL } from "@/lib/config";


const PRIORITY_MAP: Record<
  string,
  { label: string; badge: string; dot: string; border: string }
> = {
  "3": {
    label: "Critique",
    dot: "bg-rose-500",
    badge: "bg-rose-500/10 text-rose-500 border-rose-500/20",
    border: "border-l-rose-500",
  },
  "2": {
    label: "Haute",
    dot: "bg-amber-500",
    badge: "bg-amber-500/10 text-amber-500 border-amber-500/20",
    border: "border-l-amber-500",
  },
  "1": {
    label: "Moyenne",
    dot: "bg-blue-500",
    badge: "bg-blue-500/10 text-blue-500 border-blue-500/20",
    border: "border-l-blue-500",
  },
  "0": {
    label: "Basse",
    dot: "bg-slate-400",
    badge: "bg-slate-500/10 text-slate-500 border-slate-500/20",
    border: "border-l-slate-400",
  },
};

type QueueTicket = {
  id: number;
  name: string;
  description: string;
  priority: string;
  priority_label: string;
  state: string;
  x_accepted: boolean;
  assigned_to_id: number | null;
  assigned_by_id?: number | null;
  assigned_by?: string | null;
  category?: string | null;
  create_date: string | null;
  sla_deadline: string | null;
  sla_status?: string | null;
  user_id: number | null;
  user_name?: string | null;
  user_email?: string | null;
};

type Agent = {
  id: number;
  name: string;
  email: string;
  it_domains: string[];
  active_tickets: number;
  is_expert: boolean;
};

function QueuePage() {
  const { user } = useAuth();
  const isAdmin = user?.x_support_role === "admin";
  const [tickets, setTickets] = useState<QueueTicket[]>([]);
  const [activeTab, setActiveTab] = useState<"expertise" | "missions">("missions");
  const [loading, setLoading] = useState(true);
  const [selectedPriority, setSelectedPriority] = useState<string | null>(null);

  // Dispatch modal state
  const [dispatchTicket, setDispatchTicket] = useState<QueueTicket | null>(
    null,
  );
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [loadingAgents, setLoadingAgents] = useState(false);
  const [dispatching, setDispatching] = useState(false);

  // Modale technicien
  const [techTicket, setTechTicket] = useState<QueueTicket | null>(null);
  const [techLoading, setTechLoading] = useState(false);

  // Removed custom showToast

  const fetchQueue = useCallback(async () => {
    if (!user?.id) return;
    try {
      const res = await axios.get(`${ODOO_URL}/api/tickets/queue`, {
        params: { user_id: user.id, role: user.x_support_role },
        withCredentials: true,
      });
      if (res.data.status === "success") {
        setTickets(res.data.data);
      }
    } catch (e: any) {
      console.error("Erreur chargement file d'attente", e?.message || e);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchQueue();
    const id = setInterval(fetchQueue, 20000);
    return () => clearInterval(id);
  }, [fetchQueue]);

  const handleAssign = async (ticketId: number) => {
    setAssigning(ticketId);
    try {
      const res = await axios.patch(
        `${ODOO_URL}/api/ticket/${ticketId}/assign`,
        { user_id: user?.id },
        { withCredentials: true },
      );
      if (res.data.status === "success") {
        toast.success(res.data.message, { icon: <ClipboardCheck size={18} /> });
        fetchQueue();
      } else {
        toast.error("Erreur lors de l'assignation");
      }
    } catch {
      toast.error("Impossible de contacter le serveur");
    } finally {
      setAssigning(null);
    }
  };

  const handleAccept = async (ticketId: number) => {
    setAssigning(ticketId);
    try {
      const res = await axios.patch(
        `${ODOO_URL}/api/ticket/${ticketId}/accept`,
        {},
        { withCredentials: true },
      );
      if (res.data.status === "success") {
        toast.success(res.data.message, { icon: <ClipboardCheck size={18} /> });
        fetchQueue();
      } else {
        toast.error("Erreur lors de l'acceptation");
      }
    } catch {
      toast.error("Impossible de contacter le serveur");
    } finally {
      setAssigning(null);
    }
  };

  const openDispatch = async (ticket: QueueTicket) => {
    setDispatchTicket(ticket);
    setSelectedAgent(null);
    setLoadingAgents(true);
    try {
      const res = await axios.get(`${ODOO_URL}/api/agents/suggest`, {
        params: { category: ticket.category || "", ticket_id: ticket.id },
        withCredentials: true,
      });
      if (res.data.status === "success") setAgents(res.data.data);
    } catch {
      setAgents([]);
    } finally {
      setLoadingAgents(false);
    }
  };

  const closeDispatch = () => {
    setDispatchTicket(null);
    setSelectedAgent(null);
    setAgents([]);
  };

  const handleConfirmDispatch = async () => {
    if (!dispatchTicket || !selectedAgent) return;
    setDispatching(true);
    try {
      const res = await axios.post(
        `${ODOO_URL}/api/ticket/${dispatchTicket.id}/dispatch`,
        { target_user_id: selectedAgent.id },
        { withCredentials: true },
      );
      if (res.data.status === "success") {
        toast.success(res.data.message, { icon: <UserCog size={18} /> });
        closeDispatch();
        fetchQueue();
      } else {
        toast.error("Erreur lors de l'assignation");
      }
    } catch {
      toast.error("Impossible de contacter le serveur");
    } finally {
      setDispatching(false);
    }
  };

  /* ─ Modale Technicien ─ */
  const openTechModal = (ticket: QueueTicket) => setTechTicket(ticket);
  const closeTechModal = () => setTechTicket(null);

  const handleTake = async () => {
    if (!techTicket) return;
    setTechLoading(true);
    try {
      const res = await axios.patch(
        `${ODOO_URL}/api/ticket/${techTicket.id}/assign`,
        { user_id: user?.id },
        { withCredentials: true },
      );
      if (res.data.status === "success") {
        closeTechModal();
        toast.success(
          `Vous êtes désormais responsable du ticket TK-${String(techTicket.id).padStart(4, "0")}. Retrouvez-le dans votre espace "Mes Tickets".`,
          { icon: <ClipboardCheck size={18} /> }
        );
        fetchQueue();
      } else {
        toast.error("Erreur lors de l'assignation");
      }
    } catch {
      toast.error("Impossible de contacter le serveur");
    } finally {
      setTechLoading(false);
    }
  };

  const handleAcceptModal = async () => {
    if (!techTicket) return;
    setTechLoading(true);
    try {
      const res = await axios.patch(
        `${ODOO_URL}/api/ticket/${techTicket.id}/accept`,
        {},
        { withCredentials: true },
      );
      if (res.data.status === "success") {
        closeTechModal();
        toast.success(
          `Mission acceptée — TK-${String(techTicket.id).padStart(4, "0")} est maintenant dans vos "Mes Tickets".`,
          { icon: <ClipboardCheck size={18} /> }
        );
        fetchQueue();
      } else {
        toast.error("Erreur lors de l'acceptation");
      }
    } catch {
      toast.error("Impossible de contacter le serveur");
    } finally {
      setTechLoading(false);
    }
  };

  // Derive current tab tickets
  const currentTabTickets = isAdmin 
    ? tickets 
    : activeTab === "expertise"
      ? tickets.filter(t => !t.assigned_to_id)
      : tickets.filter(t => t.assigned_to_id === user?.id);

  // Calculate priorities manually based on current tab tickets
  const tabPriorities = Object.keys(PRIORITY_MAP)
    .map(pId => ({
      id: pId,
      label: PRIORITY_MAP[pId].label,
      count: currentTabTickets.filter(t => t.priority === pId).length
    }))
    .filter(p => p.count > 0 || selectedPriority === p.id)
    .sort((a, b) => parseInt(b.id) - parseInt(a.id));

  const filteredTickets = selectedPriority
    ? currentTabTickets.filter((t) => t.priority === selectedPriority)
    : currentTabTickets;

  const sorted = [...filteredTickets].sort(
    (a, b) => parseInt(b.priority) - parseInt(a.priority),
  );

  return (
    <>
      <div className="p-6 lg:p-8 max-w-5xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <Inbox size={24} className="text-[hsl(var(--primary))]" />
              File d&apos;attente
            </h1>
            <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1">
              Tickets non assignés — triés par priorité décroissante
            </p>
          </div>
          <div className="flex items-center gap-4">
            {selectedPriority && (
              <span className="text-sm font-medium text-[hsl(var(--primary))] animate-fade-in">
                {filteredTickets.length} ticket{filteredTickets.length > 1 ? "s" : ""}{" "}
                {PRIORITY_MAP[selectedPriority]?.label.toLowerCase()}
                {filteredTickets.length > 1 ? "s" : ""} trouvé{filteredTickets.length > 1 ? "s" : ""}
              </span>
            )}
            <button
              onClick={fetchQueue}
              className="btn-ghost flex items-center gap-2 text-sm"
              title="Actualiser"
            >
              <RefreshCw size={15} />
              Actualiser
            </button>
          </div>
        </div>

        {/* Tabs Technicien */}
        {!isAdmin && (
          <div className="flex bg-[hsl(var(--muted)/0.5)] p-1 rounded-xl w-fit">
            <button
              onClick={() => { setActiveTab("missions"); setSelectedPriority(null); }}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-bold transition-all ${activeTab === "missions" ? "bg-[hsl(var(--card))] text-[hsl(var(--primary))] shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
            >
              <Briefcase size={16} />
              Missions Admin
              <span className="bg-[hsl(var(--primary)/0.1)] text-[hsl(var(--primary))] px-2 py-0.5 rounded-full text-xs ml-1">
                {tickets.filter(t => t.assigned_to_id === user?.id).length}
              </span>
            </button>
            <button
              onClick={() => { setActiveTab("expertise"); setSelectedPriority(null); }}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-bold transition-all ${activeTab === "expertise" ? "bg-[hsl(var(--card))] text-[hsl(var(--primary))] shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
            >
              <Inbox size={16} />
              Flux Expertise
              <span className="bg-[hsl(var(--primary)/0.1)] text-[hsl(var(--primary))] px-2 py-0.5 rounded-full text-xs ml-1">
                {tickets.filter(t => !t.assigned_to_id).length}
              </span>
            </button>
          </div>
        )}

        {/* Stats rapides */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {tabPriorities.map((p) => {
            const cfg = PRIORITY_MAP[p.id] || {
              badge: "bg-gray-500/10 text-gray-500 border-gray-500/20",
              dot: "bg-gray-500",
            };
            return (
              <div
                key={p.id}
                onClick={() => setSelectedPriority(selectedPriority === p.id ? null : p.id)}
                className={`glass-card px-4 py-3 flex items-center gap-3 border cursor-pointer transition-all duration-200 hover:scale-[1.02] active:scale-95
                  ${selectedPriority === p.id ? "ring-2 ring-[hsl(var(--primary))] border-transparent shadow-lg" : selectedPriority ? "opacity-40 grayscale-[0.5]" : "hover:border-[hsl(var(--primary)/0.5)]"}
                  ${cfg.badge}`}
              >
                <span
                  className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${cfg.dot}`}
                />
                <div>
                  <p className="text-xs font-medium opacity-70">{p.label}</p>
                  <p className="text-xl font-bold">{p.count}</p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Liste */}
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="glass-card h-20 animate-pulse opacity-50"
              />
            ))}
          </div>
        ) : sorted.length === 0 ? (
          <div className="glass-card flex flex-col items-center justify-center py-20 text-center">
            <Inbox
              size={40}
              className="text-[hsl(var(--muted-foreground)/0.4)] mb-3"
            />
            <h3 className="text-lg font-semibold">
              File d&apos;attente vide !
            </h3>
            <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1">
              Tous les tickets ont été pris en charge.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {sorted.map((ticket) => {
              const pCfg = PRIORITY_MAP[ticket.priority] || {
                border: "border-l-gray-500",
                badge: "bg-gray-500/10 text-gray-500 border-gray-500/20",
                dot: "bg-gray-500",
              };
              return (
                <div
                  key={ticket.id}
                  onClick={
                    isAdmin
                      ? () => openDispatch(ticket)
                      : () => openTechModal(ticket)
                  }
                  className={`flex flex-col p-4 bg-[hsl(var(--secondary)/0.2)] border border-[hsl(var(--border)/0.5)] rounded-xl transition-all duration-200 shadow-sm border-l-4 ${pCfg.border} group cursor-pointer
                    ${
                      isAdmin
                        ? "hover:bg-[hsl(var(--primary)/0.06)] hover:border-[hsl(var(--primary)/0.3)] hover:shadow-md"
                        : "hover:bg-[hsl(var(--secondary)/0.4)] hover:shadow-md"
                    }`}
                >
                  {/* Top Section: Info + SLA */}
                  <div className="flex items-start justify-between w-full">
                    {/* Left: Info */}
                    <div className="flex-1 min-w-0 pr-4">
                      {/* ID + escalated badge */}
                      <div className="flex items-center gap-2 mb-1">
                        <span className="inline-block text-[10px] font-mono text-[hsl(var(--muted-foreground))] bg-[hsl(var(--muted))] px-1.5 py-0.5 rounded uppercase">
                          #{ticket.id}
                        </span>
                        {ticket.state === "escalated" && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-500/15 text-purple-400 border border-purple-500/30 uppercase tracking-wider">
                            <ArrowUpCircle size={12} />
                            ESCALADÉ
                          </span>
                        )}
                      </div>

                      {/* Title */}
                      {isAdmin ? (
                        <p className="block text-base font-bold text-[hsl(var(--foreground))] tracking-tight mt-1 line-clamp-1 group-hover:text-[hsl(var(--primary))] transition-colors">
                          {ticket.name}
                        </p>
                      ) : (
                        <p className="block text-base font-bold text-[hsl(var(--foreground))] tracking-tight mt-1 line-clamp-1 group-hover:text-[hsl(var(--primary))] transition-colors">
                          {ticket.name}
                        </p>
                      )}

                      {/* Description */}
                      <p className="text-sm text-[hsl(var(--muted-foreground)/0.8)] line-clamp-1 mt-1">
                        {ticket.description}
                      </p>
                    </div>

                    {/* Right: SLA */}
                    <div className="flex flex-col items-end gap-2 flex-shrink-0">
                      {ticket.sla_status === "breached" ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-full bg-rose-500/10 text-rose-500 border border-rose-500/20 uppercase tracking-wider">
                          <AlertTriangle size={12} />
                          SLA Dépassé
                        </span>
                      ) : ticket.sla_status === "at_risk" ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-full bg-amber-500/10 text-amber-500 border border-amber-500/20 uppercase tracking-wider">
                          <Clock size={12} />À risque
                        </span>
                      ) : ticket.sla_status === "on_track" ||
                        ticket.sla_deadline ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-full bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 uppercase tracking-wider">
                          <CheckCircle2 size={12} />
                          Dans les temps
                        </span>
                      ) : null}
                    </div>
                  </div>

                  {/* Bottom Section: Metadata + Indicator */}
                  <div className="flex items-center justify-between w-full mt-auto pt-3">
                    {/* Left: Metadata */}
                    <div className="flex items-center flex-wrap gap-4 text-xs text-[hsl(var(--muted-foreground))]">
                      {(ticket.user_name || ticket.user_id) && (
                        <div className="flex items-center">
                          <User2 className="w-3.5 h-3.5 mr-1" />
                          <span className="truncate max-w-[120px]">
                            {ticket.user_name ?? `${ticket.user_id}`}
                          </span>
                        </div>
                      )}
                      {ticket.create_date && (
                        <div className="flex items-center">
                          <Calendar className="w-3.5 h-3.5 mr-1" />
                          {new Date(ticket.create_date).toLocaleDateString(
                            "fr-FR",
                          )}
                        </div>
                      )}
                      <div className="flex items-center">
                        {ticket.category && (
                          <span className="inline-flex items-center bg-blue-500/10 text-blue-500 border border-blue-500/20 px-2 py-0.5 rounded text-[10px] font-bold uppercase mr-2 tracking-wider">
                            <Tag size={10} className="mr-1" />
                            {ticket.category}
                          </span>
                        )}
                        <Tag className="w-3.5 h-3.5 mr-1" />
                        <span
                          className={`inline-flex items-center px-1.5 py-0.5 rounded-full border text-[10px] uppercase tracking-wider font-semibold mr-2 ${pCfg.badge}`}
                        >
                          {ticket.priority_label ||
                            pCfg.label ||
                            ticket.priority}
                        </span>
                      </div>
                    </div>

                    {/* Right: Indicator */}
                    <div className="flex flex-col gap-2 flex-shrink-0 ml-4 items-end">
                      {!ticket.assigned_to_id ? (
                        <span className="flex items-center gap-1.5 px-2 py-1 rounded-full border text-[10px] font-black uppercase tracking-widest bg-sky-500/10 text-sky-500 border-sky-500/20">
                          <Globe size={12} />
                          OUVERT
                        </span>
                      ) : ticket.assigned_to_id === user?.id && !ticket.x_accepted ? (
                        <span className="flex items-center gap-1.5 px-2 py-1 rounded-full border text-[10px] font-black uppercase tracking-widest bg-emerald-500/10 text-emerald-500 border-emerald-500/20 animate-pulse">
                          <ArrowUpCircle size={12} />
                          MISSION ASSIGNÉE
                        </span>
                      ) : null}
                      
                      {/* Affichage traçabilité origin Assignateur si assigné */}
                      {ticket.assigned_to_id && (
                         <span className="text-[10px] font-semibold italic text-muted-foreground">
                           {ticket.assigned_by_id === ticket.assigned_to_id 
                             ? "Auto-assigné" 
                             : `Assigné par: ${ticket.assigned_by || 'Admin'}`}
                         </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Modale Tout-en-un : Détails + Assignation ─────────────────── */}
      {dispatchTicket && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[90vh]">
            {/* ── Header ── */}
            <div className="flex items-start justify-between p-5 border-b border-[hsl(var(--border))] flex-shrink-0">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <p className="text-[10px] font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded uppercase inline-block">
                    TK-{String(dispatchTicket.id).padStart(4, "0")}
                  </p>
                  {dispatchTicket.state === "escalated" && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-500/15 text-purple-400 border border-purple-500/30 uppercase tracking-wider">
                      <ArrowUpCircle size={12} />
                      ESCALADÉ — Attention urgente requise
                    </span>
                  )}
                </div>
                <h2 className="text-lg font-bold text-foreground leading-tight line-clamp-2">
                  {dispatchTicket.name}
                </h2>
              </div>
              <button
                onClick={closeDispatch}
                className="text-muted-foreground hover:text-foreground transition-colors p-1 ml-3 flex-shrink-0"
              >
                <X size={18} />
              </button>
            </div>

            {/* ── Corps scrollable ── */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Section Détails */}
              <div className="space-y-4">
                {/* Description */}
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                    Description
                  </p>
                  <div className="text-sm text-muted-foreground leading-relaxed bg-[hsl(var(--muted)/0.3)] rounded-xl p-3 max-h-32 overflow-y-auto pr-3">
                    {dispatchTicket.description}
                  </div>
                </div>

                {/* Métadonnées */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Demandeur */}
                  <div className="flex items-center gap-3 p-4 rounded-xl border border-[hsl(var(--border)/0.5)] bg-[hsl(var(--card))]">
                    <div className="w-10 h-10 rounded-full accent-gradient flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                      {dispatchTicket.user_name ? (
                        dispatchTicket.user_name
                          .trim()
                          .split(/\s+/)
                          .filter(Boolean)
                          .map((w: string) => w[0].toUpperCase())
                          .join("")
                          .slice(0, 2)
                      ) : (
                        <User size={16} />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-[0.6rem] font-semibold text-muted-foreground uppercase tracking-wider mb-0.5">
                        Demandeur
                      </p>
                      <p className="text-sm font-semibold truncate">
                        {dispatchTicket.user_name
                          ? dispatchTicket.user_name.replace(/#/g, "").trim()
                          : `Utilisateur ${dispatchTicket.user_id}`}
                      </p>
                      {dispatchTicket.user_email && (
                        <p className="text-[0.7rem] text-muted-foreground truncate mt-0.5">
                          {dispatchTicket.user_email}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Catégorie + Priorité */}
                  <div className="flex flex-col justify-center gap-2 p-4 rounded-xl border border-[hsl(var(--border)/0.5)] bg-[hsl(var(--card))]">
                    <p className="text-[0.6rem] font-semibold text-muted-foreground uppercase tracking-wider">
                      Classification
                    </p>
                    <div className="flex items-center gap-2 flex-wrap">
                      {dispatchTicket.category && (
                        <span className="inline-flex items-center gap-1 text-[11px] bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 px-2.5 py-0.5 rounded-full">
                          <Tag size={10} /> {dispatchTicket.category}
                        </span>
                      )}
                      {(() => {
                        const pc = PRIORITY_MAP[dispatchTicket.priority];
                        return pc ? (
                          <span
                            className={`inline-flex items-center text-[11px] px-2.5 py-0.5 rounded-full border font-semibold ${pc.badge}`}
                          >
                            {pc.label}
                          </span>
                        ) : null;
                      })()}
                    </div>
                  </div>

                  {/* SLA */}
                  {(dispatchTicket.sla_status ||
                    dispatchTicket.sla_deadline) && (
                    <div className="sm:col-span-2 flex items-center gap-3 p-3 rounded-xl border border-[hsl(var(--border)/0.5)] bg-[hsl(var(--card))]">
                      <Clock
                        size={13}
                        className="text-muted-foreground flex-shrink-0"
                      />
                      <div className="flex items-center gap-2 flex-wrap">
                        {dispatchTicket.sla_status === "breached" && (
                          <span className="flex flex-row items-center gap-1 text-xs font-bold text-rose-500 bg-rose-500/10 px-2.5 py-0.5 rounded-full border border-rose-500/20">
                            <AlertTriangle size={12} />
                            SLA Dépassé
                          </span>
                        )}
                        {dispatchTicket.sla_status === "at_risk" && (
                          <span className="flex flex-row items-center gap-1 text-xs font-bold text-amber-500 bg-amber-500/10 px-2.5 py-0.5 rounded-full border border-amber-500/20">
                            <Clock size={12} />
                            SLA À risque
                          </span>
                        )}
                        {dispatchTicket.sla_status === "on_track" && (
                          <span className="flex flex-row items-center gap-1 text-xs font-bold text-emerald-500 bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/20">
                            <CheckCircle2 size={12} />
                            SLA Dans les temps
                          </span>
                        )}
                        {dispatchTicket.sla_deadline && (
                          <span className="text-xs text-muted-foreground">
                            Deadline :{" "}
                            {new Date(
                              dispatchTicket.sla_deadline,
                            ).toLocaleString("fr-FR")}
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Section Assignation */}
              <div className="space-y-3">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                  <Users size={13} />
                  Choisir un technicien
                </h3>

                {(() => {
                  const availableTechs = agents.filter(tech => dispatchTicket?.state === 'escalated' ? tech.id !== dispatchTicket.user_id : true);
                  
                  return loadingAgents ? (
                    <div className="text-center text-sm text-muted-foreground py-8 flex items-center justify-center gap-2">
                      <RefreshCw size={14} className="animate-spin" />
                      Chargement des experts...
                    </div>
                  ) : availableTechs.length === 0 ? (
                    <div className="text-center text-sm text-muted-foreground py-8">
                      Aucun technicien disponible
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                      {availableTechs.map((agent) => (
                        <button
                          key={agent.id}
                          onClick={() => setSelectedAgent(agent)}
                          className={`w-full flex items-center justify-between p-3 rounded-xl border transition-all text-left
                            ${
                              selectedAgent?.id === agent.id
                                ? "border-indigo-500 bg-indigo-500/10 shadow-sm shadow-indigo-500/20"
                                : "border-[hsl(var(--border)/0.5)] bg-[hsl(var(--secondary)/0.2)] hover:bg-[hsl(var(--secondary)/0.4)]"
                            }`}
                        >
                          <div className="flex items-center gap-3">
                            <div
                              className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold
                              ${
                                selectedAgent?.id === agent.id
                                  ? "bg-indigo-500 text-white"
                                  : "bg-[hsl(var(--muted))] text-[hsl(var(--foreground))]"
                              }`}
                            >
                              {agent.name.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <p className="text-sm font-semibold text-foreground">
                                {agent.name}
                              </p>
                              <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                                {agent.is_expert && (
                                  <span className="text-[10px] bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 px-1.5 py-0.5 rounded-full font-semibold">
                                    ⭐ Expert
                                  </span>
                                )}
                                {agent.it_domains.slice(0, 2).map((d) => (
                                  <span
                                    key={d}
                                    className="text-[10px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded-full"
                                  >
                                    {d}
                                  </span>
                                ))}
                              </div>
                            </div>
                          </div>
                          <div
                            className={`flex items-center gap-1.5 text-xs shrink-0 ${agent.active_tickets >= 5 ? "text-rose-400 font-semibold" : "text-muted-foreground"}`}
                          >
                            <Briefcase size={12} />
                            {agent.active_tickets} actif
                            {agent.active_tickets > 1 ? "s" : ""}
                          </div>
                        </button>
                      ))}
                    </div>
                  );
                })()}
              </div>
            </div>

            {/* ── Footer ── */}
            <div className="flex items-center gap-3 p-5 border-t border-[hsl(var(--border))] flex-shrink-0">
              <button
                onClick={closeDispatch}
                className="flex-1 py-2 rounded-lg border border-[hsl(var(--border))] text-sm text-muted-foreground hover:bg-muted transition-all"
              >
                Annuler
              </button>
              <button
                onClick={handleConfirmDispatch}
                disabled={!selectedAgent || dispatching}
                className="flex-1 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
              >
                <ChevronRight size={14} />
                {dispatching
                  ? "Assignation..."
                  : selectedAgent
                    ? `Assigner à ${selectedAgent.name.split(" ")[0]}`
                    : "Choisir un technicien"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modale Action Technicien ─────────────────── */}
      {techTicket && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-2xl shadow-2xl w-full max-w-lg flex flex-col max-h-[90vh]">
            {/* Header */}
            <div className="flex items-start justify-between p-6 border-b border-[hsl(var(--border))]">
              <div>
                <p className="text-[10px] font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded uppercase inline-block mb-2">
                  TK-{String(techTicket.id).padStart(4, "0")}
                </p>
                <h2 className="text-xl font-bold text-foreground leading-tight line-clamp-2">
                  {techTicket.name}
                </h2>
              </div>
              <button
                onClick={closeTechModal}
                className="text-muted-foreground hover:text-foreground transition-colors p-1 flex-shrink-0"
              >
                <X size={18} />
              </button>
            </div>

            {/* Corps */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
              {/* Alert Escalade */}
              {techTicket.state === "escalated" && (
                <div className="flex items-start gap-3 p-4 bg-purple-500/10 border border-purple-500/30 rounded-xl">
                  <ArrowUpCircle className="text-purple-500 mt-0.5" size={18} />
                  <div>
                    <p className="text-sm font-bold text-purple-400">
                      Priorité Absolue
                    </p>
                    <p className="text-xs text-purple-400/80 mt-1">
                      Attention : Ce ticket a fait l&apos;objet d&apos;une
                      escalade et nécessite une prise en charge immédiate.
                    </p>
                  </div>
                </div>
              )}

              {/* Description */}
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 mb-2">
                  Description du problème
                </p>
                <div className="text-sm text-muted-foreground leading-relaxed bg-[hsl(var(--muted)/0.3)] rounded-xl p-4 border border-[hsl(var(--border)/0.3)] max-h-32 overflow-y-auto pr-3 custom-scrollbar">
                  {techTicket.description}
                </div>
              </div>

              {/* Demandeur + SLA */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex items-center gap-3 p-4 rounded-xl border border-[hsl(var(--border)/0.5)] bg-[hsl(var(--card))] shadow-sm">
                  <div className="w-10 h-10 rounded-full accent-gradient flex items-center justify-center text-white text-sm font-bold flex-shrink-0 shadow-md">
                    {techTicket.user_name ? (
                      techTicket.user_name
                        .trim()
                        .split(/\s+/)
                        .filter(Boolean)
                        .map((w: string) => w[0].toUpperCase())
                        .join("")
                        .slice(0, 2)
                    ) : (
                      <User size={16} />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-widest mb-0.5">
                      Demandeur
                    </p>
                    <p className="text-sm font-bold truncate text-foreground capitalize">
                      {techTicket.user_name
                        ? techTicket.user_name.replace(/#/g, "").trim()
                        : `${techTicket.user_id}`}
                    </p>
                  </div>
                </div>

                <div className="flex flex-col justify-center gap-2 p-4 rounded-xl border border-[hsl(var(--border)/0.5)] bg-[hsl(var(--card))] shadow-sm">
                  <p className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-widest mb-1">
                    Classification
                  </p>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className={`inline-flex items-center px-2.5 py-1 rounded-lg border font-bold text-[11px] ${PRIORITY_MAP[techTicket.priority]?.badge || "bg-gray-500/10 text-gray-500 border-gray-500/20"}`}
                    >
                      {PRIORITY_MAP[techTicket.priority]?.label ||
                        techTicket.priority}
                    </span>
                    {techTicket.category && (
                      <span className="inline-flex items-center gap-1.5 text-[11px] bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 px-2.5 py-1 rounded-lg font-bold">
                        <Tag size={12} /> {techTicket.category}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Footer / Actions */}
            <div className="p-6 border-t border-[hsl(var(--border))] bg-[hsl(var(--card))] rounded-b-2xl">
              {techTicket.assigned_to_id && !techTicket.x_accepted ? (
                <div className="space-y-4">
                  <p className="text-xs text-center text-emerald-500 font-medium bg-emerald-500/10 py-2 px-3 rounded-lg border border-emerald-500/20 mb-1">
                    🎯 Cette mission vous a été confiée par l&apos;administration.
                  </p>
                  <p className="text-center text-[10px] text-muted-foreground italic mb-2">
                    {techTicket.assigned_by_id === techTicket.assigned_to_id 
                      ? "Auto-assigné" 
                      : `Assigné par : ${techTicket.assigned_by || 'Admin'}`}
                  </p>
                  <button
                    disabled={techLoading}
                    onClick={handleAcceptModal}
                    className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-lg shadow-emerald-500/20 transition-all disabled:opacity-50"
                  >
                    <ShieldCheck size={18} />
                    {techLoading
                      ? "Acceptation en cours..."
                      : "Accepter la mission"}
                  </button>
                </div>
              ) : (
                <button
                  disabled={techLoading}
                  onClick={handleTake}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-bold shadow-lg shadow-orange-500/20 transition-all disabled:opacity-50"
                >
                  <Inbox size={18} />
                  {techLoading
                    ? "Assignation en cours..."
                    : "Prendre en charge"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default function TechQueuePage() {
  return (
    <ProtectedRoute roles={["tech", "admin"]}>
      <QueuePage />
    </ProtectedRoute>
  );
}
