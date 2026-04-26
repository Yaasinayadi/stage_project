"use client";

import { useEffect, useState } from "react";
import axios from "axios";
import { useAuth } from "@/lib/auth";
import {
  Sparkles,
  Ticket,
  Activity,
  BookOpen,
  Clock,
  Loader2,
  TrendingUp,
  Info,
  X,
  CheckCircle2,
  BarChart2,
  ChevronRight,
} from "lucide-react";
import ActivityFeed from "@/components/ActivityFeed";
import Link from "next/link";
import ProtectedRoute from "@/components/ProtectedRoute";
import WelcomeSlider from "./WelcomeSlider";
import TicketModal from "@/components/TicketModal";
import Chatbot from "@/components/Chatbot";
import { ODOO_URL } from "@/lib/config";


// ─── KPI hook ───────────────────────────────────────────────────────────────
type DashboardStats = {
  enCours: number;
  resolus: number;
  total: number;
  totalKnowledge: number;
  loading: boolean;
};

function useDashboardStats(userId: number | undefined, role: string | undefined): DashboardStats {
  const [stats, setStats] = useState<DashboardStats>({
    enCours: 0,
    resolus: 0,
    total: 0,
    totalKnowledge: 0,
    loading: true,
  });

  useEffect(() => {
    if (!userId) return;

    const ticketsUrl =
      role === "user"
        ? `${ODOO_URL}/api/tickets?user_id=${userId}`
        : `${ODOO_URL}/api/tickets`;

    const knowledgeUrl = `${ODOO_URL}/api/knowledge?limit=1`;

    Promise.all([
      axios.get(ticketsUrl),
      axios.get(knowledgeUrl)
    ])
      .then(([ticketsRes, knowledgeRes]) => {
        const tickets: { state?: string }[] = ticketsRes.data?.data || [];
        const enCours = tickets.filter((t) => {
          const s = (t.state || "").toLowerCase();
          return (
            s.includes("cours") ||
            s.includes("progress") ||
            s === "new" ||
            s.includes("attente")
          );
        }).length;
        const resolus = tickets.filter((t) => {
          const s = (t.state || "").toLowerCase();
          return (
            s.includes("résol") ||
            s.includes("resolv") ||
            s.includes("done") ||
            s.includes("fermé")
          );
        }).length;

        const totalKnowledge = knowledgeRes.data?.pagination?.total || 0;

        setStats({
          enCours,
          resolus,
          total: tickets.length,
          totalKnowledge,
          loading: false
        });
      })
      .catch(() => setStats((s) => ({ ...s, loading: false })));
  }, [userId, role]);

  return stats;
}

// ─── KPI Badge ───────────────────────────────────────────────────────────────
function KpiBadge({
  loading,
  value,
  label,
  color,
}: {
  loading: boolean;
  value: number;
  label: string;
  color: string;
}) {
  if (loading) {
    return <div className="h-5 w-20 bg-[hsl(var(--muted))] rounded-full animate-pulse mt-3" />;
  }
  return (
    <span
      className="inline-flex items-center gap-1.5 mt-3 text-xs font-bold px-2.5 py-1 rounded-full"
      style={{ backgroundColor: `${color}18`, color }}
    >
      <TrendingUp size={11} />
      {value} {label}
    </span>
  );
}

