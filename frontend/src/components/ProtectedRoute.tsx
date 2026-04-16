"use client";

import { useAuth } from "@/lib/auth";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Loader2 } from "lucide-react";

interface ProtectedRouteProps {
  children: React.ReactNode;
  roles?: string[];
}

export default function ProtectedRoute({ children, roles }: ProtectedRouteProps) {
  const { isAuthenticated, isLoading, user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace("/login");
    }
    // Role guard — redirect to /tickets if role not authorized
    if (!isLoading && isAuthenticated && roles && user && !roles.includes(user.x_support_role)) {
      router.replace("/tickets");
    }
  }, [isLoading, isAuthenticated, router, roles, user]);

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex flex-col items-center gap-4 animate-fade-in">
          <div className="w-12 h-12 rounded-2xl accent-gradient flex items-center justify-center animate-pulse-glow">
            <Loader2 size={22} className="text-white animate-spin" />
          </div>
          <p className="text-sm text-[hsl(var(--muted-foreground))] font-medium">
            Chargement...
          </p>
        </div>
      </div>
    );
  }

  // Not authenticated or not authorized — will redirect
  if (!isAuthenticated) return null;
  if (roles && user && !roles.includes(user.x_support_role)) return null;

  return <>{children}</>;
}
