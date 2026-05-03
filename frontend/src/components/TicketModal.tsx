"use client";

import { useState, useRef, useCallback } from "react";
import {
  X, Sparkles, Send, Loader2, CheckCircle2,
  Paperclip, Upload, FileText, Image, File, Trash2, AlertCircle
} from "lucide-react";
import axios from "axios";
import { useAuth } from "@/lib/auth";
import { ODOO_URL } from "@/lib/config";


type TicketModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
};

type Step = "form" | "analyzing" | "uploading" | "success";

type PendingFile = {
  file: File;
  preview?: string;
  id: string;
};

const ALLOWED_TYPES = [
  "image/jpeg", "image/png", "image/gif", "image/webp",
  "application/pdf",
  "text/plain", "text/csv",
  "application/zip",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];
const MAX_SIZE = 10 * 1024 * 1024; // 10 MB
const MAX_FILES = 5;

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}

function getFileIcon(type: string) {
  if (type.startsWith("image/")) return <Image size={16} className="text-blue-400" />;
  if (type === "application/pdf") return <FileText size={16} className="text-red-400" />;
  return <File size={16} className="text-gray-400" />;
}

export default function TicketModal({ isOpen, onClose, onSuccess }: TicketModalProps) {
  // ─── TOUS les hooks en premier, AVANT tout return conditionnel ───
  const { user } = useAuth();
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [step, setStep] = useState<Step>("form");
  const [aiResult, setAiResult] = useState<{ category: string; priority: string } | null>(null);
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // useCallback AVANT le return conditionnel
  const addFiles = useCallback((newFiles: FileList | File[]) => {
    setFileError(null);
    const filesArray = Array.from(newFiles);

    setPendingFiles((prev) => {
      if (prev.length + filesArray.length > MAX_FILES) {
        setFileError(`Maximum ${MAX_FILES} fichiers autorisés.`);
        return prev;
      }

      const toAdd: PendingFile[] = [];
      for (const file of filesArray) {
        if (!ALLOWED_TYPES.includes(file.type)) {
          setFileError(`Type non autorisé : ${file.name}`);
          return prev;
        }
        if (file.size > MAX_SIZE) {
          setFileError(`"${file.name}" dépasse 10 Mo.`);
          return prev;
        }
        const id = `${Date.now()}_${Math.random().toString(36).slice(2)}`;
        const entry: PendingFile = { file, id };
        if (file.type.startsWith("image/")) {
          entry.preview = URL.createObjectURL(file);
        }
        toAdd.push(entry);
      }
      return [...prev, ...toAdd];
    });
  }, []); // pas de dépendance sur pendingFiles, on utilise le setter fonctionnel

  const removeFile = useCallback((id: string) => {
    setPendingFiles((prev) => {
      const removed = prev.find((f) => f.id === id);
      if (removed?.preview) URL.revokeObjectURL(removed.preview);
      return prev.filter((f) => f.id !== id);
    });
    setFileError(null);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback(() => setIsDragging(false), []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    addFiles(e.dataTransfer.files);
  }, [addFiles]);

  const handleClose = useCallback(() => {
    pendingFiles.forEach(({ preview }) => { if (preview) URL.revokeObjectURL(preview); });
    setTitle("");
    setDesc("");
    setStep("form");
    setAiResult(null);
    setPendingFiles([]);
    setFileError(null);
    onClose();
  }, [pendingFiles, onClose]);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setStep("analyzing");

    try {
      // 1. Classification IA
      const iaRes = await axios.post("http://localhost:8000/classify_ticket", { description: desc });
      const { category, priority } = iaRes.data;
      setAiResult({ category, priority });

      // 2. Création du ticket dans Odoo
      const createRes = await axios.post(`${ODOO_URL}/api/ticket/create`, {
        name: title,
        description: desc,
        category,
        priority,
        user_id: user?.id,
      });


      const ticketId = createRes.data.ticket_id;

      // 3. Upload des fichiers vers Odoo (ir.attachment — stockage centralisé PostgreSQL)
      if (pendingFiles.length > 0 && ticketId) {
        setStep("uploading");
        const formData = new FormData();
        pendingFiles.forEach(({ file }) => formData.append("files", file));
        await axios.post(
          `${ODOO_URL}/api/ticket/${ticketId}/upload`,
          formData,
          { headers: { "Content-Type": "multipart/form-data" } }
        );
      }

      setStep("success");
      setTimeout(() => {
        handleClose();
        onSuccess();
      }, 1800);
    } catch {
      alert("Erreur lors de la création du ticket.");
      setStep("form");
    }
  }, [title, desc, user, pendingFiles, handleClose, onSuccess]);

  // ─── Early return APRÈS tous les hooks ───
  if (!isOpen) return null;

  // ─── Render ───
  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div className="modal-content" style={{ maxWidth: "540px" }} onClick={(e) => e.stopPropagation()}>
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
        <div className="p-5 overflow-y-auto custom-scrollbar" style={{ maxHeight: "calc(90vh - 80px)" }}>

          {/* ─── Form ─── */}
          {step === "form" && (
            <form onSubmit={handleSubmit} className="space-y-4 animate-fade-in">
              <div>
                <label className="block text-sm font-semibold mb-1.5">Sujet du problème</label>
                <input
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="input-field focus-ring"
                  placeholder="Ex: Impossible de me connecter au VPN"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold mb-1.5">Description détaillée</label>
                <textarea
                  required
                  value={desc}
                  onChange={(e) => setDesc(e.target.value)}
                  className="input-field focus-ring resize-none"
                  style={{ height: "110px" }}
                  placeholder="Décrivez votre problème en détail pour que l'IA puisse mieux le classifier..."
                />
              </div>

              {/* ─── Zone Upload ─── */}
              <div>
                <label className="block text-sm font-semibold mb-1.5 flex items-center gap-1.5">
                  <Paperclip size={14} />
                  Pièces jointes
                  <span className="text-[hsl(var(--muted-foreground))] font-normal text-xs">
                    (optionnel — max {MAX_FILES} fichiers, 10 Mo chacun)
                  </span>
                </label>

                {/* Drag & Drop Zone */}
                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`
                    relative border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition-all duration-200
                    ${isDragging
                      ? "border-[hsl(var(--primary))] bg-[hsl(var(--primary)/0.08)] scale-[1.01]"
                      : "border-[hsl(var(--border))] hover:border-[hsl(var(--primary)/0.4)] hover:bg-[hsl(var(--muted)/0.3)]"
                    }
                    ${pendingFiles.length >= MAX_FILES ? "opacity-50 cursor-not-allowed" : ""}
                  `}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    className="hidden"
                    accept={ALLOWED_TYPES.join(",")}
                    disabled={pendingFiles.length >= MAX_FILES}
                    onChange={(e) => e.target.files && addFiles(e.target.files)}
                  />
                  <div className="flex flex-col items-center gap-2">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${
                      isDragging ? "bg-[hsl(var(--primary)/0.15)]" : "bg-[hsl(var(--muted))]"
                    }`}>
                      <Upload size={18} className={isDragging ? "text-[hsl(var(--primary))]" : "text-[hsl(var(--muted-foreground))]"} />
                    </div>
                    <div>
                      <p className="text-sm font-semibold">
                        {isDragging ? "Déposez vos fichiers ici" : "Glissez-déposez ou cliquez pour sélectionner"}
                      </p>
                      <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">
                        Images, PDF, Word, Excel, TXT, ZIP
                      </p>
                    </div>
                  </div>
                </div>

                {/* Erreur fichier */}
                {fileError && (
                  <div className="flex items-center gap-2 mt-2 p-2.5 rounded-lg bg-red-500/10 text-red-500 text-xs font-medium animate-fade-in">
                    <AlertCircle size={14} />
                    {fileError}
                  </div>
                )}

                {/* Liste des fichiers sélectionnés */}
                {pendingFiles.length > 0 && (
                  <div className="mt-3 space-y-2 animate-fade-in">
                    {pendingFiles.map(({ file, preview, id }) => (
                      <div
                        key={id}
                        className="flex items-center gap-3 p-2.5 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] group"
                      >
                        {preview ? (
                          <img
                            src={preview}
                            alt={file.name}
                            className="w-9 h-9 rounded-md object-cover flex-shrink-0 border border-[hsl(var(--border))]"
                          />
                        ) : (
                          <div className="w-9 h-9 rounded-md bg-[hsl(var(--muted))] flex items-center justify-center flex-shrink-0">
                            {getFileIcon(file.type)}
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold truncate">{file.name}</p>
                          <p className="text-[0.65rem] text-[hsl(var(--muted-foreground))]">
                            {formatBytes(file.size)}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeFile(id)}
                          className="w-7 h-7 rounded-md text-[hsl(var(--muted-foreground))] hover:text-red-500 hover:bg-red-500/10 flex items-center justify-center transition-colors"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    ))}
                    <p className="text-[0.65rem] text-[hsl(var(--muted-foreground))] text-right">
                      {pendingFiles.length}/{MAX_FILES} fichier{pendingFiles.length > 1 ? "s" : ""}
                    </p>
                  </div>
                )}
              </div>

              {/* IA Info Banner */}
              <div className="flex items-start gap-3 p-3.5 rounded-xl bg-[hsl(var(--primary)/0.06)] border border-[hsl(var(--primary)/0.12)]">
                <Sparkles size={16} className="text-[hsl(var(--primary))] flex-shrink-0 mt-0.5 animate-float" />
                <p className="text-xs text-[hsl(var(--primary))] leading-relaxed">
                  À la soumission, notre IA analysera votre description pour détecter
                  la <strong>catégorie</strong> et le <strong>niveau d&apos;urgence</strong> automatiquement.
                </p>
              </div>

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

          {/* ─── Analyzing ─── */}
          {step === "analyzing" && (
            <div className="flex flex-col items-center justify-center py-10 animate-fade-in space-y-4">
              <div className="w-14 h-14 rounded-2xl accent-gradient flex items-center justify-center animate-pulse-glow">
                <Loader2 size={24} className="text-white animate-spin" />
              </div>
              <div className="text-center">
                <h3 className="font-bold text-base mb-1">Analyse IA en cours...</h3>
                <p className="text-sm text-[hsl(var(--muted-foreground))]">Classification automatique de votre demande</p>
              </div>
              <div className="flex gap-1.5 mt-2">
                <span className="w-2 h-2 rounded-full bg-[hsl(var(--primary))] animate-bounce" style={{ animationDelay: "0ms" }} />
                <span className="w-2 h-2 rounded-full bg-[hsl(var(--primary))] animate-bounce" style={{ animationDelay: "150ms" }} />
                <span className="w-2 h-2 rounded-full bg-[hsl(var(--primary))] animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
            </div>
          )}

          {/* ─── Uploading ─── */}
          {step === "uploading" && (
            <div className="flex flex-col items-center justify-center py-10 animate-fade-in space-y-4">
              <div className="w-14 h-14 rounded-2xl bg-[hsl(var(--info)/0.15)] flex items-center justify-center">
                <Upload size={24} className="text-[hsl(var(--info))] animate-bounce" />
              </div>
              <div className="text-center">
                <h3 className="font-bold text-base mb-1">Upload des fichiers...</h3>
                <p className="text-sm text-[hsl(var(--muted-foreground))]">
                  Téléversement de {pendingFiles.length} fichier{pendingFiles.length > 1 ? "s" : ""} en cours
                </p>
              </div>
              <div className="flex gap-1.5 mt-2">
                <span className="w-2 h-2 rounded-full bg-[hsl(var(--info))] animate-bounce" style={{ animationDelay: "0ms" }} />
                <span className="w-2 h-2 rounded-full bg-[hsl(var(--info))] animate-bounce" style={{ animationDelay: "150ms" }} />
                <span className="w-2 h-2 rounded-full bg-[hsl(var(--info))] animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
            </div>
          )}

          {/* ─── Success ─── */}
          {step === "success" && (
            <div className="flex flex-col items-center justify-center py-10 animate-fade-in space-y-4">
              <div className="w-14 h-14 rounded-2xl bg-[hsl(var(--success)/0.1)] flex items-center justify-center">
                <CheckCircle2 size={28} className="text-[hsl(var(--success))]" />
              </div>
              <div className="text-center">
                <h3 className="font-bold text-base mb-1">Ticket créé avec succès !</h3>
                <p className="text-sm text-[hsl(var(--muted-foreground))]">
                  {aiResult && (
                    <>Catégorie : <strong>{aiResult.category}</strong> · Priorité : <strong>{aiResult.priority}</strong></>
                  )}
                </p>
                {pendingFiles.length > 0 && (
                  <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1">
                    <CheckCircle2 size={12} className="inline mr-1" /> {pendingFiles.length} fichier{pendingFiles.length > 1 ? "s" : ""} joint{pendingFiles.length > 1 ? "s" : ""}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
