"use client";

import { useState } from "react";
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

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname();
  const { user, logout } = useAuth();

  // Navigation Items by role
  let navItems: NavItem[] = [];

  if (user?.x_support_role === "admin") {
    navItems = [
      { id: "analytics", label: "Analytiques", href: "/analytics", icon: <BarChart3 size={20} /> },
      { id: "tickets", label: "Tous les Tickets", href: "/tickets", icon: <Ticket size={20} /> },
      { id: "queue", label: "File d'attente", href: "/tech/queue", icon: <Inbox size={20} /> },
      { id: "knowledge", label: "Base de connaissances", href: "/tech/knowledge", icon: <BookOpen size={20} /> },
      { id: "users", label: "Équipe & Rôles", href: "/users", icon: <Settings size={20} /> },
      { id: "settings", label: "Paramètres", href: "#", icon: <Settings size={20} />, disabled: true },
    ];
  } else if (user?.x_support_role === "tech") {
    navItems = [
      { id: "analytics", label: "Analytiques", href: "/analytics", icon: <BarChart3 size={20} /> },
      { id: "queue", label: "File d'attente", href: "/tech/queue", icon: <Inbox size={20} /> },
      { id: "my-tickets", label: "Mes Tickets", href: "/tech/tickets", icon: <ClipboardList size={20} /> },
      { id: "knowledge", label: "Base de connaissances", href: "/tech/knowledge", icon: <BookOpen size={20} /> },
    ];
  } else {
    // Regular User
    navItems = [
      { id: "welcome",   label: "Accueil",               href: "/welcome",         icon: <Home size={20} /> },
      { id: "tickets",   label: "Mes Tickets",            href: "/tickets",         icon: <Ticket size={20} /> },
      { id: "knowledge", label: "Base de connaissances",  href: "/tech/knowledge",  icon: <BookOpen size={20} /> },
    ];
  }

  // User initials for avatar
  const initials = user?.name
    ? user.name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "?";

  const roleLabels: Record<string, string> = {
    user: "Utilisateur",
    agent: "Agent IT",
    admin: "Administrateur",
  };

  return (
    <aside
      className="sidebar h-screen flex flex-col sticky top-0 z-40 select-none"
      style={{ width: collapsed ? "var(--sidebar-collapsed)" : "var(--sidebar-width)" }}
    >
      {/* Logo Area */}
      <div className="flex items-center gap-3 px-4 h-16 border-b border-[hsl(var(--border)/0.5)] flex-shrink-0">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 accent-gradient">
          <Headphones size={18} className="text-white" />
        </div>
        {!collapsed && (
          <div className="animate-fade-in overflow-hidden">
            <h1 className="text-sm font-bold tracking-tight whitespace-nowrap">
              IT Support
            </h1>
            <p className="text-[0.65rem] text-[hsl(var(--muted-foreground))] font-medium flex items-center gap-1">
              <Sparkles size={10} className="text-[hsl(var(--primary))]" />
              Propulsé par l&apos;IA
            </p>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {!collapsed && (
          <p className="text-[0.65rem] font-semibold uppercase tracking-widest text-[hsl(var(--muted-foreground))] px-3 mb-3">
            Navigation
          </p>
        )}
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          
          if (item.disabled) {
            return (
              <button
                key={item.id}
                className={`sidebar-item w-full opacity-40 cursor-not-allowed ${collapsed ? "justify-center px-0" : ""}`}
                title={collapsed ? item.label : undefined}
                disabled={true}
              >
                <span className="flex-shrink-0">{item.icon}</span>
                {!collapsed && <span className="whitespace-nowrap">{item.label}</span>}
                {!collapsed && (
                  <span className="ml-auto text-[0.6rem] uppercase bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))] px-1.5 py-0.5 rounded font-semibold">
                    Bientôt
                  </span>
                )}
              </button>
            );
          }

          return (
            <Link
              key={item.id}
              href={item.href}
              className={`sidebar-item w-full ${isActive ? "active" : ""} ${collapsed ? "justify-center px-0" : ""}`}
              title={collapsed ? item.label : undefined}
            >
              <span className="flex-shrink-0">{item.icon}</span>
              {!collapsed && <span className="whitespace-nowrap">{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="px-3 py-3 border-t border-[hsl(var(--border)/0.5)] space-y-2 flex-shrink-0">
        {/* User Info */}
        {user && (
          <div className={`flex items-center gap-3 px-2 py-2 ${collapsed ? "justify-center" : ""}`}>
            <div
              className="w-8 h-8 rounded-lg accent-gradient flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
              title={user.name}
            >
              {initials}
            </div>
            {!collapsed && (
              <div className="overflow-hidden animate-fade-in flex-1 min-w-0">
                <p className="text-xs font-semibold truncate">{user.name}</p>
                <p className="text-[0.6rem] text-[hsl(var(--muted-foreground))] truncate">
                  {roleLabels[user.x_support_role] || user.x_support_role}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Theme + Collapse row */}
        <div className={`flex ${collapsed ? "flex-col items-center gap-1" : "justify-between items-center px-2"}`}>
          {!collapsed && (
            <span className="text-xs font-medium text-[hsl(var(--muted-foreground))]">Thème</span>
          )}
          <ThemeToggle />
        </div>

        {/* Logout */}
        <button
          onClick={logout}
          className={`sidebar-item w-full text-[hsl(var(--destructive))] hover:bg-[hsl(var(--destructive)/0.08)] ${
            collapsed ? "justify-center px-0" : ""
          }`}
          title={collapsed ? "Déconnexion" : undefined}
        >
          <LogOut size={18} />
          {!collapsed && <span className="text-sm">Déconnexion</span>}
        </button>

        {/* Collapse Toggle */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="sidebar-item w-full justify-center text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
        >
          {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
          {!collapsed && <span className="text-xs">Réduire</span>}
        </button>
      </div>
    </aside>
  );
}
