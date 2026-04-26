"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import axios from "axios";
import { useAuth } from "@/lib/auth";
import ProtectedRoute from "@/components/ProtectedRoute";
import {
  User, Shield, Briefcase, Ban, CheckCircle2, Search,
  Loader2, Filter, ChevronDown, XCircle, Check, X
} from "lucide-react";
import { ODOO_URL as ODOO } from "@/lib/config";


/* ─────────────────────────────────────────────────────── types ── */
type UserData = {
  id: number;
  name: string;
  email: string;
  role: string;
  it_domains: string[];
  active: boolean;
};

/* ─────────────────────────────────────────────────────── consts ── */


const DOMAINS = ["Réseau", "Logiciel", "Matériel", "Accès", "Messagerie", "Infrastructure", "Sécurité", "Autre"];

const ROLE_META: Record<string, { label: string; color: string; bg: string; border: string; dot: string }> = {
  admin: { label: "Administrateur", color: "text-purple-400", bg: "bg-purple-500/10", border: "border-purple-500/25", dot: "bg-purple-400" },
  agent: { label: "Technicien",     color: "text-sky-400",    bg: "bg-sky-500/10",    border: "border-sky-500/25",    dot: "bg-sky-400"    },
  user:  { label: "Utilisateur",    color: "text-slate-400",  bg: "bg-slate-500/10",  border: "border-slate-500/25",  dot: "bg-slate-400"  },
};

/* ─────────── tiny toast ─────────── */
type Toast = { id: number; msg: string; ok: boolean };

function Toaster({ toasts, remove }: { toasts: Toast[]; remove: (id: number) => void }) {
  return (
    <div className="fixed bottom-6 right-6 z-[9999] flex flex-col gap-2 pointer-events-none">
      {toasts.map(t => (
        <div
          key={t.id}
          className={`pointer-events-auto flex items-center gap-2.5 px-4 py-2.5 rounded-xl shadow-2xl border text-sm font-semibold animate-fade-in backdrop-blur-md
            ${t.ok
              ? "bg-[hsl(var(--card))] border-emerald-500/30 text-emerald-400"
              : "bg-[hsl(var(--card))] border-red-500/30 text-red-400"
            }`}
          style={{ minWidth: 220 }}
        >
          {t.ok ? <Check size={15} /> : <X size={15} />}
          {t.msg}
          <button className="ml-auto opacity-60 hover:opacity-100" onClick={() => remove(t.id)}>
            <X size={12} />
          </button>
        </div>
      ))}
    </div>
  );
}

