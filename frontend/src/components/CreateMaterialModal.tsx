"use client";

import { useState } from "react";
import axios from "axios";
import { ODOO_URL } from "@/lib/config";
import {
  X,
  PackagePlus,
  Loader2,
  Tag,
  Hash,
  Layers,
  DollarSign,
  Archive,
  ChevronDown,
} from "lucide-react";
import { toast } from "sonner";

// ─── Types ────────────────────────────────────────────────────────────────────

type CatalogItem = {
  id: number;
  name: string;
  reference: string;
  category: string;
  qty_available: number;
  unit_cost: number;
};

interface CreateMaterialModalProps {
  categories: { id: number; name: string }[];
  onClose: () => void;
  onCreated: (newItem: CatalogItem) => void;
}



// ─── Form Field Component ─────────────────────────────────────────────────────

function Field({
  label,
  icon: Icon,
  children,
  required,
}: {
  label: string;
  icon: React.ElementType;
  children: React.ReactNode;
  required?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <label className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-[hsl(var(--muted-foreground))]">
        <Icon size={12} />
        {label}
        {required && <span className="text-rose-500 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}

const inputClass =
  "w-full bg-[hsl(var(--secondary)/0.5)] border border-[hsl(var(--border)/0.8)] focus:border-[hsl(var(--primary)/0.6)] focus:ring-2 focus:ring-[hsl(var(--primary)/0.15)] rounded-lg px-3.5 py-2.5 text-sm text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground)/0.5)] transition-all outline-none";

// ─── Modal ────────────────────────────────────────────────────────────────────

export default function CreateMaterialModal({
  categories,
  onClose,
  onCreated,
}: CreateMaterialModalProps) {
  const [name, setName] = useState("");
  const [categoryId, setCategoryId] = useState(categories.length > 0 ? categories[0].id.toString() : "");
  const [reference, setReference] = useState("");
  const [unitCost, setUnitCost] = useState("");
  const [qtyAvailable, setQtyAvailable] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const trimmedName = name.trim();
    if (!trimmedName) {
      toast.error("La désignation est obligatoire.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await axios.post(`${ODOO_URL}/api/admin/catalog/create`, {
        name: trimmedName,
        category_id: parseInt(categoryId),
        reference: reference.trim(),
        unit_cost: parseFloat(unitCost) || 0,
        qty_available: parseInt(qtyAvailable) || 0,
      });

      if (res.data.status === 201) {
        onCreated(res.data.data);
        toast.success("Ressource ajoutée au catalogue avec succès.");
        onClose();
      } else {
        toast.error(res.data.message || "Erreur lors de la création.");
      }
    } catch (err: unknown) {
      const message =
        axios.isAxiosError(err) && err.response?.data?.message
          ? err.response.data.message
          : "Impossible de créer le matériel.";
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {/* Panel */}
      <div
        className="relative w-full max-w-lg rounded-2xl border border-[hsl(var(--border)/0.6)] bg-[hsl(var(--background))] shadow-2xl animate-fade-in-up overflow-hidden"
        style={{ boxShadow: "0 25px 60px rgba(0,0,0,0.5)" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-[hsl(var(--border)/0.4)] bg-[hsl(var(--secondary)/0.06)]">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center h-9 w-9 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-500">
              <PackagePlus size={18} />
            </div>
            <div>
              <h2 className="text-sm font-black text-[hsl(var(--foreground))] tracking-tight">
                Nouveau matériel
              </h2>
              <p className="text-[11px] text-[hsl(var(--muted-foreground))] mt-0.5">
                Ajout d&apos;un article au catalogue
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="h-8 w-8 rounded-lg flex items-center justify-center text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] hover:bg-[hsl(var(--secondary)/0.5)] transition-all"
          >
            <X size={16} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-5">
          {/* Désignation */}
          <Field label="Désignation" icon={Tag} required>
            <input
              type="text"
              placeholder="ex : Clavier Logitech G Pro"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={inputClass}
              autoFocus
            />
          </Field>

          {/* Catégorie */}
          <Field label="Catégorie" icon={Layers}>
            <div className="relative">
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className={`${inputClass} appearance-none cursor-pointer pr-10`}
              >
                {categories.map((opt) => (
                  <option key={opt.id} value={opt.id} className="bg-[hsl(var(--background))] text-[hsl(var(--foreground))] py-1">
                    {opt.name}
                  </option>
                ))}
              </select>
              <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-[hsl(var(--muted-foreground))]">
                <ChevronDown size={16} />
              </div>
            </div>
          </Field>

          {/* Référence Interne */}
          <Field label="Référence Interne" icon={Hash}>
            <input
              type="text"
              placeholder="ex : LOG-KB-001"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              className={inputClass}
            />
          </Field>

          {/* Coût & Stock — row */}
          <div className="grid grid-cols-2 gap-4">
            <Field label="Coût Unitaire (MAD)" icon={DollarSign}>
              <div className="relative">
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  value={unitCost}
                  onChange={(e) => setUnitCost(e.target.value)}
                  className={`${inputClass} pr-10 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none`}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-[hsl(var(--muted-foreground))]">
                  DH
                </span>
              </div>
            </Field>

            <Field label="Stock Initial" icon={Archive}>
              <input
                type="number"
                min="0"
                step="1"
                placeholder="0"
                value={qtyAvailable}
                onChange={(e) => setQtyAvailable(e.target.value)}
                className={`${inputClass} [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none`}
              />
            </Field>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-2 border-t border-[hsl(var(--border)/0.3)] mt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2 rounded-lg text-sm font-semibold text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] hover:bg-[hsl(var(--secondary)/0.5)] border border-[hsl(var(--border)/0.6)] transition-all disabled:opacity-50"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={submitting || !name.trim()}
              className="flex items-center gap-2 px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
            >
              {submitting ? (
                <Loader2 size={15} className="animate-spin" />
              ) : (
                <PackagePlus size={15} />
              )}
              {submitting ? "Création..." : "Créer le matériel"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
