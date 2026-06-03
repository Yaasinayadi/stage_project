"use client";

import { useState, useRef, useEffect } from "react";
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
  Check,
  PlusCircle,
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

function CustomCategorySelect({
  value,
  onChange,
  categories,
  onCreateCategory,
}: {
  value: string;
  onChange: (val: string) => void;
  categories: { id: number; name: string }[];
  onCreateCategory: (name: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    if (!open) {
      setSearch("");
    } else {
      setTimeout(() => inputRef.current?.focus(), 10);
    }
  }, [open]);

  const selectedOption = categories.find((o) => o.id.toString() === value) || categories[0];
  const filteredOptions = categories.filter(o => o.name.toLowerCase().includes(search.toLowerCase()));
  const exactMatch = categories.find(o => o.name.toLowerCase() === search.toLowerCase().trim());

  return (
    <div ref={ref} className="relative w-full">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={`${inputClass} flex items-center justify-between text-left`}
      >
        <span className="font-semibold block truncate pr-4">
          {selectedOption ? selectedOption.name : "Sélectionnez une catégorie"}
        </span>
        <ChevronDown
          size={16}
          className={`transition-transform text-[hsl(var(--muted-foreground))] shrink-0 ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      {open && (
        <div className="absolute top-[calc(100%+8px)] left-0 z-50 w-full rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] shadow-2xl backdrop-blur-lg overflow-hidden animate-fade-in flex flex-col">
          <div className="p-2 border-b border-[hsl(var(--border)/0.5)]">
            <input
              ref={inputRef}
              type="text"
              placeholder="Rechercher ou créer..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-transparent border-none text-sm text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground)/0.5)] focus:ring-0 focus:outline-none px-2 py-1"
            />
          </div>
          <div className="p-2 space-y-1 overflow-y-auto custom-scrollbar max-h-48">
            {filteredOptions.map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => {
                  onChange(opt.id.toString());
                  setOpen(false);
                }}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-semibold transition-all
                  ${
                    opt.id.toString() === value
                      ? "bg-[hsl(var(--muted))] text-[hsl(var(--foreground))]"
                      : "hover:bg-[hsl(var(--muted)/0.5)] text-[hsl(var(--foreground)/0.8)] hover:text-[hsl(var(--foreground))]"
                  }`}
              >
                <span className="truncate pr-2">{opt.name}</span>
                {opt.id.toString() === value && (
                  <Check
                    size={14}
                    className="shrink-0 text-[hsl(var(--foreground))]"
                  />
                )}
              </button>
            ))}
            {search.trim() && !exactMatch && (
              <button
                type="button"
                onClick={() => {
                  onCreateCategory(search.trim());
                  setOpen(false);
                }}
                className="w-full flex items-center px-3 py-2.5 rounded-lg text-sm font-semibold transition-all hover:bg-[hsl(var(--muted)/0.5)] text-[hsl(var(--foreground)/0.8)] hover:text-[hsl(var(--foreground))]"
              >
                <PlusCircle size={14} className="text-emerald-500 mr-2 shrink-0" />
                <span className="truncate">Créer "{search.trim()}"</span>
              </button>
            )}
            {filteredOptions.length === 0 && !search.trim() && (
              <div className="text-center py-2 text-sm text-[hsl(var(--muted-foreground))]">
                Aucune catégorie
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function CreateMaterialModal({
  categories: initialCategories,
  onClose,
  onCreated,
}: CreateMaterialModalProps) {
  const [localCategories, setLocalCategories] = useState(initialCategories);
  const [name, setName] = useState("");
  const [categoryId, setCategoryId] = useState(localCategories.length > 0 ? localCategories[0].id.toString() : "");
  const [reference, setReference] = useState("");
  const [unitCost, setUnitCost] = useState("");
  const [qtyAvailable, setQtyAvailable] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setLocalCategories(initialCategories);
  }, [initialCategories]);

  const handleCreateCategory = async (catName: string) => {
    try {
      const res = await axios.post(`${ODOO_URL}/api/material-categories`, { name: catName });
      if (res.data.status === 201 || res.data.status === 200) {
        const newCat = res.data.data;
        setLocalCategories((prev) => {
          if (prev.find((c) => c.id === newCat.id)) return prev;
          return [...prev, newCat];
        });
        setCategoryId(newCat.id.toString());
        toast.success(`Catégorie "${newCat.name}" ${res.data.status === 201 ? "créée" : "sélectionnée"} avec succès.`);
      } else {
        toast.error(res.data.message || "Erreur lors de la création de la catégorie.");
      }
    } catch (err) {
      toast.error("Impossible de créer la catégorie.");
    }
  };

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
            <CustomCategorySelect
              value={categoryId}
              onChange={setCategoryId}
              categories={localCategories}
              onCreateCategory={handleCreateCategory}
            />
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
