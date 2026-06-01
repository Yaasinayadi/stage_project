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
  Sun,
  Moon,
} from "lucide-react";
import { useTheme } from "next-themes";
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

// Composant unifié pour toutes les lignes de la sidebar
const SidebarItem = ({
  icon,
  label,
  expanded,
  active = false,
  disabled = false,
  onClick,
  href,
  badge,
  className = "",
  title,
  danger = false,
  as = "button"
}: any) => {
  const content = (
    <>
      {/* Indicateur d'état actif positionné de manière absolue à gauche de la sidebar entière (-left-3 compense le px-3 du parent) */}
      {active && (
        <div className="absolute -left-3 top-1/2 -translate-y-1/2 w-[3px] h-[60%] bg-[hsl(var(--primary))] rounded-r-[4px]" />
      )}
      
      {/* Conteneur d'icône invariant : largeur fixe (w-12 = 48px) */}
      <div className="w-12 flex-shrink-0 flex items-center justify-center">
        {icon}
      </div>
      
      {/* Alignement du texte avec flex items-center */}
      <span className={`whitespace-nowrap flex-1 text-left flex items-center transition-all duration-300 ease-in-out overflow-hidden ${expanded ? "opacity-100 max-w-[200px]" : "opacity-0 max-w-0"}`}>
        {label}
      </span>
      
      {badge && (
        <span className={`text-[0.6rem] uppercase bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))] px-1.5 py-0.5 rounded font-semibold transition-all duration-300 ease-in-out overflow-hidden ${expanded ? "opacity-100 max-w-[50px] mr-2" : "opacity-0 max-w-0 mr-0"}`}>
          {badge}
        </span>
      )}
    </>
  );

  const baseClasses = `relative flex items-center w-full min-h-[44px] rounded-xl transition-all duration-200 ease-in-out text-sm ${
    disabled ? "opacity-40 cursor-not-allowed" : as !== "div" ? "cursor-pointer active:scale-95 active:bg-zinc-800/50" : ""
  } ${
    active 
      ? "text-[hsl(var(--primary))] bg-[hsl(var(--primary)/0.1)] font-semibold" 
      : danger 
        ? "text-[hsl(var(--muted-foreground))] hover:text-rose-500 hover:bg-rose-500/10 font-medium" 
        : as !== "div" ? "text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] hover:bg-white/10 font-medium" : "text-[hsl(var(--muted-foreground))] font-medium"
  } ${className}`;

  if (href && !disabled) {
    return (
      <Link href={href} onClick={onClick} className={baseClasses} title={title}>
        {content}
      </Link>
    );
  }

  if (as === "div") {
    return (
      <div className={baseClasses} title={title}>
        {content}
      </div>
    );
  }

  return (
    <button onClick={onClick} disabled={disabled} className={baseClasses} title={title}>
      {content}
    </button>
  );
};

