"use client";

import { useState, useEffect } from "react";
import axios from "axios";
import {
  Ticket,
  Clock,
  CheckCircle2,
  AlertTriangle,
  BarChart3,
  Shield,
  Activity,
  Target,
  TrendingUp,
  Calendar,
  ChevronDown,
} from "lucide-react";
import StatsCard from "@/components/StatsCard";
import ProtectedRoute from "@/components/ProtectedRoute";
import SlaPerformanceModal from "@/components/SlaPerformanceModal";
import { useAuth } from "@/lib/auth";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
} from "recharts";
import { ODOO_URL } from "@/lib/config";

const COLORS = [
  "#6366f1","#10b981","#f59e0b","#ec4899","#8b5cf6",
  "#06b6d4","#ef4444","#84cc16","#14b8a6","#3b82f6",
  "#d946ef","#f97316","#64748b","#a855f7","#eab308",
];

/* ── Period filter pills ─────────────────────────────────────────── */
const VISIBLE_PERIODS = [
  { id: "today", label: "Aujourd'hui" },
  { id: "week",  label: "7 Jours"     },
  { id: "month", label: "Mois"        },
  { id: "all",   label: "Global"      },
];
const MORE_PERIODS = [
  { id: "yesterday", label: "Hier" },
  { id: "30days", label: "30 Jours" },
];

/* ── Custom recharts tooltip ─────────────────────────────────────── */
const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-[hsl(var(--card))] border border-[hsl(var(--border))] shadow-lg p-3 rounded-xl text-sm font-semibold z-50">
        <p className="text-[hsl(var(--muted-foreground))] mb-1">{label}</p>
        <p style={{ color: payload[0].color || payload[0].payload.fill }}>
          {payload[0].name}: {payload[0].value}
        </p>
      </div>
    );
  }
  return null;
};

