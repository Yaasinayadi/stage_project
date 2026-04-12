"use client";

import { useAuth } from "@/lib/auth";
import { PlusCircle, Headphones, Sparkles, ArrowRight } from "lucide-react";
import Link from "next/link";
import ProtectedRoute from "@/components/ProtectedRoute";

function Welcome() {
  const { user } = useAuth();

  return (
    <div className="p-6 lg:p-8 max-w-[1400px] mx-auto space-y-6">
      <div className="animate-fade-in flex flex-col items-center justify-center min-h-[60vh] text-center">
        
        <div className="w-20 h-20 rounded-3xl accent-gradient flex items-center justify-center mb-8 shadow-lg shadow-[hsl(var(--primary)/0.2)]">
          <Headphones size={40} className="text-white" />
        </div>

        <h1 className="text-4xl lg:text-5xl font-bold tracking-tight mb-4">
          Bonjour, {user ? user.name.split(" ")[0] : "Utilisateur"} 👋
        </h1>
        
        <p className="text-lg text-[hsl(var(--muted-foreground))] max-w-xl mx-auto mb-10 leading-relaxed">
          Bienvenue sur votre espace de support IT propulsé par l'IA. 
          Gérez vos demandes d'assistance facilement et suivez leur résolution en temps réel.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto">
          <Link href="/tickets">
            <button className="btn-primary w-full sm:w-auto px-8 py-3.5 text-base shadow-lg shadow-[hsl(var(--primary)/0.2)] hover:shadow-xl hover:-translate-y-0.5 transition-all">
              <PlusCircle size={20} />
              Gérer mes tickets
            </button>
          </Link>
          
          <button className="btn-ghost w-full sm:w-auto px-8 py-3.5 text-base border-2 border-[hsl(var(--border))] hover:bg-[hsl(var(--muted))] hover:-translate-y-0.5 transition-all">
            Contacter le support <ArrowRight size={18} className="ml-1" />
          </button>
        </div>

        <div className="mt-16 flex items-center gap-2 text-sm text-[hsl(var(--muted-foreground))] bg-[hsl(var(--muted)/0.5)] px-4 py-2 rounded-full">
          <Sparkles size={16} className="text-[hsl(var(--primary))]" />
          Notre assistant virtuel est disponible en bas à droite pour toute question.
        </div>
      </div>
    </div>
  );
}

export default function WelcomePage() {
  return (
    <ProtectedRoute>
      <Welcome />
    </ProtectedRoute>
  );
}
