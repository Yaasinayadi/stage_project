"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { Menu, Headphones, Sparkles } from "lucide-react";
import { useAuth } from "@/lib/auth";
import Sidebar from "@/components/Sidebar";
import Chatbot from "@/components/Chatbot";

/**
 * AppShell conditionally renders the sidebar and chatbot
 * only on authenticated pages (not on /login or /register).
 *
 * Mobile: renders a top header with hamburger → slides open the Sidebar drawer.
 * Desktop (md+): classic sticky sidebar layout.
 */
export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { isAuthenticated } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  const isAuthPage = pathname === "/login" || pathname === "/register";

  // Auth pages: render children only
  if (isAuthPage) return <>{children}</>;

  // Authenticated pages
  if (isAuthenticated) {
    return (
      <div className="flex min-h-screen">
        {/* ── Sidebar (handles desktop sticky + mobile drawer internally) ── */}
        <Sidebar
          mobileOpen={mobileOpen}
          onMobileClose={() => setMobileOpen(false)}
        />

        {/* ── Main content column ── */}
        <div className="flex-1 flex flex-col min-h-screen overflow-x-hidden">
          {/* Mobile top header — only visible on < md */}
          <header className="md:hidden sticky top-0 z-40 flex items-center gap-3 px-4 h-14 border-b border-[hsl(var(--border)/0.5)] bg-[hsl(var(--card)/0.95)] backdrop-blur-md">
            {/* Hamburger */}
            <button
              onClick={() => setMobileOpen(true)}
              className="p-2 rounded-xl hover:bg-[hsl(var(--muted)/0.6)] text-[hsl(var(--muted-foreground))] transition-colors"
              aria-label="Ouvrir le menu"
            >
              <Menu size={22} />
            </button>

            {/* Brand mark */}
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center accent-gradient">
                <Headphones size={14} className="text-white" />
              </div>
              <span className="text-sm font-bold tracking-tight">IT Support</span>
              <span className="hidden xs:flex items-center gap-0.5 text-[0.6rem] text-[hsl(var(--muted-foreground))] font-medium">
                <Sparkles size={9} className="text-[hsl(var(--primary))]" />
                IA
              </span>
            </div>
          </header>

          {/* Page content */}
          <main className="flex-1">{children}</main>
        </div>

        <Chatbot />
      </div>
    );
  }

  // Fallback (not auth page + not authenticated → will redirect via ProtectedRoute)
  return <>{children}</>;
}
