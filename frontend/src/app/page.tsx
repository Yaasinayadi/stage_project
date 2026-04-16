"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import ProtectedRoute from "@/components/ProtectedRoute";
import { useAuth } from "@/lib/auth";
import { Loader2 } from "lucide-react";

function RootRedirect() {
  const { user, isAuthenticated } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isAuthenticated && user) {
      if (user.x_support_role === "admin" || user.x_support_role === "tech") {
        router.replace("/analytics");
      } else {
        router.replace("/welcome");
      }
    }
  }, [user, isAuthenticated, router]);

  return (
    <div className="flex h-[80vh] w-full items-center justify-center">
      <div className="flex flex-col items-center gap-4 text-[hsl(var(--muted-foreground))] animate-fade-in">
        <Loader2 className="h-10 w-10 animate-spin text-[hsl(var(--primary))]" />
        <p className="text-sm font-medium animate-pulse">Chargement de votre espace...</p>
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <ProtectedRoute>
      <RootRedirect />
    </ProtectedRoute>
  );
}
