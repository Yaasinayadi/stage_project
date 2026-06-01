"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Bell, BellOff, Check, CheckCheck, Trash2, X, Moon, Settings, ArrowLeft } from "lucide-react";
import { toast } from "sonner";

import { useNotifications, Notification, TYPE_CONFIG } from "@/lib/NotificationContext";

const ODOO_BASE = process.env.NEXT_PUBLIC_ODOO_URL || "http://localhost:8069";

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return "";
  const date = new Date(dateStr.replace(" ", "T") + "Z");
  const diff = Math.floor((Date.now() - date.getTime()) / 1000);
  if (diff < 60) return "à l'instant";
  if (diff < 3600) return `il y a ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `il y a ${Math.floor(diff / 3600)}h`;
  return `il y a ${Math.floor(diff / 86400)}j`;
}

export default function NotificationBell() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { notifs, unreadCount, loading, markRead, markAllRead, deleteNotif } = useNotifications();
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"all" | "unread">("all");
  const panelRef = useRef<HTMLDivElement>(null);
  const mobilePanelRef = useRef<HTMLDivElement>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  
  // ── Mode Settings ──
  const [view, setView] = useState<"list" | "settings">("list");
  const [prefs, setPrefs] = useState({
    notif_on_create: true,
    notif_on_assign: true,
    notif_on_comment: true,
    notif_on_sla: true,
  });

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
        const json = await res.json();
        const stored = localStorage.getItem("it_support_user");
        if (stored) {
          const parsed = JSON.parse(stored);
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
  
  // ── Mode Snooze (Ne pas déranger) ──
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

  const toggleSnooze = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (isSnoozed) {
      setSnoozedUntil(null);
      localStorage.removeItem("it_support_snooze");
      toast.success("Notifications réactivées", { icon: "🔔" });
    } else {
      const until = Date.now() + 2 * 60 * 60 * 1000; // 2 heures
      setSnoozedUntil(until);
      localStorage.setItem("it_support_snooze", until.toString());
      toast.info("Notifications en sourdine pour 2 heures", { icon: "🌙" });
    }
    window.dispatchEvent(new Event("snooze_changed"));
  };

  // Fermer le panneau sur navigation mobile/desktop ou changement de paramètre
  useEffect(() => {
    setOpen(false);
    setView("list");
  }, [pathname, searchParams]);

  useEffect(() => {
    if (!open) {
      const t = setTimeout(() => setView("list"), 300);
      return () => clearTimeout(t);
    }
  }, [open]);

  useEffect(() => {
    const handleOpenSettings = () => {
      setOpen(true);
      setView("settings");
    };
    window.addEventListener("open_notification_settings", handleOpenSettings);
    return () => window.removeEventListener("open_notification_settings", handleOpenSettings);
  }, []);

  useEffect(() => {
    const loadPrefs = () => {
      try {
        const stored = localStorage.getItem("it_support_user");
        if (stored) {
          const parsed = JSON.parse(stored);
          setUserRole(parsed?.x_support_role || "user");
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
  }, [open]);

  // ── Fermeture au clic à l'extérieur ─────────────────────────────────────
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      // Sur Desktop, on vérifie panelRef
      const isOutsideDesktop = panelRef.current && !panelRef.current.contains(e.target as Node);
      // Sur Mobile (Portal), on vérifie mobilePanelRef
      const isOutsideMobile = mobilePanelRef.current && !mobilePanelRef.current.contains(e.target as Node);

      // Si le clic n'est NI dans la cloche (panelRef), NI dans le tiroir mobile
      if (isOutsideDesktop && isOutsideMobile) {
        setOpen(false);
      }
    };

    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("touchstart", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, [open]);

  const getTicketLink = (notif: Notification) => {
    if (!notif.ticket_id) return "#";
    if (userRole === "tech") {
      if (notif.notif_type === "ticket_assigned" && notif.x_accepted === false) {
        return `/tech/queue?highlight=${notif.ticket_id}`;
      }
      return `/tech/tickets/${notif.ticket_id}`;
    }
    return `/tickets?ticketId=${notif.ticket_id}`;
  };

  const handleNotifInteract = (notif: Notification) => {
    // Action secondaire silencieuse : évite de déclencher un re-rendu React 
    // qui pourrait annuler ou interrompre la navigation du composant natif <Link>
    if (!notif.is_read) {
      markRead(notif.id);
    }
  };

  const acceptTicketAction = async (ticketId: number, notifId: number, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      const res = await fetch(`${ODOO_BASE}/api/ticket/${ticketId}/accept`, { method: "PATCH" });
      if (res.ok) {
        toast.success("Ticket accepté avec succès !");
        markRead(notifId, true);
        deleteNotif(notifId);
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
        deleteNotif(notifId);
      }
    } catch {}
  };

  const handleDeleteClick = (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    deleteNotif(id);
  };

  // ── Render Settings View ──────────────────────────────────────────────
  const renderSettingsView = () => (
    <>
      <div className="flex items-center gap-2 px-4 py-3 border-b border-[hsl(var(--border)/0.5)]">
        <button
          onClick={(e) => { e.stopPropagation(); setView("list"); }}
          className="p-1 rounded-lg hover:bg-[hsl(var(--muted)/0.4)] text-[hsl(var(--muted-foreground))]"
        >
          <ArrowLeft size={16} />
        </button>
        <span className="text-sm font-semibold text-[hsl(var(--foreground))]">
          Préférences
        </span>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-4 text-sm" onClick={(e) => e.stopPropagation()}>
        <p className="text-xs text-[hsl(var(--muted-foreground))]">
          Choisissez les événements pour lesquels vous souhaitez recevoir une notification par Email.
        </p>

        <label className="flex items-center justify-between cursor-pointer group">
          <span className="font-medium group-hover:text-[hsl(var(--primary))] transition-colors">Création de ticket</span>
          <input 
            type="checkbox" 
            className="toggle-checkbox" 
            checked={prefs.notif_on_create}
            onChange={(e) => savePrefs("notif_on_create", e.target.checked)}
          />
        </label>

        <label className="flex items-center justify-between cursor-pointer group">
          <span className="font-medium group-hover:text-[hsl(var(--primary))] transition-colors">Assignation de ticket</span>
          <input 
            type="checkbox" 
            className="toggle-checkbox" 
            checked={prefs.notif_on_assign}
            onChange={(e) => savePrefs("notif_on_assign", e.target.checked)}
          />
        </label>

        <label className="flex items-center justify-between cursor-pointer group">
          <span className="font-medium group-hover:text-[hsl(var(--primary))] transition-colors">Nouveau commentaire</span>
          <input 
            type="checkbox" 
            className="toggle-checkbox" 
            checked={prefs.notif_on_comment}
            onChange={(e) => savePrefs("notif_on_comment", e.target.checked)}
          />
        </label>

        {userRole === "tech" && (
          <label className="flex items-center justify-between cursor-pointer group">
            <span className="font-medium group-hover:text-[hsl(var(--primary))] transition-colors">Dépassement de SLA</span>
            <input 
              type="checkbox" 
              className="toggle-checkbox" 
              checked={prefs.notif_on_sla}
              onChange={(e) => savePrefs("notif_on_sla", e.target.checked)}
            />
          </label>
        )}
      </div>
      <style dangerouslySetInnerHTML={{__html: `
        .toggle-checkbox {
          appearance: none; width: 36px; height: 20px; background: hsl(var(--muted)); rounded-full; position: relative; cursor: pointer; outline: none; transition: 0.3s;
          border-radius: 9999px; box-shadow: inset 0 0 5px rgba(0,0,0,0.2);
        }
        .toggle-checkbox::before {
          content: ''; position: absolute; width: 16px; height: 16px; border-radius: 50%; top: 2px; left: 2px; background: white; transition: 0.3s; transform: scale(1);
        }
        .toggle-checkbox:checked { background: hsl(var(--primary)); }
        .toggle-checkbox:checked::before { left: 18px; }
      `}} />
    </>
  );

  // ── Inner Content (Shared between Mobile & Desktop) ──────────────────────
  const renderInnerContent = () => (
    <>
      {/* En-tête */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[hsl(var(--border)/0.5)] shrink-0">
        <div className="flex items-center gap-2">
          {isSnoozed ? (
            <BellOff size={15} className="text-indigo-400" />
          ) : (
            <Bell size={15} className="text-[hsl(var(--primary))]" />
          )}
          <span className="text-sm font-semibold text-[hsl(var(--foreground))]">
            Notifications
            {isSnoozed && (
              <span className="ml-2 text-[10px] font-normal bg-indigo-500/20 text-indigo-400 px-1.5 py-0.5 rounded">Snoozed</span>
            )}
            {unreadCount > 0 && !isSnoozed && (
              <span className="ml-1.5 text-xs text-[hsl(var(--muted-foreground))]">
                ({unreadCount} non lue{unreadCount > 1 ? "s" : ""})
              </span>
            )}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={(e) => { e.stopPropagation(); setView("settings"); }}
            className="p-1.5 rounded-lg transition-colors hover:bg-[hsl(var(--muted)/0.4)] text-[hsl(var(--muted-foreground))]"
            title="Préférences"
          >
            <Settings size={14} />
          </button>
          <button
            onClick={toggleSnooze}
            className={`p-1.5 rounded-lg transition-colors ${
              isSnoozed 
                ? "bg-indigo-500/20 text-indigo-400" 
                : "hover:bg-[hsl(var(--muted)/0.4)] text-[hsl(var(--muted-foreground))]"
            }`}
            title={isSnoozed ? "Réactiver les notifications" : "Mettre en sourdine pour 2 heures"}
          >
            <Moon size={14} />
          </button>
          {unreadCount > 0 && (
            <button
              onClick={markAllRead}
              className="flex items-center gap-1 text-xs text-[hsl(var(--primary))] hover:opacity-70 transition-opacity px-2 py-1 rounded-lg hover:bg-[hsl(var(--muted)/0.4)]"
              title="Tout marquer comme lu"
            >
              <CheckCheck size={13} />
              <span className="hidden sm:inline">Tout lire</span>
            </button>
          )}
          <button
            onClick={() => setOpen(false)}
            className="p-1 rounded-lg hover:bg-[hsl(var(--muted)/0.4)] text-[hsl(var(--muted-foreground))] md:hidden"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {/* Onglets */}
      <div className="flex px-4 border-b border-[hsl(var(--border)/0.5)] bg-[hsl(var(--muted)/0.1)]">
        <button
          onClick={() => setActiveTab("all")}
          className={`flex-1 py-2 text-xs font-semibold border-b-2 transition-colors ${activeTab === "all" ? "border-[hsl(var(--primary))] text-[hsl(var(--primary))]" : "border-transparent text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"}`}
        >
          Tout
        </button>
        <button
          onClick={() => setActiveTab("unread")}
          className={`flex-1 py-2 text-xs font-semibold border-b-2 transition-colors ${activeTab === "unread" ? "border-[hsl(var(--primary))] text-[hsl(var(--primary))]" : "border-transparent text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"}`}
        >
          Non-lues
        </button>
      </div>

      {/* Liste */}
      <div className="overflow-y-auto flex-1">
        {loading ? (
          <div className="flex items-center justify-center h-24 text-sm text-[hsl(var(--muted-foreground))]">
            Chargement…
          </div>
        ) : notifs.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-28 gap-2 text-[hsl(var(--muted-foreground))]">
            <Bell size={28} className="opacity-30" />
            <p className="text-xs">Aucune notification</p>
          </div>
        ) : (() => {
          const displayedNotifs = activeTab === "all" ? notifs : notifs.filter((n) => !n.is_read);
          if (displayedNotifs.length === 0) {
            return (
              <div className="flex flex-col items-center justify-center h-28 gap-2 text-[hsl(var(--muted-foreground))]">
                <CheckCheck size={28} className="opacity-30" />
                <p className="text-xs">Tout est lu !</p>
              </div>
            );
          }
          return displayedNotifs.map((notif) => {
            const cfg = TYPE_CONFIG[notif.notif_type];
            return (
              <a
                key={notif.id}
                href={getTicketLink(notif)}
                onClick={() => handleNotifInteract(notif)}
                className={`group flex items-start gap-3 px-4 py-3 cursor-pointer border-b border-[hsl(var(--border)/0.3)] transition-colors hover:bg-[hsl(var(--muted)/0.3)] ${
                  !notif.is_read ? "bg-[hsl(var(--primary)/0.06)]" : ""
                }`}
              >
                {/* Icône */}
                <div className="mt-0.5 shrink-0 text-lg leading-none">
                  {cfg.icon}
                </div>

                {/* Contenu textuel */}
                <div className="flex-1 min-w-0">
                  <p className={`text-xs leading-snug ${!notif.is_read ? "font-medium text-[hsl(var(--foreground))]" : "text-[hsl(var(--muted-foreground))]"}`}>
                    {notif.message}
                  </p>
                  {notif.ticket_name && (
                    <p className={`mt-0.5 text-[11px] truncate ${!notif.is_read ? "font-semibold text-[hsl(var(--foreground))]" : "font-medium text-[hsl(var(--muted-foreground))]"}`}>
                      {notif.ticket_name}
                    </p>
                  )}
                  <p className="mt-1 text-[10px] text-[hsl(var(--muted-foreground)/0.7)]">
                    {timeAgo(notif.create_date)}
                  </p>

                </div>

                {/* Actions inline */}
                <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                  {!notif.is_read && (
                    <button
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); markRead(notif.id, false); }}
                      className="p-1 rounded-md hover:bg-[hsl(var(--muted)/0.6)] text-[hsl(var(--muted-foreground))]"
                      title="Marquer comme lu"
                    >
                      <Check size={12} />
                    </button>
                  )}
                  <button
                    onClick={(e) => handleDeleteClick(notif.id, e)}
                    className="p-1 rounded-md hover:bg-red-500/20 text-red-400"
                    title="Supprimer"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>

                {/* Point non-lu */}
                {!notif.is_read && (
                  <div className="mt-1.5 w-1.5 h-1.5 rounded-full bg-[hsl(var(--primary))] shrink-0" />
                )}
              </a>
            );
          });
        })()}
      </div>

      {/* Pied de page */}
      {notifs.length > 0 && (
        <div className="px-4 py-2.5 border-t border-[hsl(var(--border)/0.5)] text-center pb-safe">
          <Link
            href="/notifications"
            className="text-xs text-[hsl(var(--primary))] hover:opacity-70 transition-opacity block w-full"
          >
            Voir toutes les notifications →
          </Link>
        </div>
      )}
    </>
  );

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="relative" ref={panelRef}>
      {/* ── Cloche ── */}
      <button
        id="notification-bell-btn"
        onClick={() => {
          setOpen((prev) => !prev);
        }}
        className={`relative p-2 rounded-xl transition-colors ${
          isSnoozed ? "bg-indigo-500/10 text-indigo-400" : "hover:bg-[hsl(var(--muted)/0.6)] text-[hsl(var(--muted-foreground))]"
        }`}
        aria-label="Notifications"
      >
        {isSnoozed ? <BellOff size={20} /> : <Bell size={20} />}
        
        {unreadCount > 0 && !isSnoozed && (
          <span className="absolute -top-1 -right-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-black text-white leading-none shadow-[0_0_10px_rgba(239,68,68,0.8)] animate-pulse border-2 border-[hsl(var(--card))] z-10">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
        
        {unreadCount > 0 && isSnoozed && (
          <span className="absolute -top-1 -right-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-slate-500/80 px-1 text-[10px] font-black text-white leading-none border-2 border-[hsl(var(--card))] z-10">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {/* ── Panneau déroulant Desktop (intégré dans le DOM normal) ── */}
      {open && (
        <div className="hidden md:flex absolute right-0 top-12 z-[99999] w-[340px] max-h-[480px] flex-col rounded-2xl border border-[hsl(var(--border)_/_0.4)] bg-[hsl(var(--card)_/_0.98)] backdrop-blur-xl shadow-[0_10px_40px_rgba(0,0,0,0.3)] overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
          {view === "list" ? renderInnerContent() : renderSettingsView()}
        </div>
      )}

      {/* ── Panneau Mobile (Bottom Sheet exact mimic of filters) ── */}
      {open && typeof document !== "undefined" && createPortal(
        <div className="fixed inset-0 z-[9998] md:hidden" onClick={() => setOpen(false)}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div 
            ref={mobilePanelRef}
            className="absolute bottom-0 left-0 right-0 bg-[hsl(var(--card))] rounded-t-2xl max-h-[85vh] overflow-y-auto animate-slide-up flex flex-col" 
            onClick={(e) => e.stopPropagation()}
          >
            {/* Grabber visuel (esthétique mobile) */}
            <div className="w-full flex justify-center pt-5 pb-2 bg-[hsl(var(--card))] shrink-0" onClick={() => setOpen(false)}>
              <div className="w-10 h-1 rounded-full bg-[hsl(var(--border))]" />
            </div>
            {/* Contenu */}
            {view === "list" ? renderInnerContent() : renderSettingsView()}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