/* ── Main component ──────────────────────────────────────────────── */
function AnalyticsDashboard() {
  const { user } = useAuth();
  const [loading, setLoading]         = useState(true);
  const [period, setPeriod]           = useState("all");
  const [customStartDate, setCustomStartDate] = useState("");
  const [customEndDate, setCustomEndDate] = useState("");
  const [isMorePeriodsOpen, setIsMorePeriodsOpen] = useState(false);
  const [isSlaModalOpen, setIsSlaModalOpen] = useState(false);

  const customDateError = (() => {
    if (!customStartDate && !customEndDate) return null;
    const todayStr = new Date().toISOString().split('T')[0];
    if ((customStartDate && customStartDate > todayStr) || (customEndDate && customEndDate > todayStr)) {
      return "La date ne peut pas être dans le futur.";
    }
    if (customStartDate && customEndDate && customStartDate > customEndDate) {
      return "La date 'Du' doit être avant 'Au'.";
    }
    return null;
  })();
  const [data, setData] = useState({
    counters: { total: 0, overdue: 0, at_risk: 0, in_progress: 0, resolved: 0 },
    categories: [] as any[],
    trend:      [] as any[],
    kpis:       { mttr_hours: 0, sla_compliance: 100 },
  });

  const fetchStats = async (selectedPeriod: string) => {
    if (!user) return;
    setLoading(true);
    try {
      const isTech    = user?.x_support_role === "tech";
      let endpoint  = isTech
        ? `${ODOO_URL}/api/tech/stats?period=${selectedPeriod}&tech_id=${user.id}`
        : `${ODOO_URL}/api/admin/stats?period=${selectedPeriod}`;
      
      if (selectedPeriod === "custom") {
        endpoint += `&start_date=${customStartDate}&end_date=${customEndDate}`;
      }
      
      const res = await axios.get(endpoint);
      if (res.data.status === 200) setData(res.data.data);
    } catch (e) {
      console.error("Erreur backend Odoo", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchStats(period); }, [period, user]);

  const isTechUser = user?.x_support_role === "tech";

  const pieData = isTechUser
    ? [
        { name: "Résolus",    value: data.counters.resolved },
        { name: "À résoudre", value: data.counters.overdue + data.counters.at_risk + data.counters.in_progress },
      ].filter((d) => d.value > 0)
    : data.categories;

  const pieTitle = isTechUser ? "Progression des Tickets" : "Répartition IA (Catégories)";

  return (
    /* ── outer wrapper: prevents horizontal overflow ── */
    <div 
      className="w-full"
      onClick={() => setIsMorePeriodsOpen(false)}
    >
      <div className="p-4 sm:p-6 lg:p-8 max-w-[1400px] mx-auto space-y-6">

        {/* ── HEADER ───────────────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-fade-in relative z-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-[hsl(var(--primary)/0.2)] flex items-center justify-center text-[hsl(var(--primary))] shadow-sm flex-shrink-0">
              <BarChart3 size={22} />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black tracking-tight">
                Tableau de Bord Global
              </h1>
              <p className="text-xs sm:text-sm font-medium text-[hsl(var(--muted-foreground))] mt-0.5">
                Supervision IT, Performances et SLAs
              </p>
            </div>
          </div>

          {/* Period filter */}
          <div className="flex items-center gap-2 relative z-50">
            <div className="flex bg-[hsl(var(--muted)/0.3)] p-1.5 rounded-xl border border-[hsl(var(--border)/0.5)] shadow-sm w-max">
              {/* Primary Tabs */}
              {VISIBLE_PERIODS.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setPeriod(p.id)}
                  className={`px-3 sm:px-4 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                    period === p.id
                      ? "bg-[hsl(var(--background))] text-[hsl(var(--primary))] shadow-sm border border-[hsl(var(--border)/0.5)]"
                      : "text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] border border-transparent"
                  }`}
                >
                  {p.label}
                </button>
              ))}
              
              {/* More button */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setIsMorePeriodsOpen(!isMorePeriodsOpen);
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap ${
                  MORE_PERIODS.some(p => p.id === period) || period === "custom"
                    ? "bg-[hsl(var(--background))] text-[hsl(var(--primary))] shadow-sm border border-[hsl(var(--border)/0.5)]"
                    : "text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] border border-transparent"
                }`}
              >
                {period === "custom" ? (
                  <><Calendar size={13} /> {customStartDate && customEndDate ? `${new Date(customStartDate).toLocaleDateString('fr-FR', {day: '2-digit', month: 'short'})} - ${new Date(customEndDate).toLocaleDateString('fr-FR', {day: '2-digit', month: 'short'})}` : "Personnalisé"}</>
                ) : (
                  MORE_PERIODS.find(p => p.id === period)?.label || <><Calendar size={13} /> Plus</>
                )}
                <ChevronDown size={13} className={`transition-transform ${isMorePeriodsOpen ? "rotate-180" : ""}`} />
              </button>
            </div>

            {isMorePeriodsOpen && (
              <div 
                className="absolute top-[calc(100%+8px)] right-0 w-64 bg-[hsl(var(--popover))] border border-[hsl(var(--border))] rounded-xl shadow-2xl z-[100] p-2 animate-fade-in text-[hsl(var(--popover-foreground))]"
                onClick={e => e.stopPropagation()}
              >
                <div className="space-y-1 mb-2 pb-2 border-b border-[hsl(var(--border)/0.5)]">
                  {MORE_PERIODS.map(p => (
                    <button
                      key={p.id}
                      onClick={() => { setPeriod(p.id); setIsMorePeriodsOpen(false); }}
                      className={`w-full text-left text-xs px-3 py-2 rounded-md font-semibold transition-colors
                        ${period === p.id ? "bg-[hsl(var(--primary)/0.1)] text-[hsl(var(--primary))]" : "hover:bg-[hsl(var(--muted))] text-[hsl(var(--foreground))]"}`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
                
                <div className="px-1 pt-1 space-y-2">
                  <span className="text-[0.65rem] font-bold text-[hsl(var(--muted-foreground))] uppercase tracking-wide px-2">Personnalisé</span>
                  <div className="flex flex-col gap-2 px-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-[hsl(var(--muted-foreground))] w-6">Du</span>
                      <input 
                        type="date" 
                        max={new Date().toISOString().split('T')[0]}
                        className={`flex-1 bg-[hsl(var(--background))] border rounded text-[10px] p-1.5 outline-none transition-colors ${
                          customDateError && customStartDate && (!customEndDate || customStartDate > customEndDate || customStartDate > new Date().toISOString().split('T')[0])
                            ? "border-red-500/50 focus:border-red-500" 
                            : "border-[hsl(var(--border))] focus:border-[hsl(var(--primary))]"
                        }`}
                        value={customStartDate}
                        onChange={e => setCustomStartDate(e.target.value)}
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-[hsl(var(--muted-foreground))] w-6">Au</span>
                      <input 
                        type="date" 
                        max={new Date().toISOString().split('T')[0]}
                        className={`flex-1 bg-[hsl(var(--background))] border rounded text-[10px] p-1.5 outline-none transition-colors ${
                          customDateError && customEndDate && (customStartDate > customEndDate || customEndDate > new Date().toISOString().split('T')[0])
                            ? "border-red-500/50 focus:border-red-500" 
                            : "border-[hsl(var(--border))] focus:border-[hsl(var(--primary))]"
                        }`}
                        value={customEndDate}
                        onChange={e => setCustomEndDate(e.target.value)}
                      />
                    </div>
                  </div>
                  {customDateError && (
                    <div className="text-[10px] text-red-500 font-medium px-1 mt-2 leading-tight flex items-start gap-1.5 animate-fade-in">
                      <AlertTriangle size={12} className="flex-shrink-0 mt-0.5" /> 
                      <span>{customDateError}</span>
                    </div>
                  )}
                  <button
                    disabled={!customStartDate || !customEndDate || !!customDateError}
                    onClick={() => { 
                      if (period === "custom") {
                        fetchStats("custom");
                      } else {
                        setPeriod("custom"); 
                      }
                      setIsMorePeriodsOpen(false); 
                    }}
                    className="w-full mt-2 py-1.5 rounded-lg bg-[hsl(var(--primary))] text-white text-[11px] font-bold disabled:opacity-50 disabled:cursor-not-allowed transition-all hover:opacity-90"
                  >
                    Appliquer la période
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── KPI CARDS ────────────────────────────────────────────── */}
        {/* 2 col on xs/sm, 4 on lg */}
        <div className="grid gap-2 sm:gap-4 grid-cols-2 lg:grid-cols-4 animate-fade-in [animation-delay:100ms]">
          <StatsCard
            title="Total Tickets"
            value={data.counters.total}
            icon={<Ticket size={20} />}
            color="#6366f1"
            loading={loading}
            delay={0}
          />
          <StatsCard
            title="En Traitement"
            value={(data.counters.overdue || 0) + (data.counters.at_risk || 0) + (data.counters.in_progress || 0)}
            icon={<Activity size={20} />}
            color="#f59e0b"
            loading={loading}
            delay={80}
          />
          <StatsCard
            title="MTTR (Heures)"
            value={data.kpis.mttr_hours || 0}
            icon={<Clock size={20} />}
            color="#ff6d5a"
            loading={loading}
            delay={160}
          />
          <StatsCard
            title="SLA Respecté"
            value={`${data.kpis.sla_compliance || 0}%`}
            icon={<Shield size={20} />}
            color="#10b981"
            loading={loading}
            delay={240}
            onClick={() => setIsSlaModalOpen(true)}
            tooltip={
              !isTechUser
                ? "Ce taux représente le pourcentage de tickets résolus avant la deadline par l'équipe technique uniquement."
                : "Ce taux représente votre pourcentage de tickets résolus avant la deadline."
            }
          />
        </div>

        {/* ── CHARTS ROW ───────────────────────────────────────────── */}
        {/* Stack on mobile, side-by-side (2/3 + 1/3) on lg */}
        <div
          className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6 animate-fade-in"
          style={{ animationDelay: "0.2s" }}
        >
          {/* Area Chart — takes 2 columns on lg */}
          <div className="lg:col-span-2 glass-card p-4 sm:p-6 flex flex-col rounded-2xl shadow-sm border border-[hsl(var(--border)/0.5)]">
            <h3 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-[hsl(var(--muted-foreground))] flex items-center gap-2 mb-4 sm:mb-6">
              <TrendingUp size={16} /> Évolution des tickets
            </h3>

            {/* Fixed height that shrinks on mobile */}
            <div className="w-full h-[220px] sm:h-[280px] lg:h-[300px]">
              {loading ? (
                <div className="w-full h-full flex items-center justify-center">
                  <span className="text-xs font-bold text-[hsl(var(--muted-foreground))] animate-pulse">
                    Chargement Analytics…
                  </span>
                </div>
              ) : data.trend.length === 0 ? (
                <div className="w-full h-full flex items-center justify-center flex-col text-[hsl(var(--muted-foreground))]">
                  <BarChart3 opacity={0.3} size={40} className="mb-2" />
                  <span className="text-xs font-medium">Aucune donnée</span>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={data.trend} margin={{ top: 10, right: 8, left: -24, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorTickets" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor="hsl(var(--primary))" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}   />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                    <XAxis
                      dataKey="name"
                      stroke="hsl(var(--muted-foreground))"
                      fontSize={11}
                      tickLine={false}
                      axisLine={false}
                      interval="preserveStartEnd"
                    />
                    <YAxis
                      stroke="hsl(var(--muted-foreground))"
                      fontSize={11}
                      tickLine={false}
                      axisLine={false}
                      width={28}
                    />
                    <RechartsTooltip
                      content={<CustomTooltip />}
                      cursor={{ stroke: "hsl(var(--primary)/0.5)", strokeWidth: 1, strokeDasharray: "4 4" }}
                    />
                    <Area
                      type="monotone"
                      dataKey="tickets"
                      name="Nouveaux Tickets"
                      stroke="hsl(var(--primary))"
                      strokeWidth={3}
                      fillOpacity={1}
                      fill="url(#colorTickets)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Pie Chart */}
          <div className="glass-card p-4 sm:p-6 flex flex-col rounded-2xl shadow-sm border border-[hsl(var(--border)/0.5)]">
            <h3 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-[hsl(var(--muted-foreground))] flex items-center gap-2 mb-4 sm:mb-6">
              <Target size={16} /> {pieTitle}
            </h3>

            <div className="flex-1 flex flex-col justify-center">
              {loading ? (
                <div className="w-full h-[200px] flex items-center justify-center">
                  <span className="text-xs font-bold text-[hsl(var(--muted-foreground))] animate-pulse">
                    Chargement…
                  </span>
                </div>
              ) : pieData.length === 0 ? (
                <div className="w-full h-[200px] flex items-center justify-center flex-col text-[hsl(var(--muted-foreground))]">
                  <BarChart3 opacity={0.3} size={40} className="mb-2" />
                  <span className="text-xs font-medium">Aucune donnée</span>
                </div>
              ) : (
                <>
                  {/* Donut */}
                  <div className="relative w-full h-[200px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={pieData}
                          cx="50%"
                          cy="50%"
                          innerRadius={58}
                          outerRadius={82}
                          paddingAngle={4}
                          dataKey="value"
                          stroke="none"
                          cornerRadius={4}
                        >
                          {pieData.map((entry: any, index: number) => (
                            <Cell
                              key={`cell-${index}`}
                              fill={
                                isTechUser
                                  ? entry.name === "Résolus" ? "#10b981" : "#f59e0b"
                                  : COLORS[index % COLORS.length]
                              }
                            />
                          ))}
                        </Pie>
                        <RechartsTooltip content={<CustomTooltip />} />
                      </PieChart>
                    </ResponsiveContainer>

                    {/* Center label */}
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center pointer-events-none">
                      <span className="text-2xl sm:text-3xl font-black text-[hsl(var(--foreground))]">
                        {isTechUser
                          ? data.counters.resolved + data.counters.overdue + data.counters.at_risk + data.counters.in_progress
                          : data.counters.total}
                      </span>
                      <p className="text-[0.6rem] font-bold uppercase tracking-widest text-[hsl(var(--muted-foreground))]">
                        Total
                      </p>
                    </div>
                  </div>

                  {/* Legend */}
                  <div className="flex flex-wrap justify-center gap-x-3 gap-y-2 mt-3 max-h-[90px] overflow-y-auto custom-scrollbar px-1">
                    {pieData.map((c: any, i: number) => (
                      <div key={i} className="flex items-center gap-1.5 text-xs font-medium">
                        <div
                          className="w-2.5 h-2.5 rounded-sm flex-shrink-0"
                          style={{
                            backgroundColor: isTechUser
                              ? c.name === "Résolus" ? "#10b981" : "#f59e0b"
                              : COLORS[i % COLORS.length],
                          }}
                        />
                        <span className="text-[hsl(var(--foreground))] opacity-80 truncate max-w-[80px]">
                          {c.name}
                          <span className="opacity-60 ml-1">({c.value})</span>
                        </span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* SLA Modal */}
        <SlaPerformanceModal
          isOpen={isSlaModalOpen}
          onClose={() => setIsSlaModalOpen(false)}
          period={period}
        />
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