// ─── Stats Mini-Dashboard (for Card 1) ────────────────────────────────────────
function StatsMiniDashboard({ stats }: { stats: DashboardStats }) {
  const resolusPercent = stats.total > 0 ? Math.round((stats.resolus / stats.total) * 100) : 0;
  const circumference = 2 * Math.PI * 36;
  const strokeDashoffset = stats.loading
    ? circumference
    : circumference - (resolusPercent / 100) * circumference;

  return (
    <div className="flex flex-col items-center justify-center gap-3 min-w-[140px]">
      {/* Circular progress */}
      <div className="relative w-24 h-24 flex items-center justify-center">
        <svg className="w-24 h-24 -rotate-90" viewBox="0 0 80 80">
          {/* Track */}
          <circle
            cx="40"
            cy="40"
            r="36"
            fill="none"
            stroke="hsl(var(--muted))"
            strokeWidth="7"
          />
          {/* Progress */}
          <circle
            cx="40"
            cy="40"
            r="36"
            fill="none"
            stroke="hsl(var(--primary))"
            strokeWidth="7"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            className="transition-all duration-1000 ease-out"
            style={{ filter: "drop-shadow(0 0 6px hsl(var(--primary)/0.5))" }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          {stats.loading ? (
            <Loader2 size={18} className="animate-spin text-[hsl(var(--primary))]" />
          ) : (
            <>
              <span className="text-xl font-bold text-[hsl(var(--foreground))] leading-none">
                {resolusPercent}%
              </span>
              <span className="text-[0.6rem] text-[hsl(var(--muted-foreground))] font-medium">
                résolus
              </span>
            </>
          )}
        </div>
      </div>

      {/* Mini counters */}
      <div className="flex gap-4 text-center">
        <div>
          {stats.loading ? (
            <div className="h-6 w-8 bg-[hsl(var(--muted))] rounded animate-pulse mx-auto" />
          ) : (
            <p className="text-2xl font-bold text-[hsl(var(--primary))] leading-none">
              {stats.enCours}
            </p>
          )}
          <p className="text-[0.65rem] text-[hsl(var(--muted-foreground))] mt-0.5 font-medium">
            En cours
          </p>
        </div>
        <div className="w-px bg-[hsl(var(--border))]" />
        <div>
          {stats.loading ? (
            <div className="h-6 w-8 bg-[hsl(var(--muted))] rounded animate-pulse mx-auto" />
          ) : (
            <p className="text-2xl font-bold text-[#10b981] leading-none">{stats.resolus}</p>
          )}
          <p className="text-[0.65rem] text-[hsl(var(--muted-foreground))] mt-0.5 font-medium">
            Résolus
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── User Guide Modal ─────────────────────────────────────────────────────────
function UserGuideModal({ onClose }: { onClose: () => void }) {
  const steps = [
    {
      icon: <Ticket size={20} />,
      color: "hsl(var(--primary))",
      title: "Créer un ticket",
      description: "Décrivez votre problème IT. L'IA l'analyse, le catégorise et l'assigne automatiquement au bon technicien.",
    },
    {
      icon: <BarChart2 size={20} />,
      color: "#10b981",
      title: "Suivre l'avancement",
      description: "Consultez vos statistiques en temps réel depuis le tableau de bord : tickets en cours, résolus et taux de résolution.",
    },
    {
      icon: <BookOpen size={20} />,
      color: "#f59e0b",
      title: "Consulter la Base de Connaissances",
      description: "Accédez aux guides et tutoriels pour résoudre vous-même les problèmes courants et gagner du temps.",
    },
  ];

  return (
    <div
      className="modal-overlay"
      onClick={onClose}
    >
      <div
        className="modal-content w-full max-w-md p-8 relative"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close */}
        <button
          onClick={onClose}
          id="btn-guide-close"
          className="absolute top-4 right-4 p-1.5 rounded-lg hover:bg-[hsl(var(--muted)/0.5)] text-[hsl(var(--muted-foreground))] transition-colors"
        >
          <X size={18} />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-2xl bg-[hsl(var(--primary)/0.1)] text-[hsl(var(--primary))] flex items-center justify-center">
            <Sparkles size={20} />
          </div>
          <div>
            <h2 className="text-xl font-bold text-[hsl(var(--foreground))]">
              Comment utiliser votre espace ?
            </h2>
            <p className="text-sm text-[hsl(var(--muted-foreground))]">Guide en 3 étapes simples</p>
          </div>
        </div>

        {/* Steps */}
        <div className="space-y-5">
          {steps.map((step, idx) => (
            <div key={idx} className="flex gap-4">
              <div className="flex flex-col items-center">
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: `${step.color}18`, color: step.color }}
                >
                  {step.icon}
                </div>
                {idx < steps.length - 1 && (
                  <div className="w-px flex-1 mt-2 bg-[hsl(var(--border))]" />
                )}
              </div>
              <div className="pb-5">
                <div className="flex items-center gap-2 mb-1">
                  <span
                    className="text-xs font-bold px-2 py-0.5 rounded-full"
                    style={{ backgroundColor: `${step.color}18`, color: step.color }}
                  >
                    Étape {idx + 1}
                  </span>
                  <h3 className="font-semibold text-sm text-[hsl(var(--foreground))]">
                    {step.title}
                  </h3>
                </div>
                <p className="text-sm text-[hsl(var(--muted-foreground))] leading-relaxed">
                  {step.description}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="mt-2 pt-5 border-t border-[hsl(var(--border))]">
          <div className="flex items-center gap-2 text-xs text-[hsl(var(--muted-foreground))]">
            <CheckCircle2 size={14} className="text-[#10b981]" />
            L&apos;IA s&apos;occupe du reste — concentrez-vous sur votre travail.
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
function Welcome() {
  const { user } = useAuth();
  const stats = useDashboardStats(user?.id, user?.x_support_role);

  const [isTicketModalOpen, setIsTicketModalOpen] = useState(false);
  const [isChatbotOpen, setIsChatbotOpen] = useState(false);
  const [isGuideOpen, setIsGuideOpen] = useState(false);
  const [statsKey, setStatsKey] = useState(0);

  const handleTicketSuccess = () => {
    setIsTicketModalOpen(false);
    setStatsKey((k) => k + 1);
  };

  return (
    <div className="p-6 lg:p-8 max-w-[1440px] mx-auto space-y-10">

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 animate-fade-in">
        {/* Left: greeting */}
        <div>
          <h1 className="text-3xl lg:text-4xl font-bold tracking-tight mb-2 text-[hsl(var(--foreground))]">
            Bonjour,{" "}
            {user
              ? user.name.split(" ")[0].charAt(0).toUpperCase() +
                user.name.split(" ")[0].slice(1)
              : "Utilisateur"}{" "}
            👋
          </h1>
          <p className="text-[hsl(var(--muted-foreground))] text-base sm:text-lg">
            Voici un aperçu de votre espace de support IT propulsé par l&apos;IA.
          </p>
        </div>

        {/* Right: action buttons */}
        <div className="flex items-center gap-3 flex-shrink-0">
          {/* Guide d'utilisation */}
          <button
            id="btn-guide-open"
            onClick={() => setIsGuideOpen(true)}
            className="btn-ghost px-5 py-2.5 text-sm border border-[hsl(var(--border))] rounded-[var(--radius)] flex items-center gap-2 hover:border-[hsl(var(--primary)/0.5)] hover:text-[hsl(var(--primary))] transition-all"
          >
            <Info size={16} />
            Guide d&apos;utilisation
          </button>

          {/* Nouveau Ticket — action principale */}
          <button
            id="btn-nouveau-ticket"
            onClick={() => setIsTicketModalOpen(true)}
            className="btn-primary px-5 py-2.5 text-sm shadow-md shadow-[hsl(var(--primary)/0.2)] hover:shadow-lg hover:-translate-y-0.5 transition-all flex items-center gap-2"
          >
            <Ticket size={18} />
            Nouveau Ticket
          </button>
        </div>
      </div>

      {/* ── Hero Slider ────────────────────────────────────────────────── */}
      <div className="animate-fade-in w-full stagger-1">
        <WelcomeSlider
          onOpenTicketModal={() => setIsTicketModalOpen(true)}
          onOpenChatbot={() => setIsChatbotOpen(true)}
        />
      </div>

      {/* ── Dashboard Grid ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8 animate-slide-up stagger-2">

        {/* Quick Actions */}
        <div className="lg:col-span-2 space-y-6">
          <h2 className="text-xl font-semibold flex items-center gap-2 text-[hsl(var(--foreground))]">
            <Activity size={22} className="text-[hsl(var(--primary))]" />
            Actions Rapides
          </h2>

          {/* ── CARD 1 — Gérer mes tickets (LARGE — full width) ── */}
          <Link
            href="/tickets"
            id="card-tickets"
            className="glass-card p-6 flex flex-col sm:flex-row items-start sm:items-center gap-6 group cursor-pointer hover:border-[hsl(var(--primary)/0.5)] transition-all duration-300"
          >
            {/* Left: text */}
            <div className="flex-1 flex flex-col gap-2">
              <div className="w-12 h-12 rounded-2xl bg-[hsl(var(--primary)/0.1)] text-[hsl(var(--primary))] flex items-center justify-center group-hover:scale-110 group-hover:bg-[hsl(var(--primary)/0.15)] transition-all duration-300">
                <Ticket size={24} />
              </div>
              <h3 className="font-semibold text-lg mt-1 group-hover:text-[hsl(var(--primary))] transition-colors">
                Gérer mes tickets
              </h3>
              <p className="text-sm text-[hsl(var(--muted-foreground))] leading-relaxed">
                Consultez l&apos;état de vos demandes d&apos;assistance en cours et accédez à vos archives. Suivez chaque étape de la résolution.
              </p>
              <div className="flex items-center gap-2 mt-2">
                <KpiBadge
                  key={statsKey}
                  loading={stats.loading}
                  value={stats.enCours}
                  label="en cours"
                  color="hsl(var(--primary))"
                />
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-[hsl(var(--primary))] mt-3 group-hover:translate-x-1 transition-transform duration-200">
                  Voir tous les tickets <ChevronRight size={13} />
                </span>
              </div>
            </div>

            {/* Right: Mini-Dashboard Stats */}
            <div className="flex-shrink-0 self-center sm:border-l sm:border-[hsl(var(--border))] sm:pl-6">
              <StatsMiniDashboard stats={stats} />
            </div>
          </Link>

          {/* ── CARDS 2 & 3 — side by side ── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 lg:gap-6">

            {/* Card 2 — Base de connaissances */}
            <Link
              href="/tech/knowledge"
              id="card-knowledge"
              className="glass-card p-6 flex flex-col gap-2 group cursor-pointer hover:border-[#10b981]/50 transition-all"
            >
              <div className="w-12 h-12 rounded-2xl bg-[#10b981]/10 text-[#10b981] flex items-center justify-center group-hover:scale-110 group-hover:bg-[#10b981]/15 transition-all duration-300">
                <BookOpen size={24} />
              </div>
              <div>
                <h3 className="font-semibold text-lg mb-1 group-hover:text-[#10b981] transition-colors">
                  Base de connaissances
                </h3>
                <p className="text-sm text-[hsl(var(--muted-foreground))] leading-relaxed">
                  Trouvez des solutions instantanées grâce à notre documentation indexée par
                  l&apos;IA.
                </p>
                <div className="flex items-center gap-2 mt-2">
                  <KpiBadge
                    key={statsKey}
                    loading={stats.loading}
                    value={stats.totalKnowledge}
                    label="articles d'aide"
                    color="#10b981"
                  />
                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#10b981] mt-3 group-hover:translate-x-1 transition-transform duration-200">
                    Consulter la documentation <ChevronRight size={13} />
                  </span>
                </div>
              </div>
            </Link>

            {/* Card 3 — Assistant IA (Groq) */}
            <button
              id="card-assistant-ia"
              onClick={() => setIsChatbotOpen(true)}
              className="glass-card p-6 flex flex-col gap-2 group cursor-pointer hover:border-[#f59e0b]/50 transition-all text-left w-full"
            >
              <div className="relative w-12 h-12 rounded-2xl bg-[#f59e0b]/10 text-[#f59e0b] flex items-center justify-center group-hover:scale-110 group-hover:bg-[#f59e0b]/15 transition-all duration-300">
                <Sparkles size={24} />
                {/* Pulsing "online" dot */}
                <span className="absolute -top-1 -right-1 w-3 h-3 bg-green-400 rounded-full animate-ping opacity-75" />
                <span className="absolute -top-1 -right-1 w-3 h-3 bg-green-400 rounded-full" />
              </div>
              <div>
                <h3 className="font-semibold text-lg mb-1 group-hover:text-[#f59e0b] transition-colors flex items-center gap-2">
                  Assistant IA (Groq)
                  <span className="text-[0.6rem] font-bold px-1.5 py-0.5 rounded-full bg-green-400/15 text-green-500 border border-green-400/30">
                    En ligne
                  </span>
                </h3>
                <p className="text-sm text-[hsl(var(--muted-foreground))] leading-relaxed">
                  Posez vos questions à notre IA alimentée par Groq pour une réponse instantanée.
                </p>
                <span className="inline-flex items-center gap-1.5 mt-3 text-xs font-bold px-2.5 py-1 rounded-full bg-[#f59e0b]/10 text-[#f59e0b]">
                  <Loader2 size={11} className="animate-spin" />
                  Prêt à répondre
                </span>
              </div>
            </button>

          </div>
        </div>

        {/* Recent Activity */}
        <div className="space-y-6">
          <h2 className="text-xl font-semibold flex items-center gap-2 text-[hsl(var(--foreground))]">
            <Clock size={22} className="text-[hsl(var(--muted-foreground))]" />
            Activité Récente
          </h2>
          <ActivityFeed />
        </div>

      </div>

      {/* ── Modales & Chatbot ──────────────────────────────────────────── */}
      <TicketModal
        isOpen={isTicketModalOpen}
        onClose={() => setIsTicketModalOpen(false)}
        onSuccess={handleTicketSuccess}
      />

      {isChatbotOpen && (
        <Chatbot
          defaultOpen={true}
          onClose={() => setIsChatbotOpen(false)}
        />
      )}

      {isGuideOpen && <UserGuideModal onClose={() => setIsGuideOpen(false)} />}

    </div>
  );
}

export default function WelcomePage() {
  return (
    <ProtectedRoute>
      <Welcome />
    </ProtectedRoute>
  );
}
