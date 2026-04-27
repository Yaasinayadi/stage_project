"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { Mail, Lock, LogIn, Loader2, AlertCircle, Headphones, Sparkles, Eye, EyeOff } from "lucide-react";
import Link from "next/link";

export default function LoginPage() {
  const { login, isAuthenticated } = useAuth();
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [shake, setShake] = useState(false);

  // Redirect if already authenticated
  if (isAuthenticated) {
    router.replace("/");
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const result = await login(email, password);

    if (result.success) {
      router.replace("/");
    } else {
      setError(result.error || "Erreur de connexion.");
      setShake(true);
      setTimeout(() => setShake(false), 600);
    }

    setLoading(false);
  };

  return (
    <div className="min-h-screen flex">
      {/* ─── Left Panel: Decorative ─── */}
      <div className="hidden lg:flex lg:w-[45%] relative overflow-hidden accent-gradient">
        {/* Floating shapes */}
        <div className="absolute inset-0">
          <div className="absolute top-[15%] left-[10%] w-72 h-72 rounded-full bg-white/5 blur-3xl animate-float" />
          <div className="absolute bottom-[20%] right-[5%] w-56 h-56 rounded-full bg-white/8 blur-2xl animate-float" style={{ animationDelay: "1.5s" }} />
          <div className="absolute top-[55%] left-[40%] w-40 h-40 rounded-full bg-white/5 blur-2xl animate-float" style={{ animationDelay: "3s" }} />

          {/* Grid pattern overlay */}
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
            Gérez vos tickets
            <br />
            <span className="text-white/80">intelligemment.</span>
          </h1>

          <p className="text-white/60 text-lg leading-relaxed max-w-md">
            Notre plateforme propulsée par l&apos;intelligence artificielle
            classifie, priorise et résout vos demandes IT automatiquement.
          </p>

          {/* Feature bullets */}
          <div className="mt-10 space-y-4">
            {[
              "Classification automatique par IA",
              "Chatbot intelligent 24/7",
              "Suivi SLA en temps réel",
            ].map((feature, i) => (
              <div key={i} className="flex items-center gap-3 text-white/70">
                <div className="w-1.5 h-1.5 rounded-full bg-white/50" />
                <span className="text-sm font-medium">{feature}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ─── Right Panel: Login Form ─── */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-10 bg-[hsl(var(--background))]">
        <div className="w-full max-w-[420px] animate-fade-in">
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-3 mb-8">
            <div className="w-10 h-10 rounded-xl accent-gradient flex items-center justify-center">
              <Headphones size={18} className="text-white" />
            </div>
            <h2 className="text-lg font-bold">IT Support IA</h2>
          </div>

          <div className="mb-8">
            <h2 className="text-2xl font-bold tracking-tight">Bon retour !</h2>
            <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1">
              Connectez-vous à votre espace de support IT
            </p>
          </div>

          {/* Error message */}
          {error && (
            <div
              className={`flex items-center gap-2.5 p-3.5 mb-5 rounded-xl bg-[hsl(var(--destructive)/0.08)] border border-[hsl(var(--destructive)/0.2)] text-sm text-[hsl(var(--destructive))] ${
                shake ? "animate-shake" : ""
              }`}
            >
              <AlertCircle size={16} className="flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email */}
            <div>
              <label className="block text-sm font-semibold mb-1.5" htmlFor="login-email">
                Adresse email
              </label>
              <div className="relative">
                <Mail
                  size={16}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-[hsl(var(--muted-foreground))]"
                />
                <input
                  id="login-email"
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
              <label className="block text-sm font-semibold mb-1.5" htmlFor="login-password">
                Mot de passe
              </label>
              <div className="relative">
                <Lock
                  size={16}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-[hsl(var(--muted-foreground))]"
                />
                <input
                  id="login-password"
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input-field focus-ring !pl-11 !pr-10"
                  placeholder="••••••••"
                  autoComplete="current-password"
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

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full mt-2"
              id="login-submit"
            >
              {loading ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Connexion en cours...
                </>
              ) : (
                <>
                  <LogIn size={16} />
                  Se connecter
                </>
              )}
            </button>
          </form>

          {/* Register link */}
          <p className="text-center text-sm text-[hsl(var(--muted-foreground))] mt-6">
            Pas encore de compte ?{" "}
            <Link
              href="/register"
              className="text-[hsl(var(--primary))] font-semibold hover:underline"
            >
              Créer un compte
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
