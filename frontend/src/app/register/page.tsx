"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { Mail, Lock, User, UserPlus, Loader2, AlertCircle, CheckCircle2, Headphones, Sparkles, Eye, EyeOff } from "lucide-react";
import Link from "next/link";

export default function RegisterPage() {
  const { register, isAuthenticated } = useAuth();
  const router = useRouter();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  // Redirect if already authenticated
  if (isAuthenticated) {
    router.replace("/");
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError("Les mots de passe ne correspondent pas.");
      return;
    }

    if (password.length < 6) {
      setError("Le mot de passe doit contenir au moins 6 caractères.");
      return;
    }

    setLoading(true);
    const result = await register(name, email, password);

    if (result.success) {
      setSuccess(true);
      setTimeout(() => router.push("/login"), 2000);
    } else {
      setError(result.error || "Erreur lors de l'inscription.");
    }

    setLoading(false);
  };

  return (
    <div className="min-h-screen flex">
      {/* ─── Left Panel: Decorative ─── */}
      <div className="hidden lg:flex lg:w-[45%] relative overflow-hidden accent-gradient">
        {/* Floating shapes */}
        <div className="absolute inset-0">
          <div className="absolute top-[20%] right-[10%] w-64 h-64 rounded-full bg-white/5 blur-3xl animate-float" />
          <div className="absolute bottom-[15%] left-[10%] w-48 h-48 rounded-full bg-white/8 blur-2xl animate-float" style={{ animationDelay: "2s" }} />
          <div className="absolute top-[60%] right-[35%] w-36 h-36 rounded-full bg-white/5 blur-2xl animate-float" style={{ animationDelay: "4s" }} />

          {/* Grid pattern */}
          <div
            className="absolute inset-0 opacity-[0.03]"
            style={{
              backgroundImage: `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`,
              backgroundSize: "40px 40px",
            }}
          />
        </div>

        {/* Content */}
        <div className="relative z-10 flex flex-col justify-center px-12 xl:px-16">
          {/* Logo */}
          <div className="flex items-center gap-3 mb-10">
            <div className="w-12 h-12 rounded-2xl bg-white/15 backdrop-blur flex items-center justify-center">
              <Headphones size={24} className="text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">IT Support</h2>
              <p className="text-xs text-white/60 flex items-center gap-1">
                <Sparkles size={10} />
                Propulsé par l&apos;IA
              </p>
            </div>
          </div>

          <h1 className="text-4xl xl:text-5xl font-bold text-white leading-tight mb-4">
            Rejoignez la
            <br />
            <span className="text-white/80">plateforme.</span>
          </h1>

          <p className="text-white/60 text-lg leading-relaxed max-w-md">
            Créez votre compte en quelques secondes et commencez à gérer
            vos demandes IT avec l&apos;aide de l&apos;intelligence artificielle.
          </p>

          {/* Steps */}
          <div className="mt-10 space-y-5">
            {[
              { step: "1", text: "Créez votre compte" },
              { step: "2", text: "Soumettez votre premier ticket" },
              { step: "3", text: "L'IA analyse et résout" },
            ].map((item, i) => (
              <div key={i} className="flex items-center gap-4 text-white/70">
                <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center text-xs font-bold text-white">
                  {item.step}
                </div>
                <span className="text-sm font-medium">{item.text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ─── Right Panel: Register Form ─── */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-10 bg-[hsl(var(--background))]">
        <div className="w-full max-w-[420px] animate-fade-in">
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-3 mb-8">
            <div className="w-10 h-10 rounded-xl accent-gradient flex items-center justify-center">
              <Headphones size={18} className="text-white" />
            </div>
            <h2 className="text-lg font-bold">IT Support IA</h2>
          </div>

          {/* Success state */}
          {success ? (
            <div className="flex flex-col items-center justify-center py-12 animate-fade-in text-center">
              <div className="w-16 h-16 rounded-2xl bg-[hsl(var(--success)/0.1)] flex items-center justify-center mb-4">
                <CheckCircle2 size={32} className="text-[hsl(var(--success))]" />
              </div>
              <h3 className="text-xl font-bold mb-2">Compte créé !</h3>
              <p className="text-sm text-[hsl(var(--muted-foreground))]">
                Redirection vers la page de connexion...
              </p>
            </div>
          ) : (
            <>
              <div className="mb-8">
                <h2 className="text-2xl font-bold tracking-tight">Créer un compte</h2>
                <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1">
                  Inscrivez-vous pour accéder au support IT intelligent
                </p>
              </div>

              {/* Error */}
              {error && (
                <div className="flex items-center gap-2.5 p-3.5 mb-5 rounded-xl bg-[hsl(var(--destructive)/0.08)] border border-[hsl(var(--destructive)/0.2)] text-sm text-[hsl(var(--destructive))]">
                  <AlertCircle size={16} className="flex-shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Name */}
                <div>
                  <label className="block text-sm font-semibold mb-1.5" htmlFor="register-name">
                    Nom complet
                  </label>
                  <div className="relative">
                    <User
                      size={16}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-[hsl(var(--muted-foreground))]"
                    />
                    <input
                      id="register-name"
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="input-field focus-ring !pl-11"
                      placeholder="Ahmed Benali"
                      autoComplete="name"
                    />
                  </div>
                </div>

                {/* Email */}
                <div>
                  <label className="block text-sm font-semibold mb-1.5" htmlFor="register-email">
                    Adresse email
                  </label>
                  <div className="relative">
                    <Mail
                      size={16}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-[hsl(var(--muted-foreground))]"
                    />
                    <input
                      id="register-email"
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="input-field focus-ring !pl-11"
                      placeholder="nom@entreprise.com"
                      autoComplete="email"
                    />
                  </div>
                </div>

                {/* Password */}
                <div>
                  <label className="block text-sm font-semibold mb-1.5" htmlFor="register-password">
                    Mot de passe
                  </label>
                  <div className="relative">
                    <Lock
                      size={16}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-[hsl(var(--muted-foreground))]"
                    />
                    <input
                      id="register-password"
                      type={showPassword ? "text" : "password"}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="input-field focus-ring !pl-11 !pr-10"
                      placeholder="Min. 6 caractères"
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors"
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                {/* Confirm Password */}
                <div>
                  <label className="block text-sm font-semibold mb-1.5" htmlFor="register-confirm">
                    Confirmer le mot de passe
                  </label>
                  <div className="relative">
                    <Lock
                      size={16}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-[hsl(var(--muted-foreground))]"
                    />
                    <input
                      id="register-confirm"
                      type={showConfirmPassword ? "text" : "password"}
                      required
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="input-field focus-ring !pl-11 !pr-10"
                      placeholder="••••••••"
                      autoComplete="new-password"
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

                {/* Submit */}
                <button
                  type="submit"
                  disabled={loading}
                  className="btn-primary w-full mt-2"
                  id="register-submit"
                >
                  {loading ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      Création en cours...
                    </>
                  ) : (
                    <>
                      <UserPlus size={16} />
                      Créer un compte
                    </>
                  )}
                </button>
              </form>

              {/* Login link */}
              <p className="text-center text-sm text-[hsl(var(--muted-foreground))] mt-6">
                Déjà un compte ?{" "}
                <Link
                  href="/login"
                  className="text-[hsl(var(--primary))] font-semibold hover:underline"
                >
                  Se connecter
                </Link>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
