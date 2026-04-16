"use client";

import { useState, useEffect } from "react";
import axios from "axios";
import { useAuth } from "@/lib/auth";
import ProtectedRoute from "@/components/ProtectedRoute";
import { User, Shield, Briefcase, Ban, CheckCircle2, Search, Loader2 } from "lucide-react";

type UserData = {
  id: number;
  name: string;
  email: string;
  role: string;
  it_domain: string | false;
  active: boolean;
};

const DOMAINS = [
  "Réseau",
  "Logiciel",
  "Matériel",
  "Accès",
  "Messagerie",
  "Infrastructure",
  "Autre"
];

function UsersManagement() {
  const { user } = useAuth();
  const [users, setUsers] = useState<UserData[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [updating, setUpdating] = useState<number | null>(null);

  const fetchUsers = async () => {
    try {
      const res = await axios.get("http://localhost:8069/api/admin/users");
      if (res.data.status === 200) {
        setUsers(res.data.data);
      }
    } catch (e) {
      console.error("Erreur backend Odoo", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user?.role === "admin") {
      fetchUsers();
    }
  }, [user]);

  const updateUser = async (userId: number, updates: Partial<UserData>) => {
    setUpdating(userId);
    try {
      await axios.put(`http://localhost:8069/api/admin/users/${userId}`, updates);
      // Mettre à jour localement pour la réactivité
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, ...updates } : u));
    } catch (e) {
      console.error(e);
      alert("Erreur lors de la mise à jour");
    } finally {
      setUpdating(null);
    }
  };

  const filteredUsers = users.filter((u) =>
    (u.name?.toLowerCase().includes(search.toLowerCase()) || 
     u.email?.toLowerCase().includes(search.toLowerCase()))
  );

  if (user?.role !== "admin") {
    return (
      <div className="p-8 flex items-center justify-center h-full">
        <p className="text-red-500 font-bold">Accès non autorisé.</p>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 max-w-[1400px] mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-fade-in">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Gestion de l'Équipe & Utilisateurs</h1>
          <p className="text-sm text-[hsl(var(--muted-foreground))] mt-0.5">
            Gérez les rôles, les spécialisations (domaines) et les accès au portail IT.
          </p>
        </div>
      </div>

      <div className="glass-card p-4 flex items-center gap-3 animate-fade-in" style={{ animationDelay: "0.1s" }}>
        <Search className="text-[hsl(var(--muted-foreground))]" size={18} />
        <input
          type="text"
          placeholder="Rechercher par nom ou email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="bg-transparent border-none outline-none flex-1 font-medium"
        />
      </div>

      <div className="glass-card overflow-hidden animate-fade-in" style={{ animationDelay: "0.2s" }}>
        {loading ? (
          <div className="flex justify-center p-12">
            <Loader2 className="animate-spin text-[hsl(var(--primary))]" size={32} />
          </div>
        ) : (
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-[hsl(var(--muted)/0.5)] text-[hsl(var(--muted-foreground))] font-semibold">
                <tr>
                  <th className="p-4 rounded-tl-xl">Utilisateur</th>
                  <th className="p-4">Rôle</th>
                  <th className="p-4">Domaine d'Expertise</th>
                  <th className="p-4">Statut</th>
                  <th className="p-4 rounded-tr-xl flex justify-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[hsl(var(--border)/0.5)]">
                {filteredUsers.map((u) => (
                  <tr key={u.id} className={`transition-colors hover:bg-[hsl(var(--muted)/0.2)] ${!u.active ? "opacity-60" : ""}`}>
                    
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-[hsl(var(--primary)/0.1)] flex items-center justify-center text-[hsl(var(--primary))] font-bold text-xs ring-1 ring-[hsl(var(--primary)/0.2)]">
                          {u.name.substring(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-bold text-[hsl(var(--foreground))]">{u.name}</p>
                          <p className="text-[0.65rem] text-[hsl(var(--muted-foreground))]">{u.email}</p>
                        </div>
                      </div>
                    </td>

                    <td className="p-4">
                      <select
                        value={u.role}
                        disabled={updating === u.id || u.id === user.id} // User cannot change own role easily here
                        onChange={(e) => updateUser(u.id, { role: e.target.value })}
                        className="bg-[hsl(var(--background))] border border-[hsl(var(--border))] rounded-md px-2 py-1 text-xs font-semibold select-none cursor-pointer outline-none focus:ring-2 focus:ring-[hsl(var(--primary)/0.3)] transition-all"
                      >
                        <option value="user">Utilisateur</option>
                        <option value="agent">Agent (Technicien)</option>
                        <option value="admin">Administrateur</option>
                      </select>
                    </td>

                    <td className="p-4">
                      {u.role === "agent" ? (
                        <select
                          value={u.it_domain || ""}
                          disabled={updating === u.id}
                          onChange={(e) => updateUser(u.id, { it_domain: e.target.value })}
                          className="bg-[hsl(var(--primary)/0.05)] border border-[hsl(var(--primary)/0.3)] text-[hsl(var(--primary))] rounded-md px-2 py-1 text-xs font-semibold cursor-pointer outline-none focus:ring-2 focus:ring-[hsl(var(--primary)/0.3)] transition-all"
                        >
                          <option value="">-- Non Spécifié --</option>
                          {DOMAINS.map(domain => (
                            <option key={domain} value={domain}>{domain}</option>
                          ))}
                        </select>
                      ) : (
                        <span className="text-[0.65rem] text-[hsl(var(--muted-foreground))] uppercase font-semibold pl-2">
                          N/A
                        </span>
                      )}
                    </td>

                    <td className="p-4">
                      <div className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-[0.65rem] font-bold uppercase tracking-wider ${
                        u.active 
                          ? "bg-[hsl(var(--success)/0.1)] text-[hsl(var(--success))] border border-[hsl(var(--success)/0.2)]" 
                          : "bg-red-500/10 text-red-500 border border-red-500/20"
                      }`}>
                        {u.active ? <CheckCircle2 size={12} /> : <Ban size={12} />}
                        {u.active ? "Actif" : "Banni"}
                      </div>
                    </td>

                    <td className="p-4 flex justify-center">
                      <button
                        disabled={updating === u.id || u.id === user.id}
                        onClick={() => updateUser(u.id, { active: !u.active })}
                        className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${
                          u.active 
                            ? "text-red-500 hover:bg-red-500/10" 
                            : "text-[hsl(var(--success))] hover:bg-[hsl(var(--success)/0.1)]"
                        }`}
                        title={u.active ? "Bannir cet utilisateur" : "Réactiver cet utilisateur"}
                      >
                        {updating === u.id ? <Loader2 size={14} className="animate-spin" /> : (u.active ? "Archiver/Bannir" : "Réactiver")}
                      </button>
                    </td>

                  </tr>
                ))}
              </tbody>
            </table>
            
            {filteredUsers.length === 0 && (
              <div className="p-8 text-center text-[hsl(var(--muted-foreground))]">
                Aucun utilisateur trouvé.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function UsersPage() {
  return (
    <ProtectedRoute>
      <UsersManagement />
    </ProtectedRoute>
  );
}
