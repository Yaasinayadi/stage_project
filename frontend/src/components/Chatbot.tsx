"use client";

import { useState, useRef, useEffect } from "react";
import {
  MessageCircle,
  X,
  Send,
  Bot,
  User,
  Sparkles,
  AlertTriangle,
  FileText,
  Clock,
  Zap,
  CheckCircle2,
  LayoutGrid,
  Sidebar,
  Maximize2,
  History,
  PlusCircle,
  MoreHorizontal,
  Pin,
  Check,
  Trash2,
} from "lucide-react";
import axios from "axios";
import { useAuth } from "@/lib/auth";
import { ODOO_URL } from "@/lib/config";
import TicketDetailsModal from "./TicketDetailsModal";

type Message = {
  sender: "user" | "bot";
  text: React.ReactNode;
  ticketId?: string | null;
};
type ViewMode = "floating" | "sidebar" | "fullscreen";
type ChatSession = {
  id: number;
  session_id: string;
  title: string;
  is_pinned?: boolean;
  date: string;
  messages: Message[];
};

type ChatbotProps = {
  defaultOpen?: boolean;
  onClose?: () => void;
};

export default function Chatbot({
  defaultOpen = false,
  onClose,
}: ChatbotProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [viewMode, setViewMode] = useState<ViewMode>("floating");
  const [isMinimized, setIsMinimized] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  const [sessionId, setSessionId] = useState<string>(
    `session_${Date.now()}_${Math.random().toString(36).slice(2)}`,
  );
  const [historySessions, setHistorySessions] = useState<ChatSession[]>([]);

  const [messages, setMessages] = useState<Message[]>([
    {
      sender: "bot",
      text: "Bonjour ! Je suis l'assistant IA du support IT. Comment puis-je vous aider aujourd'hui ?",
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // ── History Management State ──
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editTitleValue, setEditTitleValue] = useState("");

  const { user } = useAuth();
  const [userTickets, setUserTickets] = useState<any[]>([]);
  const [rawUserTickets, setRawUserTickets] = useState<any[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<{
    data: any;
    viewType: "live" | "report";
  } | null>(null);

  // ── Keyboard Shortcuts ──
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setIsOpen((prev) => {
          if (!prev) setIsMinimized(false);
          return !prev;
        });
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // ── Scroll to bottom ──
  useEffect(() => {
    if (!isMinimized) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isMinimized, viewMode]);

  // ── Listen for global toggle ──
  useEffect(() => {
    const handleToggle = (e: any) => {
      if (e.detail?.open !== undefined) {
        setIsOpen(e.detail.open);
        if (e.detail.open) setIsMinimized(false);
      }
    };
    window.addEventListener("toggle-chatbot", handleToggle);
    return () => window.removeEventListener("toggle-chatbot", handleToggle);
  }, []);

  // ── Fetch Tickets & Chat History ──
  useEffect(() => {
    if (user) {
      // Tickets
      axios
        .get(`${ODOO_URL}/api/tickets?user_id=${user.id}`)
        .then((res) => {
          if (res.data.status === 200) {
            setRawUserTickets(res.data.data);
            setUserTickets(
              res.data.data.map((t: any) => ({
                reference: `TK-${String(t.id).padStart(4, "0")}`,
                sujet: t.name,
                statut: t.state,
                assigne_a: t.assigned_to || "Non assigné",
                categorie: t.category,
                priorite: t.priority,
              })),
            );
          }
        })
        .catch(console.error);

      // History
      fetchHistory();
    }
  }, [user]);

  const fetchHistory = async () => {
    if (!user) return;
    try {
      const res = await axios.get(
        `${ODOO_URL}/api/chat/history?user_id=${user.id}`,
      );
      if (res.data.status === "success") {
        setHistorySessions(res.data.data);
      }
    } catch (e) {
      console.error("Erreur récupération historique", e);
    }
  };

  // ── Save Session to Odoo ──
  const saveSession = async (updatedMessages: Message[]) => {
    if (!user) return;
    try {
      // Find the first user message for the title
      const firstUserMsg = updatedMessages.find(
        (m) => m.sender === "user",
      )?.text;
      const title =
        typeof firstUserMsg === "string"
          ? firstUserMsg.slice(0, 40) + "..."
          : "Nouvelle discussion";

      await axios.post(`${ODOO_URL}/api/chat/history`, {
        user_id: user.id,
        session_id: sessionId,
        title,
        messages: updatedMessages,
      });
      fetchHistory(); // Refresh history list
    } catch (e) {
      console.error("Erreur sauvegarde session", e);
    }
  };

  const startNewSession = () => {
    setSessionId(
      `session_${Date.now()}_${Math.random().toString(36).slice(2)}`,
    );
    setMessages([
      {
        sender: "bot",
        text: "Bonjour ! Je suis l'assistant IA du support IT. Comment puis-je vous aider aujourd'hui ?",
      },
    ]);
    setShowHistory(false);
  };

  const loadSession = (session: ChatSession) => {
    setSessionId(session.session_id);
    setMessages(
      session.messages.length > 0
        ? session.messages
        : [
            {
              sender: "bot",
              text: "Bonjour ! Je suis l'assistant IA du support IT. Comment puis-je vous aider aujourd'hui ?",
            },
          ],
    );
    setShowHistory(false);
  };

  const handleHistoryAction = async (
    targetSessionId: string,
    action: "pin" | "rename" | "delete",
    newTitle?: string,
  ) => {
    if (!user) return;
    try {
      await axios.post(`${ODOO_URL}/api/chat/history/action`, {
        user_id: user.id,
        session_id: targetSessionId,
        action,
        title: newTitle,
      });
      fetchHistory();
      if (action === "delete" && targetSessionId === sessionId) {
        startNewSession();
      }
      setActiveMenu(null);
      setEditingSessionId(null);
    } catch (e) {
      console.error("Erreur action historique", e);
    }
  };

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;
    const userMessage = input;
    const newMessages: Message[] = [
      ...messages,
      { sender: "user", text: userMessage },
    ];
    setMessages(newMessages);
    setInput("");
    setIsLoading(true);

    try {
      const iaUrl = `http://${window.location.hostname}:8000/chat`;
      const res = await axios.post(iaUrl, {
        user_message: userMessage,
        session_id: sessionId,
        user_tickets: userTickets,
        user_name: user?.name || "Utilisateur",
      });
      const botText = res.data.text || res.data.bot_reply || "";
      const ticketId = res.data.ticket_id || null;

      const updatedMessages: Message[] = [
        ...newMessages,
        { sender: "bot", text: botText, ticketId },
      ];
      setMessages(updatedMessages);
      saveSession(updatedMessages);
    } catch {
      const updatedMessages: Message[] = [
        ...newMessages,
        {
          sender: "bot",
          text: (
            <>
              <AlertTriangle size={14} className="inline mr-1" /> Erreur de
              connexion au service IA. Veuillez réessayer.
            </>
          ),
        },
      ];
      setMessages(updatedMessages);
    } finally {
      setIsLoading(false);
    }
  };

  // ── Render Helpers ──
  const renderMessageWithCards = (text: React.ReactNode) => {
    if (typeof text !== "string") return text;

    const regex = /\[SHOW_TICKETS:\s*([^\]]+)\]/g;
    const parts = [];
    let lastIndex = 0;
    let match;

    while ((match = regex.exec(text)) !== null) {
      if (match.index > lastIndex)
        parts.push(
          <span key={`text-${lastIndex}`}>
            {text.slice(lastIndex, match.index)}
          </span>,
        );

      const refs = match[1].split(",").map((r) => r.trim());
      const matchedTickets = rawUserTickets.filter((t) =>
        refs.includes(`TK-${String(t.id).padStart(4, "0")}`),
      );

      if (matchedTickets.length > 0) {
        parts.push(
          <div
            key={`cards-${match.index}`}
            className="my-3 flex gap-3 overflow-x-auto snap-x custom-scrollbar pb-2"
          >
            {matchedTickets.map((t) => {
              const tRef = `TK-${String(t.id).padStart(4, "0")}`;
              let badgeBg = "bg-zinc-800 text-zinc-300 border-zinc-700";
              let translatedStatus = t.state;

              if (t.state === "new" || t.state === "nouveau") {
                translatedStatus = "Nouveau";
                badgeBg = "bg-blue-500/10 text-blue-400 border-blue-500/20";
              } else if (t.state === "in_progress" || t.state === "cours") {
                translatedStatus = "En cours";
                badgeBg = "bg-amber-500/10 text-amber-400 border-amber-500/20";
              } else if (t.state === "waiting_material") {
                translatedStatus = "Attente matériel";
                badgeBg =
                  "bg-purple-500/10 text-purple-400 border-purple-500/20";
              } else if (
                ["done", "resolved", "closed", "résolu"].includes(t.state)
              ) {
                translatedStatus = "Résolu";
                badgeBg =
                  "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
              }

              return (
                <div
                  key={t.id}
                  className="min-w-[240px] snap-center bg-zinc-900/50 border border-zinc-800 rounded-xl p-3 flex flex-col gap-2"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono font-bold text-zinc-300">
                      {tRef}
                    </span>
                    <span
                      className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${badgeBg}`}
                    >
                      {translatedStatus}
                    </span>
                  </div>
                  <h4 className="font-bold text-sm text-zinc-100 line-clamp-1">
                    {t.name}
                  </h4>
                  <div className="flex items-center gap-2 mt-auto pt-2 border-t border-zinc-800/50">
                    {t.assigned_to ? (
                      <div className="flex items-center gap-1.5 text-xs text-zinc-400">
                        <div className="w-5 h-5 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center font-bold text-[10px]">
                          {t.assigned_to.charAt(0).toUpperCase()}
                        </div>
                        <span className="truncate max-w-[80px]">
                          {t.assigned_to}
                        </span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 text-xs text-zinc-500 italic">
                        <User size={12} /> Non assigné
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col gap-1.5 mt-2">
                    <button
                      onClick={() =>
                        setSelectedTicket({ data: t, viewType: "live" })
                      }
                      className="w-full py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold rounded-lg border border-zinc-700 transition-colors"
                    >
                      Voir les détails
                    </button>
                    {["done", "resolved", "closed", "résolu"].includes(
                      t.state,
                    ) && (
                      <button
                        onClick={() =>
                          setSelectedTicket({ data: t, viewType: "report" })
                        }
                        className="w-full py-1.5 bg-[hsl(var(--primary)/0.15)] hover:bg-[hsl(var(--primary)/0.25)] text-[hsl(var(--primary))] text-xs font-semibold rounded-lg border border-[hsl(var(--primary)/0.3)] transition-colors flex items-center justify-center gap-1.5"
                      >
                        <FileText size={12} /> Compte-rendu
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>,
        );
      }
      lastIndex = regex.lastIndex;
    }
    if (lastIndex < text.length)
      parts.push(<span key={`text-end`}>{text.slice(lastIndex)}</span>);
    return <>{parts}</>;
  };

  const renderSingleTicketCard = (ticketId: string) => {
    const numStr = ticketId.replace("TK-", "").replace(/^0+/, "");
    const ticket = rawUserTickets.find((t) => String(t.id) === numStr);
    if (!ticket) return null;

    const tRef = `TK-${String(ticket.id).padStart(4, "0")}`;
    const isResolved = ["done", "resolved", "closed", "résolu"].includes(
      ticket.state,
    );

    let statusLabel = ticket.state;
    let statusClass = "bg-zinc-800/60 text-zinc-300 border-zinc-700";
    let StatusIcon = Clock;

    if (ticket.state === "new") {
      statusLabel = "Nouveau";
      statusClass = "bg-blue-500/15 text-blue-400 border-blue-500/25";
      StatusIcon = Zap;
    } else if (ticket.state === "in_progress") {
      statusLabel = "En cours";
      statusClass = "bg-amber-500/15 text-amber-400 border-amber-500/25";
      StatusIcon = Clock;
    } else if (ticket.state === "waiting_material") {
      statusLabel = "Attente matériel";
      statusClass = "bg-purple-500/15 text-purple-400 border-purple-500/25";
      StatusIcon = Clock;
    } else if (isResolved) {
      statusLabel = "Résolu";
      statusClass = "bg-emerald-500/15 text-emerald-400 border-emerald-500/25";
      StatusIcon = CheckCircle2;
    }

    return (
      <div className="mt-3 rounded-xl border border-zinc-700/60 bg-zinc-950/40 backdrop-blur-sm overflow-hidden">
        <div className="flex items-center justify-between px-3 pt-3 pb-2 border-b border-zinc-800/60">
          <span className="font-mono text-xs font-bold text-zinc-300 tracking-wider">
            {tRef}
          </span>
          <div className="flex items-center gap-1.5">
            <span
              className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border ${statusClass}`}
            >
              <StatusIcon size={9} /> {statusLabel}
            </span>
          </div>
        </div>
        <div className="px-3 py-2.5">
          <p className="text-xs font-semibold text-zinc-100 line-clamp-2 leading-snug">
            {ticket.name}
          </p>
        </div>
        <div className="flex gap-2 px-3 pb-3">
          <button
            onClick={() =>
              setSelectedTicket({ data: ticket, viewType: "live" })
            }
            className="flex-1 py-1.5 text-[11px] font-semibold rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-200 transition-all flex items-center justify-center"
          >
            Voir les détails
          </button>
          {isResolved && (
            <button
              onClick={() =>
                setSelectedTicket({ data: ticket, viewType: "report" })
              }
              className="flex-1 py-1.5 text-[11px] font-semibold rounded-lg bg-[hsl(var(--primary)/0.12)] hover:bg-[hsl(var(--primary)/0.22)] border border-[hsl(var(--primary)/0.25)] text-[hsl(var(--primary))] transition-all flex items-center justify-center gap-1"
            >
              <FileText size={10} /> Compte-rendu
            </button>
          )}
        </div>
      </div>
    );
  };

  // ── Layout Classes based on viewMode ──
  let containerClasses = "";
  if (viewMode === "floating") {
    containerClasses = `fixed bottom-6 right-6 ${showHistory ? "w-[640px]" : "w-[380px]"} ${isMinimized ? "h-[60px]" : "h-[560px]"} rounded-2xl shadow-2xl transition-[width] duration-300`;
  } else if (viewMode === "sidebar") {
    containerClasses = `fixed top-0 right-0 h-full ${showHistory ? "w-full md:w-[660px]" : "w-full sm:w-[400px]"} border-l border-zinc-800/60 shadow-2xl md:rounded-l-2xl transition-[width] duration-300`;
  } else if (viewMode === "fullscreen") {
    containerClasses = `fixed inset-0 w-full h-full z-[9999] bg-zinc-950`;
  }

  return (
    <>
      {/* Floating Action Button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 w-14 h-14 rounded-2xl flex items-center justify-center z-[9998] transition-all duration-300 hover:scale-110 hover:shadow-xl active:scale-95 accent-gradient shadow-lg group"
          style={{ boxShadow: "0 8px 24px hsl(var(--primary) / 0.35)" }}
        >
          <MessageCircle size={22} className="text-white group-hover:hidden" />
          <div className="hidden group-hover:flex items-center gap-1 text-[10px] font-bold text-white tracking-widest">
            <span>CMD</span>
            <span>+</span>
            <span>K</span>
          </div>
        </button>
      )}

      {/* Chat Container */}
      {isOpen && (
        <div
          className={`z-[9999] flex flex-col overflow-hidden backdrop-blur-xl bg-zinc-950/80 border border-zinc-800/60 transition-all duration-300 ease-in-out ${containerClasses}`}
        >
          {/* Header */}
          <div className="flex justify-between items-center px-4 h-[60px] flex-shrink-0 border-b border-white/5 bg-white/5">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-[hsl(var(--primary)/0.2)] border border-[hsl(var(--primary)/0.3)] flex items-center justify-center">
                <Sparkles size={16} className="text-[hsl(var(--primary))]" />
              </div>
              <div className="flex flex-col">
                <h3 className="font-semibold text-sm text-zinc-100 flex items-center">
                  Assistant IA
                </h3>
                <div className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  <p className="text-[10px] text-zinc-400 font-medium">
                    En ligne
                  </p>
                </div>
              </div>
            </div>

            {/* Window Controls */}
            <div className="flex items-center gap-1">
              <div className="flex items-center gap-2 bg-zinc-800/50 p-1.5 rounded-lg">
                <button
                  onClick={() => setShowHistory(!showHistory)}
                  className={`w-7 h-7 rounded-md flex items-center justify-center transition-colors ${showHistory ? "bg-white/10 text-white shadow-sm" : "text-zinc-400 hover:text-white hover:bg-zinc-700/50"}`}
                  title="Historique"
                >
                  <History size={14} />
                </button>
                <div className="w-[1px] h-4 bg-zinc-700 mx-1" />
                <button
                  onClick={() => {
                    setViewMode("floating");
                    setIsMinimized(false);
                  }}
                  className={`w-7 h-7 rounded-md flex items-center justify-center transition-colors ${viewMode === "floating" && !isMinimized ? "bg-white/10 text-white shadow-sm" : "text-zinc-400 hover:text-white hover:bg-zinc-700/50"}`}
                  title="Mode Compact"
                >
                  <LayoutGrid size={14} />
                </button>
                <button
                  onClick={() => {
                    setViewMode("sidebar");
                    setIsMinimized(false);
                  }}
                  className={`w-7 h-7 rounded-md flex items-center justify-center transition-colors ${viewMode === "sidebar" && !isMinimized ? "bg-white/10 text-white shadow-sm" : "text-zinc-400 hover:text-white hover:bg-zinc-700/50"}`}
                  title="Mode Panneau Latéral"
                >
                  <Sidebar size={14} />
                </button>
                <button
                  onClick={() => {
                    setViewMode("fullscreen");
                    setIsMinimized(false);
                  }}
                  className={`w-7 h-7 rounded-md flex items-center justify-center transition-colors ${viewMode === "fullscreen" && !isMinimized ? "bg-white/10 text-white shadow-sm" : "text-zinc-400 hover:text-white hover:bg-zinc-700/50"}`}
                  title="Mode Plein Écran"
                >
                  <Maximize2 size={14} />
                </button>
              </div>

              <div className="w-[1px] h-4 bg-zinc-700 mx-1" />

              <button
                onClick={() => {
                  setIsOpen(false);
                  onClose?.();
                }}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-zinc-400 hover:text-white hover:bg-zinc-700/50 transition-colors"
                title="Fermer"
              >
                <X size={16} />
              </button>
            </div>
          </div>

          {/* Main Content Area (History Drawer + Chat) */}
          {!isMinimized && (
            <div className="flex-1 flex overflow-hidden relative">
              {/* History Drawer */}
              <div
                className={`
                  h-full w-[260px] flex-shrink-0 bg-zinc-950/95 border-r border-zinc-800/50 flex flex-col transition-all duration-300 ease-in-out
                  relative z-10
                  ${showHistory ? "translate-x-0 ml-0" : "-translate-x-full -ml-[260px]"}
                `}
              >
                <div className="p-4 border-b border-zinc-800/50 flex justify-center">
                  <button
                    onClick={startNewSession}
                    className="w-auto inline-flex items-center justify-center gap-2 py-1.5 px-4 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-100 font-medium text-xs transition-all border border-zinc-700 shadow-sm"
                  >
                    <PlusCircle size={14} /> Nouvelle discussion
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto p-2 custom-scrollbar">
                  {/* Pinned & Recent Split */}
                  {(() => {
                    const pinnedChats = historySessions.filter(
                      (s) => s.is_pinned,
                    );
                    const recentChats = historySessions.filter(
                      (s) => !s.is_pinned,
                    );

                    const renderSessionItem = (session: ChatSession) => {
                      const isEditing = editingSessionId === session.session_id;
                      return (
                        <div key={session.id} className="relative group">
                          {isEditing ? (
                            <div className="w-full px-2 py-1.5 rounded-lg bg-zinc-900 border border-zinc-700 flex items-center gap-2">
                              <input
                                autoFocus
                                type="text"
                                value={editTitleValue}
                                onChange={(e) =>
                                  setEditTitleValue(e.target.value)
                                }
                                onKeyDown={(e) => {
                                  if (e.key === "Enter")
                                    handleHistoryAction(
                                      session.session_id,
                                      "rename",
                                      editTitleValue,
                                    );
                                  if (e.key === "Escape")
                                    setEditingSessionId(null);
                                }}
                                className="flex-1 bg-transparent text-xs text-white outline-none"
                              />
                              <button
                                onClick={() =>
                                  handleHistoryAction(
                                    session.session_id,
                                    "rename",
                                    editTitleValue,
                                  )
                                }
                                className="text-emerald-500 hover:text-emerald-400"
                              >
                                <Check size={14} />
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => loadSession(session)}
                              className={`w-full text-left px-3 py-2.5 rounded-lg text-xs transition-all flex flex-col gap-1 pr-8 ${session.session_id === sessionId ? "bg-zinc-800 text-zinc-100" : "text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200"}`}
                            >
                              <div className="flex items-center justify-between">
                                <span className="font-medium truncate flex-1">
                                  {session.title}
                                </span>
                              </div>
                              <span className="text-[9px] opacity-60 font-mono">
                                {new Date(session.date).toLocaleDateString()}
                              </span>
                            </button>
                          )}

                          {!isEditing && (
                            <div
                              className={`absolute right-2 top-2.5 ${activeMenu === session.session_id || session.session_id === sessionId ? "block" : "hidden group-hover:block"}`}
                            >
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setActiveMenu(
                                    activeMenu === session.session_id
                                      ? null
                                      : session.session_id,
                                  );
                                }}
                                className={`p-0.5 rounded transition-colors ${session.session_id === sessionId ? "text-zinc-300 hover:text-white hover:bg-zinc-700" : "text-zinc-400 hover:text-white hover:bg-zinc-700"}`}
                              >
                                <MoreHorizontal size={14} />
                              </button>

                              {activeMenu === session.session_id && (
                                <div className="absolute right-0 top-full mt-1 w-32 bg-zinc-900 border border-zinc-800 rounded-lg shadow-xl overflow-hidden z-50">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleHistoryAction(
                                        session.session_id,
                                        "pin",
                                      );
                                    }}
                                    className="w-full text-left px-3 py-2 text-[10px] font-medium text-zinc-300 hover:bg-zinc-800 hover:text-white flex items-center justify-between"
                                  >
                                    {session.is_pinned
                                      ? "Désépingler"
                                      : "Épingler"}{" "}
                                    <Pin size={10} className="rotate-45" />
                                  </button>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setEditingSessionId(session.session_id);
                                      setEditTitleValue(session.title);
                                      setActiveMenu(null);
                                    }}
                                    className="w-full text-left px-3 py-2 text-[10px] font-medium text-zinc-300 hover:bg-zinc-800 hover:text-white"
                                  >
                                    Renommer
                                  </button>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleHistoryAction(
                                        session.session_id,
                                        "delete",
                                      );
                                    }}
                                    className="w-full text-left px-3 py-2 text-[10px] font-medium text-rose-500 hover:bg-zinc-800 flex items-center justify-between border-t border-zinc-800/50"
                                  >
                                    Supprimer <Trash2 size={12} />
                                  </button>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    };

                    return (
                      <>
                        {pinnedChats.length > 0 && (
                          <div className="mb-4">
                            <h4 className="text-[10px] uppercase font-bold text-zinc-500 mb-2 px-2 tracking-wider flex items-center gap-1.5">
                              <Pin size={10} className="rotate-45" /> Épinglés
                            </h4>
                            <div className="flex flex-col gap-1">
                              {pinnedChats.map(renderSessionItem)}
                            </div>
                          </div>
                        )}

                        <div>
                          <h4 className="text-[10px] uppercase font-bold text-zinc-500 mb-2 px-2 tracking-wider">
                            Récentes
                          </h4>
                          <div className="flex flex-col gap-1">
                            {recentChats.map(renderSessionItem)}
                            {recentChats.length === 0 && (
                              <div className="text-center text-zinc-500 text-xs py-6">
                                Aucun historique
                              </div>
                            )}
                          </div>
                        </div>
                      </>
                    );
                  })()}
                </div>
              </div>

              {/* Chat Messages */}
              <div className="flex-1 flex flex-col bg-zinc-950/40 overflow-hidden relative z-0">
                <div className="flex-1 p-4 overflow-y-auto flex flex-col gap-4 custom-scrollbar">
                  {messages.map((msg, idx) => (
                    <div
                      key={idx}
                      className={`flex gap-3 animate-fade-in ${msg.sender === "user" ? "flex-row-reverse" : "flex-row"}`}
                      style={{ animationDelay: `${idx * 50}ms` }}
                    >
                      <div
                        className={`flex-shrink-0 w-8 h-8 rounded-xl flex items-center justify-center text-white text-xs shadow-sm ${msg.sender === "user" ? "bg-[hsl(var(--info))]" : "bg-[hsl(var(--primary)/0.8)] border border-[hsl(var(--primary))] backdrop-blur"}`}
                      >
                        {msg.sender === "user" ? (
                          <User size={14} />
                        ) : (
                          <Bot size={14} />
                        )}
                      </div>
                      <div
                        className={`max-w-[85%] px-4 py-3 text-sm leading-relaxed ${msg.sender === "user" ? "bg-[hsl(var(--info))] text-white rounded-2xl rounded-tr-sm shadow-md" : "bg-zinc-900/80 border border-zinc-800 text-zinc-200 rounded-2xl rounded-tl-sm shadow-md"}`}
                      >
                        {renderMessageWithCards(msg.text)}
                        {msg.sender === "bot" &&
                          msg.ticketId &&
                          renderSingleTicketCard(msg.ticketId)}
                      </div>
                    </div>
                  ))}

                  {isLoading && (
                    <div className="flex gap-3 animate-fade-in">
                      <div className="flex-shrink-0 w-8 h-8 rounded-xl flex items-center justify-center text-white text-xs bg-[hsl(var(--primary)/0.8)] border border-[hsl(var(--primary))] backdrop-blur">
                        <Bot size={14} />
                      </div>
                      <div className="px-5 py-4 rounded-2xl rounded-tl-sm bg-zinc-900/80 border border-zinc-800 flex items-center">
                        <span className="flex gap-1.5">
                          <span
                            className="w-1.5 h-1.5 rounded-full bg-zinc-500 animate-bounce"
                            style={{ animationDelay: "0ms" }}
                          />
                          <span
                            className="w-1.5 h-1.5 rounded-full bg-zinc-500 animate-bounce"
                            style={{ animationDelay: "150ms" }}
                          />
                          <span
                            className="w-1.5 h-1.5 rounded-full bg-zinc-500 animate-bounce"
                            style={{ animationDelay: "300ms" }}
                          />
                        </span>
                      </div>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>

                {/* Input Area */}
                <div className="p-3 bg-zinc-950 border-t border-zinc-800/80 relative">
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      sendMessage();
                    }}
                    className="flex gap-2 relative z-20"
                  >
                    <div className="flex-1 relative">
                      <input
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder="Posez votre question à l'IA..."
                        disabled={isLoading}
                        className="w-full h-11 pl-4 pr-12 rounded-xl bg-zinc-900 border border-zinc-800 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary)/0.5)] focus:border-transparent transition-all placeholder:text-zinc-600"
                        autoFocus
                      />
                    </div>
                    <button
                      type="submit"
                      className="w-11 h-11 rounded-xl flex items-center justify-center text-white bg-[hsl(var(--primary))] hover:bg-[hsl(var(--primary)/0.9)] transition-all disabled:opacity-40 flex-shrink-0 shadow-lg shadow-[hsl(var(--primary)/0.2)]"
                      disabled={!input.trim() || isLoading}
                    >
                      <Send
                        size={16}
                        className={input.trim() && !isLoading ? "ml-0.5" : ""}
                      />
                    </button>
                  </form>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {selectedTicket && (
        <TicketDetailsModal
          isOpen={!!selectedTicket}
          ticket={selectedTicket.data}
          viewType={selectedTicket.viewType}
          onClose={() => setSelectedTicket(null)}
        />
      )}
    </>
  );
}
