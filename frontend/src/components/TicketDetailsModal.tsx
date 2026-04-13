"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import axios from "axios";
import {
  X, Edit2, Trash2, Save, Sparkles, Loader2,
  Paperclip, Upload, FileText, Image, File, Download,
  AlertCircle, CheckCircle2, XCircle
} from "lucide-react";
import { getCategoryColor, getCategoryIcon, getPriorityBadge, getStatusInfo } from "./TicketCard";

// ─── Types ───

type Ticket = {
  id: number;
  name: string;
  description: string;
  state: string;
  priority: string;
  category: string;
};

type Attachment = {
  id: number;
  name: string;
  mimetype: string;
  file_size: number;
  create_date: string | null;
  url: string;
};

type TicketDetailsModalProps = {
  isOpen: boolean;
  ticket: Ticket;
  onClose: () => void;
  onRefresh?: () => void;
};

// ─── Constants ───

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
const MAX_SIZE   = 10 * 1024 * 1024;
const MAX_FILES  = 5;
const ODOO_BASE  = "http://localhost:8069";
const FLASK_BASE = "http://localhost:8000";

// ─── Helpers ───

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}

function formatDate(dateStr: string | null) {
  if (!dateStr) return "";
  return new Date(dateStr).toLocaleDateString("fr-FR", {
    day: "2-digit", month: "short", year: "numeric",
  });
}

function getFileIcon(mimetype: string, size = 16) {
  if (mimetype.startsWith("image/")) return <Image size={size} className="text-blue-400" />;
  if (mimetype === "application/pdf")  return <FileText size={size} className="text-red-400" />;
  return <File size={size} className="text-gray-400" />;
}

function isImageMime(mimetype: string) {
  return mimetype.startsWith("image/");
}

// ─── Component ───

