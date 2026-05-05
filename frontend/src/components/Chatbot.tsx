"use client";

import { useState, useRef, useEffect } from "react";
import { MessageCircle, X, Send, Bot, User, Sparkles, AlertTriangle } from "lucide-react";
import axios from "axios";
import { useAuth } from "@/lib/auth";
import { ODOO_URL } from "@/lib/config";

type Message = { sender: "user" | "bot"; text: React.ReactNode };

type ChatbotProps = {
  /** When true, open the panel immediately (controlled from outside) */
  defaultOpen?: boolean;
  /** Called when the user closes the panel in controlled mode */
  onClose?: () => void;
};

export default function Chatbot({ defaultOpen = false, onClose }: ChatbotProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [messages, setMessages] = useState<Message[]>([
    { sender: "bot", text: "Bonjour ! 👋 Je suis l'assistant IA du support IT. Comment puis-je vous aider aujourd'hui ?" }
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [sessionId] = useState(() => `session_${Date.now()}_${Math.random().toString(36).slice(2)}`);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Listen for global toggle events (to avoid multiple instances)
  useEffect(() => {
    const handleToggle = (e: any) => {
      if (e.detail?.open !== undefined) {
        setIsOpen(e.detail.open);
      }
    };
    window.addEventListener("toggle-chatbot", handleToggle);
    return () => window.removeEventListener("toggle-chatbot", handleToggle);
  }, []);

  const { user } = useAuth();

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;
    const userMessage = input;
    setMessages(prev => [...prev, { sender: "user", text: userMessage }]);
    setInput("");
    setIsLoading(true);

    try {
      let userTickets: any[] = [];
      if (user) {
        try {
          // Fetch only the connected user's tickets
          const ticketsRes = await axios.get(`${ODOO_URL}/api/tickets?user_id=${user.id}`);
          if (ticketsRes.data.status === 200) {
            userTickets = ticketsRes.data.data.map((t: any) => ({
              reference: `Ticket #${t.id}`,
              sujet: t.name,
              statut: t.state,
              assigne_a: t.assigned_to || "Non assigné",
              categorie: t.category,
              priorite: t.priority
            }));
          }
        } catch (e) {
          console.error("Erreur récupération tickets pour chatbot", e);
        }
      }

      const iaUrl = `http://${window.location.hostname}:8000/chat`;
      const res = await axios.post(iaUrl, {
        user_message: userMessage,
        session_id: sessionId,
        user_tickets: userTickets
      });
      setMessages(prev => [...prev, { sender: "bot", text: res.data.bot_reply }]);
    } catch {
      setMessages(prev => [...prev, { sender: "bot", text: <><AlertTriangle size={14} className="inline mr-1" /> Erreur de connexion au service IA. Veuillez réessayer.</> }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      {/* Floating Action Button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 w-14 h-14 rounded-2xl flex items-center justify-center z-[9998] transition-all duration-300 hover:scale-110 hover:shadow-xl active:scale-95 accent-gradient shadow-lg"
          style={{ boxShadow: "0 8px 24px hsl(var(--primary) / 0.35)" }}
          id="chatbot-toggle"
        >
          <MessageCircle size={22} className="text-white" />
        </button>
      )}

      {/* Chat Panel */}
      {isOpen && (
        <div
          className="fixed bottom-6 right-6 w-[380px] h-[520px] rounded-2xl flex flex-col overflow-hidden z-[9999] chatbot-panel animate-slide-up"
          id="chatbot-panel"
        >
          {/* Header */}
          <div className="flex justify-between items-center px-4 py-3 accent-gradient">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-white/15 backdrop-blur flex items-center justify-center">
                <Sparkles size={16} className="text-white" />
              </div>
              <div>
                <h3 className="font-semibold text-sm text-white">Assistant IA</h3>
                <div className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                  <p className="text-[0.65rem] text-white/70 font-medium">En ligne</p>
                </div>
              </div>
            </div>
            <button
              onClick={() => { setIsOpen(false); onClose?.(); }}
              className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-white/15 transition-colors text-white/80 hover:text-white"
            >
              <X size={18} />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 p-4 overflow-y-auto flex flex-col gap-3 bg-[hsl(var(--background))]">
            {messages.map((msg, idx) => (
              <div
                key={idx}
                className={`flex gap-2.5 animate-fade-in ${
                  msg.sender === "user" ? "flex-row-reverse" : "flex-row"
                }`}
                style={{ animationDelay: `${idx * 50}ms` }}
              >
                {/* Avatar */}
                <div
                  className={`flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center text-white text-xs ${
                    msg.sender === "user"
                      ? "bg-[hsl(var(--info))]"
                      : "accent-gradient"
                  }`}
                >
                  {msg.sender === "user" ? <User size={13} /> : <Bot size={13} />}
                </div>

                {/* Bubble */}
                <div
                  className={`max-w-[78%] px-3.5 py-2.5 text-sm leading-relaxed ${
                    msg.sender === "user"
                      ? "bg-[hsl(var(--info))] text-white rounded-2xl rounded-br-md"
                      : "bg-[hsl(var(--card))] border border-[hsl(var(--border))] text-[hsl(var(--foreground))] rounded-2xl rounded-bl-md"
                  }`}
                >
                  {msg.text}
                </div>
              </div>
            ))}

            {/* Loading dots */}
            {isLoading && (
              <div className="flex gap-2.5 animate-fade-in">
                <div className="flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center text-white text-xs accent-gradient">
                  <Bot size={13} />
                </div>
                <div className="px-4 py-3 rounded-2xl rounded-bl-md bg-[hsl(var(--card))] border border-[hsl(var(--border))]">
                  <span className="flex gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-[hsl(var(--muted-foreground))] animate-bounce" style={{ animationDelay: "0ms" }} />
                    <span className="w-1.5 h-1.5 rounded-full bg-[hsl(var(--muted-foreground))] animate-bounce" style={{ animationDelay: "150ms" }} />
                    <span className="w-1.5 h-1.5 rounded-full bg-[hsl(var(--muted-foreground))] animate-bounce" style={{ animationDelay: "300ms" }} />
                  </span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="p-3 border-t border-[hsl(var(--border))] bg-[hsl(var(--card))]">
            <form onSubmit={(e) => { e.preventDefault(); sendMessage(); }} className="flex gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Décrivez votre problème..."
                disabled={isLoading}
                className="input-field focus-ring flex-1 text-sm"
                id="chatbot-input"
              />
              <button
                type="submit"
                className="w-10 h-10 rounded-xl flex items-center justify-center text-white accent-gradient transition-all hover:scale-105 disabled:opacity-40 disabled:hover:scale-100 flex-shrink-0"
                disabled={!input.trim() || isLoading}
                id="chatbot-send"
              >
                <Send size={15} />
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
