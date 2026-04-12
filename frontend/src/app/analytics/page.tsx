"use client";

import { useState, useEffect } from "react";
import axios from "axios";
import { Ticket, Clock, CheckCircle2, AlertTriangle, BarChart3, TrendingUp } from "lucide-react";
import StatsCard from "@/components/StatsCard";
import ProtectedRoute from "@/components/ProtectedRoute";
import { useAuth } from "@/lib/auth";

function AnalyticsDashboard() {
  const { user } = useAuth();
  const [tickets, setTickets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTickets = async () => {
    try {
      const res = await axios.get("http://localhost:8069/api/tickets");
      if (res.data.status === 200) {
        setTickets(res.data.data);
      }
    } catch (e) {
      console.error("Erreur backend Odoo", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTickets();
  }, []);

  const totalTickets = tickets.length;
  const openCount = tickets.filter((t) => {
    const s = (t.state || "").toLowerCase();
    return s.includes("nouveau") || s.includes("new") || s.includes("ouvert");
  }).length;
  const inProgressCount = tickets.filter((t) => {
    const s = (t.state || "").toLowerCase();
    return s.includes("cours") || s.includes("progress") || s.includes("attente");
  }).length;
  const resolvedCount = tickets.filter((t) => {
    const s = (t.state || "").toLowerCase();
    return s.includes("résolu") || s.includes("resolved") || s.includes("done") || s.includes("fermé");
  }).length;

  return (
    <div className="p-6 lg:p-8 max-w-[1400px] mx-auto space-y-6">
      <div className="flex items-center gap-3 animate-fade-in mb-8">
        <div className="w-12 h-12 rounded-2xl bg-[hsl(var(--primary)/0.2)] flex items-center justify-center text-[hsl(var(--primary))]">
          <BarChart3 size={24} />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Analytiques de la plateforme</h1>
          <p className="text-sm text-[hsl(var(--muted-foreground))] mt-0.5">
            Vue d'ensemble et performances globales ({user?.name})
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatsCard title="Total Tickets" value={totalTickets} icon={<Ticket size={20} />} color="#6366f1" loading={loading} delay={0} />
        <StatsCard title="Nouveaux" value={openCount} icon={<AlertTriangle size={20} />} color="#f59e0b" loading={loading} delay={80} />
        <StatsCard title="En Cours" value={inProgressCount} icon={<Clock size={20} />} color="#ff6d5a" loading={loading} delay={160} />
        <StatsCard title="Résolus" value={resolvedCount} icon={<CheckCircle2 size={20} />} color="#10b981" loading={loading} delay={240} />
      </div>

      <div className="glass-card p-8 flex flex-col items-center justify-center text-center animate-fade-in" style={{ animationDelay: "0.3s" }}>
        <div className="w-16 h-16 rounded-full bg-[hsl(var(--muted))] flex items-center justify-center mb-4">
          <TrendingUp size={28} className="text-[hsl(var(--muted-foreground)/0.5)]" />
        </div>
        <h3 className="text-xl font-semibold mb-2">Graphiques Détaillés</h3>
        <p className="text-sm text-[hsl(var(--muted-foreground))] max-w-sm mb-6">
          La section des graphiques analytiques (temps de résolution, volumes par catégorie) est en cours de développement.
        </p>
      </div>
    </div>
  );
}

export default function AnalyticsPage() {
  return (
    <ProtectedRoute>
      <AnalyticsDashboard />
    </ProtectedRoute>
  );
}