export default function Sidebar({ mobileOpen = false, onMobileClose }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(true);
  const [hovered, setHovered] = useState(false);
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const sidebarRef = useRef<HTMLDivElement>(null);
  
  const { setTheme, theme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (onMobileClose) onMobileClose();
  }, [pathname]);

  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [mobileOpen]);

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

  const sidebarContent = (isMobile: boolean) => {
    const expanded = isMobile ? true : isExpanded;

    return (
      <div className="flex flex-col h-full w-full px-3 py-3">
        {/* Logo */}
        <div className="flex items-center min-h-[56px] flex-shrink-0 transition-all duration-300 ease-in-out w-full border-b border-[hsl(var(--border)/0.5)] mb-2 pb-2">
          <div className="w-12 flex-shrink-0 flex items-center justify-center">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 accent-gradient shadow-md">
              <Headphones size={18} className="text-white" />
            </div>
          </div>
          <div className={`transition-all duration-300 ease-in-out overflow-hidden flex-1 ${expanded ? "opacity-100 max-w-[200px]" : "opacity-0 max-w-0"}`}>
            <h1 className="text-sm font-bold tracking-tight whitespace-nowrap">IT Support</h1>
            <p className="text-[0.65rem] text-[hsl(var(--muted-foreground))] font-medium flex items-center gap-1 whitespace-nowrap">
              <Sparkles size={10} className="text-[hsl(var(--primary))]" />
              Propulsé par l&apos;IA
            </p>
          </div>
          {isMobile && (
            <button
              onClick={onMobileClose}
              className="p-1.5 rounded-lg hover:bg-[hsl(var(--muted)/0.5)] text-[hsl(var(--muted-foreground))]"
            >
              <X size={18} />
            </button>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-2 space-y-1 overflow-y-auto custom-scrollbar w-full">
          <p className={`text-[0.65rem] font-semibold uppercase tracking-widest text-[hsl(var(--muted-foreground))] px-3 mb-2 transition-all duration-300 ease-in-out whitespace-nowrap overflow-hidden ${expanded ? "opacity-100 max-h-10" : "opacity-0 max-h-0 mb-0"}`}>
            Navigation
          </p>
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <SidebarItem
                key={item.id}
                icon={item.icon}
                label={item.label}
                href={item.href}
                active={isActive}
                disabled={item.disabled}
                expanded={expanded}
                badge={item.disabled ? "Bientôt" : undefined}
                title={!expanded ? item.label : undefined}
                onClick={() => {
                  if (isMobile && onMobileClose) onMobileClose();
                }}
              />
            );
          })}
        </nav>

        {/* Footer */}
        <div className="pt-3 border-t border-[hsl(var(--border)/0.5)] space-y-1 flex-shrink-0 w-full">
          {user && (
            <SidebarItem
              href="/profile"
              expanded={expanded}
              icon={
                <div
                  className="w-8 h-8 rounded-lg accent-gradient flex items-center justify-center text-white text-xs font-bold"
                  title={user.name}
                >
                  {initials}
                </div>
              }
              label={
                <div className="flex flex-col min-w-0 w-full">
                  <p className="text-sm font-semibold truncate leading-tight text-[hsl(var(--foreground))]">{user.name}</p>
                  <p className="text-[0.65rem] text-[hsl(var(--muted-foreground))] truncate font-normal mt-0.5">
                    {roleLabels[user.x_support_role] || user.x_support_role}
                  </p>
                </div>
              }
              title={!expanded ? "Profil" : undefined}
              onClick={() => {
                if (isMobile && onMobileClose) onMobileClose();
              }}
            />
          )}

          <SidebarItem
            expanded={expanded}
            icon={
              <div className="relative flex items-center justify-center w-full h-full">
                {mounted ? (
                  <>
                    <Sun className="h-[18px] w-[18px] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
                    <Moon className="absolute h-[18px] w-[18px] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
                  </>
                ) : (
                  <div className="w-[18px] h-[18px]" />
                )}
              </div>
            }
            label="Thème"
            title={!expanded ? "Changer de thème" : undefined}
            onClick={() => setTheme(theme === "light" ? "dark" : "light")}
          />

          <SidebarItem
            expanded={expanded}
            icon={<LogOut size={18} />}
            label="Déconnexion"
            danger={true}
            onClick={logout}
            title={!expanded ? "Déconnexion" : undefined}
          />

          {!isMobile && (
            <SidebarItem
              expanded={expanded}
              icon={isExpanded ? <ChevronLeft size={18} /> : <ChevronRight size={18} />}
              label={collapsed ? "Épingler" : "Réduire"}
              onClick={() => setCollapsed(!collapsed)}
              title={collapsed ? "Épingler la barre" : "Réduire"}
            />
          )}
        </div>
      </div>
    );
  };

  return (
    <>
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

      <div
        className={`md:hidden fixed inset-0 z-[9999] transition-all duration-300 ${
          mobileOpen ? "pointer-events-auto" : "pointer-events-none"
        }`}
      >
        <div
          className={`absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-300 ${
            mobileOpen ? "opacity-100" : "opacity-0"
          }`}
          onClick={onMobileClose}
        />
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