/* ─────────── InlineRoleSelect ─────────── */
function InlineRoleSelect({
  userId, currentRole, selfId, updating,
  onUpdate,
}: {
  userId: number; currentRole: string; selfId?: number; updating: number | null;
  onUpdate: (id: number, updates: Partial<UserData>) => void;
}) {
  const [open, setOpen] = useState(false);
  const [draftRole, setDraftRole] = useState(currentRole);
  const ref = useRef<HTMLDivElement>(null);
  const meta = ROLE_META[currentRole] ?? ROLE_META.user;
  const isSelf = userId === selfId;
  const isBusy = updating === userId;

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleOpen = () => {
    setDraftRole(currentRole);
    setOpen(p => !p);
  };

  const handleSave = () => {
    setOpen(false);
    if (draftRole !== currentRole) onUpdate(userId, { role: draftRole });
  };

  return (
    <div ref={ref} className="relative">
      <button
        disabled={isSelf || isBusy}
        onClick={handleOpen}
        className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-bold transition-all duration-200
          ${meta.bg} ${meta.border} ${meta.color}
          ${!isSelf && !isBusy ? "hover:brightness-110 cursor-pointer" : "opacity-60 cursor-not-allowed"}
        `}
      >
        {isBusy
          ? <Loader2 size={11} className="animate-spin" />
          : <span className={`w-1.5 h-1.5 rounded-full ${meta.dot}`} />
        }
        {meta.label}
        {!isSelf && <ChevronDown size={11} className={`transition-transform ${open ? "rotate-180" : ""}`} />}
      </button>

      {open && (
        <div className="absolute top-[calc(100%+6px)] left-0 z-[200] w-56 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] shadow-2xl backdrop-blur-lg overflow-hidden animate-fade-in flex flex-col">
          <div className="p-2 space-y-1">
            {Object.entries(ROLE_META).map(([val, m]) => (
              <button
                key={val}
                onClick={() => setDraftRole(val)}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-xs font-bold transition-all
                  ${val === draftRole
                    ? `${m.bg} ${m.color} ${m.border} border`
                    : "hover:bg-[hsl(var(--muted)/0.6)] text-[hsl(var(--foreground))]"
                  }`}
              >
                <span className={`w-2 h-2 rounded-full flex-shrink-0 ${m.dot}`} />
                {m.label}
                {val === draftRole && <Check size={13} className="ml-auto" />}
              </button>
            ))}
          </div>
          <div className="px-2 pb-2 pt-1">
            <button
              onClick={handleSave}
              disabled={draftRole === currentRole}
              className="w-full flex items-center justify-center py-2 px-4 rounded-lg bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] text-xs font-bold transition-all duration-200 hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed shadow-md shadow-[hsl(var(--primary)/0.2)]"
            >
              Enregistrer
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─────────── InlineDomainSelect ─────────── */
function InlineDomainSelect({
  userId, domains, role, updating, onUpdate,
}: {
  userId: number; domains: string[]; role: string; updating: number | null;
  onUpdate: (id: number, updates: Partial<UserData>) => void;
}) {
  const [open, setOpen] = useState(false);
  const [draftDomains, setDraftDomains] = useState<string[]>(domains);
  const ref = useRef<HTMLDivElement>(null);
  const isTech = role === "agent" || role === "tech";
  const isBusy = updating === userId;

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleOpen = () => {
    setDraftDomains(domains);
    setOpen(p => !p);
  };

  const handleSave = () => {
    setOpen(false);
    // Sort and compare arrays to see if they differ
    const currentStr = [...domains].sort().join(",");
    const draftStr = [...draftDomains].sort().join(",");
    if (currentStr !== draftStr) {
      onUpdate(userId, { it_domains: draftDomains });
    }
  };

  const toggleDraft = (domain: string) => {
    setDraftDomains(prev => prev.includes(domain) ? prev.filter(d => d !== domain) : [...prev, domain]);
  };

  if (!isTech) {
    return <span className="text-[0.65rem] text-[hsl(var(--muted-foreground))] font-semibold">N/A</span>;
  }

  // Check if draft has changed compared to original domains
  const hasChanges = [...domains].sort().join(",") !== [...draftDomains].sort().join(",");

  return (
    <div ref={ref} className="relative">
      {/* Badges row + add button */}
      <div className="flex flex-wrap gap-1 items-center max-w-[200px]">
        {domains.map(d => (
          <span
            key={d}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[0.6rem] font-bold bg-sky-500/10 text-sky-400 border border-sky-500/20"
          >
            {d}
          </span>
        ))}
        <button
          disabled={isBusy}
          onClick={handleOpen}
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[0.6rem] font-bold border border-dashed border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))] hover:border-sky-500/40 hover:text-sky-400 hover:bg-sky-500/5 transition-all outline-none"
        >
          {isBusy ? <Loader2 size={9} className="animate-spin" /> : <ChevronDown size={9} className={`transition-transform ${open ? "rotate-180" : ""}`} />}
          Modifier
        </button>
      </div>

      {/* Dropdown panel */}
      {open && (
        <div className="absolute top-[calc(100%+6px)] left-0 z-[200] w-56 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] shadow-2xl backdrop-blur-lg overflow-hidden animate-fade-in flex flex-col">
          <div className="px-3 pt-3 pb-2 border-b border-[hsl(var(--border)/0.5)]">
            <p className="text-[0.65rem] font-bold text-[hsl(var(--muted-foreground))] uppercase tracking-wide">
              Domaines d&apos;expertise
            </p>
          </div>
          <div className="p-2 space-y-1 max-h-56 overflow-y-auto custom-scrollbar">
            {DOMAINS.map(d => {
              const selected = draftDomains.includes(d);
              return (
                <button
                  key={d}
                  onClick={() => toggleDraft(d)}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-semibold transition-all
                    ${selected
                      ? "bg-sky-500/10 text-sky-400 border border-sky-500/20"
                      : "hover:bg-[hsl(var(--muted)/0.5)] text-[hsl(var(--foreground))] border border-transparent"
                    }`}
                >
                  {d}
                  <div className={`w-4 h-4 rounded-md border flex items-center justify-center flex-shrink-0 transition-all
                    ${selected ? "bg-sky-500 border-sky-500" : "border-[hsl(var(--border))]"}`}>
                    {selected && <Check size={10} className="text-white" />}
                  </div>
                </button>
              );
            })}
          </div>
          <div className="px-2 pb-2 pt-1 bg-[hsl(var(--card))]">
            <button
              onClick={handleSave}
              disabled={!hasChanges}
              className="w-full flex items-center justify-center py-2 px-4 rounded-lg bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] text-xs font-bold transition-all duration-200 hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed shadow-md shadow-[hsl(var(--primary)/0.2)]"
            >
              Enregistrer
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────── main ── */
function UsersManagement() {
  const { user } = useAuth();
  const [users, setUsers] = useState<UserData[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<number | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastId = useRef(0);

  const addToast = useCallback((msg: string, ok: boolean) => {
    const id = ++toastId.current;
    setToasts(p => [...p, { id, msg, ok }]);
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 3500);
  }, []);

  const removeToast = useCallback((id: number) => setToasts(p => p.filter(t => t.id !== id)), []);

  const [activeFilters, setActiveFilters] = useState<{
    search: string; roles: string[]; statuses: string[]; domains: string[];
  }>({ search: "", roles: [], statuses: [], domains: [] });

  const [openHeaderDropdown, setOpenHeaderDropdown] = useState<"role" | "status" | null>(null);

  const roles   = [{ value: "user", label: "Utilisateur" }, { value: "agent", label: "Technicien" }, { value: "admin", label: "Administrateur" }];
  const statuses = [{ value: "active", label: "Actif" }, { value: "banned", label: "Banni" }];

  const toggleFilter = (key: "roles" | "statuses" | "domains", value: string) => {
    setActiveFilters(prev => {
      const curr = prev[key];
      return { ...prev, [key]: curr.includes(value) ? curr.filter(v => v !== value) : [...curr, value] };
    });
  };

  const resetFilters = () => { setActiveFilters({ search: "", roles: [], statuses: [], domains: [] }); setOpenHeaderDropdown(null); };
  const hasActiveFilters = activeFilters.search !== "" || activeFilters.roles.length > 0 || activeFilters.statuses.length > 0 || activeFilters.domains.length > 0;

  const fetchUsers = async () => {
    try {
      const res = await axios.get(`${ODOO}/api/admin/users`);
      if (res.data.status === 200) setUsers(res.data.data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { if (user?.x_support_role === "admin") fetchUsers(); }, [user]);

  const updateUser = useCallback(async (userId: number, updates: Partial<UserData>) => {
    setUpdating(userId);
    try {
      const payload = { ...updates, caller_user_id: user?.id };
      const res = await axios.put(`${ODOO}/api/admin/users/${userId}`, payload);
      if (res.data.status !== 200) throw new Error(res.data.message || "Échec");

      const freshRole = res.data.x_support_role;
      setUsers(prev => prev.map(u => {
        if (u.id !== userId) return u;
        return {
          ...u, ...updates,
          ...(freshRole ? { role: freshRole === "admin" ? "admin" : freshRole === "tech" ? "agent" : "user" } : {}),
        };
      }));
      addToast("Modification enregistrée ✓", true);
    } catch (e: any) {
      addToast(e?.response?.data?.message || e?.message || "Erreur serveur", false);
      fetchUsers();
    } finally { setUpdating(null); }
  }, [user?.id, addToast]);

  const filteredUsers = users.filter(u => {
    const s = activeFilters.search.toLowerCase();
    if (s && !(u.name?.toLowerCase().includes(s) || u.email?.toLowerCase().includes(s))) return false;
    if (activeFilters.roles.length > 0 && !activeFilters.roles.includes(u.role)) return false;
    const sv = u.active ? "active" : "banned";
    if (activeFilters.statuses.length > 0 && !activeFilters.statuses.includes(sv)) return false;
    if (activeFilters.domains.length > 0) {
      const noneMatch = activeFilters.domains.includes("none") && u.it_domains.length === 0;
      const domMatch  = u.it_domains.some(d => activeFilters.domains.includes(d));
      if (!noneMatch && !domMatch) return false;
    }
    return true;
  });

  if (user?.x_support_role !== "admin") return (
    <div className="p-8 flex items-center justify-center h-full">
      <p className="text-red-500 font-bold">Accès non autorisé.</p>
    </div>
  );

  return (
    <>
      <Toaster toasts={toasts} remove={removeToast} />

      <div className="p-6 lg:p-8 max-w-[1400px] mx-auto space-y-6" onClick={() => setOpenHeaderDropdown(null)}>

        {/* ── Header ── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-fade-in">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Gestion de l&apos;Équipe &amp; Utilisateurs</h1>
            <p className="text-sm text-[hsl(var(--muted-foreground))] mt-0.5">
              Gérez les rôles, spécialisations et accès au portail IT.
            </p>
          </div>
        </div>

        {/* ── Filters ── */}
        <div className="glass-card relative z-50 p-4 space-y-4 shadow-sm animate-fade-in" style={{ animationDelay: "0.1s" }}>
          <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
            {/* Search */}
            <div className="relative flex-1 w-full lg:max-w-md">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[hsl(var(--muted-foreground))]" size={16} />
              <input
                type="text" value={activeFilters.search}
                onChange={e => setActiveFilters({ ...activeFilters, search: e.target.value })}
                placeholder="Rechercher par nom ou email..."
                className="w-full bg-[hsl(var(--background)/0.5)] border border-[hsl(var(--border))] focus:border-[hsl(var(--primary)/0.5)] rounded-lg text-sm pl-11 pr-4 h-10 outline-none transition-all"
              />
            </div>

            <div className="flex items-center gap-2">
              {/* Role filter */}
              {(["role", "status"] as const).map(key => {
                const isRole = key === "role";
                const count = isRole ? activeFilters.roles.length : activeFilters.statuses.length;
                const items = isRole ? roles : statuses;
                const filterKey: "roles" | "statuses" = isRole ? "roles" : "statuses";
                return (
                  <div key={key} className="relative" onClick={e => e.stopPropagation()}>
                    <button
                      onClick={() => setOpenHeaderDropdown(openHeaderDropdown === key ? null : key)}
                      className={`flex items-center gap-1.5 h-10 px-3.5 rounded-lg text-sm font-semibold transition-all border
                        ${count > 0 || openHeaderDropdown === key
                          ? "bg-[hsl(var(--primary)/0.12)] border-[hsl(var(--primary)/0.3)] text-[hsl(var(--primary))]"
                          : "bg-transparent border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))] hover:border-[hsl(var(--primary)/0.2)]"
                        }`}
                    >
                      {isRole ? <Shield size={14} /> : <Filter size={14} />}
                      {isRole ? "Rôle" : "Statut"} {count > 0 && `(${count})`}
                      <ChevronDown size={13} className={`transition-transform ${openHeaderDropdown === key ? "rotate-180" : ""}`} />
                    </button>
                    {openHeaderDropdown === key && (
                      <div className="absolute top-11 left-0 z-[200] w-52 bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-xl shadow-2xl animate-fade-in p-1.5 space-y-0.5">
                        {items.map(it => (
                          <label key={it.value} className="flex items-center gap-2.5 p-2 hover:bg-[hsl(var(--muted)/0.5)] rounded-lg cursor-pointer text-sm font-medium transition-colors">
                            <input type="checkbox" checked={(isRole ? activeFilters.roles : activeFilters.statuses).includes(it.value)} onChange={() => toggleFilter(filterKey, it.value)} className="accent-[hsl(var(--primary))] w-4 h-4 cursor-pointer" />
                            {it.label}
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Domain pills */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-[hsl(var(--border)/0.5)]">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[hsl(var(--muted-foreground))] text-xs font-semibold">Domaines:</span>
              {["none", ...DOMAINS].map(cat => {
                const sel = activeFilters.domains.includes(cat);
                return (
                  <button key={cat} onClick={() => toggleFilter("domains", cat)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border cursor-pointer
                      ${sel ? "bg-[hsl(var(--primary)/0.12)] border-[hsl(var(--primary)/0.3)] text-[hsl(var(--primary))]"
                             : "bg-[hsl(var(--background)/0.5)] border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))] hover:border-[hsl(var(--primary)/0.2)]"}`}
                  >
                    {cat === "none" ? "Aucun" : cat}
                  </button>
                );
              })}
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs font-medium text-[hsl(var(--muted-foreground))] bg-[hsl(var(--muted)/0.5)] px-3 py-1.5 rounded-md">
                <span className="text-[hsl(var(--foreground))] font-bold">{filteredUsers.length}</span> util.{filteredUsers.length !== 1 ? "s" : ""} {hasActiveFilters && "trouvé(s)"}
              </span>
              {hasActiveFilters && (
                <button onClick={resetFilters} className="flex items-center gap-1.5 text-xs font-semibold text-red-500 hover:text-red-600 bg-red-500/10 hover:bg-red-500/20 px-3 py-1.5 rounded-md transition-colors">
                  <XCircle size={14} /> Réinitialiser
                </button>
              )}
            </div>
          </div>
        </div>

        {/* ── Table ── */}
        <div className="glass-card overflow-hidden animate-fade-in" style={{ animationDelay: "0.2s" }}>
          {loading ? (
            <div className="flex justify-center p-12">
              <Loader2 className="animate-spin text-[hsl(var(--primary))]" size={32} />
            </div>
          ) : (
            <div className="overflow-x-auto custom-scrollbar">
              <table className="w-full text-left text-sm">
                <thead className="bg-[hsl(var(--muted)/0.5)] text-[hsl(var(--muted-foreground))] text-xs font-bold uppercase tracking-wide">
                  <tr>
                    <th className="p-4 pl-5 rounded-tl-xl">Utilisateur</th>
                    <th className="p-4">Rôle</th>
                    <th className="p-4">Domaines d&apos;Expertise</th>
                    <th className="p-4">Statut</th>
                    <th className="p-4 rounded-tr-xl text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[hsl(var(--border)/0.4)]">
                  {filteredUsers.map(u => (
                    <tr key={u.id} className={`transition-colors hover:bg-[hsl(var(--muted)/0.15)] ${!u.active ? "opacity-55" : ""}`}>

                      {/* Avatar + name */}
                      <td className="p-4 pl-5">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-[hsl(var(--primary)/0.1)] flex items-center justify-center text-[hsl(var(--primary))] font-bold text-xs ring-1 ring-[hsl(var(--primary)/0.2)] flex-shrink-0">
                            {u.name.substring(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-bold text-[hsl(var(--foreground))] whitespace-nowrap">{u.name}</p>
                            <p className="text-[0.65rem] text-[hsl(var(--muted-foreground))]">{u.email}</p>
                          </div>
                        </div>
                      </td>

                      {/* Role – custom dropdown */}
                      <td className="p-4">
                        <InlineRoleSelect
                          userId={u.id}
                          currentRole={u.role}
                          selfId={user?.id}
                          updating={updating}
                          onUpdate={updateUser}
                        />
                      </td>

                      {/* Domains – multi-select with badges */}
                      <td className="p-4">
                        <InlineDomainSelect
                          userId={u.id}
                          domains={u.it_domains}
                          role={u.role}
                          updating={updating}
                          onUpdate={updateUser}
                        />
                      </td>

                      {/* Status badge */}
                      <td className="p-4">
                        <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[0.65rem] font-bold uppercase tracking-wider
                          ${u.active ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" : "bg-red-500/10 text-red-400 border border-red-500/20"}`}>
                          {u.active ? <CheckCircle2 size={11} /> : <Ban size={11} />}
                          {u.active ? "Actif" : "Banni"}
                        </div>
                      </td>

                      {/* Ban/Activate */}
                      <td className="p-4 text-center">
                        <button
                          disabled={updating === u.id || u.id === user?.id}
                          onClick={() => updateUser(u.id, { active: !u.active })}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border
                            ${u.active
                              ? "text-red-400 border-red-500/20 hover:bg-red-500/10"
                              : "text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/10"
                            } disabled:opacity-40 disabled:cursor-not-allowed`}
                          title={u.active ? "Bannir" : "Réactiver"}
                        >
                          {updating === u.id ? <Loader2 size={13} className="animate-spin" /> : (u.active ? "Bannir" : "Réactiver")}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {filteredUsers.length === 0 && (
                <div className="p-12 text-center text-[hsl(var(--muted-foreground))] text-sm">
                  Aucun utilisateur trouvé.
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

export default function UsersPage() {
  return (
    <ProtectedRoute>
      <UsersManagement />
    </ProtectedRoute>
  );
}
