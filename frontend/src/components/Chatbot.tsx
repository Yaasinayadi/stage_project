"use client";

import { useState, useRef, useEffect } from "react";
import { MessageCircle, X, Send, Bot, User } from "lucide-react";
import axios from "axios";

type Message = { sender: "user" | "bot"; text: string };

export default function Chatbot() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { sender: "bot", text: "Bonjour ! 👋 Je suis l'assistant IA du support IT. Comment puis-je vous aider aujourd'hui ?" }
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Générer un ID de session unique pour la mémoire de conversation
  const [sessionId] = useState(() => `session_${Date.now()}_${Math.random().toString(36).slice(2)}`);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;
    const userMessage = input;
    setMessages(prev => [...prev, { sender: "user", text: userMessage }]);
    setInput("");
    setIsLoading(true);

    try {
      const res = await axios.post("http://localhost:8000/chat", {
        user_message: userMessage,
        session_id: sessionId,
      });
      setMessages(prev => [...prev, { sender: "bot", text: res.data.bot_reply }]);
    } catch (error) {
      setMessages(prev => [...prev, { sender: "bot", text: "⚠️ Erreur de connexion au service IA. Veuillez réessayer." }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      {/* Bouton flottant */}
      <button
        onClick={() => setIsOpen(true)}
        className={`fixed bottom-6 right-6 p-4 rounded-full shadow-xl transition-all transform hover:scale-110 z-50 ${isOpen ? "hidden" : "flex"}`}
        style={{ background: "linear-gradient(135deg, #3b82f6, #8b5cf6)" }}
      >
        <MessageCircle size={28} className="text-white" />
      </button>

      {/* Fenêtre du Chatbot */}
      {isOpen && (
        <div className="fixed bottom-6 right-6 w-[380px] h-[520px] rounded-2xl shadow-2xl flex flex-col overflow-hidden z-50 border"
          style={{ background: "var(--chatbot-bg, hsl(var(--card)))" }}
        >
          {/* Header */}
          <div className="flex justify-between items-center p-4 text-white"
            style={{ background: "linear-gradient(135deg, #3b82f6, #8b5cf6)" }}
          >
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white/20 rounded-lg">
                <Bot size={20} />
              </div>
              <div>
                <h3 className="font-semibold text-sm">Assistant IA Support</h3>
                <p className="text-xs opacity-80">En ligne • Propulsé par GPT-4o</p>
              </div>
            </div>
            <button onClick={() => setIsOpen(false)} className="hover:bg-white/20 p-1 rounded-lg transition-colors">
              <X size={20} />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 p-4 overflow-y-auto flex flex-col gap-3" style={{ background: "hsl(var(--muted) / 0.3)" }}>
            {messages.map((msg, idx) => (
              <div key={idx} className={`flex gap-2 ${msg.sender === "user" ? "flex-row-reverse" : "flex-row"}`}>
                <div className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-white text-xs ${msg.sender === "user" ? "bg-blue-500" : "bg-purple-500"}`}>
                  {msg.sender === "user" ? <User size={14} /> : <Bot size={14} />}
                </div>
                <div className={`max-w-[75%] p-3 rounded-2xl text-sm leading-relaxed ${
                  msg.sender === "user"
                    ? "bg-blue-500 text-white rounded-br-sm"
                    : "rounded-bl-sm border"
                }`}
                  style={msg.sender === "bot" ? { background: "hsl(var(--card))", color: "hsl(var(--foreground))" } : {}}
                >
                  {msg.text}
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex gap-2">
                <div className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-white text-xs bg-purple-500">
                  <Bot size={14} />
                </div>
                <div className="p-3 rounded-2xl rounded-bl-sm border text-sm" style={{ background: "hsl(var(--card))" }}>
                  <span className="flex gap-1">
                    <span className="w-2 h-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: "0ms" }}></span>
                    <span className="w-2 h-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: "150ms" }}></span>
                    <span className="w-2 h-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: "300ms" }}></span>
                  </span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="p-3 border-t" style={{ background: "hsl(var(--background))" }}>
            <form onSubmit={(e) => { e.preventDefault(); sendMessage(); }} className="flex gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Décrivez votre problème..."
                disabled={isLoading}
                className="flex-1 px-4 py-2.5 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm border"
                style={{ background: "hsl(var(--muted))", color: "hsl(var(--foreground))" }}
              />
              <button
                type="submit"
                className="p-2.5 text-white rounded-xl transition-all hover:scale-105 disabled:opacity-50"
                style={{ background: "linear-gradient(135deg, #3b82f6, #8b5cf6)" }}
                disabled={!input.trim() || isLoading}
              >
                <Send size={16} />
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
