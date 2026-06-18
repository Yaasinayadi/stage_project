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
  ChevronLeft,
  ChevronRight,
  X,
  ExternalLink,
  Info,
} from "lucide-react";
import StatsCard from "@/components/StatsCard";
import ProtectedRoute from "@/components/ProtectedRoute";
import SlaPerformanceModal from "@/components/SlaPerformanceModal";
import NotificationBell from "@/components/NotificationBell";
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
  "#6366f1",
  "#10b981",
  "#f59e0b",
  "#ec4899",
  "#8b5cf6",
  "#06b6d4",
  "#ef4444",
  "#84cc16",
  "#14b8a6",
  "#3b82f6",
  "#d946ef",
  "#f97316",
  "#64748b",
  "#a855f7",
  "#eab308",
];

/* ── Period filter pills ─────────────────────────────────────────── */
const VISIBLE_PERIODS = [
  { id: "today", label: "Aujourd'hui" },
  { id: "week", label: "7 Jours" },
  { id: "month", label: "Mois" },
  { id: "all", label: "Global" },
];
const MORE_PERIODS = [
  { id: "yesterday", label: "Hier" },
  { id: "30days", label: "30 Jours" },
];

/* ── Custom tooltip for AreaChart ───────────────────────────── */
const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div
        className="bg-[hsl(var(--card))] border border-[hsl(var(--border))] shadow-2xl px-3 py-2 rounded-xl text-sm z-[100] text-[hsl(var(--foreground))] pointer-events-none"
        style={{ backgroundColor: "hsl(var(--card))" }}
      >
        <p className="text-[hsl(var(--muted-foreground))] text-[10px] mb-0.5">{label}</p>
        <p style={{ color: payload[0].color }} className="font-bold">
          {payload[0].name}: <span>{payload[0].value}</span>
        </p>
      </div>
    );
  }
  return null;
};

/* ── Pie active shape with liaison ──────────────────────────────── */
const RADIAN = Math.PI / 180;
const renderPieActiveShape = (props: any) => {
  const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill, payload, value } = props;
  const midAngle = (startAngle + endAngle) / 2;
  const labelR = outerRadius + 24; // Push label 24px outside
  let lx = cx + labelR * Math.cos(-midAngle * RADIAN);
  let ly = cy + labelR * Math.sin(-midAngle * RADIAN);

  // Manual offsets to perfect the visual organization (stronger adjustments for presentation)
  const nameLower = (payload.name || "").toLowerCase();
  if (nameLower.includes("matériel") || nameLower.includes("materiel")) {
    ly += 40; // Move down
    lx += 55; // Move RIGHT (inwards, away from the left edge to prevent clipping)
  } else if (nameLower.includes("infrastruct")) {
    ly -= 35; // Move up
    lx -= 55; // Move LEFT (inwards, away from the right edge to prevent clipping)
  }

  // Use a very large fixed container width to guarantee NO text clipping.
  // The flex layout inside will auto-align the actual card perfectly to the line.
  const containerW = 300; 
  const boxH = 34;
  const isLeft = midAngle > 90 && midAngle < 270;
  
  // If on the left side, the container spans [lx - 300, lx]. Flex-end pushes the card to touch lx.
  // If on the right side, the container spans [lx, lx + 300]. Flex-start pushes the card to touch lx.
  const bx = isLeft ? lx - containerW : lx; 
  const by = ly - boxH / 2;

  return (
    <g style={{ outline: 'none' }}>
      {/* 1. Draw the slice exactly as it is (no zoom) */}
      <path
        d={[
          `M`, cx + innerRadius * Math.cos(-startAngle * RADIAN), cy + innerRadius * Math.sin(-startAngle * RADIAN),
          `A`, innerRadius, innerRadius, 0, Math.abs(endAngle - startAngle) > 180 ? 1 : 0, 0,
          cx + innerRadius * Math.cos(-endAngle * RADIAN), cy + innerRadius * Math.sin(-endAngle * RADIAN),
          `L`, cx + outerRadius * Math.cos(-endAngle * RADIAN), cy + outerRadius * Math.sin(-endAngle * RADIAN),
          `A`, outerRadius, outerRadius, 0, Math.abs(endAngle - startAngle) > 180 ? 1 : 0, 1,
          cx + outerRadius * Math.cos(-startAngle * RADIAN), cy + outerRadius * Math.sin(-startAngle * RADIAN),
          `Z`,
        ].join(' ')}
        fill={fill}
      />
      {/* 2. Liaison line */}
      <line
        x1={cx + outerRadius * Math.cos(-midAngle * RADIAN)}
        y1={cy + outerRadius * Math.sin(-midAngle * RADIAN)}
        x2={lx}
        y2={ly}
        stroke={fill}
        strokeWidth={1.5}
        strokeDasharray="3 3"
        opacity={0.8}
      />
      {/* 3. The card label */}
      <foreignObject x={bx} y={by} width={containerW} height={boxH + 20} style={{ overflow: 'visible', outline: 'none' }}>
        <div style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "flex-start",
          justifyContent: isLeft ? "flex-end" : "flex-start",
          paddingTop: "2px" // slight padding to account for shadow
        }}>
          <div
            style={{
              backgroundColor: "hsl(var(--card))",
              border: "1px solid hsl(var(--border))",
              borderRadius: "10px",
              padding: "6px 12px",
              boxShadow: "0 6px 16px rgba(0,0,0,0.25)",
              whiteSpace: "nowrap",
              fontSize: "13px",
              fontWeight: 800,
              color: fill,
              lineHeight: 1.2,
            }}
          >
            {payload.name}: {value}
          </div>
        </div>
      </foreignObject>
    </g>
  );
};

