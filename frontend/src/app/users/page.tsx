"use client";

import { useState, useEffect } from "react";
import axios from "axios";
import { useAuth } from "@/lib/auth";
import ProtectedRoute from "@/components/ProtectedRoute";
import { User, Shield, Briefcase, Ban, CheckCircle2, Search, Loader2, Filter, ChevronDown, XCircle } from "lucide-react";

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
  const [updating, setUpdating] = useState<number | null>(null);

  const [activeFilters, setActiveFilters] = useState<{
    search: string;
    roles: string[];
    statuses: string[];
    domains: string[];
  }>({
    search: "",
    roles: [],
    statuses: [],
    domains: [],
  });

  const [openDropdown, setOpenDropdown] = useState<"role" | "status" | null>(null);

  const roles = [
    { value: "user", label: "Utilisateur" },
    { value: "agent", label: "Agent (Tech)" },
    { value: "admin", label: "Administrateur" }
  ];
  
  const statuses = [
    { value: "active", label: "Actif" },
    { value: "banned", label: "Banni" }
  ];

  const toggleFilter = (key: "roles" | "statuses" | "domains", value: string) => {
    setActiveFilters((prev) => {
      const current = prev[key];
      const updated = current.includes(value)
        ? current.filter((v) => v !== value)
        : [...current, value];
      return { ...prev, [key]: updated };
    });
  };

  const resetFilters = () => {
    setActiveFilters({ search: "", roles: [], statuses: [], domains: [] });
    setOpenDropdown(null);
  };
  
  const hasActiveFilters =
    activeFilters.search !== "" ||
    activeFilters.roles.length > 0 ||
    activeFilters.statuses.length > 0 ||
    activeFilters.domains.length > 0;

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
    if (user?.x_support_role === "admin") {
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

  const filteredUsers = users.filter((u) => {
    const safeSearch = activeFilters.search.toLowerCase();
    const matchesSearch = !safeSearch || 
      (u.name || "").toLowerCase().includes(safeSearch) || 
      (u.email || "").toLowerCase().includes(safeSearch);
      
    const matchesRole = activeFilters.roles.length === 0 || activeFilters.roles.includes(u.role);
    
    const statusVal = u.active ? "active" : "banned";
    const matchesStatus = activeFilters.statuses.length === 0 || activeFilters.statuses.includes(statusVal);
    
    const domainVal = u.it_domain || "none";
    const matchesDomain = activeFilters.domains.length === 0 || activeFilters.domains.includes(domainVal);
    
    return matchesSearch && matchesRole && matchesStatus && matchesDomain;
  });

  if (user?.x_support_role !== "admin") {
    return (
      <div className="p-8 flex items-center justify-center h-full">
        <p className="text-red-500 font-bold">Accès non autorisé.</p>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 max-w-[1400px] mx-auto space-y-6" onClick={() => setOpenDropdown(null)}>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-fade-in">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Gestion de l'Équipe & Utilisateurs</h1>
          <p className="text-sm text-[hsl(var(--muted-foreground))] mt-0.5">
            Gérez les rôles, les spécialisations (domaines) et les accès au portail IT.
          </p>
        </div>
      </div>

      <div className="glass-card relative z-50 p-4 space-y-4 shadow-sm animate-fade-in" style={{ animationDelay: "0.1s" }}>
        <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
          <div className="relative flex-1 w-full lg:max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[hsl(var(--muted-foreground))]" size={16} />
            <input
              type="text"
              value={activeFilters.search}
              onChange={(e) => setActiveFilters({ ...activeFilters, search: e.target.value })}
              placeholder="Rechercher par nom ou email..."
              className="w-full bg-[hsl(var(--background)/0.5)] border border-[hsl(var(--border))] focus:border-[hsl(var(--primary)/0.5)] rounded-lg text-sm pl-11 pr-4 h-10 outline-none transition-all"
            />
          </div>

          <div className="flex items-center gap-4">
            <div className="flex flex-wrap gap-2 items-center">
              <div className="relative" onClick={(e) => e.stopPropagation()}>
                <button
                  onClick={() => setOpenDropdown(openDropdown === "role" ? null : "role")}
                  className={`flex items-center gap-1.5 h-10 px-3.5 rounded-lg text-sm font-semibold transition-all duration-200 border ${activeFilters.roles.length > 0 || openDropdown === "role"
                      ? "bg-[hsl(var(--primary)/0.12)] border-[hsl(var(--primary)/0.3)] text-[hsl(var(--primary))]"
                      : "bg-transparent border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))] hover:border-[hsl(var(--primary)/0.2)] hover:text-[hsl(var(--foreground))]"
                    }`}
                >
                  <Shield size={14} />
                  Rôle {activeFilters.roles.length > 0 && `(${activeFilters.roles.length})`}
                  <ChevronDown size={14} className={`transition-transform ${openDropdown === "role" ? "rotate-180" : ""}`} />
                </button>
                {openDropdown === "role" && (
                  <div className="absolute top-11 right-0 sm:left-0 sm:right-auto mt-1 w-56 bg-white dark:bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-xl shadow-xl z-[100] animate-fade-in flex flex-col gap-1 p-2">
                    {roles.map(r => (
                      <label key={r.value} className="flex items-center gap-2.5 p-2 hover:bg-[hsl(var(--muted))] rounded-md cursor-pointer text-sm font-medium transition-colors">
                        <input
                          type="checkbox"
                          checked={activeFilters.roles.includes(r.value)}
                          onChange={() => toggleFilter("roles", r.value)}
                          className="accent-[hsl(var(--primary))] w-4 h-4 cursor-pointer"
                        />
                        {r.label}
                      </label>
                    ))}
                  </div>
                )}
              </div>

              <div className="relative" onClick={(e) => e.stopPropagation()}>
                <button
                  onClick={() => setOpenDropdown(openDropdown === "status" ? null : "status")}
                  className={`flex items-center gap-1.5 h-10 px-3.5 rounded-lg text-sm font-semibold transition-all duration-200 border ${activeFilters.statuses.length > 0 || openDropdown === "status"
                      ? "bg-[hsl(var(--primary)/0.12)] border-[hsl(var(--primary)/0.3)] text-[hsl(var(--primary))]"
                      : "bg-transparent border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))] hover:border-[hsl(var(--primary)/0.2)] hover:text-[hsl(var(--foreground))]"
                    }`}
                >
                  <Filter size={14} />
                  Statut {activeFilters.statuses.length > 0 && `(${activeFilters.statuses.length})`}
                  <ChevronDown size={14} className={`transition-transform ${openDropdown === "status" ? "rotate-180" : ""}`} />
                </button>
                {openDropdown === "status" && (
                  <div className="absolute top-11 right-0 w-56 bg-white dark:bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-xl shadow-xl z-[100] animate-fade-in flex flex-col gap-1 p-2">
                    {statuses.map(st => (
                      <label key={st.value} className="flex items-center gap-2.5 p-2 hover:bg-[hsl(var(--muted))] rounded-md cursor-pointer text-sm font-medium transition-colors">
                        <input
                          type="checkbox"
                          checked={activeFilters.statuses.includes(st.value)}
                          onChange={() => toggleFilter("statuses", st.value)}
                          className="accent-[hsl(var(--primary))] w-4 h-4 cursor-pointer"
                        />
                        {st.label}
                      </label>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-[hsl(var(--border)/0.5)]">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[hsl(var(--muted-foreground))] text-xs font-semibold mr-1">Domaines:</span>
            {["none", ...DOMAINS].map((cat) => {
              const isSelected = activeFilters.domains.includes(cat);
              return (
                <button
                  key={cat}
                  onClick={() => toggleFilter("domains", cat)}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 cursor-pointer border ${isSelected
                      ? "bg-[hsl(var(--primary)/0.12)] border-[hsl(var(--primary)/0.3)] text-[hsl(var(--primary))]"
                      : "bg-[hsl(var(--background)/0.5)] border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))] hover:border-[hsl(var(--primary)/0.2)] hover:text-[hsl(var(--foreground))]"
                    }`}
                >
                  {cat === "none" ? "Aucun" : cat}
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-4 w-full sm:w-auto">
            <span className="text-xs font-medium text-[hsl(var(--muted-foreground))] bg-[hsl(var(--muted)/0.5)] px-3 py-1.5 rounded-md">
              <span className="text-[hsl(var(--foreground))] font-bold">{filteredUsers.length}</span> util.{filteredUsers.length !== 1 ? 's' : ''} {hasActiveFilters && "trouvé(s)"}
            </span>

            {hasActiveFilters && (
              <button
                onClick={resetFilters}
                className="flex items-center gap-1.5 text-xs font-semibold text-red-500 hover:text-red-600 bg-red-500/10 hover:bg-red-500/20 px-3 py-1.5 rounded-md transition-colors ml-auto sm:ml-0"
              >
                <XCircle size={14} />
                Réinitialiser
              </button>
            )}
          </div>
        </div>
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
                      <div className="relative w-max">
                        <select
                          value={u.role}
                          disabled={updating === u.id || u.id === user.id} // User cannot change own role easily here
                          onChange={(e) => updateUser(u.id, { role: e.target.value })}
                          className={`appearance-none outline-none cursor-pointer transition-all rounded-lg pl-3 pr-8 py-1.5 text-xs font-bold border ${
                            u.role === 'admin' ? 'border-purple-500/30 text-purple-600 bg-purple-500/5 hover:bg-purple-500/10 focus:ring-2 focus:ring-purple-500/20' : 
                            u.role === 'agent' ? 'border-blue-500/30 text-blue-600 bg-blue-500/5 hover:bg-blue-500/10 focus:ring-2 focus:ring-blue-500/20' : 
                            'border-[hsl(var(--border))] text-[hsl(var(--foreground))] bg-[hsl(var(--background))] hover:bg-[hsl(var(--muted)/0.5)] focus:ring-2 focus:ring-[hsl(var(--primary)/0.2)]'
                          }`}
                        >
                          <option value="user" className="bg-[hsl(var(--background))] text-[hsl(var(--foreground))] font-semibold">Utilisateur</option>
                          <option value="agent" className="bg-[hsl(var(--background))] text-[hsl(var(--foreground))] font-semibold">Agent (Tech)</option>
                          <option value="admin" className="bg-[hsl(var(--background))] text-[hsl(var(--foreground))] font-semibold">Administrateur</option>
                        </select>
                        <div className="absolute inset-y-0 right-2 flex items-center pointer-events-none">
                          <svg className={`w-3.5 h-3.5 ${u.role === 'admin' ? 'text-purple-500' : u.role === 'agent' ? 'text-blue-500' : 'text-gray-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
                        </div>
                      </div>
                    </td>

                    <td className="p-4">
                      {u.role === "agent" ? (
                        <div className="relative w-max">
                          <select
                            value={u.it_domain || ""}
                            disabled={updating === u.id}
                            onChange={(e) => updateUser(u.id, { it_domain: e.target.value })}
                            className="appearance-none outline-none cursor-pointer transition-all rounded-lg pl-3 pr-8 py-1.5 text-xs font-bold border border-[hsl(var(--primary)/0.3)] bg-[hsl(var(--primary)/0.05)] text-[hsl(var(--primary))] hover:bg-[hsl(var(--primary)/0.1)] focus:ring-2 focus:ring-[hsl(var(--primary)/0.3)] shadow-sm"
                          >
                            <option value="" className="bg-[hsl(var(--background))] text-[hsl(var(--foreground))] font-semibold">-- Non Spécifié --</option>
                            {DOMAINS.map(domain => (
                              <option key={domain} value={domain} className="bg-[hsl(var(--background))] text-[hsl(var(--foreground))] font-semibold">{domain}</option>
                            ))}
                          </select>
                          <div className="absolute inset-y-0 right-2 flex items-center pointer-events-none">
                            <svg className="w-3.5 h-3.5 text-[hsl(var(--primary)/0.6)]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
                          </div>
                        </div>
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
                        {updating === u.id ? <Loader2 size={14} className="animate-spin" /> : (u.active ? "Bannir" : "Réactiver")}
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
