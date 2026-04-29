"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { ArrowLeft, User as UserIcon, Shield, Star, CheckCircle, Loader2, Eye, EyeOff } from "lucide-react";
import axios from "axios";
import { ODOO_URL } from "@/lib/config";
import { toast, Toaster } from "sonner";
import { useTheme } from "next-themes";

export default function ProfilePage() {
  const { user, refreshUser, isLoading } = useAuth();
  const router = useRouter();
  const { theme, resolvedTheme } = useTheme();

  useEffect(() => {
    if (!isLoading && !user) {
      router.replace("/login");
    }
  }, [isLoading, user, router]);

  const [isLoadingProfile, setIsLoadingProfile] = useState(false);
  const [isLoadingPassword, setIsLoadingPassword] = useState(false);

  // Profile Form State
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");

  // Password Form State
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showOldPassword, setShowOldPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  useEffect(() => {
    if (user) {
      // Split name into first and last
      const parts = user.name.split(" ");
      if (parts.length > 1) {
        setLastName(parts.pop() || "");
        setFirstName(parts.join(" "));
      } else {
        setFirstName(user.name);
        setLastName("");
      }
      setPhone(user.phone || "");
    }
  }, [user]);

  if (isLoading || !user) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <Loader2 className="animate-spin text-[hsl(var(--primary))] w-8 h-8" />
      </div>
    );
  }

  const roleLabels: Record<string, string> = {
    user: "Utilisateur",
    tech: "Technicien",
    admin: "Administrateur",
  };

  const initials = user.name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const hasProfileChanged = (() => {
    if (!user) return false;
    const fullName = `${firstName.trim()} ${lastName.trim()}`.trim();
    const origPhone = user.phone || "";
    return fullName !== user.name || phone !== origPhone;
  })();

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoadingProfile(true);
    
    const fullName = `${firstName.trim()} ${lastName.trim()}`.trim();
    
    try {
      const res = await axios.post(`${ODOO_URL}/api/auth/update_profile`, {
        user_id: user.id,
        name: fullName,
        phone: phone,
      });
      
      if (res.data.status === 200) {
        toast.success("Profil mis à jour avec succès");
        await refreshUser();
      } else {
        toast.error(res.data.message || "Erreur lors de la mise à jour");
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Erreur de connexion au serveur");
    } finally {
      setIsLoadingProfile(false);
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (newPassword !== confirmPassword) {
      toast.error("Les nouveaux mots de passe ne correspondent pas");
      return;
    }
    
    if (newPassword.length < 6) {
      toast.error("Le mot de passe doit contenir au moins 6 caractères");
      return;
    }
    
    setIsLoadingPassword(true);
    
    try {
      const res = await axios.post(`${ODOO_URL}/api/auth/change_password`, {
        user_id: user.id,
        old_password: oldPassword,
        new_password: newPassword,
      });
      
      if (res.data.status === 200) {
        toast.success("Mot de passe modifié avec succès");
        setOldPassword("");
        setNewPassword("");
        setConfirmPassword("");
      } else {
        toast.error(res.data.message || "Erreur lors de la modification");
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Erreur de connexion au serveur");
    } finally {
      setIsLoadingPassword(false);
    }
  };

  const handleBack = () => {
    router.back();
  };

  const currentTheme = resolvedTheme || theme;
  const toasterTheme = currentTheme === "dark" ? "light" : "dark";

  return (
    <div className="flex-1 flex flex-col h-screen overflow-y-auto custom-scrollbar bg-[hsl(var(--background))]">
      <Toaster position="top-right" theme={toasterTheme as any} />
      
      {/* Header Area */}
      <header className="h-16 flex items-center px-6 border-b border-[hsl(var(--border)/0.5)] flex-shrink-0 sticky top-0 bg-[hsl(var(--background)/0.8)] backdrop-blur-md z-10">
        <button
          onClick={handleBack}
          className="btn-ghost !p-2 !gap-0 mr-4"
          title="Retour au tableau de bord"
        >
          <ArrowLeft size={18} />
        </button>
        <h1 className="text-lg font-bold">Mon Compte</h1>
      </header>

      <main className="flex-1 p-6 lg:p-10 max-w-5xl mx-auto w-full animate-fade-in space-y-8">
        
        {/* Identity Header */}
        <div className="glass-card p-8 flex flex-col md:flex-row items-center gap-6 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-[hsl(var(--primary)/0.1)] rounded-full blur-3xl -translate-y-1/2 translate-x-1/3"></div>
          
          <div className="w-24 h-24 rounded-2xl accent-gradient flex items-center justify-center text-white text-3xl font-bold shadow-lg flex-shrink-0 border-4 border-[hsl(var(--background))]">
            {initials}
          </div>
          
          <div className="text-center md:text-left flex-1 z-10">
            <h2 className="text-3xl font-bold mb-1">{user.name}</h2>
            <div className="flex items-center justify-center md:justify-start gap-3">
              <span className="text-[hsl(var(--muted-foreground))]">{user.email}</span>
              <span className="w-1.5 h-1.5 rounded-full bg-[hsl(var(--muted-foreground)/0.3)]"></span>
              <span className="badge badge-high">{roleLabels[user.x_support_role]}</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Left Column: Forms */}
          <div className="lg:col-span-2 space-y-8">
            
            {/* Personal Info */}
            <section className="glass-card p-6 animate-slide-up stagger-1">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-[hsl(var(--primary)/0.1)] text-[hsl(var(--primary))] rounded-lg">
                  <UserIcon size={20} />
                </div>
                <h3 className="text-xl font-bold">Informations Personnelles</h3>
              </div>
              
              <form onSubmit={handleProfileSubmit} className="space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-[hsl(var(--muted-foreground))]">Prénom</label>
                    <input
                      type="text"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      className="input-field"
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-[hsl(var(--muted-foreground))]">Nom</label>
                    <input
                      type="text"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      className="input-field"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-[hsl(var(--muted-foreground))]">Adresse Email</label>
                    <input
                      type="email"
                      value={user.email}
                      className="input-field opacity-60 cursor-not-allowed"
                      disabled
                    />
                    <p className="text-[0.65rem] text-[hsl(var(--muted-foreground))] ml-1">L'email ne peut pas être modifié.</p>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-[hsl(var(--muted-foreground))]">Numéro de téléphone</label>
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="input-field"
                      placeholder="+33 6 12 34 56 78"
                    />
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <button type="submit" className="btn-primary" disabled={isLoadingProfile || !hasProfileChanged}>
                    {isLoadingProfile ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle size={16} />}
                    Enregistrer les modifications
                  </button>
                </div>
              </form>
            </section>

            {/* Security */}
            <section className="glass-card p-6 animate-slide-up stagger-2">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-[hsl(var(--info)/0.1)] text-[hsl(var(--info))] rounded-lg">
                  <Shield size={20} />
                </div>
                <h3 className="text-xl font-bold">Sécurité</h3>
              </div>
              
              <form onSubmit={handlePasswordSubmit} className="space-y-5">
                <div className="space-y-1.5 max-w-md">
                  <label className="text-sm font-medium text-[hsl(var(--muted-foreground))]">Ancien mot de passe</label>
                  <div className="relative">
                    <input
                      type={showOldPassword ? "text" : "password"}
                      value={oldPassword}
                      onChange={(e) => setOldPassword(e.target.value)}
                      className="input-field !pr-10"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowOldPassword(!showOldPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors"
                    >
                      {showOldPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5 max-w-2xl">
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-[hsl(var(--muted-foreground))]">Nouveau mot de passe</label>
                    <div className="relative">
                      <input
                        type={showNewPassword ? "text" : "password"}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className="input-field !pr-10"
                        required
                        minLength={6}
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPassword(!showNewPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors"
                      >
                        {showNewPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-[hsl(var(--muted-foreground))]">Confirmer le mot de passe</label>
                    <div className="relative">
                      <input
                        type={showConfirmPassword ? "text" : "password"}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="input-field !pr-10"
                        required
                        minLength={6}
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors"
                      >
                        {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <button type="submit" className="btn-primary" disabled={isLoadingPassword || !oldPassword || !newPassword || !confirmPassword}>
                    {isLoadingPassword ? <Loader2 size={16} className="animate-spin" /> : <Shield size={16} />}
                    Mettre à jour le mot de passe
                  </button>
                </div>
              </form>
            </section>
          </div>

          {/* Right Column: Preferences & Stats */}
          <div className="space-y-6">
            <section className="stat-card animate-slide-up stagger-3">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-[hsl(var(--warning)/0.1)] text-[hsl(var(--warning))] rounded-lg">
                  <Star size={20} />
                </div>
                <h3 className="text-lg font-bold">Activité</h3>
              </div>
              
              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 rounded-lg bg-[hsl(var(--muted)/0.3)] border border-[hsl(var(--border)/0.5)]">
                  <span className="text-sm text-[hsl(var(--muted-foreground))]">Tickets résolus</span>
                  <span className="text-2xl font-bold text-[hsl(var(--foreground))]">{user.resolved_tickets || 0}</span>
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg bg-[hsl(var(--muted)/0.3)] border border-[hsl(var(--border)/0.5)]">
                  <span className="text-sm text-[hsl(var(--muted-foreground))]">Rôle système</span>
                  <span className="text-sm font-semibold uppercase">{user.x_support_role}</span>
                </div>
              </div>
            </section>

            {user.x_support_role === 'tech' && (
              <section className="glass-card p-6 animate-slide-up stagger-4">
                <h3 className="text-lg font-bold mb-4">Domaines d'expertise</h3>
                {user.it_domains && user.it_domains.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {user.it_domains.map((domain, idx) => (
                      <span key={idx} className="badge badge-medium px-3 py-1.5 bg-[hsl(var(--primary)/0.1)] text-[hsl(var(--primary))] border border-[hsl(var(--primary)/0.2)]">
                        {domain}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-[hsl(var(--muted-foreground))] italic">
                    Aucun domaine d'expertise renseigné.
                  </p>
                )}
              </section>
            )}
          </div>
          
        </div>
      </main>
    </div>
  );
}
