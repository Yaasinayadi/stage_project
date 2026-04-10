"use client";

import { useState } from "react";
import {
  LayoutDashboard,
  Ticket,
  BarChart3,
  Settings,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Headphones,
} from "lucide-react";
import { ThemeToggle } from "./ThemeToggle";

type NavItem = {
  id: string;
  label: string;
  icon: React.ReactNode;
  active?: boolean;
  disabled?: boolean;
};

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const [activeItem, setActiveItem] = useState("dashboard");

  const navItems: NavItem[] = [
    { id: "dashboard", label: "Tableau de bord", icon: <LayoutDashboard size={20} /> },
    { id: "tickets", label: "Tickets", icon: <Ticket size={20} /> },
    { id: "analytics", label: "Analytiques", icon: <BarChart3 size={20} />, disabled: true },
    { id: "settings", label: "Paramètres", icon: <Settings size={20} />, disabled: true },
  ];

  return (
    <aside
      className="sidebar h-screen flex flex-col sticky top-0 z-40 select-none"
      style={{ width: collapsed ? "var(--sidebar-collapsed)" : "var(--sidebar-width)" }}
    >
      {/* Logo Area */}
      <div className="flex items-center gap-3 px-4 h-16 border-b border-[hsl(var(--border)/0.5)] flex-shrink-0">
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 accent-gradient"
        >
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
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => !item.disabled && setActiveItem(item.id)}
            className={`sidebar-item w-full ${activeItem === item.id ? "active" : ""} ${
              item.disabled ? "opacity-40 cursor-not-allowed" : ""
            } ${collapsed ? "justify-center px-0" : ""}`}
            title={collapsed ? item.label : undefined}
            disabled={item.disabled}
          >
            <span className="flex-shrink-0">{item.icon}</span>
            {!collapsed && <span className="whitespace-nowrap">{item.label}</span>}
            {!collapsed && item.disabled && (
              <span className="ml-auto text-[0.6rem] uppercase bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))] px-1.5 py-0.5 rounded font-semibold">
                Bientôt
              </span>
            )}
          </button>
        ))}
      </nav>

      {/* Footer */}
      <div className="px-3 py-3 border-t border-[hsl(var(--border)/0.5)] space-y-2 flex-shrink-0">
        {/* Theme Toggle */}
        <div className={`flex ${collapsed ? "justify-center" : "justify-between items-center px-2"}`}>
          {!collapsed && (
            <span className="text-xs font-medium text-[hsl(var(--muted-foreground))]">Thème</span>
          )}
          <ThemeToggle />
        </div>

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
