"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
} from "react";
import axios from "axios";

// ─── Types ───
export type UserRole = "user" | "tech" | "admin";

export type User = {
  id: number;
  name: string;
  email: string;
  x_support_role: UserRole;
  token?: string;
};

type AuthContextType = {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (
    email: string,
    password: string,
  ) => Promise<{ success: boolean; error?: string }>;
  register: (
    name: string,
    email: string,
    password: string,
  ) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  refreshUser: () => Promise<void>;
};

// ─── Context ───
const AuthContext = createContext<AuthContextType | undefined>(undefined);

const STORAGE_KEY = "it_support_user";
const ODOO_URL = "http://localhost:8069";
const SYNC_INTERVAL_MS = 60 * 1000; // Re-sync every 60 seconds

// ─── Provider ───
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const syncTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Persist user to localStorage and state
  const persistUser = useCallback((userData: User) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(userData));
    setUser(userData);
  }, []);

  // Fetch fresh user data from Odoo and update if changed
  const refreshUser = useCallback(async () => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) return;
      const local = JSON.parse(stored) as User;
      if (!local?.id) return;

      const res = await axios.post(`${ODOO_URL}/api/auth/me`, {
        user_id: local.id,
      });
      if (res.data.status === 200 && res.data.data) {
        const fresh = res.data.data;
        // Merge token (not returned by /me) from existing local data
        const merged: User = {
          ...fresh,
          token: local.token,
        };
        // Only update if something changed to avoid unnecessary re-renders
        if (
          merged.name !== local.name ||
          merged.x_support_role !== local.x_support_role ||
          merged.email !== local.email
        ) {
          persistUser(merged);
        }
      }
    } catch {
      // Silent – don't logout on network error, just keep cached data
    }
  }, [persistUser]);

  // Restore session from localStorage on mount + immediate sync
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as User;
        setUser(parsed);
        // Immediately sync with Odoo in the background
        setTimeout(() => refreshUser(), 500);
      }
    } catch {
      localStorage.removeItem(STORAGE_KEY);
    } finally {
      setIsLoading(false);
    }
  }, [refreshUser]);

  // Periodic sync while the user is logged in
  useEffect(() => {
    if (user) {
      syncTimerRef.current = setInterval(() => {
        refreshUser();
      }, SYNC_INTERVAL_MS);
    } else {
      if (syncTimerRef.current) {
        clearInterval(syncTimerRef.current);
        syncTimerRef.current = null;
      }
    }
    return () => {
      if (syncTimerRef.current) {
        clearInterval(syncTimerRef.current);
      }
    };
  }, [user, refreshUser]);

  // Also sync when the tab regains focus (user switches back to the app)
  useEffect(() => {
    const handleFocus = () => {
      if (user) refreshUser();
    };
    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, [user, refreshUser]);

  const login = useCallback(
    async (email: string, password: string) => {
      try {
        const res = await axios.post(`${ODOO_URL}/api/auth/login`, {
          email,
          password,
        });
        if (res.data.status === 200 && res.data.data) {
          persistUser(res.data.data);
          return { success: true };
        }
        return {
          success: false,
          error: res.data.message || "Erreur de connexion.",
        };
      } catch (err: any) {
        const message =
          err?.response?.data?.message ||
          err?.message ||
          "Impossible de contacter le serveur.";
        return { success: false, error: message };
      }
    },
    [persistUser],
  );

  const register = useCallback(
    async (name: string, email: string, password: string) => {
      try {
        const res = await axios.post(`${ODOO_URL}/api/auth/register`, {
          name,
          email,
          password,
        });
        if (res.data.status === 201) {
          return { success: true };
        }
        return {
          success: false,
          error: res.data.message || "Erreur lors de l'inscription.",
        };
      } catch (err: any) {
        const message =
          err?.response?.data?.message ||
          err?.message ||
          "Impossible de contacter le serveur.";
        return { success: false, error: message };
      }
    },
    [],
  );

  const logout = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        login,
        register,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// ─── Hook ───
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
