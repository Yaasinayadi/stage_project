"use client";

import { useState } from "react";
import { X, Sparkles, Send, Loader2, CheckCircle2 } from "lucide-react";
import axios from "axios";

type TicketModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
};

type Step = "form" | "analyzing" | "success";

export default function TicketModal({ isOpen, onClose, onSuccess }: TicketModalProps) {
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [step, setStep] = useState<Step>("form");
  const [aiResult, setAiResult] = useState<{ category: string; priority: string } | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStep("analyzing");

    try {
      // 1. Classify via IA
      const iaRes = await axios.post("http://localhost:8000/classify_ticket", { description: desc });
      const { category, priority } = iaRes.data;
      setAiResult({ category, priority });

      // 2. Create in Odoo
      await axios.post("http://localhost:8069/api/ticket/create", {
        name: title,
        description: desc,
        category,
        priority,
      });

      setStep("success");

      // Auto-close after success
      setTimeout(() => {
        handleClose();
        onSuccess();
      }, 1800);
    } catch {
      alert("Erreur lors de la création du ticket.");
      setStep("form");
    }
  };

  const handleClose = () => {
    setTitle("");
    setDesc("");
    setStep("form");
    setAiResult(null);
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-[hsl(var(--border))]">
          <div>
            <h2 className="text-lg font-bold">Nouveau ticket</h2>
            <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">
              L&apos;IA analysera automatiquement votre demande
            </p>
          </div>
          <button
            onClick={handleClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-[hsl(var(--muted))] transition-colors text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="p-5">
          {step === "form" && (
            <form onSubmit={handleSubmit} className="space-y-4 animate-fade-in">
              <div>
                <label className="block text-sm font-semibold mb-1.5">
                  Sujet du problème
                </label>
                <input
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="input-field focus-ring"
                  placeholder="Ex: Impossible de me connecter au VPN"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold mb-1.5">
                  Description détaillée
                </label>
                <textarea
                  required
                  value={desc}
                  onChange={(e) => setDesc(e.target.value)}
                  className="input-field focus-ring resize-none"
                  style={{ height: "120px" }}
                  placeholder="Décrivez votre problème en détail pour que l'IA puisse mieux le classifier..."
                />
              </div>

              {/* IA Info Banner */}
              <div className="flex items-start gap-3 p-3.5 rounded-xl bg-[hsl(var(--primary)/0.06)] border border-[hsl(var(--primary)/0.12)]">
                <Sparkles size={16} className="text-[hsl(var(--primary))] flex-shrink-0 mt-0.5 animate-float" />
                <p className="text-xs text-[hsl(var(--primary))] leading-relaxed">
                  À la soumission, notre IA analysera votre description pour détecter
                  la <strong>catégorie</strong> et le <strong>niveau d&apos;urgence</strong> automatiquement.
                </p>
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={handleClose} className="btn-ghost">
                  Annuler
                </button>
                <button type="submit" className="btn-primary">
                  <Send size={15} />
                  Soumettre
                </button>
              </div>
            </form>
          )}

          {step === "analyzing" && (
            <div className="flex flex-col items-center justify-center py-10 animate-fade-in space-y-4">
              <div className="w-14 h-14 rounded-2xl accent-gradient flex items-center justify-center animate-pulse-glow">
                <Loader2 size={24} className="text-white animate-spin" />
              </div>
              <div className="text-center">
                <h3 className="font-bold text-base mb-1">Analyse IA en cours...</h3>
                <p className="text-sm text-[hsl(var(--muted-foreground))]">
                  Classification automatique de votre demande
                </p>
              </div>
              <div className="flex gap-1.5 mt-2">
                <span className="w-2 h-2 rounded-full bg-[hsl(var(--primary))] animate-bounce" style={{ animationDelay: "0ms" }} />
                <span className="w-2 h-2 rounded-full bg-[hsl(var(--primary))] animate-bounce" style={{ animationDelay: "150ms" }} />
                <span className="w-2 h-2 rounded-full bg-[hsl(var(--primary))] animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
            </div>
          )}

          {step === "success" && (
            <div className="flex flex-col items-center justify-center py-10 animate-fade-in space-y-4">
              <div className="w-14 h-14 rounded-2xl bg-[hsl(var(--success)/0.1)] flex items-center justify-center">
                <CheckCircle2 size={28} className="text-[hsl(var(--success))]" />
              </div>
              <div className="text-center">
                <h3 className="font-bold text-base mb-1">Ticket créé avec succès !</h3>
                <p className="text-sm text-[hsl(var(--muted-foreground))]">
                  {aiResult && (
                    <>
                      Catégorie : <strong>{aiResult.category}</strong> · Priorité : <strong>{aiResult.priority}</strong>
                    </>
                  )}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
