"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
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
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  register: (name: string, email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
};

// ─── Context ───
const AuthContext = createContext<AuthContextType | undefined>(undefined);

const STORAGE_KEY = "it_support_user";
const ODOO_URL = "http://localhost:8069";

// ─── Provider ───
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Restore session from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as User;
        setUser(parsed);
      }
    } catch {
      localStorage.removeItem(STORAGE_KEY);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Persist user to localStorage
  const persistUser = (userData: User) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(userData));
    setUser(userData);
  };

  const login = useCallback(async (email: string, password: string) => {
    try {
      const res = await axios.post(`${ODOO_URL}/api/auth/login`, { email, password });
      if (res.data.status === 200 && res.data.data) {
        persistUser(res.data.data);
        return { success: true };
      }
      return { success: false, error: res.data.message || "Erreur de connexion." };
    } catch (err: any) {
      const message =
        err?.response?.data?.message ||
        err?.message ||
        "Impossible de contacter le serveur.";
      return { success: false, error: message };
    }
  }, []);

  const register = useCallback(async (name: string, email: string, password: string) => {
    try {
      const res = await axios.post(`${ODOO_URL}/api/auth/register`, { name, email, password });
      if (res.data.status === 201) {
        return { success: true };
      }
      return { success: false, error: res.data.message || "Erreur lors de l'inscription." };
    } catch (err: any) {
      const message =
        err?.response?.data?.message ||
        err?.message ||
        "Impossible de contacter le serveur.";
      return { success: false, error: message };
    }
  }, []);

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
