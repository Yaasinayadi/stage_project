"use client";

import { useState, useEffect } from "react";
import axios from "axios";
import { PlusCircle, Search, Laptop, Globe, Key, AlertCircle } from "lucide-react";

type Ticket = {
  id: number;
  name: string;
  description: string;
  state: string;
  priority: string;
  category: string;
};

export default function Home() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Form states
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");

  const fetchTickets = async () => {
    try {
      const res = await axios.get("http://localhost:8069/api/tickets");
      if (res.data.status === 200) {
        setTickets(res.data.data);
      }
    } catch (e) {
      console.error("Erreur backend Odoo", e);
    }
  };

  useEffect(() => {
    fetchTickets();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // 1. Appel du microservice IA pour classifier le ticket
      const iaRes = await axios.post("http://localhost:8000/classify_ticket", { description: desc });
      const { category, priority } = iaRes.data;

      // 2. Création dans Odoo avec la classification IA
      await axios.post("http://localhost:8069/api/ticket/create", {
        name: title,
        description: desc,
        category: category,
        priority: priority
      });

      setIsModalOpen(false);
      setTitle("");
      setDesc("");
      fetchTickets();
    } catch (e) {
      console.error(e);
      alert("Erreur lors de la création du ticket.");
    } finally {
      setLoading(false);
    }
  };

  const getCategoryIcon = (cat: string) => {
    if (!cat) return <AlertCircle size={20} />;
    const lcat = cat.toLowerCase();
    if (lcat.includes("réseau")) return <Globe size={20} className="text-blue-500" />;
    if (lcat.includes("accès")) return <Key size={20} className="text-amber-500" />;
    if (lcat.includes("logiciel")) return <Laptop size={20} className="text-purple-500" />;
    return <AlertCircle size={20} className="text-red-500" />;
  };

  const getPriorityBadge = (prio: string) => {
    switch (prio) {
      case '3': return <span className="bg-red-500/20 text-red-500 px-2 py-1 rounded-md text-xs font-medium">Critique</span>;
      case '2': return <span className="bg-orange-500/20 text-orange-500 px-2 py-1 rounded-md text-xs font-medium">Haute</span>;
      case '1': return <span className="bg-blue-500/20 text-blue-500 px-2 py-1 rounded-md text-xs font-medium">Moyenne</span>;
      default: return <span className="bg-gray-500/20 text-gray-400 px-2 py-1 rounded-md text-xs font-medium">Basse</span>;
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex justify-between items-center bg-card p-6 rounded-2xl shadow-sm border">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Tableau de bord de Support IT</h1>
          <p className="text-muted-foreground mt-1">Gérez vos demandes intelligemment épaulé par l'IA.</p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl font-medium transition-all shadow-lg hover:shadow-blue-500/25"
        >
          <PlusCircle size={20} />
          Nouveau Ticket
        </button>
      </div>

      {/* Barre de recherche */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-muted-foreground" size={20} />
        <input
          type="text"
          placeholder="Rechercher un ticket..."
          className="w-full bg-card border pl-12 pr-4 py-4 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600 transition-all text-sm"
        />
      </div>

      {/* Liste des tickets (Cards) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {tickets.length === 0 ? (
          <div className="col-span-full py-12 text-center text-muted-foreground bg-card/50 rounded-2xl border border-dashed">
            Aucun ticket trouvé. Créez-en un nouveau.
          </div>
        ) : (
          tickets.map(ticket => (
            <div key={ticket.id} className="bg-card border rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow group cursor-pointer hover:border-blue-500/50">
              <div className="flex justify-between items-start mb-4">
                <div className="p-3 rounded-xl bg-muted/50 group-hover:bg-blue-500/10 transition-colors">
                  {getCategoryIcon(ticket.category)}
                </div>
                {getPriorityBadge(ticket.priority)}
              </div>
              <h3 className="font-semibold text-lg line-clamp-1 mb-2">{ticket.name}</h3>
              <p className="text-sm text-muted-foreground line-clamp-2 mb-4">{ticket.description}</p>
              
              <div className="flex justify-between items-center text-xs font-medium pt-4 border-t">
                <span className="text-muted-foreground uppercase">{ticket.category || 'Non classé'}</span>
                <span className="px-2 py-1 rounded-full bg-green-500/10 text-green-500">{ticket.state}</span>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Modal Création Ticket (Super basique pour l'instant) */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card w-full max-w-lg rounded-3xl p-8 border shadow-2xl">
            <h2 className="text-2xl font-bold mb-6">Créer un nouveau ticket</h2>
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-sm font-medium mb-2 opacity-80">Sujet du problème</label>
                <input
                  required
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  className="w-full bg-background border px-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600 transition-all text-sm"
                  placeholder="Ex: Impossible de me connecter au VPN"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2 opacity-80">Description détaillée</label>
                <textarea
                  required
                  value={desc}
                  onChange={e => setDesc(e.target.value)}
                  className="w-full bg-background border px-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600 transition-all text-sm h-32 resize-none"
                  placeholder="Décrivez ce qu'il se passe..."
                />
              </div>
              
              <div className="bg-blue-500/10 p-4 rounded-xl border border-blue-500/20 text-sm text-blue-600 dark:text-blue-400 flex gap-3 items-center">
                <span className="flex-shrink-0 animate-pulse">✨</span>
                <p>À la soumission, notre IA va lire votre description pour analyser la catégorie et le niveau d'urgence.</p>
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-6 py-2.5 rounded-xl font-medium hover:bg-muted transition-colors"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-6 py-2.5 rounded-xl font-medium bg-blue-600 hover:bg-blue-700 text-white transition-all shadow-lg shadow-blue-600/25 disabled:opacity-50"
                >
                  {loading ? "Analyse IA en cours..." : "Soumettre le ticket"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
