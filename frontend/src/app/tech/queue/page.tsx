"use client";

import { useState, useEffect, useCallback } from "react";
import axios from "axios";
import { Inbox, RefreshCw, AlertTriangle, User2, Clock } from "lucide-react";
import SlaBadge from "@/components/SlaBadge";
import ProtectedRoute from "@/components/ProtectedRoute";
import { useAuth } from "@/lib/auth";
import Link from "next/link";

const ODOO_URL = "http://localhost:8069";

const PRIORITY_MAP: Record<string, { label: string; color: string; dot: string }> = {
  "3": { label: "Critique", color: "bg-red-500/10 text-red-500 border-red-500/20", dot: "bg-red-500" },
  "2": { label: "Haute",    color: "bg-orange-500/10 text-orange-500 border-orange-500/20", dot: "bg-orange-500" },
  "1": { label: "Moyenne",  color: "bg-amber-500/10 text-amber-600 border-amber-500/20", dot: "bg-amber-500" },
  "0": { label: "Basse",    color: "bg-sky-500/10 text-sky-600 border-sky-500/20", dot: "bg-sky-400" },
};

type QueueTicket = {
  id: number;
  name: string;
  description: string;
  priority: string;
  state: string;
  create_date: string | null;
  sla_deadline: string | null;
  user_id: string | null;
};

function QueuePage() {
  const { user } = useAuth();
  const [tickets, setTickets] = useState<QueueTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [assigning, setAssigning] = useState<number | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: "ok" | "err" } | null>(null);

  const showToast = (msg: string, type: "ok" | "err") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const fetchQueue = useCallback(async () => {
    try {
      const res = await axios.get(`${ODOO_URL}/api/tickets/queue`, { withCredentials: true });
      if (res.data.status === "success") setTickets(res.data.data);
    } catch {
      console.error("Erreur chargement file d'attente");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchQueue();
    const id = setInterval(fetchQueue, 20000);
    return () => clearInterval(id);
  }, [fetchQueue]);

  const handleAssign = async (ticketId: number) => {
    setAssigning(ticketId);
    try {
      const res = await axios.patch(`${ODOO_URL}/api/ticket/${ticketId}/assign`, {}, { withCredentials: true });
      if (res.data.status === "success") {
        showToast("✅ Ticket pris en charge !", "ok");
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

  const sorted = [...tickets].sort((a, b) => parseInt(b.priority) - parseInt(a.priority));

  return (
    <div className="p-6 lg:p-8 max-w-5xl mx-auto space-y-6">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-5 right-5 z-[200] px-5 py-3 rounded-xl shadow-xl text-sm font-semibold animate-fade-in
          ${toast.type === "ok" ? "bg-emerald-600 text-white" : "bg-red-600 text-white"}`}>
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
        {["3", "2", "1", "0"].map((p) => {
          const count = tickets.filter((t) => t.priority === p).length;
          const cfg = PRIORITY_MAP[p];
          return (
            <div key={p} className={`glass-card px-4 py-3 flex items-center gap-3 border ${cfg.color}`}>
              <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${cfg.dot}`} />
              <div>
                <p className="text-xs font-medium opacity-70">{cfg.label}</p>
                <p className="text-xl font-bold">{count}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Liste */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="glass-card h-20 animate-pulse opacity-50" />
          ))}
        </div>
      ) : sorted.length === 0 ? (
        <div className="glass-card flex flex-col items-center justify-center py-20 text-center">
          <Inbox size={40} className="text-[hsl(var(--muted-foreground)/0.4)] mb-3" />
          <h3 className="text-lg font-semibold">File d&apos;attente vide !</h3>
          <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1">Tous les tickets ont été pris en charge.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {sorted.map((ticket) => {
            const pCfg = PRIORITY_MAP[ticket.priority] ?? PRIORITY_MAP["1"];
            return (
              <div
                key={ticket.id}
                className="glass-card p-4 flex flex-col sm:flex-row sm:items-center gap-4 hover:shadow-md transition-all duration-200 group"
              >
                {/* Priority dot + content */}
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <span className={`w-2.5 h-2.5 rounded-full mt-1.5 flex-shrink-0 ${pCfg.dot}`} />
                  <div className="min-w-0">
                    <Link
                      href={`/tech/tickets/${ticket.id}`}
                      className="font-semibold text-sm hover:text-[hsl(var(--primary))] transition-colors truncate block"
                    >
                      #{ticket.id} — {ticket.name}
                    </Link>
                    <p className="text-xs text-[hsl(var(--muted-foreground))] line-clamp-1 mt-0.5">
                      {ticket.description}
                    </p>
                    <div className="flex flex-wrap items-center gap-2 mt-2">
                      <span className={`inline-flex items-center gap-1 text-[0.65rem] font-semibold px-2 py-0.5 rounded-full border ${pCfg.color}`}>
                        <AlertTriangle size={10} /> {pCfg.label}
                      </span>
                      {ticket.user_id && (
                        <span className="inline-flex items-center gap-1 text-[0.65rem] text-[hsl(var(--muted-foreground))]">
                          <User2 size={10} /> {ticket.user_id}
                        </span>
                      )}
                      {ticket.create_date && (
                        <span className="inline-flex items-center gap-1 text-[0.65rem] text-[hsl(var(--muted-foreground))]">
                          <Clock size={10} /> {new Date(ticket.create_date).toLocaleDateString("fr-FR")}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* SLA + Action */}
                <div className="flex flex-row sm:flex-col items-center sm:items-end gap-3 flex-shrink-0">
                  <SlaBadge slaDeadline={ticket.sla_deadline} compact />
                  <button
                    disabled={assigning === ticket.id}
                    onClick={() => handleAssign(ticket.id)}
                    className="btn-primary text-xs px-4 py-1.5 rounded-lg disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {assigning === ticket.id ? "En cours…" : "Prendre en charge"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function TechQueuePage() {
  return (
    <ProtectedRoute roles={["tech", "admin"]}>
      <QueuePage />
    </ProtectedRoute>
  );
}
