from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
import os
import json

from langchain_groq import ChatGroq
from langchain.schema import SystemMessage, HumanMessage, AIMessage

app = FastAPI(
    title="PFE IT Support - Service IA",
    description="Microservice d'Intelligence Artificielle pour la classification des tickets.",
    version="2.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─────────────────────────────────────────────
# API GROQ (LLaMA-3 70B) - Puissant et Gratuit !
# ─────────────────────────────────────────────
GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")

llm = None
if GROQ_API_KEY and GROQ_API_KEY != "your-groq-api-key-here":
    llm = ChatGroq(
        model="llama-3.3-70b-versatile",
        temperature=0.3,
        groq_api_key=GROQ_API_KEY
    )

chat_histories: dict[str, list] = {}

class TicketRequest(BaseModel):
    description: str

class TicketResponse(BaseModel):
    category: str
    priority: str
    confidence: float
    suggested_solution: str

class ChatRequest(BaseModel):
    user_message: str
    session_id: Optional[str] = "default"

class ChatResponse(BaseModel):
    bot_reply: str

CLASSIFY_SYSTEM_PROMPT = """Tu es un expert en support IT de niveau 3. 
Analyse et réponds UNIQUEMENT en JSON valide avec cette structure exacte :
{
  "category": "<Réseau, Logiciel, Matériel, Accès, Messagerie, Infrastructure, Autre>",
  "priority": "<0=Basse, 1=Moyenne, 2=Haute, 3=Critique>",
  "confidence": <0 à 100>,
  "suggested_solution": "<solution courte>"
}
Règles: pannes serveur = Critique (3). Accès mot de passe = Moyenne (1). Renvoie juste le JSON."""

@app.post("/classify_ticket", response_model=TicketResponse)
async def classify_ticket(ticket: TicketRequest):
    if not llm:
        return _mock_classify(ticket.description)
    try:
        messages = [SystemMessage(content=CLASSIFY_SYSTEM_PROMPT), HumanMessage(content=f"Ticket :\n{ticket.description}")]
        response = await llm.ainvoke(messages)
        content = response.content.strip()
        if content.startswith("```"): content = content.split("\n", 1)[1].rsplit("```", 1)[0].strip()
        data = json.loads(content)
        return TicketResponse(
            category=data.get("category", "Autre"),
            priority=str(data.get("priority", "1")),
            confidence=float(data.get("confidence", 75.0)),
            suggested_solution=data.get("suggested_solution", "Contactez le support.")
        )
    except Exception as e:
        print(f"Erreur LLM classification: {e}")
        return _mock_classify(ticket.description)

CHAT_SYSTEM_PROMPT = """Tu es un assistant virtuel de support IT intelligent. Tu aides l'utilisateur à diagnostiquer ses soucis réseau, accès, logiciel. Réponds poliment et en français."""

@app.post("/chat", response_model=ChatResponse)
async def chat_with_bot(chat: ChatRequest):
    session_id = chat.session_id or "default"
    if not llm:
        return _mock_chat(chat.user_message)
    try:
        if session_id not in chat_histories:
            chat_histories[session_id] = [SystemMessage(content=CHAT_SYSTEM_PROMPT)]
        history = chat_histories[session_id]
        history.append(HumanMessage(content=chat.user_message))
        if len(history) > 21:
            chat_histories[session_id] = [history[0]] + history[-20:]
            history = chat_histories[session_id]
        response = await llm.ainvoke(history)
        history.append(AIMessage(content=response.content))
        return ChatResponse(bot_reply=response.content)
    except Exception as e:
        print(f"Erreur LLM chat: {e}")
        return _mock_chat(chat.user_message)

def _mock_classify(description: str) -> TicketResponse:
    desc_lower = description.lower()
    cat, prio, sol, conf = "Logiciel", "1", "Veuillez redémarrer l'application.", 50.0
    if any(w in desc_lower for w in ["internet", "wifi", "réseau", "vpn", "connexion"]):
        cat, prio, sol, conf = "Réseau", "2", "Vérifiez le routeur.", 85.0
    elif any(w in desc_lower for w in ["accès", "mot de passe"]):
        cat, prio, sol, conf = "Accès", "1", "Changez votre mot de passe.", 90.0
    return TicketResponse(category=cat, priority=prio, confidence=conf, suggested_solution=sol)

def _mock_chat(user_message: str) -> ChatResponse:
    reply = "Simulation IA : Je comprends. Pouvez-vous détailler ?"
    if "bonjour" in user_message.lower(): reply = "Bonjour ! Je suis l'assistant IT simulé."
    return ChatResponse(bot_reply=reply)

@app.get("/")
def root():
    has_key = llm is not None
    return {
        "status": "running",
        "ai_mode": "Groq LLaMA-3" if has_key else "Mock (simulation)",
    }
