"use client";

import { useState } from "react";
import axios from "axios";
import { X, Edit2, Trash2, Save, AlertCircle, Globe, Key, Laptop, HardDrive, Mail, Server, Clock, Sparkles, Loader2 } from "lucide-react";
import { getCategoryColor, getCategoryIcon, getPriorityBadge, getStatusInfo } from "./TicketCard";

type Ticket = {
  id: number;
  name: string;
  description: string;
  state: string;
  priority: string;
  category: string;
};

type TicketDetailsModalProps = {
  isOpen: boolean;
  ticket: Ticket;
  onClose: () => void;
  onRefresh?: () => void;
};

export default function TicketDetailsModal({ isOpen, ticket, onClose, onRefresh }: TicketDetailsModalProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [editForm, setEditForm] = useState({ name: ticket.name, description: ticket.description });

  if (!isOpen) return null;

  const status = getStatusInfo(ticket.state);
  const catColor = getCategoryColor(ticket.category);

  const handleClose = () => {
    if (isAnalyzing) return;
    setIsEditing(false);
    setEditForm({ name: ticket.name, description: ticket.description });
    onClose();
  };

  const handleDelete = async () => {
    if (confirm("Êtes-vous sûr de vouloir supprimer ce ticket ?")) {
      try {
        await axios.delete(`http://localhost:8069/api/ticket/${ticket.id}`);
        onRefresh?.();
        handleClose();
      } catch (err) {
        alert("Erreur lors de la suppression");
      }
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsAnalyzing(true);

    try {
      // 1. Re-classify via IA based on new description
      const iaRes = await axios.post("http://localhost:8000/classify_ticket", { description: editForm.description });
      const { category, priority } = iaRes.data;

      // 2. Update ticket in Odoo
      await axios.put(`http://localhost:8069/api/ticket/update/${ticket.id}`, {
        name: editForm.name,
        description: editForm.description,
        category,
        priority
      });
      
      onRefresh?.();
      setIsEditing(false);
    } catch (err) {
      alert("Erreur lors de la modification et ré-analyse IA.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div className="modal-content overflow-hidden flex flex-col max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[hsl(var(--border))] bg-[hsl(var(--background)/0.5)]">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ background: `${catColor}14`, color: catColor }}
            >
              {getCategoryIcon(ticket.category)}
            </div>
            <div>
              <h2 className="text-lg font-bold leading-tight">Détails du ticket</h2>
              <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">
                Ticket #{ticket.id}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {!isEditing && status.dotClass === "new" && (
              <>
                <button
                  onClick={() => setIsEditing(true)}
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-[hsl(var(--primary))] hover:bg-[hsl(var(--primary)/0.1)] transition-colors"
                  title="Modifier"
                >
                  <Edit2 size={16} />
                </button>
                <button
                  onClick={handleDelete}
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-red-500 hover:bg-red-500/10 transition-colors"
                  title="Supprimer"
                >
                  <Trash2 size={16} />
                </button>
              </>
            )}
            <button
              onClick={handleClose}
              disabled={isAnalyzing}
              className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
                isAnalyzing ? "opacity-50 cursor-not-allowed text-[hsl(var(--muted-foreground))]" 
                : "hover:bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
              }`}
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto custom-scrollbar">
          {isEditing ? (
            <form onSubmit={handleUpdate} className="space-y-5 animate-fade-in">
              <div>
                <label className="block text-sm font-semibold mb-1.5">Titre <span className="text-[hsl(var(--muted-foreground))] font-normal text-xs">(Modifiable)</span></label>
                <input
                  required
                  disabled={isAnalyzing}
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  className="input-field focus-ring disabled:opacity-50"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1.5">Description <span className="text-[hsl(var(--muted-foreground))] font-normal text-xs">(Modifiable)</span></label>
                <textarea
                  required
                  disabled={isAnalyzing}
                  value={editForm.description}
                  onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                  className="input-field focus-ring resize-none disabled:opacity-50"
                  style={{ height: "140px" }}
                />
              </div>

              {/* Read-only info panel */}
              <div className="p-4 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--muted)/0.3)] grid grid-cols-2 gap-4 relative overflow-hidden">
                {isAnalyzing ? (
                  <div className="absolute inset-0 z-10 bg-[hsl(var(--background)/0.8)] backdrop-blur-sm flex flex-col items-center justify-center animate-fade-in">
                      <Loader2 size={24} className="text-[hsl(var(--primary))] animate-spin mb-2" />
                      <p className="text-xs font-semibold text-[hsl(var(--primary))] flex items-center gap-1.5">
                        <Sparkles size={12} />
                        Analyse IA en cours...
                      </p>
                  </div>
                ) : null}
                <div>
                  <label className="block text-xs font-semibold mb-1 text-[hsl(var(--muted-foreground))]">Catégorie IA Actuelle</label>
                  <div className="text-sm font-medium">{ticket.category || "Non classé"}</div>
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1 text-[hsl(var(--muted-foreground))]">Priorité IA Actuelle</label>
                  <div className="mt-0.5">{getPriorityBadge(ticket.priority)}</div>
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-semibold mb-1 text-[hsl(var(--muted-foreground))]">Statut actuel</label>
                  <div className="flex items-center gap-2">
                    <span className={`status-dot ${status.dotClass}`} />
                    <span className="text-sm font-medium">{status.label}</span>
                  </div>
                </div>
                <p className="col-span-2 text-xs text-[hsl(var(--muted-foreground))] italic mt-1 flex gap-1.5 items-start">
                  <Sparkles size={12} className="flex-shrink-0 mt-0.5" />
                  À l'enregistrement, la catégorie et la priorité seront automatiquement réévaluées par l'IA.
                </p>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setIsEditing(false)} disabled={isAnalyzing} className="btn-ghost disabled:opacity-50">
                  Annuler
                </button>
                <button type="submit" disabled={isAnalyzing} className="btn-primary disabled:opacity-50 min-w-[140px]">
                  {isAnalyzing ? (
                    <>
                      <Loader2 size={16} className="animate-spin" /> Analyse...
                    </>
                  ) : (
                    <>
                      <Save size={16} /> Enregistrer
                    </>
                  )}
                </button>
              </div>
            </form>
          ) : (
            <div className="space-y-6 animate-fade-in">
              <div>
                <h3 className="text-xl font-bold mb-3">{ticket.name}</h3>
                <div className="whitespace-pre-wrap text-[hsl(var(--muted-foreground))] text-sm leading-relaxed bg-[hsl(var(--muted)/0.2)] p-4 rounded-xl border border-[hsl(var(--border)/0.5)]">
                  {ticket.description}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 rounded-xl border border-[hsl(var(--border)/0.5)] bg-[hsl(var(--card))]">
                  <span className="block text-xs font-semibold mb-1 opacity-70">Statut</span>
                  <div className="flex items-center gap-2">
                    <span className={`status-dot ${status.dotClass}`} />
                    <span className="font-medium text-[hsl(var(--foreground))]">{status.label}</span>
                  </div>
                </div>
                <div className="p-3 rounded-xl border border-[hsl(var(--border)/0.5)] bg-[hsl(var(--card))]">
                  <span className="block text-xs font-semibold mb-1 opacity-70">Priorité</span>
                  {getPriorityBadge(ticket.priority)}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
