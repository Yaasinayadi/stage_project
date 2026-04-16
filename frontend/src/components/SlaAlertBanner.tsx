"use client";

import { useEffect, useState, useCallback } from "react";
import axios from "axios";
import { useAuth } from "@/lib/auth";
import { AlertTriangle, X, ChevronRight } from "lucide-react";
import Link from "next/link";

const ODOO_URL = "http://localhost:8069";

type DangerTicket = {
  id: number;
  name: string;
  sla_status: "at_risk" | "breached";
  sla_deadline: string | null;
};

export default function SlaAlertBanner() {
  const { user } = useAuth();
  const [dangerTickets, setDangerTickets] = useState<DangerTicket[]>([]);
  const [dismissed, setDismissed] = useState<Set<number>>(new Set());

  const checkSla = useCallback(async () => {
    if (!user || !["tech", "admin"].includes(user.x_support_role)) return;
    try {
      const res = await axios.get(`${ODOO_URL}/api/tickets`, { withCredentials: true });
      if (res.data.status === 200) {
        const urgent: DangerTicket[] = (res.data.data as DangerTicket[]).filter(
          (t) => t.sla_status === "at_risk" || t.sla_status === "breached"
        );
        setDangerTickets(urgent);
      }
    } catch {
      // silently ignore
    }
  }, [user]);

  useEffect(() => {
    checkSla();
    // Poll every 60 seconds to detect SLA changes
    const id = setInterval(checkSla, 60000);
    return () => clearInterval(id);
  }, [checkSla]);

  const visible = dangerTickets.filter((t) => !dismissed.has(t.id));

  if (!visible.length) return null;

  const breached = visible.filter((t) => t.sla_status === "breached");
  const atRisk   = visible.filter((t) => t.sla_status === "at_risk");

  return (
    <div className={`w-full px-4 py-2.5 flex items-center gap-3 text-sm font-medium z-50
      ${breached.length > 0
        ? "bg-red-600 text-white"
        : "bg-amber-500 text-white"
      }`}
    >
      <AlertTriangle size={16} className="flex-shrink-0 animate-pulse" />

      <div className="flex-1 flex flex-wrap items-center gap-x-4 gap-y-1 min-w-0">
        {breached.length > 0 && (
          <span className="font-bold">
            🚨 {breached.length} ticket{breached.length > 1 ? "s" : ""} SLA dépassé{breached.length > 1 ? "s" : ""} !
          </span>
        )}
        {atRisk.length > 0 && (
          <span>
            ⚠️ {atRisk.length} ticket{atRisk.length > 1 ? "s" : ""} à risque
          </span>
        )}

        {/* Show first ticket link */}
        {visible.slice(0, 2).map((t) => (
          <Link
            key={t.id}
            href={`/tech/tickets/${t.id}`}
            className="inline-flex items-center gap-1 underline underline-offset-2 hover:opacity-80 transition-opacity text-xs"
          >
            #{t.id} {t.name.length > 30 ? t.name.slice(0, 30) + "…" : t.name}
            <ChevronRight size={11} />
          </Link>
        ))}
        {visible.length > 2 && (
          <Link href="/tech/tickets" className="text-xs underline underline-offset-2 hover:opacity-80">
            +{visible.length - 2} autres
          </Link>
        )}
      </div>

      {/* Dismiss all */}
      <button
        onClick={() => setDismissed(new Set(visible.map((t) => t.id)))}
        className="flex-shrink-0 hover:opacity-70 transition-opacity"
        title="Masquer"
      >
        <X size={16} />
      </button>
    </div>
  );
}
