"use client";

import React, { useState, useMemo, useEffect } from "react";
import { useNotifications, Notification, TYPE_CONFIG } from "@/lib/NotificationContext";
import { Bell, Check, CheckCheck, Trash2, ArrowRight, ShieldAlert, AtSign, Briefcase, Zap, SlidersHorizontal, X, Settings, BellOff, Moon } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import ProtectedRoute from "@/components/ProtectedRoute";

// ── Helpers ─────────────────────────────────────────────────────────────────
const ODOO_BASE = process.env.NEXT_PUBLIC_ODOO_URL || "http://localhost:8069";

function formatDateHeader(dateStr: string | null): string {
  if (!dateStr) return "Inconnu";
  const date = new Date(dateStr.replace(" ", "T") + "Z");
  const now = new Date();
  const diffTime = Math.abs(now.getTime() - date.getTime());
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays === 0 && now.getDate() === date.getDate()) return "Aujourd'hui";
  if (diffDays === 1 || (diffDays === 0 && now.getDate() !== date.getDate())) return "Hier";
  if (diffDays < 7) return "Cette semaine";
  return "Plus ancien";
}

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return "";
  const date = new Date(dateStr.replace(" ", "T") + "Z");
  const diff = Math.floor((Date.now() - date.getTime()) / 1000);
  if (diff < 60) return "à l'instant";
  if (diff < 3600) return `il y a ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `il y a ${Math.floor(diff / 3600)}h`;
  return `il y a ${Math.floor(diff / 86400)}j`;
}

// ── Component ───────────────────────────────────────────────────────────────
export default function NotificationsPage() {
  const { notifs, markRead, markAllRead, deleteNotif, fetchNotifications } = useNotifications();
  const router = useRouter();
  
  // États locaux
  const [filter, setFilter] = useState<"all" | "unread" | "sla" | "mentions" | "assignments">("all");
  const [isMobileFilterOpen, setIsMobileFilterOpen] = useState(false);

  // ── Mode Snooze ──
  const [snoozedUntil, setSnoozedUntil] = useState<number | null>(null);

  useEffect(() => {
    const checkSnooze = () => {
      try {
        const storedSnooze = localStorage.getItem("it_support_snooze");
        if (storedSnooze) {
          const until = parseInt(storedSnooze, 10);
          if (until > Date.now()) {
            setSnoozedUntil(until);
          } else {
            setSnoozedUntil(null);
            localStorage.removeItem("it_support_snooze");
          }
        } else {
          setSnoozedUntil(null);
        }
      } catch {}
    };
    checkSnooze();
    window.addEventListener("snooze_changed", checkSnooze);
    return () => window.removeEventListener("snooze_changed", checkSnooze);
  }, []);

  // eslint-disable-next-line react-hooks/purity
  const isSnoozed = snoozedUntil !== null && snoozedUntil > Date.now();

  const toggleSnooze = (e: React.MouseEvent) => {
    e.preventDefault();
    if (isSnoozed) {
      setSnoozedUntil(null);
      localStorage.removeItem("it_support_snooze");
      toast.success("Notifications réactivées", { icon: "🔔" });
    } else {
      const until = Date.now() + 2 * 60 * 60 * 1000;
      setSnoozedUntil(until);
      localStorage.setItem("it_support_snooze", until.toString());
      toast.info("Notifications en sourdine pour 2 heures", { icon: "🌙" });
    }
    window.dispatchEvent(new Event("snooze_changed"));
  };

  // ── Mode Paramètres (Préférences) ──
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [prefs, setPrefs] = useState({
    notif_on_create: true,
    notif_on_assign: true,
    notif_on_comment: true,
    notif_on_sla: true,
  });

  useEffect(() => {
    const loadPrefs = () => {
      try {
        const stored = localStorage.getItem("it_support_user");
        if (stored) {
          const parsed = JSON.parse(stored);
          setPrefs({
            notif_on_create: parsed?.x_notif_on_create ?? true,
            notif_on_assign: parsed?.x_notif_on_assign ?? true,
            notif_on_comment: parsed?.x_notif_on_comment ?? true,
            notif_on_sla: parsed?.x_notif_on_sla ?? true,
          });
        }
      } catch {}
    };
    loadPrefs();
    window.addEventListener("prefs_changed", loadPrefs);
    return () => window.removeEventListener("prefs_changed", loadPrefs);
  }, []);

  const savePrefs = async (key: keyof typeof prefs, val: boolean) => {
    const newPrefs = { ...prefs, [key]: val };
    setPrefs(newPrefs);
    const storedUser = localStorage.getItem("it_support_user");
    const userId = storedUser ? JSON.parse(storedUser)?.id : null;
    if (!userId) return;
    try {
      const res = await fetch(`${ODOO_BASE}/api/auth/update_profile`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: parseInt(userId), preferences: newPrefs })
      });
      if (res.ok) {
        if (storedUser) {
          const parsed = JSON.parse(storedUser);
          const updated = { 
            ...parsed, 
            x_notif_on_create: newPrefs.notif_on_create,
            x_notif_on_assign: newPrefs.notif_on_assign,
            x_notif_on_comment: newPrefs.notif_on_comment,
            x_notif_on_sla: newPrefs.notif_on_sla
          };
          localStorage.setItem("it_support_user", JSON.stringify(updated));
          window.dispatchEvent(new Event("prefs_changed"));
        }
      }
    } catch {}
  };

  // Rôle de l'utilisateur
  const userRole = useMemo(() => {
    try {
      const stored = localStorage.getItem("it_support_user");
      return stored ? JSON.parse(stored).x_support_role || "user" : "user";
    } catch {
      return "user";
    }
  }, []);

  // ── Actions Complexes (Accepter/Refuser) ──
  const acceptTicketAction = async (ticketId: number, notifId: number, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      const res = await fetch(`${ODOO_BASE}/api/ticket/${ticketId}/accept`, { method: "PATCH" });
      if (res.ok) {
        toast.success("Ticket accepté avec succès !");
        markRead(notifId, true);
        fetchNotifications(true); // Refresh silently
      }
    } catch {}
  };

  const rejectTicketAction = async (ticketId: number, notifId: number, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      const res = await fetch(`${ODOO_BASE}/api/ticket/${ticketId}/reject`, { method: "PATCH" });
      if (res.ok) {
        toast.error("Mission refusée.");
        markRead(notifId, true);
        fetchNotifications(true); // Refresh silently
      }
    } catch {}
  };

  const handleCardClick = (notif: Notification) => {
    if (!notif.is_read) markRead(notif.id);
    if (!notif.ticket_id) return;
    
    if (userRole === "tech") {
      if (notif.notif_type === "ticket_assigned" && notif.x_accepted === false) {
        router.push(`/tech/queue?highlight=${notif.ticket_id}`);
      } else {
        router.push(`/tech/tickets/${notif.ticket_id}`);
      }
    } else {
      router.push(`/tickets?ticketId=${notif.ticket_id}`);
    }
  };

  // ── Filtrage et Groupement ──
  const filteredNotifs = useMemo(() => {
    let list = notifs;
    if (filter === "unread") list = list.filter((n) => !n.is_read);
    if (filter === "sla") list = list.filter((n) => n.notif_type === "sla_breached" || n.notif_type === "ticket_escalated");
    if (filter === "mentions") list = list.filter((n) => n.notif_type === "new_comment");
    if (filter === "assignments") list = list.filter((n) => n.notif_type === "ticket_assigned");
    return list;
  }, [notifs, filter]);

  const groupedNotifs = useMemo(() => {
    const groups: Record<string, Notification[]> = {};
    filteredNotifs.forEach((n) => {
      const groupKey = formatDateHeader(n.create_date);
      if (!groups[groupKey]) groups[groupKey] = [];
      groups[groupKey].push(n);
    });
    return groups;
  }, [filteredNotifs]);

  const groupOrder = ["Aujourd'hui", "Hier", "Cette semaine", "Plus ancien"];

  return (
    <ProtectedRoute>
      {/* Wrapper global avec padding horizontal pour l'effet "cadre" sur Desktop */}
      <div className="w-full h-[calc(100vh-56px)] md:h-screen p-2 md:p-6 lg:p-8 flex justify-center bg-[hsl(var(--background))]">
        <div className="flex h-full w-full max-w-6xl bg-[hsl(var(--background))] overflow-hidden rounded-xl border border-[hsl(var(--border)/0.5)] shadow-md">
        
          {/* ── Main Feed ── */}
          <div className="flex-1 flex flex-col min-w-0 bg-[hsl(var(--background))] relative">
            <div className="h-16 flex items-center justify-between px-4 sm:px-6 border-b border-[hsl(var(--border)/0.5)] shrink-0 bg-[hsl(var(--background)/0.8)] backdrop-blur-sm z-10 sticky top-0">
              <h2 className="text-base sm:text-lg font-semibold flex items-center gap-2 capitalize">
                {filter === "all" ? "Toutes les notifications" : filter === "unread" ? "Non lues" : filter === "sla" ? "Urgences SLA" : filter === "mentions" ? "Commentaires" : "Assignations"}
              </h2>
              <div className="flex items-center gap-2 sm:gap-3">
                <button
                  onClick={toggleSnooze}
                  className={`hidden sm:flex items-center gap-2 px-3 py-2 text-xs font-semibold rounded-xl transition-colors ${isSnoozed ? "bg-indigo-500/20 text-indigo-400" : "text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted)/0.5)]"}`}
                >
                  {isSnoozed ? <BellOff size={14} /> : <Moon size={14} />} 
                  {isSnoozed ? "Réactiver" : "Sourdine 2h"}
                </button>
                <button
                  onClick={() => setIsSettingsOpen(true)}
                  className="hidden sm:flex items-center gap-2 px-3 py-2 text-xs font-semibold text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted)/0.5)] rounded-xl transition-colors"
                >
                  <Settings size={14} /> Préférences
                </button>
                <button
                  onClick={markAllRead}
                  className="hidden sm:flex items-center gap-2 px-3 py-2 text-xs font-semibold text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted)/0.5)] rounded-xl transition-colors"
                >
                  <CheckCheck size={14} /> Tout marquer lu
                </button>
                <button
                  onClick={toggleSnooze}
                  className={`sm:hidden p-2 rounded-lg transition-colors ${isSnoozed ? "bg-indigo-500/20 text-indigo-400" : "text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted)/0.5)]"}`}
                  title={isSnoozed ? "Réactiver les notifications" : "Mettre en sourdine 2h"}
                >
                  {isSnoozed ? <BellOff size={18} /> : <Moon size={18} />}
                </button>
                <button
                  onClick={() => setIsSettingsOpen(true)}
                  className="sm:hidden p-2 text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted)/0.5)] rounded-lg transition-colors"
                  title="Préférences"
                >
                  <Settings size={18} />
                </button>
                <button
                  onClick={markAllRead}
                  className="sm:hidden p-2 text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted)/0.5)] rounded-lg transition-colors"
                  title="Tout marquer lu"
                >
                  <CheckCheck size={18} />
                </button>
                <button
                  onClick={() => setIsMobileFilterOpen(true)}
                  className="md:hidden p-2 text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted)/0.5)] rounded-lg transition-colors"
                  title="Filtres"
                >
                  <SlidersHorizontal size={18} />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-3 sm:p-6 md:p-8">
              {filteredNotifs.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-[hsl(var(--muted-foreground))] px-4 text-center">
                  <CheckCheck size={48} className="opacity-20 mb-4" />
                  <p className="text-lg font-medium text-[hsl(var(--foreground))]">Tout est calme.</p>
                  <p className="text-sm mt-1">Vous avez traité toutes vos alertes ! ✨</p>
                </div>
              ) : (
                <div className="max-w-4xl mx-auto space-y-6">
                  {groupOrder.map((group) => {
                    const groupItems = groupedNotifs[group];
                    if (!groupItems || groupItems.length === 0) return null;

                    return (
                      <div key={group} className="animate-in fade-in slide-in-from-bottom-2 duration-500">
                        <div className="flex items-center gap-4 mb-3 sm:mb-4 px-1 sm:px-2">
                          <h3 className="text-xs sm:text-sm font-bold text-[hsl(var(--foreground))]">
                            {group}
                          </h3>
                          <div className="flex-1 h-px bg-[hsl(var(--border)/0.5)]"></div>
                        </div>
                        
                        <div className="space-y-1.5">
                          {groupItems.map((notif) => {
                            const cfg = TYPE_CONFIG[notif.notif_type];
                            const isActionableAssign = notif.notif_type === "ticket_assigned" && notif.x_accepted === false && userRole === "tech";

                            return (
                              <div
                                key={notif.id}
                                onClick={() => handleCardClick(notif)}
                                className={`group flex flex-row items-start gap-3 sm:gap-4 py-3 px-3 sm:px-4 rounded-lg border transition-all cursor-pointer ${
                                  !notif.is_read 
                                    ? "bg-[hsl(var(--card))] border-l-4 border-l-indigo-500 border-y-[hsl(var(--border)/0.5)] border-r-[hsl(var(--border)/0.5)] shadow-sm" 
                                    : "bg-[hsl(var(--background))] border-l-4 border-l-transparent border-y-[hsl(var(--border)/0.3)] border-r-[hsl(var(--border)/0.3)] hover:bg-[hsl(var(--muted)/0.3)]"
                                }`}
                              >
                                {/* Icône (Gauche) */}
                                <div className={`mt-0.5 shrink-0 flex items-center justify-center w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-[hsl(var(--muted)/0.5)] ${!notif.is_read ? 'ring-2 ring-[hsl(var(--primary)/0.2)] ring-offset-1 sm:ring-offset-2 ring-offset-[hsl(var(--background))]' : ''}`}>
                                  <span className="text-sm sm:text-xl">{cfg.icon}</span>
                                </div>

                                {/* Contenu central */}
                                <div className="flex-1 min-w-0 flex flex-col justify-center">
                                  <div className="flex justify-between items-start gap-2">
                                    <p className={`text-xs sm:text-sm leading-snug ${!notif.is_read ? "font-bold text-[hsl(var(--foreground))]" : "font-normal text-[hsl(var(--foreground)/0.8)]"}`}>
                                      {notif.message}
                                    </p>
                                    <span className="text-[10px] text-[hsl(var(--muted-foreground))] font-medium whitespace-nowrap shrink-0 sm:hidden mt-0.5">
                                      {timeAgo(notif.create_date)}
                                    </span>
                                  </div>
                                  
                                  {notif.ticket_name && (
                                    <p className="mt-1 sm:mt-1.5 text-[10px] sm:text-xs text-[hsl(var(--muted-foreground))] flex items-center gap-1.5 truncate">
                                      <span className="px-1.5 sm:px-2 py-0.5 rounded border border-[hsl(var(--border)/0.5)] bg-[hsl(var(--background))] font-mono font-medium">
                                        {notif.ticket_name}
                                      </span>
                                    </p>
                                  )}

                                  {/* Actions Rapides Inline */}
                                  {isActionableAssign && (
                                    <div className="mt-3 flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                                      <button
                                        onClick={(e) => acceptTicketAction(notif.ticket_id!, notif.id, e)}
                                        className="px-3 py-1.5 sm:px-4 sm:py-1.5 bg-indigo-500 text-white hover:bg-indigo-600 text-[10px] sm:text-xs font-bold rounded-lg transition-colors shadow-sm"
                                      >
                                        Prendre en charge
                                      </button>
                                      <button
                                        onClick={(e) => rejectTicketAction(notif.ticket_id!, notif.id, e)}
                                        className="px-3 py-1.5 sm:px-4 sm:py-1.5 bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))] hover:text-red-500 hover:bg-red-500/10 text-[10px] sm:text-xs font-bold rounded-lg transition-colors"
                                      >
                                        Refuser
                                      </button>
                                    </div>
                                  )}

                                  {/* Actions Mobiles : Check et Trash */}
                                  <div className="mt-3 flex items-center gap-2 sm:hidden justify-end" onClick={(e) => e.stopPropagation()}>
                                    {!notif.is_read && (
                                      <button
                                        onClick={(e) => { e.preventDefault(); markRead(notif.id); }}
                                        className="p-1.5 rounded text-[hsl(var(--primary))] bg-[hsl(var(--primary)/0.1)] transition-colors"
                                        title="Marquer comme lu"
                                      >
                                        <Check size={14} />
                                      </button>
                                    )}
                                    <button
                                      onClick={(e) => { e.preventDefault(); deleteNotif(notif.id); }}
                                      className="p-1.5 rounded text-red-500 bg-red-500/10 transition-colors"
                                      title="Supprimer définitivement"
                                    >
                                      <Trash2 size={14} />
                                    </button>
                                  </div>
                                </div>

                                {/* Hover Actions (Droite Desktop) */}
                                <div className="hidden sm:flex flex-col items-end shrink-0 ml-auto w-20" onClick={(e) => e.stopPropagation()}>
                                  <span className="text-xs text-[hsl(var(--muted-foreground))] font-medium whitespace-nowrap group-hover:hidden">
                                    {timeAgo(notif.create_date)}
                                  </span>

                                  <div className="hidden group-hover:flex items-center gap-1 z-10">
                                    {!notif.is_read && (
                                      <button
                                        onClick={(e) => { e.preventDefault(); markRead(notif.id); }}
                                        className="p-2 rounded-lg hover:bg-[hsl(var(--primary)/0.1)] text-[hsl(var(--primary))] transition-colors"
                                        title="Marquer comme lu"
                                      >
                                        <Check size={16} />
                                      </button>
                                    )}
                                    <button
                                      onClick={(e) => { e.preventDefault(); deleteNotif(notif.id); }}
                                      className="p-2 rounded-lg hover:bg-red-500/10 text-red-500 transition-colors"
                                      title="Supprimer"
                                    >
                                      <Trash2 size={16} />
                                    </button>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* ── Sidebar Filtres (Maintenant à droite - Desktop uniquement) ── */}
          <div className="w-64 shrink-0 border-l border-[hsl(var(--border)/0.5)] bg-[hsl(var(--card)/0.3)] flex flex-col hidden md:flex">
            <div className="h-16 flex flex-col justify-center px-6 border-b border-[hsl(var(--border)/0.5)] bg-[hsl(var(--background)/0.8)] shrink-0">
              <h1 className="text-base font-bold text-[hsl(var(--foreground))]">Supervision</h1>
              <p className="text-[10px] text-[hsl(var(--muted-foreground))] mt-0.5 uppercase tracking-wider">Activité & Filtres</p>
            </div>

            <nav className="flex-1 overflow-y-auto p-4 space-y-1=1">
              <button
                onClick={() => setFilter("all")}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${filter === "all" ? "bg-[hsl(var(--primary)/0.1)] text-[hsl(var(--primary))]" : "text-[hsl(var(--foreground)/0.8)] hover:bg-[hsl(var(--muted)/0.5)]"}`}
              >
                <div className="flex items-center gap-2"><Bell size={16} /> Boîte de réception</div>
              </button>
              
              <button
                onClick={() => setFilter("unread")}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${filter === "unread" ? "bg-indigo-500/10 text-indigo-400" : "text-[hsl(var(--foreground)/0.8)] hover:bg-[hsl(var(--muted)/0.5)]"}`}
              >
                <div className="flex items-center gap-2"><Zap size={16} /> Non lues</div>
                {notifs.filter(n => !n.is_read).length > 0 && (
                  <span className="bg-indigo-500 text-white text-[10px] px-1.5 py-0.5 rounded-full">
                    {notifs.filter(n => !n.is_read).length}
                  </span>
                )}
              </button>

              <div className="pt-6 pb-2">
                <p className="px-3 text-xs font-bold text-[hsl(var(--muted-foreground))] uppercase tracking-wider">Filtres intelligents</p>
              </div>

              <button
                onClick={() => setFilter("assignments")}
                className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${filter === "assignments" ? "bg-amber-500/10 text-amber-500" : "text-[hsl(var(--foreground)/0.8)] hover:bg-[hsl(var(--muted)/0.5)]"}`}
              >
                <Briefcase size={16} /> Assignations
              </button>

              <button
                onClick={() => setFilter("mentions")}
                className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${filter === "mentions" ? "bg-green-500/10 text-green-500" : "text-[hsl(var(--foreground)/0.8)] hover:bg-[hsl(var(--muted)/0.5)]"}`}
              >
                <AtSign size={16} /> Commentaires
              </button>

              {userRole === "tech" && (
                <button
                  onClick={() => setFilter("sla")}
                  className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${filter === "sla" ? "bg-red-500/10 text-red-500" : "text-[hsl(var(--foreground)/0.8)] hover:bg-[hsl(var(--muted)/0.5)]"}`}
                >
                  <ShieldAlert size={16} /> Urgences SLA
                </button>
              )}
            </nav>
          </div>
        </div>
      </div>

      {/* ── Mobile Filter Drawer (Bottom Sheet) ── */}
      {isMobileFilterOpen && (
        <div className="fixed inset-0 z-[9999] md:hidden flex flex-col justify-end">
          <div 
            className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity" 
            onClick={() => setIsMobileFilterOpen(false)} 
          />
          <div className="relative bg-[hsl(var(--background))] rounded-t-3xl max-h-[85vh] flex flex-col animate-in slide-in-from-bottom-full duration-300 border-t border-[hsl(var(--border)/0.5)]">
            {/* Grabber */}
            <div className="w-full flex justify-center pt-4 pb-2" onClick={() => setIsMobileFilterOpen(false)}>
              <div className="w-12 h-1.5 rounded-full bg-[hsl(var(--border))]" />
            </div>

            <div className="flex items-center justify-between px-6 py-4 border-b border-[hsl(var(--border)/0.5)]">
              <h3 className="font-bold text-lg text-[hsl(var(--foreground))]">Filtres intelligents</h3>
              <button onClick={() => setIsMobileFilterOpen(false)} className="p-2 text-[hsl(var(--muted-foreground))] bg-[hsl(var(--muted)/0.3)] hover:bg-[hsl(var(--muted)/0.6)] rounded-full transition-colors">
                <X size={18} />
              </button>
            </div>

            <div className="p-4 overflow-y-auto space-y-2 pb-8">
              <button
                onClick={() => { setFilter("all"); setIsMobileFilterOpen(false); }}
                className={`w-full flex items-center justify-between px-4 py-3.5 rounded-xl text-sm font-medium transition-colors ${filter === "all" ? "bg-[hsl(var(--primary)/0.1)] text-[hsl(var(--primary))]" : "text-[hsl(var(--foreground)/0.8)] hover:bg-[hsl(var(--muted)/0.5)]"}`}
              >
                <div className="flex items-center gap-3"><Bell size={18} /> Boîte de réception</div>
                {filter === "all" && <Check size={16} className="text-[hsl(var(--primary))]" />}
              </button>
              
              <button
                onClick={() => { setFilter("unread"); setIsMobileFilterOpen(false); }}
                className={`w-full flex items-center justify-between px-4 py-3.5 rounded-xl text-sm font-medium transition-colors ${filter === "unread" ? "bg-indigo-500/10 text-indigo-400" : "text-[hsl(var(--foreground)/0.8)] hover:bg-[hsl(var(--muted)/0.5)]"}`}
              >
                <div className="flex items-center gap-3"><Zap size={18} /> Non lues</div>
                <div className="flex items-center gap-2">
                  {notifs.filter(n => !n.is_read).length > 0 && (
                    <span className="bg-indigo-500 text-white text-xs px-2 py-0.5 rounded-full">
                      {notifs.filter(n => !n.is_read).length}
                    </span>
                  )}
                  {filter === "unread" && <Check size={16} className="text-indigo-500" />}
                </div>
              </button>

              <div className="pt-4 pb-2">
                <div className="h-px bg-[hsl(var(--border)/0.5)] mb-4"></div>
                <p className="px-4 text-xs font-bold text-[hsl(var(--muted-foreground))] uppercase tracking-wider">Catégories</p>
              </div>

              <button
                onClick={() => { setFilter("assignments"); setIsMobileFilterOpen(false); }}
                className={`w-full flex items-center justify-between px-4 py-3.5 rounded-xl text-sm font-medium transition-colors ${filter === "assignments" ? "bg-amber-500/10 text-amber-500" : "text-[hsl(var(--foreground)/0.8)] hover:bg-[hsl(var(--muted)/0.5)]"}`}
              >
                <div className="flex items-center gap-3"><Briefcase size={18} /> Assignations</div>
                {filter === "assignments" && <Check size={16} className="text-amber-500" />}
              </button>

              <button
                onClick={() => { setFilter("mentions"); setIsMobileFilterOpen(false); }}
                className={`w-full flex items-center justify-between px-4 py-3.5 rounded-xl text-sm font-medium transition-colors ${filter === "mentions" ? "bg-green-500/10 text-green-500" : "text-[hsl(var(--foreground)/0.8)] hover:bg-[hsl(var(--muted)/0.5)]"}`}
              >
                <div className="flex items-center gap-3"><AtSign size={18} /> Commentaires</div>
                {filter === "mentions" && <Check size={16} className="text-green-500" />}
              </button>

              {userRole === "tech" && (
                <button
                  onClick={() => { setFilter("sla"); setIsMobileFilterOpen(false); }}
                  className={`w-full flex items-center justify-between px-4 py-3.5 rounded-xl text-sm font-medium transition-colors ${filter === "sla" ? "bg-red-500/10 text-red-500" : "text-[hsl(var(--foreground)/0.8)] hover:bg-[hsl(var(--muted)/0.5)]"}`}
                >
                  <div className="flex items-center gap-3"><ShieldAlert size={18} /> Urgences SLA</div>
                  {filter === "sla" && <Check size={16} className="text-red-500" />}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
      {/* ── Settings Modal ── */}
      {isSettingsOpen && (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in" onClick={() => setIsSettingsOpen(false)}>
          <div className="bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-2xl w-full max-w-sm shadow-2xl flex flex-col overflow-hidden animate-slide-up" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-[hsl(var(--border)/0.5)]">
              <h3 className="font-bold text-lg text-[hsl(var(--foreground))] flex items-center gap-2">
                <Settings size={18} /> Préférences
              </h3>
              <button onClick={() => setIsSettingsOpen(false)} className="p-2 text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted)/0.5)] rounded-full transition-colors">
                <X size={18} />
              </button>
            </div>
            <div className="p-5 space-y-4 text-sm">
              <p className="text-xs text-[hsl(var(--muted-foreground))]">
                Choisissez les événements pour lesquels vous souhaitez recevoir une notification par Email.
              </p>

              <label className="flex items-center justify-between cursor-pointer group">
                <span className="font-medium group-hover:text-[hsl(var(--primary))] transition-colors">Création de ticket</span>
                <input type="checkbox" className="toggle-checkbox" checked={prefs.notif_on_create} onChange={(e) => savePrefs("notif_on_create", e.target.checked)} />
              </label>

              <label className="flex items-center justify-between cursor-pointer group">
                <span className="font-medium group-hover:text-[hsl(var(--primary))] transition-colors">Assignation de ticket</span>
                <input type="checkbox" className="toggle-checkbox" checked={prefs.notif_on_assign} onChange={(e) => savePrefs("notif_on_assign", e.target.checked)} />
              </label>

              <label className="flex items-center justify-between cursor-pointer group">
                <span className="font-medium group-hover:text-[hsl(var(--primary))] transition-colors">Nouveau commentaire</span>
                <input type="checkbox" className="toggle-checkbox" checked={prefs.notif_on_comment} onChange={(e) => savePrefs("notif_on_comment", e.target.checked)} />
              </label>

              {userRole === "tech" && (
                <label className="flex items-center justify-between cursor-pointer group">
                  <span className="font-medium group-hover:text-[hsl(var(--primary))] transition-colors">Dépassement de SLA</span>
                  <input type="checkbox" className="toggle-checkbox" checked={prefs.notif_on_sla} onChange={(e) => savePrefs("notif_on_sla", e.target.checked)} />
                </label>
              )}
            </div>
          </div>
          <style dangerouslySetInnerHTML={{__html: `
            .toggle-checkbox {
              appearance: none; width: 36px; height: 20px; background: hsl(var(--muted)); position: relative; cursor: pointer; outline: none; transition: 0.3s;
              border-radius: 9999px; box-shadow: inset 0 0 5px rgba(0,0,0,0.2);
            }
            .toggle-checkbox::before {
              content: ''; position: absolute; width: 16px; height: 16px; border-radius: 50%; top: 2px; left: 2px; background: white; transition: 0.3s; transform: scale(1);
            }
            .toggle-checkbox:checked { background: hsl(var(--primary)); }
            .toggle-checkbox:checked::before { left: 18px; }
          `}} />
        </div>
      )}
    </ProtectedRoute>
  );
}
