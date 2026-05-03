"use client";

import { useState, useEffect } from "react";
import {
  X,
  Trophy,
  AlertCircle,
  Clock,
  CheckCircle2,
  Shield,
} from "lucide-react";
import axios from "axios";
import { ODOO_URL } from "@/lib/config";
import { useAuth } from "@/lib/auth";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  PieChart,
  Pie,
} from "recharts";

type TechPerformance = {
  id: number;
  name: string;
  avatar_url: string;
  volume: number;
  breached_volume: number;
  sla_score: number;
  mttr: number;
};

type SlaPerformanceModalProps = {
  isOpen: boolean;
  onClose: () => void;
  period?: string; // Optional, defaults to local state
};

export default function SlaPerformanceModal({
  isOpen,
  onClose,
}: SlaPerformanceModalProps) {
  const { user } = useAuth();
  const [data, setData] = useState<TechPerformance[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"chart" | "ranking">("chart");
  const [modalPeriod, setModalPeriod] = useState<
    "today" | "week" | "month" | "all"
  >("month");

  const isTechUser = user?.x_support_role === "tech";

  useEffect(() => {
    if (!isOpen || !user) return;

    const fetchData = async () => {
      setLoading(true);
      try {
        let url = `${ODOO_URL}/api/admin/technicians/performance?period=${modalPeriod}`;
        if (isTechUser) {
          url += `&tech_id=${user.id}`;
        }
        const res = await axios.get(url);
        if (res.data.status === 200) {
          setData(res.data.data);
        }
      } catch (error) {
        console.error("Erreur chargement performance SLA", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [isOpen, modalPeriod, user, isTechUser]);

  if (!isOpen) return null;

  const techData = isTechUser && data.length > 0 ? data[0] : null;

  const getPeriodLabel = (p: string) => {
    switch (p) {
      case "today":
        return "Aujourd'hui";
      case "week":
        return "Cette semaine";
      case "month":
        return "Ce mois-ci";
      default:
        return "Global";
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in" onClick={onClose}>
      <div 
        className={`bg-[hsl(var(--background))] border border-[hsl(var(--border))] rounded-2xl shadow-2xl w-full ${isTechUser ? 'max-w-3xl' : 'max-w-4xl'} max-h-[90vh] overflow-hidden flex flex-col`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-6 border-b border-[hsl(var(--border))] flex flex-col md:flex-row md:items-center justify-between bg-[hsl(var(--muted)/0.3)] gap-4">
          <div className="flex-1">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <Trophy className="text-yellow-500" size={24} />
              {isTechUser
                ? "Mes Performances SLA"
                : "Détails de Performance SLA"}
            </h2>
            <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1">
              {isTechUser
                ? "Suivez vos indicateurs de résolution et vos délais d'intervention."
                : "Analyse détaillée du respect des délais par technicien."}
            </p>
          </div>

          {/* Period Filter */}
          <div className="flex bg-[hsl(var(--muted))] p-1 rounded-lg border border-[hsl(var(--border))]">
            {[
              { id: "today", label: "Aujourd'hui" },
              { id: "week", label: "Semaine" },
              { id: "month", label: "Mois" },
              { id: "all", label: "Global" },
            ].map((p) => (
              <button
                key={p.id}
                onClick={() => setModalPeriod(p.id as any)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                  modalPeriod === p.id
                    ? "bg-[hsl(var(--card))] text-[hsl(var(--foreground))] shadow-sm"
                    : "text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          <button
            onClick={onClose}
            className="p-2 hover:bg-[hsl(var(--muted))] rounded-full transition-colors flex-shrink-0"
          >
            <X size={20} />
          </button>
        </div>

        {/* Tabs (Admin Only) */}
        {!isTechUser && (
          <div className="flex border-b border-[hsl(var(--border))] px-6 bg-[hsl(var(--muted)/0.1)]">
            <button
              onClick={() => setActiveTab("chart")}
              className={`px-4 py-3 text-sm font-semibold border-b-2 transition-colors ${
                activeTab === "chart"
                  ? "border-[hsl(var(--primary))] text-[hsl(var(--primary))]"
                  : "border-transparent text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
              }`}
            >
              Vue Graphique
            </button>
            <button
              onClick={() => setActiveTab("ranking")}
              className={`px-4 py-3 text-sm font-semibold border-b-2 transition-colors ${
                activeTab === "ranking"
                  ? "border-[hsl(var(--primary))] text-[hsl(var(--primary))]"
                  : "border-transparent text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
              }`}
            >
              Classement & Détails
            </button>
          </div>
        )}

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1 custom-scrollbar">
          {loading ? (
            <div className="flex justify-center items-center h-40">
              <span className="text-[hsl(var(--muted-foreground))] animate-pulse">
                Chargement des performances...
              </span>
            </div>
          ) : data.length === 0 || (isTechUser && !techData) ? (
            <div className="flex justify-center items-center h-40">
              <span className="text-[hsl(var(--muted-foreground))]">
                Aucune donnée trouvée pour cette période.
              </span>
            </div>
          ) : isTechUser && techData ? (
            /* ========================================================================= */
            /* TECHNICIAN VIEW                                                           */
            /* ========================================================================= */
            <div className="space-y-6 animate-fade-in max-w-2xl mx-auto">
              <div className="flex justify-center mb-2">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-indigo-500/10 text-indigo-500 border border-indigo-500/20">
                  <Shield size={14} />
                  Vos performances - {getPeriodLabel(modalPeriod)}
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Circular Progress Chart */}
                <div className="glass-card p-6 flex flex-col items-center justify-center rounded-2xl shadow-sm border border-[hsl(var(--border)/0.5)]">
                  <h3 className="text-sm font-bold uppercase tracking-wider text-[hsl(var(--muted-foreground))] mb-4 text-center">
                    Score SLA Personnel
                  </h3>

                  <div className="relative w-48 h-48">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={[
                            { name: "SLA Respecté", value: techData.sla_score },
                            {
                              name: "SLA Manqué",
                              value: 100 - techData.sla_score,
                            },
                          ]}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={80}
                          startAngle={90}
                          endAngle={-270}
                          dataKey="value"
                          stroke="none"
                          cornerRadius={4}
                        >
                          <Cell
                            fill={
                              techData.sla_score >= 80
                                ? "#10b981"
                                : techData.sla_score >= 50
                                  ? "#f59e0b"
                                  : "#ef4444"
                            }
                          />
                          <Cell fill="hsl(var(--muted))" />
                        </Pie>
                        <Tooltip
                          formatter={(value) => `${value}%`}
                          contentStyle={{
                            backgroundColor: "hsl(var(--card))",
                            borderColor: "hsl(var(--border))",
                            borderRadius: "8px",
                          }}
                        />
                      </PieChart>
                    </ResponsiveContainer>

                    {/* Center Percentage */}
                    <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 flex flex-col items-center">
                      <span
                        className={`text-3xl font-black ${
                          techData.sla_score >= 80
                            ? "text-emerald-500"
                            : techData.sla_score >= 50
                              ? "text-yellow-500"
                              : "text-red-500"
                        }`}
                      >
                        {techData.sla_score}%
                      </span>
                    </div>
                  </div>
                </div>

                {/* KPI Metrics */}
                <div className="flex flex-col gap-4">
                  <div className="glass-card p-4 flex flex-col justify-center rounded-2xl shadow-sm border border-[hsl(var(--border)/0.5)]">
                    <div className="flex items-center gap-3 mb-1">
                      <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center">
                        <CheckCircle2 size={20} />
                      </div>
                      <div>
                        <p className="text-[0.65rem] font-bold uppercase tracking-widest text-[hsl(var(--muted-foreground))]">
                          Total Résolus
                        </p>
                        <p className="text-2xl font-black text-[hsl(var(--foreground))]">
                          {techData.volume}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="glass-card p-4 flex flex-col justify-center rounded-2xl shadow-sm border border-[hsl(var(--border)/0.5)]">
                    <div className="flex items-center gap-3 mb-1">
                      <div className="w-10 h-10 rounded-xl bg-red-500/10 text-red-500 flex items-center justify-center">
                        <AlertCircle size={20} />
                      </div>
                      <div>
                        <p className="text-[0.65rem] font-bold uppercase tracking-widest text-[hsl(var(--muted-foreground))]">
                          Hors Délai (SLA Dépassé)
                        </p>
                        <p className="text-2xl font-black text-[hsl(var(--foreground))]">
                          {techData.breached_volume || 0}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="glass-card p-4 flex flex-col justify-center rounded-2xl shadow-sm border border-[hsl(var(--border)/0.5)]">
                    <div className="flex items-center gap-3 mb-1">
                      <div className="w-10 h-10 rounded-xl bg-orange-500/10 text-orange-500 flex items-center justify-center">
                        <Clock size={20} />
                      </div>
                      <div>
                        <p className="text-[0.65rem] font-bold uppercase tracking-widest text-[hsl(var(--muted-foreground))]">
                          Temps Moyen (MTTR)
                        </p>
                        <p className="text-2xl font-black text-[hsl(var(--foreground))]">
                          {techData.mttr} h
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* ========================================================================= */
            /* ADMIN VIEW                                                                */
            /* ========================================================================= */
            <div className="space-y-6">
              {activeTab === "chart" && (
                <div className="bg-[hsl(var(--card))] p-6 rounded-xl border border-[hsl(var(--border))] animate-fade-in shadow-sm">
                  <h3 className="text-sm font-semibold text-[hsl(var(--muted-foreground))] mb-6 uppercase tracking-wider">
                    Comparatif SLA par Technicien (%)
                  </h3>
                  <div className="h-[400px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={data}
                        layout="vertical"
                        margin={{ top: 5, right: 30, left: 40, bottom: 5 }}
                      >
                        <CartesianGrid
                          strokeDasharray="3 3"
                          horizontal={true}
                          vertical={false}
                          stroke="hsl(var(--border))"
                        />
                        <XAxis
                          type="number"
                          domain={[0, 100]}
                          stroke="hsl(var(--muted-foreground))"
                          tick={{ fill: "hsl(var(--muted-foreground))" }}
                        />
                        <YAxis
                          dataKey="name"
                          type="category"
                          width={100}
                          tick={{
                            fill: "hsl(var(--foreground))",
                            fontSize: 13,
                            fontWeight: 500,
                          }}
                        />
                        <Tooltip
                          cursor={{ fill: "hsl(var(--muted)/0.5)" }}
                          contentStyle={{
                            backgroundColor: "hsl(var(--card))",
                            borderColor: "hsl(var(--border))",
                            borderRadius: "8px",
                            color: "hsl(var(--foreground))",
                          }}
                          itemStyle={{ color: "hsl(var(--foreground))" }}
                        />
                        <Bar
                          dataKey="sla_score"
                          name="Score SLA (%)"
                          radius={[0, 4, 4, 0]}
                          barSize={28}
                        >
                          {data.map((entry, index) => (
                            <Cell
                              key={`cell-${index}`}
                              fill={
                                entry.sla_score < 50
                                  ? "#ef4444"
                                  : index === 0 && entry.sla_score > 0
                                    ? "#eab308"
                                    : "#10b981"
                              }
                            />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              {activeTab === "ranking" && (
                <div className="overflow-x-auto rounded-xl border border-[hsl(var(--border))] shadow-sm animate-fade-in">
                  <table className="w-full text-sm text-left">
                    <thead className="text-xs uppercase bg-[hsl(var(--muted)/0.5)] text-[hsl(var(--muted-foreground))]">
                      <tr>
                        <th className="px-6 py-4 font-semibold">Agent</th>
                        <th className="px-6 py-4 font-semibold text-center">
                          Volume (Résolus)
                        </th>
                        <th className="px-6 py-4 font-semibold text-center">
                          MTTR
                        </th>
                        <th className="px-6 py-4 font-semibold text-center">
                          Score SLA
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[hsl(var(--border))]">
                      {data.map((tech, idx) => (
                        <tr
                          key={tech.id}
                          className="bg-[hsl(var(--card))] hover:bg-[hsl(var(--muted)/0.2)] transition-colors"
                        >
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <img
                                src={`${ODOO_URL}${tech.avatar_url}`}
                                alt={tech.name}
                                className="w-10 h-10 rounded-full object-cover border border-[hsl(var(--border))]"
                                onError={(e) => {
                                  (e.target as HTMLImageElement).src =
                                    "https://ui-avatars.com/api/?name=" +
                                    encodeURIComponent(tech.name) +
                                    "&background=random";
                                }}
                              />
                              <div>
                                <div className="font-semibold text-[hsl(var(--foreground))] flex items-center gap-2">
                                  {tech.name}
                                  {idx === 0 && tech.sla_score > 0 && (
                                    <span className="inline-flex items-center gap-1 text-xs font-bold text-yellow-600 bg-yellow-100 dark:bg-yellow-900/30 dark:text-yellow-500 px-2 py-0.5 rounded-full">
                                      <Trophy size={12} /> Champion
                                    </span>
                                  )}
                                </div>
                                <div className="text-xs text-[hsl(var(--muted-foreground))]">
                                  Technicien Support
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-center font-medium">
                            <div className="flex items-center justify-center gap-1.5 text-[hsl(var(--foreground))]">
                              <CheckCircle2
                                size={14}
                                className="text-emerald-500"
                              />
                              {tech.volume}
                            </div>
                          </td>
                          <td className="px-6 py-4 text-center font-medium">
                            <div className="flex items-center justify-center gap-1.5 text-[hsl(var(--foreground))]">
                              <Clock size={14} className="text-blue-500" />
                              {tech.mttr} h
                            </div>
                          </td>
                          <td className="px-6 py-4 text-center">
                            <div
                              className={`inline-flex items-center gap-1.5 font-bold px-2.5 py-1 rounded-full ${
                                tech.sla_score < 50 && tech.volume > 0
                                  ? "text-red-600 bg-red-100 dark:bg-red-900/30 dark:text-red-500 animate-pulse"
                                  : "text-emerald-600 bg-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-500"
                              }`}
                            >
                              {tech.sla_score < 50 && tech.volume > 0 && (
                                <AlertCircle size={14} />
                              )}
                              {tech.sla_score}%
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
