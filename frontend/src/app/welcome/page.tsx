"use client";

import { useAuth } from "@/lib/auth";
import { PlusCircle, Headphones, Sparkles, Ticket, Activity, BookOpen, Clock } from "lucide-react";
import ActivityFeed from "@/components/ActivityFeed";
import Link from "next/link";
import ProtectedRoute from "@/components/ProtectedRoute";
import WelcomeSlider from "./WelcomeSlider";

function Welcome() {
  const { user } = useAuth();

  return (
    <div className="p-6 lg:p-8 max-w-[1440px] mx-auto space-y-10">
      
      {/* Header Section */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 animate-fade-in">
        <div>
          <h1 className="text-3xl lg:text-4xl font-bold tracking-tight mb-2 text-[hsl(var(--foreground))]">
            Bonjour, {user ? user.name.split(" ")[0].charAt(0).toUpperCase() + user.name.split(" ")[0].slice(1) : "Utilisateur"} 
          </h1>
          <p className="text-[hsl(var(--muted-foreground))] text-base sm:text-lg">
            Voici un aperçu de votre espace de support IT propulsé par l'IA.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-2 text-sm font-medium text-[hsl(var(--muted-foreground))] bg-[hsl(var(--muted)/0.3)] px-4 py-2.5 border border-[hsl(var(--border))] rounded-full shadow-sm backdrop-blur-sm">
            <Sparkles size={16} className="text-[hsl(var(--primary))]" />
            IA Assistant Actif
          </div>
          <Link href="/tickets">
            <button className="btn-primary px-5 py-2.5 text-sm shadow-md shadow-[hsl(var(--primary)/0.2)] hover:shadow-lg hover:-translate-y-0.5 transition-all flex items-center gap-2">
              <PlusCircle size={18} />
              Nouveau Ticket
            </button>
          </Link>
        </div>
      </div>

      {/* Hero Slider */}
      <div className="animate-fade-in w-full stagger-1">
        <WelcomeSlider />
      </div>

      {/* Dashboard Grid Container */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8 animate-slide-up stagger-2">
        
        {/* Quick Actions */}
        <div className="lg:col-span-2 space-y-6">
          <h2 className="text-xl font-semibold flex items-center gap-2 text-[hsl(var(--foreground))]">
            <Activity size={22} className="text-[hsl(var(--primary))]" />
            Actions Rapides
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 lg:gap-6">
            
            {/* Action Card 1 */}
            <Link href="/tickets" className="glass-card p-6 flex flex-col gap-5 group cursor-pointer hover:border-[hsl(var(--primary)/0.5)]">
              <div className="w-12 h-12 rounded-2xl bg-[hsl(var(--primary)/0.1)] text-[hsl(var(--primary))] flex items-center justify-center group-hover:scale-110 group-hover:bg-[hsl(var(--primary)/0.15)] transition-all duration-300">
                <Ticket size={24} />
              </div>
              <div>
                <h3 className="font-semibold text-lg mb-1 group-hover:text-[hsl(var(--primary))] transition-colors">Gérer mes tickets</h3>
                <p className="text-sm text-[hsl(var(--muted-foreground))] leading-relaxed">Consultez l'état de vos demandes d'assistance en cours et accédez à vos archives.</p>
              </div>
            </Link>

            {/* Action Card 2 */}
            <div className="glass-card p-6 flex flex-col gap-5 group cursor-pointer hover:border-[#10b981]/50">
              <div className="w-12 h-12 rounded-2xl bg-[#10b981]/10 text-[#10b981] flex items-center justify-center group-hover:scale-110 group-hover:bg-[#10b981]/15 transition-all duration-300">
                <BookOpen size={24} />
              </div>
              <div>
                <h3 className="font-semibold text-lg mb-1 group-hover:text-[#10b981] transition-colors">Base de connaissances</h3>
                <p className="text-sm text-[hsl(var(--muted-foreground))] leading-relaxed">Trouvez des solutions instantanées grâce à notre documentation indexée par l'IA.</p>
              </div>
            </div>

            {/* Action Card 3 */}
            <div className="glass-card p-6 flex flex-col gap-5 group cursor-pointer hover:border-[#f59e0b]/50">
              <div className="w-12 h-12 rounded-2xl bg-[#f59e0b]/10 text-[#f59e0b] flex items-center justify-center group-hover:scale-110 group-hover:bg-[#f59e0b]/15 transition-all duration-300">
                <Clock size={24} />
              </div>
              <div>
                <h3 className="font-semibold text-lg mb-1 group-hover:text-[#f59e0b] transition-colors">Demandes en attente</h3>
                <p className="text-sm text-[hsl(var(--muted-foreground))] leading-relaxed">Suivez l'avancement des tickets nécessitant une action de votre part.</p>
              </div>
            </div>

            {/* Action Card 4 */}
            <div className="glass-card p-6 flex flex-col gap-5 group cursor-pointer hover:border-[#8b5cf6]/50">
              <div className="w-12 h-12 rounded-2xl bg-[#8b5cf6]/10 text-[#8b5cf6] flex items-center justify-center group-hover:scale-110 group-hover:bg-[#8b5cf6]/15 transition-all duration-300">
                <Headphones size={24} />
              </div>
              <div>
                <h3 className="font-semibold text-lg mb-1 group-hover:text-[#8b5cf6] transition-colors">Contacter le support</h3>
                <p className="text-sm text-[hsl(var(--muted-foreground))] leading-relaxed">Entrez en contact direct avec un expert IT si l'assistant virtuel ne suffit pas.</p>
              </div>
            </div>

          </div>
        </div>

        {/* Recent Activity/Updates Side Panel */}
        <div className="space-y-6">
          <h2 className="text-xl font-semibold flex items-center gap-2 text-[hsl(var(--foreground))]">
            <Clock size={22} className="text-[hsl(var(--muted-foreground))]" />
            Activité Récente
          </h2>
          <ActivityFeed />
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