/* ── Main component ──────────────────────────────────────────────── */
function AnalyticsDashboard() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState("all");
  const [customStartDate, setCustomStartDate] = useState("");
  const [customEndDate, setCustomEndDate] = useState("");
  const [isMorePeriodsOpen, setIsMorePeriodsOpen] = useState(false);
  const [isSlaModalOpen, setIsSlaModalOpen] = useState(false);
  // Phase 4.2 — Drill-down catégorie IA
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [categoryTickets, setCategoryTickets] = useState<any[]>([]);
  const [loadingCatTickets, setLoadingCatTickets] = useState(false);
  const [drillDownPage, setDrillDownPage] = useState(0);
  const [pieActiveIndex, setPieActiveIndex] = useState<number | null>(null);
  const DRILL_PAGE_SIZE = 4;

  // Reset pie hover tooltip when SLA modal opens to prevent SVG foreignObject z-index bug
  useEffect(() => {
    if (isSlaModalOpen) setPieActiveIndex(null);
  }, [isSlaModalOpen]);

  const fetchCategoryTickets = async (catName: string) => {
    setLoadingCatTickets(true);
    try {
      const res = await axios.get(`${ODOO_URL}/api/tickets`);
      const all: any[] = res.data?.data || [];
      const filtered = all.filter(
        (t: any) => (t.category || "").toLowerCase() === catName.toLowerCase(),
      );
      setCategoryTickets(filtered);
    } catch {
      setCategoryTickets([]);
    } finally {
      setLoadingCatTickets(false);
    }
  };

  const customDateError = (() => {
    if (!customStartDate && !customEndDate) return null;
    const todayStr = new Date().toISOString().split("T")[0];
    if (
      (customStartDate && customStartDate > todayStr) ||
      (customEndDate && customEndDate > todayStr)
    ) {
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
    trend: [] as any[],
    kpis: { mttr_hours: 0, sla_compliance: 100 },
  });

  const fetchStats = async (selectedPeriod: string) => {
    if (!user) return;
    setLoading(true);
    try {
      const isTech = user?.x_support_role === "tech";
      let endpoint = isTech
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

  useEffect(() => {
    fetchStats(period);
  }, [period, user]);

  const isTechUser = user?.x_support_role === "tech";

  const pieData = isTechUser
    ? [
        { name: "Résolus", value: data.counters.resolved },
        {
          name: "À résoudre",
          value:
            data.counters.overdue +
            data.counters.at_risk +
            data.counters.in_progress,
        },
      ].filter((d) => d.value > 0)
    : data.categories;

  const pieTitle = isTechUser
    ? "Progression des Tickets"
    : "Répartition par Catégorie";

  return (
    /* ── outer wrapper: prevents horizontal overflow ── */
    <div className="w-full" onClick={() => setIsMorePeriodsOpen(false)}>
      <div className="p-4 sm:p-6 lg:p-8 max-w-[1400px] mx-auto space-y-6">
        {/* ── HEADER ───────────────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative">
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

          {/* Right section: Period filter + Bell */}
          <div className="flex items-center gap-3 relative">
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
                  MORE_PERIODS.some((p) => p.id === period) ||
                  period === "custom"
                    ? "bg-[hsl(var(--background))] text-[hsl(var(--primary))] shadow-sm border border-[hsl(var(--border)/0.5)]"
                    : "text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] border border-transparent"
                }`}
              >
                {period === "custom" ? (
                  <>
                    <Calendar size={13} />{" "}
                    {customStartDate && customEndDate
                      ? `${new Date(customStartDate).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" })} - ${new Date(customEndDate).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" })}`
                      : "Personnalisé"}
                  </>
                ) : (
                  MORE_PERIODS.find((p) => p.id === period)?.label || (
                    <>
                      <Calendar size={13} /> Plus
                    </>
                  )
                )}
                <ChevronDown
                  size={13}
                  className={`transition-transform ${isMorePeriodsOpen ? "rotate-180" : ""}`}
                />
              </button>
            </div>

            {isMorePeriodsOpen && (
              <div
                className="absolute top-[calc(100%+8px)] right-0 md:right-12 w-64 bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-xl shadow-2xl z-[100] p-2 animate-fade-in text-[hsl(var(--foreground))]"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="space-y-1 mb-2 pb-2 border-b border-[hsl(var(--border)/0.5)]">
                  {MORE_PERIODS.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => {
                        setPeriod(p.id);
                        setIsMorePeriodsOpen(false);
                      }}
                      className={`w-full text-left text-xs px-3 py-2 rounded-md font-semibold transition-colors
                        ${period === p.id ? "bg-[hsl(var(--primary)/0.1)] text-[hsl(var(--primary))]" : "hover:bg-[hsl(var(--muted))] text-[hsl(var(--foreground))]"}`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>

                <div className="px-1 pt-1 space-y-2">
                  <span className="text-[0.65rem] font-bold text-[hsl(var(--muted-foreground))] uppercase tracking-wide px-2">
                    Personnalisé
                  </span>
                  <div className="flex flex-col gap-2 px-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-[hsl(var(--muted-foreground))] w-6">
                        Du
                      </span>
                      <input
                        type="date"
                        max={new Date().toISOString().split("T")[0]}
                        className={`flex-1 bg-[hsl(var(--background))] border rounded text-[10px] p-1.5 outline-none transition-colors ${
                          customDateError &&
                          customStartDate &&
                          (!customEndDate ||
                            customStartDate > customEndDate ||
                            customStartDate >
                              new Date().toISOString().split("T")[0])
                            ? "border-red-500/50 focus:border-red-500"
                            : "border-[hsl(var(--border))] focus:border-[hsl(var(--primary))]"
                        }`}
                        value={customStartDate}
                        onChange={(e) => setCustomStartDate(e.target.value)}
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-[hsl(var(--muted-foreground))] w-6">
                        Au
                      </span>
                      <input
                        type="date"
                        max={new Date().toISOString().split("T")[0]}
                        className={`flex-1 bg-[hsl(var(--background))] border rounded text-[10px] p-1.5 outline-none transition-colors ${
                          customDateError &&
                          customEndDate &&
                          (customStartDate > customEndDate ||
                            customEndDate >
                              new Date().toISOString().split("T")[0])
                            ? "border-red-500/50 focus:border-red-500"
                            : "border-[hsl(var(--border))] focus:border-[hsl(var(--primary))]"
                        }`}
                        value={customEndDate}
                        onChange={(e) => setCustomEndDate(e.target.value)}
                      />
                    </div>
                  </div>
                  {customDateError && (
                    <div className="text-[10px] text-red-500 font-medium px-1 mt-2 leading-tight flex items-start gap-1.5 animate-fade-in">
                      <AlertTriangle
                        size={12}
                        className="flex-shrink-0 mt-0.5"
                      />
                      <span>{customDateError}</span>
                    </div>
                  )}
                  <button
                    disabled={
                      !customStartDate || !customEndDate || !!customDateError
                    }
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

            <div className="hidden md:block">
              <NotificationBell />
            </div>
          </div>
        </div>

        {/* ── KPI CARDS ────────────────────────────────────────────── */}
        {/* 2 col on xs/sm, 4 on lg */}
        <div className="grid gap-2 sm:gap-4 grid-cols-2 lg:grid-cols-4 animate-fade-in [animation-delay:100ms] relative z-40 has-[:hover]:z-[60] pt-4 sm:pt-8">
          <StatsCard
            title="Total Tickets"
            value={data.counters.total}
            icon={<Ticket size={20} />}
            color="#6366f1"
            loading={loading}
            delay={0}
            tooltip="Nombre total de tickets créés sur la période sélectionnée, tous statuts confondus."
          />
          <StatsCard
            title="En Traitement"
            value={
              (data.counters.overdue || 0) +
              (data.counters.at_risk || 0) +
              (data.counters.in_progress || 0)
            }
            icon={<Activity size={20} />}
            color="#f59e0b"
            loading={loading}
            delay={80}
            tooltip="Tickets actuellement actifs : en cours de traitement + à risque SLA + déjà hors délai."
          />
          <StatsCard
            title="MTTR (Heures)"
            value={data.kpis.mttr_hours || 0}
            icon={<Clock size={20} />}
            color="#ff6d5a"
            loading={loading}
            delay={160}
            tooltip="Mean Time To Resolve : temps moyen en heures entre la création et la résolution d’un ticket. Plus c’est bas, mieux c’est."
          />
          <StatsCard
            title="SLA Respecté"
            value={`${data.kpis.sla_compliance || 0}%`}
            icon={<Shield size={20} />}
            color="#10b981"
            loading={loading}
            delay={240}
            onClick={() => { setIsSlaModalOpen(true); setPieActiveIndex(null); }}
            tooltip={
              !isTechUser
                ? "Taux de tickets résolus avant la deadline SLA. Cliquez pour voir le détail par technicien."
                : "Votre taux de tickets résolus avant la deadline SLA. Cliquez pour voir les 10 derniers."
            }
          />
        </div>

        {/* ── CHARTS ROW ───────────────────────────────────────────── */}
        {/* Stack on mobile, side-by-side (2/3 + 1/3) on lg */}
        <div
          className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6 animate-fade-in relative z-40 has-[:hover]:z-[60]"
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
                  <AreaChart
                    data={data.trend}
                    margin={{ top: 10, right: 8, left: -24, bottom: 0 }}
                  >
                    <defs>
                      <linearGradient
                        id="colorTickets"
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop
                          offset="5%"
                          stopColor="hsl(var(--primary))"
                          stopOpacity={0.4}
                        />
                        <stop
                          offset="95%"
                          stopColor="hsl(var(--primary))"
                          stopOpacity={0}
                        />
                      </linearGradient>
                    </defs>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      vertical={false}
                      stroke="hsl(var(--border))"
                    />
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
                      cursor={{
                        stroke: "hsl(var(--primary)/0.5)",
                        strokeWidth: 1,
                        strokeDasharray: "4 4",
                      }}
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
              {!isTechUser && (
                <div className="ml-auto relative group">
                  <Info
                    size={14}
                    className="text-[hsl(var(--muted-foreground))] cursor-help transition-colors group-hover:text-[hsl(var(--foreground))]"
                  />
                  <div
                    className="absolute right-0 bottom-full mb-2 w-48 p-2.5 bg-[hsl(var(--popover))] border border-[hsl(var(--border))] rounded-lg shadow-2xl text-[10px] text-[hsl(var(--popover-foreground))] opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-[100] font-medium text-center normal-case tracking-normal"
                    style={{ backgroundColor: "hsl(var(--popover))" }}
                  >
                    Cliquez sur une tranche pour détailler les tickets
                    <div
                      className="absolute top-full right-[3px] border-[6px] border-transparent"
                      style={{ borderTopColor: "hsl(var(--border))" }}
                    />
                    <div
                      className="absolute top-full right-[4px] border-[5px] border-transparent"
                      style={{ borderTopColor: "hsl(var(--popover))" }}
                    />
                  </div>
                </div>
              )}
            </h3>

            <div className="flex-1 flex flex-col justify-center">
              {loading ? (
                <div className="w-full h-[240px] flex items-center justify-center">
                  <span className="text-xs font-bold text-[hsl(var(--muted-foreground))] animate-pulse">
                    Chargement…
                  </span>
                </div>
              ) : pieData.length === 0 ? (
                <div className="w-full h-[240px] flex items-center justify-center flex-col text-[hsl(var(--muted-foreground))]">
                  <BarChart3 opacity={0.3} size={40} className="mb-2" />
                  <span className="text-xs font-medium">Aucune donnée</span>
                </div>
              ) : (
                <>
                  {/* Donut */}
                  <div className="relative w-full h-[240px] [&>div]:!overflow-visible [&_.recharts-wrapper]:!overflow-visible [&_*]:!outline-none [&_*]:!ring-0">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart style={{ overflow: 'visible' }}>
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
                          isAnimationActive={false}
                          {...(pieActiveIndex !== null && !isSlaModalOpen ? { activeIndex: pieActiveIndex } : {})}
                          activeShape={!isTechUser ? renderPieActiveShape : undefined}
                          onMouseEnter={!isTechUser ? (_, index) => setPieActiveIndex(index) : undefined}
                          onMouseLeave={!isTechUser ? () => setPieActiveIndex(null) : undefined}
                          onClick={
                            !isTechUser
                              ? (entry: any) => {
                                  const cat = entry.name;
                                  if (selectedCategory === cat) {
                                    setSelectedCategory(null);
                                    setCategoryTickets([]);
                                    setDrillDownPage(0);
                                  } else {
                                    setSelectedCategory(cat);
                                    fetchCategoryTickets(cat);
                                    setDrillDownPage(0);
                                  }
                                }
                              : undefined
                          }
                          style={
                            !isTechUser ? { cursor: "pointer" } : undefined
                          }
                        >
                          {pieData.map((entry: any, index: number) => (
                            <Cell
                              key={`cell-${index}`}
                              fill={
                                isTechUser
                                  ? entry.name === "Résolus"
                                    ? "#10b981"
                                    : "#f59e0b"
                                  : COLORS[index % COLORS.length]
                              }
                              opacity={
                                selectedCategory &&
                                selectedCategory !== entry.name
                                  ? 0.4
                                  : 1
                              }
                              style={{ outline: 'none' }}
                            />
                          ))}
                        </Pie>
                      </PieChart>
                    </ResponsiveContainer>

                    {/* Center label */}
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center pointer-events-none">
                      <span className="text-2xl sm:text-3xl font-black text-[hsl(var(--foreground))]">
                        {selectedCategory
                          ? categoryTickets.length
                          : isTechUser
                            ? data.counters.resolved +
                              data.counters.overdue +
                              data.counters.at_risk +
                              data.counters.in_progress
                            : data.counters.total}
                      </span>
                      <p className="text-[0.6rem] font-bold uppercase tracking-widest text-[hsl(var(--muted-foreground))]">
                        {selectedCategory ? "tickets" : "Total"}
                      </p>
                    </div>
                  </div>

                  {/* Legend */}
                  <div className="flex flex-wrap justify-center gap-x-3 gap-y-2 mt-3 max-h-[90px] overflow-y-auto custom-scrollbar px-1">
                    {pieData.map((c: any, i: number) => (
                      <button
                        key={i}
                        onClick={
                          !isTechUser
                            ? () => {
                                if (selectedCategory === c.name) {
                                  setSelectedCategory(null);
                                  setCategoryTickets([]);
                                  setDrillDownPage(0);
                                } else {
                                  setSelectedCategory(c.name);
                                  fetchCategoryTickets(c.name);
                                  setDrillDownPage(0);
                                }
                              }
                            : undefined
                        }
                        className={`flex items-center gap-1.5 text-xs font-medium transition-opacity ${
                          !isTechUser ? "cursor-pointer hover:opacity-100" : ""
                        } ${
                          selectedCategory && selectedCategory !== c.name
                            ? "opacity-40"
                            : ""
                        }`}
                      >
                        <div
                          className="w-2.5 h-2.5 rounded-sm flex-shrink-0"
                          style={{
                            backgroundColor: isTechUser
                              ? c.name === "Résolus"
                                ? "#10b981"
                                : "#f59e0b"
                              : COLORS[i % COLORS.length],
                          }}
                        />
                        <span className="text-[hsl(var(--foreground))] opacity-80 truncate max-w-[80px]">
                          {c.name}
                          <span className="opacity-60 ml-1">({c.value})</span>
                        </span>
                      </button>
                    ))}
                  </div>

                  {/* Phase 4.2 — Dréll-down panel : liste des tickets de la catégorie */}
                  {selectedCategory &&
                    !isTechUser &&
                    (() => {
                      const selIdx = pieData.findIndex(
                        (p: any) => p.name === selectedCategory,
                      );
                      const selColor =
                        COLORS[selIdx % COLORS.length] || "hsl(var(--primary))";

                      return (
                        <div className="mt-5 rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] shadow-lg overflow-hidden animate-fade-in flex flex-col min-h-[340px] transition-all">
                          {/* Header */}
                          <div className="flex items-center justify-between px-4 py-3 bg-[hsl(var(--muted)/0.3)] border-b border-[hsl(var(--border))]">
                            <div className="flex items-center gap-2">
                              <div
                                className="w-2.5 h-2.5 rounded-full shadow-sm"
                                style={{ backgroundColor: selColor }}
                              />
                              <h4 className="text-xs font-bold text-[hsl(var(--foreground))] uppercase tracking-wide">
                                {selectedCategory}
                              </h4>
                              <span className="ml-1 text-[10px] font-semibold text-[hsl(var(--muted-foreground))] bg-[hsl(var(--muted))] px-1.5 py-0.5 rounded-md">
                                {categoryTickets.length}
                              </span>
                            </div>
                            <button
                              onClick={() => {
                                setSelectedCategory(null);
                                setCategoryTickets([]);
                              }}
                              className="p-1 rounded-md hover:bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors"
                            >
                              <X size={14} />
                            </button>
                          </div>

                          {/* Paginated Ticket Cards */}
                          {(() => {
                            const totalPages = Math.ceil(categoryTickets.length / DRILL_PAGE_SIZE);
                            const pageTickets = categoryTickets.slice(
                              drillDownPage * DRILL_PAGE_SIZE,
                              (drillDownPage + 1) * DRILL_PAGE_SIZE
                            );
                            return (
                              <>
                                <div className="p-2 space-y-2 flex-1">
                                  {loadingCatTickets ? (
                                    <div className="flex flex-col items-center justify-center py-6 gap-2">
                                      <Activity size={18} className="text-[hsl(var(--primary))] animate-pulse" />
                                      <span className="text-[10px] font-medium text-[hsl(var(--muted-foreground))]">Chargement…</span>
                                    </div>
                                  ) : categoryTickets.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center py-6">
                                      <span className="text-[10px] font-medium text-[hsl(var(--muted-foreground))]">Aucun ticket dans cette catégorie</span>
                                    </div>
                                  ) : (
                                    pageTickets.map((t: any) => (
                                      <div
                                        key={t.id}
                                        className="group flex flex-col gap-1.5 p-2.5 rounded-xl bg-[hsl(var(--muted)/0.3)] hover:bg-[hsl(var(--muted)/0.5)] transition-colors border border-[hsl(var(--border)/0.5)] hover:border-[hsl(var(--border))]"
                                      >
                                        {/* Top row: ID + Status */}
                                        <div className="flex items-center justify-between gap-2">
                                          <span className="text-[10px] font-black text-[hsl(var(--muted-foreground))] tracking-wide">
                                            #{String(t.id).padStart(4, "0")}
                                          </span>
                                          <span className={`text-[9px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider flex-shrink-0 ${
                                            t.state === "resolved"
                                              ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20"
                                              : t.state === "escalated"
                                                ? "bg-orange-500/10 text-orange-500 border border-orange-500/20"
                                                : "bg-blue-500/10 text-blue-500 border border-blue-500/20"
                                          }`}>
                                            {t.state === "resolved" ? "✓ Résolu" : t.state === "escalated" ? "⚡ Escaladé" : "⏳ En cours"}
                                          </span>
                                        </div>
                                        {/* Title - full wrap, no clamping to guarantee full title visibility */}
                                        <p className="text-[11.5px] font-semibold text-[hsl(var(--foreground))] line-clamp-none leading-snug group-hover:text-[hsl(var(--primary))] transition-colors">
                                          {t.name}
                                        </p>
                                      </div>
                                    ))
                                  )}
                                </div>

                                {/* Pagination footer */}
                                {totalPages > 1 && (
                                  <div className="flex items-center justify-between px-3 py-2 border-t border-[hsl(var(--border))] bg-[hsl(var(--muted)/0.2)]">
                                    <button
                                      onClick={() => setDrillDownPage(p => Math.max(0, p - 1))}
                                      disabled={drillDownPage === 0}
                                      className="flex items-center gap-1 text-[10px] font-bold px-2.5 py-1.5 rounded-lg bg-[hsl(var(--muted))] hover:bg-[hsl(var(--border))] disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-[hsl(var(--foreground))]"
                                    >
                                      <ChevronLeft size={12} /> Préc.
                                    </button>
                                    <span className="text-[10px] font-semibold text-[hsl(var(--muted-foreground))]">
                                      {drillDownPage + 1} / {totalPages}
                                      <span className="ml-1 opacity-60">({categoryTickets.length} tickets)</span>
                                    </span>
                                    <button
                                      onClick={() => setDrillDownPage(p => Math.min(totalPages - 1, p + 1))}
                                      disabled={drillDownPage === totalPages - 1}
                                      className="flex items-center gap-1 text-[10px] font-bold px-2.5 py-1.5 rounded-lg bg-[hsl(var(--muted))] hover:bg-[hsl(var(--border))] disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-[hsl(var(--foreground))]"
                                    >
                                      Suiv. <ChevronRight size={12} />
                                    </button>
                                  </div>
                                )}
                              </>
                            );
                          })()}
                        </div>
                      );
                    })()}
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
