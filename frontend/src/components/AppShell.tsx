"use client";

import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth";
import Sidebar from "@/components/Sidebar";
import Chatbot from "@/components/Chatbot";

/**
 * AppShell conditionally renders the sidebar and chatbot
 * only on authenticated pages (not on /login or /register).
 */
export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { isAuthenticated } = useAuth();

  const isAuthPage = pathname === "/login" || pathname === "/register";

  // Auth pages: render children only (no sidebar, no chatbot)
  if (isAuthPage) {
    return <>{children}</>;
  }

  // Authenticated pages: sidebar + main + chatbot
  if (isAuthenticated) {
    return (
      <div className="flex min-h-screen">
        <Sidebar />
        <main className="flex-1 min-h-screen overflow-x-hidden">
          {children}
        </main>
        <Chatbot />
      </div>
    );
  }

  // Fallback (not auth page + not authenticated → will redirect via ProtectedRoute)
  return <>{children}</>;
}
