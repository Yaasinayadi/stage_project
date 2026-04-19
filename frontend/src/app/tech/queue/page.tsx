"use client";

import { useState, useEffect, useCallback } from "react";
import axios from "axios";
import {
  Inbox,
  RefreshCw,
  AlertTriangle,
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
} from "lucide-react";
import SlaBadge from "@/components/SlaBadge";
import ProtectedRoute from "@/components/ProtectedRoute";
import { useAuth } from "@/lib/auth";
import Link from "next/link";

const ODOO_URL = "http://localhost:8069";

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
  ai_classification?: string | null;
  create_date: string | null;
  sla_deadline: string | null;
  sla_status?: string | null;
  user_id: string | null;
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
  const [priorities, setPriorities] = useState<
    { id: string; label: string; count: number }[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [assigning, setAssigning] = useState<number | null>(null);
  const [toast, setToast] = useState<{
    msg: string;
    type: "ok" | "err";
  } | null>(null);

  // Dispatch modal state
  const [dispatchTicket, setDispatchTicket] = useState<QueueTicket | null>(
    null,
  );
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [loadingAgents, setLoadingAgents] = useState(false);
  const [dispatching, setDispatching] = useState(false);

  const showToast = (msg: string, type: "ok" | "err") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const fetchQueue = useCallback(async () => {
    if (!user?.id) return;
    try {
      const res = await axios.get(`${ODOO_URL}/api/tickets/queue`, {
        params: { user_id: user.id, role: user.x_support_role },
        withCredentials: true,
      });
      if (res.data.status === "success") {
        setTickets(res.data.data);
        if (res.data.priorities) setPriorities(res.data.priorities);
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
        showToast(`✅ ${res.data.message}`, "ok");
        fetchQueue();
      } else {
        showToast("Erreur lors de l'assignation", "err");
      }
    } catch {
      showToast("Impossible de contacter le serveur", "err");
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
        showToast(`✅ ${res.data.message}`, "ok");
        fetchQueue();
      } else {
        showToast("Erreur lors de l'acceptation", "err");
      }
    } catch {
      showToast("Impossible de contacter le serveur", "err");
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
        params: { category: ticket.ai_classification || "" },
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
        showToast(`✅ ${res.data.message}`, "ok");
        closeDispatch();
        fetchQueue();
      } else {
        showToast("Erreur lors de l'assignation", "err");
      }
    } catch {
      showToast("Impossible de contacter le serveur", "err");
    } finally {
      setDispatching(false);
    }
  };

  const sorted = [...tickets].sort(
    (a, b) => parseInt(b.priority) - parseInt(a.priority),
  );

  return (
    <>
      <div className="p-6 lg:p-8 max-w-5xl mx-auto space-y-6">
        {/* Toast */}
        {toast && (
          <div
            className={`fixed top-5 right-5 z-[200] px-5 py-3 rounded-xl shadow-xl text-sm font-semibold animate-fade-in
          ${toast.type === "ok" ? "bg-emerald-600 text-white" : "bg-red-600 text-white"}`}
          >
            {toast.msg}
          </div>
        )}

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
          <button
            onClick={fetchQueue}
            className="btn-ghost flex items-center gap-2 text-sm"
            title="Actualiser"
          >
            <RefreshCw size={15} />
            Actualiser
          </button>
        </div>

        {/* Stats rapides */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {priorities.map((p) => {
            const cfg = PRIORITY_MAP[p.id] || {
              badge: "bg-gray-500/10 text-gray-500 border-gray-500/20",
              dot: "bg-gray-500",
            };
            return (
              <div
                key={p.id}
                className={`glass-card px-4 py-3 flex items-center gap-3 border ${cfg.badge}`}
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
                  className={`flex items-start justify-between p-4 bg-[hsl(var(--secondary)/0.2)] hover:bg-[hsl(var(--secondary)/0.4)] border border-[hsl(var(--border)/0.5)] rounded-xl transition-all duration-200 shadow-sm border-l-4 ${pCfg.border} group`}
                >
                  {/* Left: Info */}
                  <div className="flex-1 min-w-0 pr-4">
                    {/* ID */}
                    <span className="inline-block text-[10px] font-mono text-[hsl(var(--muted-foreground))] bg-[hsl(var(--muted))] px-1.5 py-0.5 rounded uppercase mb-1">
                      #{ticket.id}
                    </span>

                    {/* Title */}
                    <Link
                      href={`/tech/tickets/${ticket.id}`}
                      className="block text-base font-bold text-[hsl(var(--foreground))] tracking-tight mt-1 line-clamp-1 group-hover:text-[hsl(var(--primary))] transition-colors"
                    >
                      {ticket.name}
                    </Link>

                    {/* Description */}
                    <p className="text-sm text-[hsl(var(--muted-foreground)/0.8)] line-clamp-1 mt-1">
                      {ticket.description}
                    </p>

                    {/* Metadata Row */}
                    <div className="flex items-center flex-wrap gap-4 mt-3 text-xs text-[hsl(var(--muted-foreground))]">
                      {ticket.user_id && (
                        <div className="flex items-center">
                          <User2 className="w-3.5 h-3.5 mr-1" />
                          <span className="truncate max-w-[120px]">
                            {ticket.user_id}
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
                        {ticket.ai_classification && (
                          <span className="inline-flex items-center bg-blue-500/10 text-blue-500 border border-blue-500/20 px-2 py-0.5 rounded text-[10px] font-bold uppercase mr-2 tracking-wider">
                            <Tag size={10} className="mr-1" />
                            {ticket.ai_classification}
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
                  </div>

                  {/* Right: SLA + Action */}
                  <div className="flex flex-col items-end gap-3 flex-shrink-0">
                    {ticket.sla_status === "breached" ? (
                      <div className="bg-rose-500/10 text-rose-500 border border-rose-500/20 px-2 py-1 rounded-full text-[11px] font-medium flex items-center gap-1">
                        <AlertTriangle size={12} />
                        SLA Dépassé
                      </div>
                    ) : ticket.sla_status === "at_risk" ? (
                      <div className="bg-amber-500/10 text-amber-500 border border-amber-500/20 px-2 py-1 rounded-full text-[11px] font-medium flex items-center gap-1">
                        <Clock size={12} />À risque
                      </div>
                    ) : ticket.sla_status === "on_track" ||
                      ticket.sla_deadline ? (
                      <div className="bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 px-2 py-1 rounded-full text-[11px] font-medium flex items-center gap-1">
                        <CheckCircle2 size={12} />
                        Dans les temps
                      </div>
                    ) : null}

                    {/* Action button: Admin → Assigner à... / Tech → Accept or Take */}
                    {isAdmin ? (
                      <button
                        onClick={() => openDispatch(ticket)}
                        className="flex items-center gap-1.5 text-xs px-4 py-1.5 rounded-lg font-semibold bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-600/30 mt-auto transition-all"
                      >
                        <Users size={13} />
                        Assigner à...
                      </button>
                    ) : ticket.assigned_to_id && !ticket.x_accepted ? (
                      <button
                        disabled={assigning === ticket.id}
                        onClick={() => handleAccept(ticket.id)}
                        className="flex items-center gap-1.5 text-xs px-4 py-1.5 rounded-lg font-semibold bg-emerald-500 hover:bg-emerald-600 text-white shadow-md shadow-emerald-500/30 disabled:opacity-60 disabled:cursor-not-allowed mt-auto transition-all"
                      >
                        <ShieldCheck size={13} />
                        {assigning === ticket.id
                          ? "En cours…"
                          : "Accepter la mission"}
                      </button>
                    ) : (
                      <button
                        disabled={assigning === ticket.id}
                        onClick={() => handleAssign(ticket.id)}
                        className="bg-orange-500 hover:bg-orange-600 text-white shadow-md shadow-orange-500/30 text-xs px-4 py-1.5 rounded-lg font-semibold disabled:opacity-60 disabled:cursor-not-allowed mt-auto transition-all flex items-center justify-center"
                      >
                        {assigning === ticket.id
                          ? "En cours…"
                          : "Prendre en charge"}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Dispatch Modal ───────────────────────────────────── */}
      {dispatchTicket && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-2xl shadow-2xl w-full max-w-lg">
            {/* Modal Header */}
            <div className="flex items-start justify-between p-5 border-b border-[hsl(var(--border))]">
              <div>
                <p className="text-[10px] font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded uppercase inline-block mb-1">
                  TK-{String(dispatchTicket.id).padStart(4, "0")}
                </p>
                <h2 className="text-base font-bold text-foreground">
                  Assigner ce ticket
                </h2>
                <p className="text-sm text-muted-foreground mt-0.5 line-clamp-1">
                  {dispatchTicket.name}
                </p>
                {dispatchTicket.ai_classification && (
                  <span className="mt-1.5 inline-flex items-center gap-1 text-[11px] bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 px-2 py-0.5 rounded-full">
                    <Tag size={10} /> {dispatchTicket.ai_classification}
                  </span>
                )}
              </div>
              <button
                onClick={closeDispatch}
                className="text-muted-foreground hover:text-foreground transition-colors p-1"
              >
                <X size={18} />
              </button>
            </div>

            {/* Agent List */}
            <div className="p-5 max-h-[360px] overflow-y-auto space-y-2">
              {loadingAgents ? (
                <div className="text-center text-sm text-muted-foreground py-8">
                  Chargement des experts...
                </div>
              ) : agents.length === 0 ? (
                <div className="text-center text-sm text-muted-foreground py-8">
                  Aucun technicien disponible
                </div>
              ) : (
                agents.map((agent) => (
                  <button
                    key={agent.id}
                    onClick={() => setSelectedAgent(agent)}
                    className={`w-full flex items-center justify-between p-3 rounded-xl border transition-all text-left
                    ${
                      selectedAgent?.id === agent.id
                        ? "border-indigo-500 bg-indigo-500/10"
                        : "border-[hsl(var(--border)/0.5)] bg-[hsl(var(--secondary)/0.2)] hover:bg-[hsl(var(--secondary)/0.4)]"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold
                      ${agent.is_expert ? "bg-indigo-500/20 text-indigo-400" : "bg-muted text-muted-foreground"}`}
                      >
                        {agent.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-foreground">
                          {agent.name}
                        </p>
                        <div className="flex items-center gap-2 mt-0.5">
                          {agent.is_expert && (
                            <span className="text-[10px] bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 px-1.5 py-0.5 rounded-full">
                              Expert
                            </span>
                          )}
                          {agent.it_domains.slice(0, 3).map((d) => (
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
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground shrink-0">
                      <Briefcase size={12} />
                      <span
                        className={
                          agent.active_tickets >= 5
                            ? "text-rose-400 font-semibold"
                            : ""
                        }
                      >
                        {agent.active_tickets} ticket
                        {agent.active_tickets > 1 ? "s" : ""} actif
                        {agent.active_tickets > 1 ? "s" : ""}
                      </span>
                    </div>
                  </button>
                ))
              )}
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-between p-5 border-t border-[hsl(var(--border))] gap-3">
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
