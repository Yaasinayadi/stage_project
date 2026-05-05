"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  Ticket,
  BarChart3,
  Settings,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Headphones,
  LogOut,
  Inbox,
  ClipboardList,
  BookOpen,
  X,
} from "lucide-react";
import { ThemeToggle } from "./ThemeToggle";
import { useAuth } from "@/lib/auth";

type NavItem = {
  id: string;
  label: string;
  href: string;
  icon: React.ReactNode;
  disabled?: boolean;
};

interface SidebarProps {
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}

export default function Sidebar({ mobileOpen = false, onMobileClose }: SidebarProps) {
  // Desktop: collapsed = icon-only. Default collapsed on desktop.
  const [collapsed, setCollapsed] = useState(true);
  const [hovered, setHovered] = useState(false);
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const sidebarRef = useRef<HTMLDivElement>(null);

  // Close mobile drawer on route change
  useEffect(() => {
    if (onMobileClose) onMobileClose();
  }, [pathname]);


  // Prevent body scroll when mobile drawer open
  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [mobileOpen]);

  // On desktop: expanded when hovered OR when manually toggled to expanded
  const isExpanded = !collapsed || hovered;

  let navItems: NavItem[] = [];

  if (user?.x_support_role === "admin") {
    navItems = [
      { id: "analytics", label: "Analytiques", href: "/analytics", icon: <BarChart3 size={20} /> },
      { id: "tickets", label: "Tous les Tickets", href: "/tickets", icon: <Ticket size={20} /> },
      { id: "inventory", label: "Gestion des Ressources", href: "/admin/inventory", icon: <ClipboardList size={20} /> },
      { id: "queue", label: "File d'attente", href: "/tech/queue", icon: <Inbox size={20} /> },
      { id: "knowledge", label: "Base de connaissances", href: "/tech/knowledge", icon: <BookOpen size={20} /> },
      { id: "users", label: "Équipe & Rôles", href: "/users", icon: <Settings size={20} /> },
    ];
  } else if (user?.x_support_role === "tech") {
    navItems = [
      { id: "analytics", label: "Analytiques", href: "/analytics", icon: <BarChart3 size={20} /> },
      { id: "queue", label: "File d'attente", href: "/tech/queue", icon: <Inbox size={20} /> },
      { id: "my-tickets", label: "Mes Tickets", href: "/tech/tickets", icon: <ClipboardList size={20} /> },
      { id: "knowledge", label: "Base de connaissances", href: "/tech/knowledge", icon: <BookOpen size={20} /> },
    ];
  } else {
    navItems = [
      { id: "welcome", label: "Accueil", href: "/welcome", icon: <Home size={20} /> },
      { id: "tickets", label: "Mes Tickets", href: "/tickets", icon: <Ticket size={20} /> },
      { id: "knowledge", label: "Base de connaissances", href: "/tech/knowledge", icon: <BookOpen size={20} /> },
    ];
  }

  const initials = user?.name
    ? user.name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
    : "?";

  const roleLabels: Record<string, string> = {
    user: "Utilisateur",
    tech: "Technicien",
    agent: "Agent IT",
    admin: "Administrateur",
  };

  // ── Shared inner content ────────────────────────────────────────────────
  const sidebarContent = (isMobile: boolean) => {
    const expanded = isMobile ? true : isExpanded;

    return (
      <>
        {/* Logo */}
        <div className={`flex items-center h-16 border-b border-[hsl(var(--border)/0.5)] flex-shrink-0 transition-all duration-300 ease-in-out ${expanded ? "gap-3 px-4" : "justify-center gap-0 px-0"}`}>
          <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 accent-gradient">
            <Headphones size={18} className="text-white" />
          </div>
          <div className={`transition-all duration-300 ease-in-out overflow-hidden flex-1 ${expanded ? "opacity-100 max-w-[200px]" : "opacity-0 max-w-0"}`}>
            <h1 className="text-sm font-bold tracking-tight whitespace-nowrap">IT Support</h1>
            <p className="text-[0.65rem] text-[hsl(var(--muted-foreground))] font-medium flex items-center gap-1 whitespace-nowrap">
              <Sparkles size={10} className="text-[hsl(var(--primary))]" />
              Propulsé par l&apos;IA
            </p>
          </div>
          {/* Mobile close button */}
          {isMobile && (
            <button
              onClick={onMobileClose}
              className="ml-auto p-1.5 rounded-lg hover:bg-[hsl(var(--muted)/0.5)] text-[hsl(var(--muted-foreground))]"
            >
              <X size={18} />
            </button>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto custom-scrollbar">
          <p className={`text-[0.65rem] font-semibold uppercase tracking-widest text-[hsl(var(--muted-foreground))] px-3 mb-3 transition-all duration-300 ease-in-out whitespace-nowrap overflow-hidden ${expanded ? "opacity-100 max-h-10" : "opacity-0 max-h-0 mb-0"}`}>
            Navigation
          </p>
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            if (item.disabled) {
              return (
                <button
                  key={item.id}
                  className={`sidebar-item w-full opacity-40 cursor-not-allowed ${!expanded ? "justify-center px-0 !gap-0" : ""}`}
                  title={!expanded ? item.label : undefined}
                  disabled
                >
                  <span className="flex-shrink-0">{item.icon}</span>
                  <span className={`whitespace-nowrap flex-1 text-left transition-all duration-300 ease-in-out overflow-hidden ${expanded ? "opacity-100 max-w-[200px] ml-2" : "opacity-0 max-w-0 ml-0"}`}>
                    {item.label}
                  </span>
                  <span className={`text-[0.6rem] uppercase bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))] px-1.5 py-0.5 rounded font-semibold transition-all duration-300 ease-in-out overflow-hidden ${expanded ? "opacity-100 max-w-[50px] ml-auto" : "opacity-0 max-w-0 ml-0"}`}>
                    Bientôt
                  </span>
                </button>
              );
            }
            return (
              <Link
                key={item.id}
                href={item.href}
                onClick={() => {
                  if (isMobile && onMobileClose) {
                    onMobileClose();
                  }
                }}
                className={`sidebar-item w-full active:scale-[0.98] active:opacity-75 ${isActive ? "active" : ""} ${!expanded ? "justify-center px-0 !gap-0" : ""}`}
                title={!expanded ? item.label : undefined}
              >
                <span className="flex-shrink-0">{item.icon}</span>
                <span className={`whitespace-nowrap transition-all duration-300 ease-in-out overflow-hidden ${expanded ? "opacity-100 max-w-[200px] ml-2" : "opacity-0 max-w-0 ml-0"}`}>
                  {item.label}
                </span>
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="px-3 py-3 border-t border-[hsl(var(--border)/0.5)] space-y-2 flex-shrink-0">
          {user && (
            <Link
              href="/profile"
              onClick={() => {
                if (isMobile && onMobileClose) {
                  onMobileClose();
                }
              }}
              className={`flex items-center py-2 rounded-xl hover:bg-[hsl(var(--muted)/0.5)] transition-colors ${expanded ? "gap-3 px-2" : "justify-center gap-0 px-0"}`}
            >
              <div
                className="w-8 h-8 rounded-lg accent-gradient flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                title={user.name}
              >
                {initials}
              </div>
              <div className={`transition-all duration-300 ease-in-out overflow-hidden flex-1 min-w-0 ${expanded ? "opacity-100 max-w-[200px]" : "opacity-0 max-w-0"}`}>
                <p className="text-xs font-semibold truncate">{user.name}</p>
                <p className="text-[0.6rem] text-[hsl(var(--muted-foreground))] truncate">
                  {roleLabels[user.x_support_role] || user.x_support_role}
                </p>
              </div>
            </Link>
          )}

          <div className={`flex ${!expanded ? "flex-col items-center gap-1" : "justify-between items-center px-2"}`}>
            <span className={`text-xs font-medium text-[hsl(var(--muted-foreground))] transition-all duration-300 ease-in-out overflow-hidden whitespace-nowrap ${expanded ? "opacity-100 max-w-[100px]" : "opacity-0 max-w-0"}`}>
              Thème
            </span>
            <ThemeToggle />
          </div>

          <button
            onClick={logout}
            className={`sidebar-item w-full text-[hsl(var(--destructive))] hover:bg-[hsl(var(--destructive)/0.08)] ${!expanded ? "justify-center px-0" : ""}`}
            title={!expanded ? "Déconnexion" : undefined}
          >
            <LogOut size={18} className="flex-shrink-0" />
            <span className={`text-sm whitespace-nowrap transition-all duration-300 ease-in-out overflow-hidden ${expanded ? "opacity-100 max-w-[200px] ml-2 text-left" : "opacity-0 max-w-0 ml-0"}`}>
              Déconnexion
            </span>
          </button>

          {/* Desktop collapse toggle — hidden on mobile drawer */}
          {!isMobile && (
            <button
              onClick={() => setCollapsed(!collapsed)}
              className="sidebar-item w-full justify-center text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
              title={collapsed ? "Épingler la barre" : "Réduire"}
            >
              {isExpanded ? <ChevronLeft size={18} className="flex-shrink-0" /> : <ChevronRight size={18} className="flex-shrink-0" />}
              <span className={`text-xs whitespace-nowrap transition-all duration-300 ease-in-out overflow-hidden ${expanded ? "opacity-100 max-w-[200px] ml-2 text-left" : "opacity-0 max-w-0 ml-0"}`}>
                {collapsed ? "Épingler" : "Réduire"}
              </span>
            </button>
          )}
        </div>
      </>
    );
  };

  return (
    <>
      {/* ── DESKTOP SIDEBAR (md+) ─────────────────────────────────────── */}
      {/* Spacer div to reserve layout space — no z-index to avoid creating a
           stacking context that would cap the fixed aside's z-[100] */}
      <div 
        className="hidden md:block flex-shrink-0 transition-all duration-300 ease-in-out" 
        style={{ width: collapsed ? "var(--sidebar-collapsed)" : "var(--sidebar-width)" }}
      >
        <aside
          ref={sidebarRef}
          className={`sidebar h-screen flex flex-col fixed top-0 left-0 z-[100] select-none transition-all duration-300 ease-in-out overflow-x-hidden ${
            isExpanded && collapsed ? "shadow-2xl border-r border-[hsl(var(--border))]" : "border-r border-[hsl(var(--border)/0.5)]"
          }`}
          style={{
            width: isExpanded ? "var(--sidebar-width)" : "var(--sidebar-collapsed)",
          }}
          onMouseEnter={() => collapsed && setHovered(true)}
          onMouseLeave={() => setHovered(false)}
        >
          {sidebarContent(false)}
        </aside>
      </div>

      {/* ── MOBILE DRAWER (< md) ─────────────────────────────────────── */}
      <div
        className={`md:hidden fixed inset-0 z-[9999] transition-all duration-300 ${
          mobileOpen ? "pointer-events-auto" : "pointer-events-none"
        }`}
      >
        {/* Backdrop */}
        <div
          className={`absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-300 ${
            mobileOpen ? "opacity-100" : "opacity-0"
          }`}
          onClick={onMobileClose}
        />
        {/* Drawer panel */}
        <aside
          className={`absolute top-0 left-0 h-full sidebar flex flex-col pointer-events-auto
            transition-transform duration-300 ease-in-out shadow-2xl
            ${mobileOpen ? "translate-x-0" : "-translate-x-full"}`}
          style={{ width: "var(--sidebar-width)" }}
          onClick={(e) => e.stopPropagation()}
        >
          {sidebarContent(true)}
        </aside>
      </div>
    </>
  );
}
