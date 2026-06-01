"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { ODOO_URL } from "./config";

export interface Notification {
  id: number;
  notif_type:
    | "ticket_created"
    | "ticket_assigned"
    | "ticket_resolved"
    | "ticket_escalated"
    | "ticket_waiting"
    | "new_comment"
    | "sla_breached"
    | "ia_solution";
  message: string;
  ticket_id: number | null;
  ticket_name: string | null;
  is_read: boolean;
  create_date: string | null;
  read_at: string | null;
  x_accepted?: boolean;
}

export const TYPE_CONFIG: Record<
  Notification["notif_type"],
  { icon: string; color: string; label: string }
> = {
  ticket_created:   { icon: "🎫", color: "text-blue-400",    label: "Ticket créé" },
  ticket_assigned:  { icon: "🔧", color: "text-amber-400",   label: "Ticket assigné" },
  ticket_resolved:  { icon: "✅", color: "text-emerald-400", label: "Ticket résolu" },
  ticket_escalated: { icon: "🚨", color: "text-orange-400",  label: "Escalade" },
  ticket_waiting:   { icon: "⏸️",  color: "text-slate-400",   label: "En attente" },
  new_comment:      { icon: "💬", color: "text-green-400",   label: "Nouveau message" },
  sla_breached:     { icon: "🚨", color: "text-red-400",     label: "SLA dépassé" },
  ia_solution:      { icon: "🤖", color: "text-purple-400", label: "Solution IA" },
};

interface NotificationContextType {
  notifs: Notification[];
  unreadCount: number;
  loading: boolean;
  fetchNotifications: (silent?: boolean) => Promise<void>;
  markRead: (id: number, silent?: boolean) => Promise<void>;
  markAllRead: () => Promise<void>;
  deleteNotif: (id: number) => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [notifs, setNotifs] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);
  const prevUnreadRef = useRef(0);
  const lastToastedIdRef = useRef<number | null>(null);

  const getUserId = (): string | null => {
    try {
      const stored = localStorage.getItem("it_support_user");
      if (!stored) return null;
      const parsed = JSON.parse(stored);
      return parsed?.id ? String(parsed.id) : null;
    } catch {
      return null;
    }
  };

  const fetchNotifications = useCallback(async (silent = false) => {
    const userId = getUserId();
    if (!userId) return;

    if (!silent) setLoading(true);
    try {
      const res = await fetch(`${ODOO_URL}/api/notifications?user_id=${userId}`, { cache: "no-store" });
      if (!res.ok) return;
      const json = await res.json();
      const incoming: Notification[] = json.data || [];
      const newUnread: number = json.unread_count || 0;

      setNotifs(incoming);

      const storedSnooze = localStorage.getItem("it_support_snooze");
      const isCurrentlySnoozed = storedSnooze && parseInt(storedSnooze, 10) > Date.now();

      // Toast si de nouvelles notifs non lues arrivent ET mode normal (non snoozé)
      if (silent && newUnread > prevUnreadRef.current && !isCurrentlySnoozed) {
        const unreadNotifs = incoming.filter((n) => !n.is_read);
        const newest = unreadNotifs.length > 0 ? unreadNotifs[0] : null;

        if (newest && newest.id !== lastToastedIdRef.current) {
          lastToastedIdRef.current = newest.id;
          const cfg = TYPE_CONFIG[newest.notif_type];
          toast.info(`${cfg.icon} ${newest.message}`, {
            description: newest.ticket_name || undefined,
            action: newest.ticket_id
              ? {
                  label: "Voir",
                  onClick: () => {
                    try {
                      const stored = localStorage.getItem("it_support_user");
                      const parsed = stored ? JSON.parse(stored) : null;
                      const role = parsed?.x_support_role;
                      if (role === "tech") {
                        if (newest.notif_type === "ticket_assigned" && newest.x_accepted === false) {
                          router.push(`/tech/queue?highlight=${newest.ticket_id}`);
                        } else {
                          router.push(`/tech/tickets/${newest.ticket_id}`);
                        }
                      } else {
                        router.push(`/tickets?ticketId=${newest.ticket_id}`);
                      }
                    } catch {
                      router.push(`/tickets?ticketId=${newest.ticket_id}`);
                    }
                  },
                }
              : undefined,
          });
        }
      }
      prevUnreadRef.current = newUnread;
    } catch {
      // Silent fail
    } finally {
      if (!silent) setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(() => fetchNotifications(true), 30000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  const markRead = async (id: number, silent = false) => {
    try {
      fetch(`${ODOO_URL}/api/notifications/${id}/read`, { method: "PATCH" })
        .then(() => {
          if (!silent) {
            setNotifs((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
          }
        })
        .catch(() => {});
    } catch {}
  };

  const markAllRead = async () => {
    const userId = getUserId();
    if (!userId) return;
    try {
      await fetch(`${ODOO_URL}/api/notifications/read-all`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: parseInt(userId) }),
      });
      setNotifs((prev) => prev.map((n) => ({ ...n, is_read: true })));
      prevUnreadRef.current = 0;
    } catch {}
  };

  const deleteNotif = async (id: number) => {
    try {
      await fetch(`${ODOO_URL}/api/notifications/${id}`, { method: "DELETE" });
      setNotifs((prev) => prev.filter((n) => n.id !== id));
    } catch {}
  };

  const unreadCount = notifs.filter((n) => !n.is_read).length;

  return (
    <NotificationContext.Provider
      value={{
        notifs,
        unreadCount,
        loading,
        fetchNotifications,
        markRead,
        markAllRead,
        deleteNotif,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error("useNotifications must be used within a NotificationProvider");
  }
  return context;
}
