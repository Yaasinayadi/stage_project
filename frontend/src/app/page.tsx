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

  // Search & Filter states
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("Tous");
  
  const categories = ["Tous", "Logiciel", "Matériel", "Accès", "Réseau", "Messagerie", "Infrastructure", "Autre"];

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

  // Filtrage combiné par recherche de texte et catégorie
  const filteredTickets = tickets.filter(ticket => {
    const safeName = (ticket.name || "").toLowerCase();
    const safeDesc = (ticket.description || "").toLowerCase();
    const safeSearch = (searchTerm || "").toLowerCase();
    
    const matchesSearch = safeName.includes(safeSearch) || safeDesc.includes(safeSearch);
    
    const ticketCat = ticket.category ? ticket.category.toLowerCase() : "autre";
    const matchesCategory = selectedCategory === "Tous" || ticketCat.includes(selectedCategory.toLowerCase());
    
    return matchesSearch && matchesCategory;
  });

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

      {/* Barre de recherche et Filtres */}
      <div className="space-y-5 bg-card/40 p-6 rounded-3xl border border-border/50 shadow-sm">
        {/* Recherche focus */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1 group">
            <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none">
              <Search className="text-muted-foreground group-focus-within:text-blue-600 transition-colors duration-300" size={20} />
            </div>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Rechercher un ticket par titre ou description..."
              className="w-full bg-background border border-border/80 pl-12 pr-4 py-4 rounded-2xl shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 transition-all text-sm font-medium"
            />
          </div>
          <button 
            className="cursor-pointer bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white px-8 py-4 rounded-2xl font-semibold transition-all duration-300 shadow-lg shadow-blue-600/20 hover:shadow-blue-600/40 hover:-translate-y-1 hover:scale-[1.03] active:scale-[0.98] flex items-center justify-center gap-3"
          >
            <Search size={18} />
            <span className="hidden sm:inline">Chercher</span>
          </button>
        </div>

        {/* Categories (Pills) */}
        <div className="flex flex-wrap gap-2.5 pt-1">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`cursor-pointer px-5 py-2.5 rounded-full text-sm font-semibold transition-all duration-300 border flex items-center justify-center min-w-[80px] hover:-translate-y-1 active:scale-95 ${
                selectedCategory === cat 
                  ? "bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-500/40 scale-[1.05]" 
                  : "bg-white/80 backdrop-blur-sm border-gray-200 hover:border-blue-400 hover:bg-blue-50 text-gray-500 hover:text-blue-600 shadow-sm hover:shadow-md"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Liste des tickets (Cards) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredTickets.length === 0 ? (
          <div className="col-span-full py-20 text-center bg-card/30 rounded-3xl border border-dashed border-border/60">
            <div className="flex flex-col items-center justify-center space-y-4">
              <div className="p-4 bg-muted/50 rounded-full">
                <Search className="h-8 w-8 text-muted-foreground/60" />
              </div>
              <h3 className="text-xl font-semibold text-foreground/80">Aucun ticket trouvé</h3>
              <p className="text-sm text-muted-foreground max-w-sm text-center">
                Essayez de modifier votre terme de recherche ou changez la catégorie sélectionnée ci-dessus.
              </p>
            </div>
          </div>
        ) : (
          filteredTickets.map(ticket => (
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
