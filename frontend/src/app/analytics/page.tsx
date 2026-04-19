"use client";

import { useState, useEffect } from "react";
import axios from "axios";
import { Ticket, Clock, CheckCircle2, AlertTriangle, BarChart3, Calendar, Shield, Activity, Target, TrendingUp } from "lucide-react";
import StatsCard from "@/components/StatsCard";
import ProtectedRoute from "@/components/ProtectedRoute";
import { useAuth } from "@/lib/auth";
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer,
  PieChart, Pie, Cell, 
  BarChart, Bar
} from "recharts";

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#06b6d4'];

function AnalyticsDashboard() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState("all");
  const [data, setData] = useState({
    counters: { total: 0, overdue: 0, at_risk: 0, in_progress: 0, resolved: 0 },
    categories: [],
    trend: [],
    kpis: { mttr_hours: 0, sla_compliance: 100 }
  });

  const fetchStats = async (selectedPeriod: string) => {
    if (!user) return;
    setLoading(true);
    try {
      const isTech = user?.x_support_role === 'tech';
      const endpoint = isTech 
        ? `http://localhost:8069/api/tech/stats?period=${selectedPeriod}&tech_id=${user.id}`
        : `http://localhost:8069/api/admin/stats?period=${selectedPeriod}`;

      const res = await axios.get(endpoint);
      if (res.data.status === 200) {
        setData(res.data.data);
      }
    } catch (e) {
      console.error("Erreur backend Odoo", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats(period);
  }, [period, user]);

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-[hsl(var(--card))] border border-[hsl(var(--border))] shadow-lg p-3 rounded-xl text-sm font-semibold relative z-50">
          <p className="text-[hsl(var(--muted-foreground))] mb-1">{label}</p>
          <p style={{ color: payload[0].color || payload[0].payload.fill }}>
            {payload[0].name}: {payload[0].value}
          </p>
        </div>
      );
    }
    return null;
  };

  const isTechUser = user?.x_support_role === 'tech';
  const pieData = isTechUser 
    ? [
        { name: "Résolus", value: data.counters.resolved },
        { name: "À résoudre", value: data.counters.overdue + data.counters.at_risk + data.counters.in_progress }
      ].filter(d => d.value > 0) 
    : data.categories;
  const pieTitle = isTechUser ? "Progression des Tickets" : "Répartition IA (Catégories)";

  return (
    <div className="p-6 lg:p-8 max-w-[1400px] mx-auto space-y-6">
      {/* HEADER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 animate-fade-in mb-8">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-[hsl(var(--primary)/0.2)] flex items-center justify-center text-[hsl(var(--primary))] shadow-sm">
            <BarChart3 size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-tight">Tableau de Bord Global</h1>
            <p className="text-sm font-medium text-[hsl(var(--muted-foreground))] mt-0.5">
              Supervision IT, Performances et SLAs
            </p>
          </div>
        </div>
        
        {/* FILTERS */}
        <div className="flex bg-[hsl(var(--muted)/0.3)] p-1.5 rounded-xl border border-[hsl(var(--border)/0.5)] shadow-sm">
          {[
            { id: "today", label: "Aujourd'hui" },
            { id: "week", label: "7 Jours" },
            { id: "month", label: "Mois" },
            { id: "all", label: "Global" }
          ].map((p) => (
            <button
              key={p.id}
              onClick={() => setPeriod(p.id)}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
                period === p.id 
                  ? "bg-[hsl(var(--background))] text-[hsl(var(--primary))] shadow-sm border border-[hsl(var(--border)/0.5)]" 
                  : "text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] border border-transparent"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* KPI CARDS */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
        <StatsCard title="Total Tickets" value={data.counters.total} icon={<Ticket size={20} />} color="#6366f1" loading={loading} delay={0} />
        <StatsCard title="En Traitement" value={(data.counters.overdue || 0) + (data.counters.at_risk || 0) + (data.counters.in_progress || 0)} icon={<Activity size={20} />} color="#f59e0b" loading={loading} delay={80} />
        <StatsCard title="MTTR (Heures)" value={data.kpis.mttr_hours || 0} icon={<Clock size={20} />} color="#ff6d5a" loading={loading} delay={160} />
        <StatsCard title="SLA Respecté" value={`${data.kpis.sla_compliance || 0}%`} icon={<Shield size={20} />} color="#10b981" loading={loading} delay={240} />
      </div>

      {/* CHARTS ROW 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fade-in" style={{ animationDelay: "0.2s" }}>
        
        {/* LINE CHART */}
        <div className="lg:col-span-2 glass-card p-6 flex flex-col rounded-2xl shadow-sm border border-[hsl(var(--border)/0.5)]">
          <h3 className="text-sm font-bold uppercase tracking-wider text-[hsl(var(--muted-foreground))] flex items-center gap-2 mb-6">
            <TrendingUp size={16} /> Évolution des tickets
          </h3>
          <div className="flex-1 min-h-[300px]">
            {loading ? (
              <div className="w-full h-full flex items-center justify-center">
                 <span className="text-xs font-bold text-[hsl(var(--muted-foreground))] animate-pulse">Chargement Analytics...</span>
              </div>
            ) : data.trend.length === 0 ? (
              <div className="w-full h-full flex items-center justify-center flex-col text-[hsl(var(--muted-foreground))]">
                <BarChart3 opacity={0.3} size={40} className="mb-2" />
                <span className="text-xs font-medium">Aucune donnée</span>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data.trend} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorTickets" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.4}/>
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                  <RechartsTooltip content={<CustomTooltip />} cursor={{ stroke: 'hsl(var(--primary)/0.5)', strokeWidth: 1, strokeDasharray: '4 4' }} />
                  <Area type="monotone" dataKey="tickets" name="Nouveaux Tickets" stroke="hsl(var(--primary))" strokeWidth={4} fillOpacity={1} fill="url(#colorTickets)" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* PIE CHART */}
        <div className="glass-card p-6 flex flex-col rounded-2xl shadow-sm border border-[hsl(var(--border)/0.5)]">
          <h3 className="text-sm font-bold uppercase tracking-wider text-[hsl(var(--muted-foreground))] flex items-center gap-2 mb-6">
            <Target size={16} /> {pieTitle}
          </h3>
          <div className="flex-1 min-h-[300px] relative flex flex-col justify-center">
            {loading ? (
              <div className="w-full h-full flex items-center justify-center">
                 <span className="text-xs font-bold text-[hsl(var(--muted-foreground))] animate-pulse">Chargement Analytics...</span>
              </div>
            ) : pieData.length === 0 ? (
              <div className="w-full h-full flex items-center justify-center flex-col text-[hsl(var(--muted-foreground))]">
                <BarChart3 opacity={0.3} size={40} className="mb-2" />
                <span className="text-xs font-medium">Aucune donnée</span>
              </div>
            ) : (
              <div className="relative w-full h-[220px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={65}
                      outerRadius={90}
                      paddingAngle={4}
                      dataKey="value"
                      stroke="none"
                      cornerRadius={4}
                    >
                      {pieData.map((entry: any, index: number) => (
                        <Cell key={`cell-${index}`} fill={isTechUser ? (entry.name === "Résolus" ? '#10b981' : '#f59e0b') : COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <RechartsTooltip content={<CustomTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
                
                {/* Center Label */}
                <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-center pointer-events-none">
                  <span className="text-3xl font-black text-[hsl(var(--foreground))]">
                    {isTechUser ? (data.counters.resolved + data.counters.overdue + data.counters.at_risk + data.counters.in_progress) : data.counters.total}
                  </span>
                  <p className="text-[0.65rem] font-bold uppercase tracking-widest text-[hsl(var(--muted-foreground))]">Total</p>
                </div>
              </div>
            )}
            
            {/* Legend */}
            {!loading && pieData.length > 0 && (
              <div className="flex flex-wrap justify-center gap-x-4 gap-y-2 mt-4 max-h-[80px] overflow-y-auto custom-scrollbar">
                {pieData.map((c: any, i: number) => (
                  <div key={i} className="flex items-center gap-2 text-xs font-medium">
                    <div className="w-3 h-3 rounded-md shadow-sm" style={{ backgroundColor: isTechUser ? (c.name === "Résolus" ? '#10b981' : '#f59e0b') : COLORS[i % COLORS.length] }} />
                    <span className="text-[hsl(var(--foreground))] opacity-80">{c.name} <span className="opacity-60 ml-1">({c.value})</span></span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
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