export default function TicketDetailsModal({
  isOpen,
  ticket,
  onClose,
  onRefresh,
}: TicketDetailsModalProps) {

  // ══════════════════════════════════════════
  //  HOOKS — tous AVANT le return conditionnel
  // ══════════════════════════════════════════

  const [isEditing,     setIsEditing]     = useState(false);
  const [isAnalyzing,   setIsAnalyzing]   = useState(false);
  const [editForm,      setEditForm]      = useState({
    name:        ticket.name,
    description: ticket.description,
  });

  // Attachments
  const [attachments,   setAttachments]   = useState<Attachment[]>([]);
  const [attachLoading, setAttachLoading] = useState(true);
  const [isDragging,    setIsDragging]    = useState(false);
  const [isUploading,   setIsUploading]   = useState(false);
  const [uploadError,   setUploadError]   = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);
  const [deletingId,    setDeletingId]    = useState<number | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Chargement des pièces jointes
  const fetchAttachments = useCallback(async () => {
    setAttachLoading(true);
    try {
      const res = await axios.get(`${FLASK_BASE}/api/ticket/${ticket.id}/attachments`);
      if (res.data.status === 200) setAttachments(res.data.data);
    } catch {
      // silently ignore
    } finally {
      setAttachLoading(false);
    }
  }, [ticket.id]);

  useEffect(() => {
    if (isOpen) fetchAttachments();
  }, [isOpen, fetchAttachments]);

  // Réinitialiser le mode édition à chaque ouverture
  useEffect(() => {
    if (isOpen) {
      setIsEditing(false);
      setEditForm({ name: ticket.name, description: ticket.description });
      setUploadError(null);
      setUploadSuccess(null);
    }
  }, [isOpen, ticket.name, ticket.description]);

  // Handlers
  const handleClose = useCallback(() => {
    if (isAnalyzing || isUploading) return;
    setIsEditing(false);
    onClose();
  }, [isAnalyzing, isUploading, onClose]);

  const handleCancelEdit = useCallback(() => {
    setIsEditing(false);
    setEditForm({ name: ticket.name, description: ticket.description });
    setUploadError(null);
    setUploadSuccess(null);
  }, [ticket.name, ticket.description]);

  const handleDelete = useCallback(async () => {
    if (!confirm("Êtes-vous sûr de vouloir supprimer ce ticket ?")) return;
    try {
      await axios.delete(`${ODOO_BASE}/api/ticket/${ticket.id}`);
      onRefresh?.();
      onClose();
    } catch {
      alert("Erreur lors de la suppression.");
    }
  }, [ticket.id, onRefresh, onClose]);

  const handleUpdate = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setIsAnalyzing(true);
    try {
      const iaRes = await axios.post(`${FLASK_BASE}/classify_ticket`, {
        description: editForm.description,
      });
      const { category, priority } = iaRes.data;
      await axios.put(`${ODOO_BASE}/api/ticket/update/${ticket.id}`, {
        name:        editForm.name,
        description: editForm.description,
        category,
        priority,
      });
      onRefresh?.();
      setIsEditing(false);
    } catch {
      alert("Erreur lors de la modification.");
    } finally {
      setIsAnalyzing(false);
    }
  }, [editForm, ticket.id, onRefresh]);

  const uploadFiles = useCallback(async (files: FileList | File[]) => {
    setUploadError(null);
    setUploadSuccess(null);
    const arr = Array.from(files);

    if (attachments.length + arr.length > MAX_FILES) {
      setUploadError(`Maximum ${MAX_FILES} fichiers par ticket.`);
      return;
    }
    for (const f of arr) {
      if (!ALLOWED_TYPES.includes(f.type)) { setUploadError(`Type non autorisé : ${f.name}`); return; }
      if (f.size > MAX_SIZE)               { setUploadError(`"${f.name}" dépasse 10 Mo.`);   return; }
    }

    setIsUploading(true);
    try {
      const formData = new FormData();
      arr.forEach((f) => formData.append("files", f));
      const res = await axios.post(
        `${FLASK_BASE}/api/ticket/${ticket.id}/upload`,
        formData,
        { headers: { "Content-Type": "multipart/form-data" } }
      );
      if (res.data.status === 201) {
        setUploadSuccess(`${res.data.data.length} fichier(s) ajouté(s) !`);
        setTimeout(() => setUploadSuccess(null), 4000);
        fetchAttachments();
      }
    } catch {
      setUploadError("Erreur lors du téléversement. Réessayez.");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }, [attachments.length, ticket.id, fetchAttachments]);

  const handleDeleteAttachment = useCallback(async (attId: number) => {
    if (!confirm("Supprimer ce fichier ?")) return;
    setDeletingId(attId);
    try {
      await axios.delete(`${FLASK_BASE}/api/attachment/${attId}`);
      setAttachments((prev) => prev.filter((a) => a.id !== attId));
      setUploadSuccess("Fichier supprimé.");
      setTimeout(() => setUploadSuccess(null), 3000);
    } catch {
      setUploadError("Erreur lors de la suppression.");
    } finally {
      setDeletingId(null);
    }
  }, []);

  const handleDragOver  = useCallback((e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); }, []);
  const handleDragLeave = useCallback(() => setIsDragging(false), []);
  const handleDrop      = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    uploadFiles(e.dataTransfer.files);
  }, [uploadFiles]);

  // ══════════════════════════════════════════
  //  RETURN CONDITIONNEL — après tous les hooks
  // ══════════════════════════════════════════
  if (!isOpen) return null;

  const status   = getStatusInfo(ticket.state);
  const catColor = getCategoryColor(ticket.category);
  const canEdit  = status.dotClass === "new"; // bouton crayon visible uniquement si ticket "Nouveau"

  // ─── Render ───
  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div
        className="modal-content overflow-hidden flex flex-col"
        style={{ maxHeight: "92vh", maxWidth: "600px" }}
        onClick={(e) => e.stopPropagation()}
      >

        {/* ══ HEADER ══ */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[hsl(var(--border))] bg-[hsl(var(--background)/0.5)] flex-shrink-0">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ background: `${catColor}14`, color: catColor }}
            >
              {getCategoryIcon(ticket.category)}
            </div>
            <div>
              <h2 className="text-lg font-bold leading-tight">Détails du ticket</h2>
              <div className="flex items-center gap-2 mt-0.5">
                <p className="text-xs text-[hsl(var(--muted-foreground))]">
                  Ticket #{ticket.id}
                </p>
                {/* Badge mode */}
                {isEditing && (
                  <span className="text-[0.6rem] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-md bg-[hsl(var(--primary)/0.12)] text-[hsl(var(--primary))] animate-fade-in">
                    Mode édition
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Bouton CRAYON — active le mode édition */}
            {!isEditing && canEdit && (
              <button
                onClick={() => setIsEditing(true)}
                className="flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-semibold text-[hsl(var(--primary))] hover:bg-[hsl(var(--primary)/0.1)] border border-[hsl(var(--primary)/0.2)] transition-all"
                title="Passer en mode édition"
              >
                <Edit2 size={13} />
                Modifier
              </button>
            )}
            {/* Bouton SUPPRIMER ticket — uniquement en lecture, si Nouveau */}
            {!isEditing && canEdit && (
              <button
                onClick={handleDelete}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-red-500 hover:bg-red-500/10 transition-colors"
                title="Supprimer le ticket"
              >
                <Trash2 size={15} />
              </button>
            )}
            {/* Fermer */}
            <button
              onClick={handleClose}
              disabled={isAnalyzing || isUploading}
              className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
                isAnalyzing || isUploading
                  ? "opacity-50 cursor-not-allowed text-[hsl(var(--muted-foreground))]"
                  : "hover:bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
              }`}
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* ══ CORPS SCROLLABLE ══ */}
        <form onSubmit={handleUpdate} className="flex-1 overflow-y-auto custom-scrollbar">
          <div className="p-6 space-y-6">

            {/* ── Titre ── */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))] mb-2">
                Sujet
              </label>
              {isEditing ? (
                <input
                  required
                  disabled={isAnalyzing}
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  className="input-field focus-ring disabled:opacity-50 text-base font-semibold animate-fade-in"
                />
              ) : (
                <h3 className="text-xl font-bold">{ticket.name}</h3>
              )}
            </div>

            {/* ── Description ── */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))] mb-2">
                Description
              </label>
              {isEditing ? (
                <div className="relative animate-fade-in">
                  <textarea
                    required
                    disabled={isAnalyzing}
                    value={editForm.description}
                    onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                    className="input-field focus-ring resize-none disabled:opacity-50 w-full"
                    style={{ height: "130px" }}
                  />
                  {isAnalyzing && (
                    <div className="absolute inset-0 bg-[hsl(var(--background)/0.8)] backdrop-blur-sm rounded-xl flex items-center justify-center gap-2">
                      <Loader2 size={18} className="text-[hsl(var(--primary))] animate-spin" />
                      <span className="text-xs font-semibold text-[hsl(var(--primary))] flex items-center gap-1">
                        <Sparkles size={11} /> Analyse IA...
                      </span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="whitespace-pre-wrap text-[hsl(var(--muted-foreground))] text-sm leading-relaxed bg-[hsl(var(--muted)/0.2)] p-4 rounded-xl border border-[hsl(var(--border)/0.5)]">
                  {ticket.description}
                </div>
              )}
            </div>

            {/* ── Statut + Priorité + Catégorie ── */}
            <div className="grid grid-cols-3 gap-3">
              <div className="p-3 rounded-xl border border-[hsl(var(--border)/0.5)] bg-[hsl(var(--card))]">
                <span className="block text-xs font-semibold mb-1.5 opacity-60">Statut</span>
                <div className="flex items-center gap-1.5">
                  <span className={`status-dot ${status.dotClass}`} />
                  <span className="text-sm font-semibold">{status.label}</span>
                </div>
              </div>
              <div className="p-3 rounded-xl border border-[hsl(var(--border)/0.5)] bg-[hsl(var(--card))]">
                <span className="block text-xs font-semibold mb-1.5 opacity-60">Priorité</span>
                {getPriorityBadge(ticket.priority)}
              </div>
              <div className="p-3 rounded-xl border border-[hsl(var(--border)/0.5)] bg-[hsl(var(--card))]">
                <span className="block text-xs font-semibold mb-1.5 opacity-60">Catégorie IA</span>
                <span className="text-sm font-semibold truncate block" style={{ color: catColor }}>
                  {ticket.category || "Non classé"}
                </span>
              </div>
            </div>

            {/* ══════════════════════════════════════
                SECTION PIÈCES JOINTES
                Comportement conditionnel selon isEditing
            ══════════════════════════════════════ */}
            <div className="space-y-3">

              {/* En-tête section */}
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))] flex items-center gap-2">
                  <Paperclip size={13} />
                  Pièces jointes
                  {!attachLoading && (
                    <span className="normal-case font-normal bg-[hsl(var(--muted))] px-2 py-0.5 rounded-full text-[0.65rem]">
                      {attachments.length}/{MAX_FILES}
                    </span>
                  )}
                </h4>
                {/* Indication de mode */}
                {!isEditing && (
                  <span className="text-[0.65rem] text-[hsl(var(--muted-foreground))] flex items-center gap-1 italic">
                    Lecture seule
                  </span>
                )}
              </div>

              {/* ── ZONE UPLOAD — visible uniquement en mode Édition ── */}
              {isEditing && attachments.length < MAX_FILES && (
                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={() => !isUploading && fileInputRef.current?.click()}
                  className={`
                    border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-all duration-200 animate-fade-in
                    ${isDragging
                      ? "border-[hsl(var(--primary))] bg-[hsl(var(--primary)/0.08)] scale-[1.01]"
                      : "border-[hsl(var(--border))] hover:border-[hsl(var(--primary)/0.4)] hover:bg-[hsl(var(--muted)/0.3)]"
                    }
                    ${isUploading ? "pointer-events-none opacity-60" : ""}
                  `}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    className="hidden"
                    accept={ALLOWED_TYPES.join(",")}
                    onChange={(e) => e.target.files && uploadFiles(e.target.files)}
                  />
                  <div className="flex items-center justify-center gap-3">
                    {isUploading
                      ? <Loader2 size={20} className="text-[hsl(var(--primary))] animate-spin" />
                      : <Upload size={18} className={isDragging ? "text-[hsl(var(--primary))]" : "text-[hsl(var(--muted-foreground))]"} />
                    }
                    <div className="text-left">
                      <p className="text-sm font-semibold">
                        {isUploading ? "Upload en cours..." : isDragging ? "Déposez ici" : "Ajouter des fichiers"}
                      </p>
                      <p className="text-xs text-[hsl(var(--muted-foreground))]">
                        Images, PDF, Word, Excel, TXT, ZIP — max 10 Mo
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Feedback upload */}
              {uploadError && (
                <div className="flex items-center gap-2 p-2.5 rounded-lg bg-red-500/10 text-red-500 text-xs font-medium animate-fade-in">
                  <AlertCircle size={14} /> {uploadError}
                </div>
              )}
              {uploadSuccess && (
                <div className="flex items-center gap-2 p-2.5 rounded-lg bg-green-500/10 text-green-500 text-xs font-medium animate-fade-in">
                  <CheckCircle2 size={14} /> {uploadSuccess}
                </div>
              )}

              {/* ── LISTE DES FICHIERS — toujours visible ── */}
              {attachLoading ? (
                <div className="flex items-center justify-center py-6">
                  <Loader2 size={20} className="text-[hsl(var(--muted-foreground))] animate-spin" />
                </div>
              ) : attachments.length === 0 ? (
                <div className="text-center py-5 text-[hsl(var(--muted-foreground))] text-xs border border-dashed border-[hsl(var(--border))] rounded-xl">
                  {isEditing
                    ? "Utilisez la zone ci-dessus pour ajouter des fichiers."
                    : "Aucune pièce jointe pour ce ticket."
                  }
                </div>
              ) : (
                <div className="space-y-2">
                  {attachments.map((att) => (
                    <div
                      key={att.id}
                      className={`
                        flex items-center gap-3 p-3 rounded-xl border transition-colors
                        ${isEditing
                          ? "border-[hsl(var(--primary)/0.15)] bg-[hsl(var(--primary)/0.03)] hover:border-[hsl(var(--primary)/0.3)]"
                          : "border-[hsl(var(--border))] bg-[hsl(var(--card))] hover:bg-[hsl(var(--muted)/0.2)]"
                        }
                      `}
                    >
                      {/* Miniature ou icône */}
                      <div className="w-10 h-10 flex-shrink-0 rounded-lg overflow-hidden bg-[hsl(var(--muted))] flex items-center justify-center border border-[hsl(var(--border)/0.5)]">
                        {isImageMime(att.mimetype) ? (
                          <img
                            src={`${FLASK_BASE}${att.url}`}
                            alt={att.name}
                            className="w-full h-full object-cover"
                            onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                          />
                        ) : (
                          getFileIcon(att.mimetype, 18)
                        )}
                      </div>

                      {/* Infos */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold truncate">{att.name}</p>
                        <p className="text-xs text-[hsl(var(--muted-foreground))]">
                          {formatBytes(att.file_size)}
                          {att.create_date && ` · ${formatDate(att.create_date)}`}
                        </p>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-1 flex-shrink-0">
                        {/* Télécharger — toujours visible */}
                        <a
                          href={`${FLASK_BASE}${att.url}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="w-7 h-7 rounded-md flex items-center justify-center text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--primary))] hover:bg-[hsl(var(--primary)/0.1)] transition-colors"
                          title="Télécharger"
                        >
                          <Download size={14} />
                        </a>

                        {/* Supprimer fichier — visible UNIQUEMENT en mode Édition */}
                        {isEditing && (
                          <button
                            type="button"
                            onClick={() => handleDeleteAttachment(att.id)}
                            disabled={deletingId === att.id}
                            className="w-7 h-7 rounded-md flex items-center justify-center text-[hsl(var(--muted-foreground))] hover:text-red-500 hover:bg-red-500/10 disabled:opacity-40 transition-colors animate-fade-in"
                            title="Supprimer ce fichier"
                          >
                            {deletingId === att.id
                              ? <Loader2 size={13} className="animate-spin" />
                              : <Trash2 size={13} />
                            }
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* ── Info IA en mode édition ── */}
            {isEditing && (
              <div className="flex items-start gap-2.5 p-3 rounded-xl bg-[hsl(var(--primary)/0.05)] border border-[hsl(var(--primary)/0.1)] animate-fade-in">
                <Sparkles size={14} className="text-[hsl(var(--primary))] flex-shrink-0 mt-0.5" />
                <p className="text-xs text-[hsl(var(--primary))] leading-relaxed">
                  À l&apos;enregistrement, la <strong>catégorie</strong> et la <strong>priorité</strong> seront
                  automatiquement réévaluées par l&apos;IA selon la nouvelle description.
                </p>
              </div>
            )}

            {/* ── Boutons Annuler / Enregistrer — visibles uniquement en mode Édition ── */}
            {isEditing && (
              <div className="flex justify-end gap-2 pt-1 animate-fade-in">
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  disabled={isAnalyzing}
                  className="btn-ghost disabled:opacity-50 flex items-center gap-1.5"
                >
                  <XCircle size={15} />
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isAnalyzing}
                  className="btn-primary disabled:opacity-50 min-w-[150px]"
                >
                  {isAnalyzing
                    ? <><Loader2 size={15} className="animate-spin" /> Analyse IA...</>
                    : <><Save size={15} /> Enregistrer</>
                  }
                </button>
              </div>
            )}

          </div>
        </form>
      </div>
    </div>
  );
}
