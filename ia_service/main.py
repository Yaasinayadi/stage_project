from flask import Flask, request, jsonify
from flask_cors import CORS
import os
import json

from langchain_groq import ChatGroq
from langchain.schema import SystemMessage, HumanMessage, AIMessage
from dotenv import load_dotenv

# Charger les variables d'environnement depuis le dossier parent
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
load_dotenv(os.path.join(BASE_DIR, '..', '.env'))

app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}})

# ─────────────────────────────────────────────
# API GROQ (LLaMA-3 70B)
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

# ─────────────────────────────────────────────
# ROUTE : Classification IA
# ─────────────────────────────────────────────
CLASSIFY_SYSTEM_PROMPT = """Tu es un expert en support IT de niveau 3. 
Analyse et réponds UNIQUEMENT en JSON valide avec cette structure exacte :
{
  "category": "<Réseau, Logiciel, Matériel, Accès, Messagerie, Sécurité, Infrastructure, Autre>",
  "priority": "<0=Basse, 1=Moyenne, 2=Haute, 3=Critique>",
  "confidence": <0 à 100>,
  "suggested_solution": "<solution courte>"
}
Règles: pannes serveur = Critique (3). Accès mot de passe = Moyenne (1). Renvoie juste le JSON."""

@app.route("/classify_ticket", methods=["POST"])
def classify_ticket():
    data = request.get_json()
    if not data or "description" not in data:
        return jsonify({"error": "Le champ 'description' est requis."}), 400
        
    description = data["description"]
    
    if not llm:
        return jsonify(_mock_classify(description))
        
    try:
        messages = [SystemMessage(content=CLASSIFY_SYSTEM_PROMPT), HumanMessage(content=f"Ticket :\n{description}")]
        response = llm.invoke(messages)
        content = response.content.strip()
        print(f"DEBUG: Classification response content: {content}")
        if content.startswith("```"): 
            content = content.split("\n", 1)[1].rsplit("```", 1)[0].strip()
        
        parsed_data = json.loads(content)
        
        return jsonify({
            "category": parsed_data.get("category", "Autre"),
            "priority": str(parsed_data.get("priority", "1")),
            "confidence": float(parsed_data.get("confidence", 75.0)),
            "suggested_solution": parsed_data.get("suggested_solution", "Contactez le support.")
        })
    except Exception as e:
        print(f"Erreur LLM classification: {e}")
        return jsonify(_mock_classify(description))

# ─────────────────────────────────────────────
# ROUTE : Analyse IA Détaillée (Résumé + Procédure)
# ─────────────────────────────────────────────
ANALYZE_SYSTEM_PROMPT = """Tu es un expert en support informatique de niveau 3. Analyse le ticket suivant (Titre et Description) et fournis une réponse structurée en 3 parties :
1. Résumé du problème (en une phrase).
2. Causes probables (liste à puces des raisons techniques possibles).
3. Plan d'action suggéré (étapes précises pour résoudre le problème).
Réponds en français, de manière concise et professionnelle.

IMPORTANT: Tu dois UNIQUEMENT renvoyer un objet JSON valide avec cette structure exacte :
{
  "analysis_markdown": "<Ta réponse complète formatée en Markdown, incluant les 3 parties (utilises \\n pour les sauts de ligne)>",
  "kb_article_id": <un nombre entier au hasard entre 1 et 10 si un article KB fictif est pertinent, sinon null>
}
Ne rajoute aucun texte avant ou après le JSON."""

@app.route("/ai_analyze_detailed", methods=["POST"])
def ai_analyze_detailed():
    data = request.get_json()
    if not data or "description" not in data:
        return jsonify({"error": "Description requise."}), 400
        
    description = data["description"]
    
    if not llm:
        return jsonify({
            "analysis_markdown": "### 1. Résumé du problème\nAnalyse simulée : Le problème semble lié à un dysfonctionnement standard.\n\n### 2. Causes probables\n- Déconnexion réseau\n- Erreur de configuration\n\n### 3. Plan d'action suggéré\n1. Vérifier les câbles\n2. Redémarrer l'appareil\n3. Contacter le support",
            "kb_article_id": 1
        })
        
    try:
        messages = [SystemMessage(content=ANALYZE_SYSTEM_PROMPT), HumanMessage(content=f"Ticket :\n{description}")]
        response = llm.invoke(messages)
        content = response.content.strip()
        print(f"DEBUG: Detailed analysis response content: {content}")
        if content.startswith("```"): 
            content = content.split("\n", 1)[1].rsplit("```", 1)[0].strip()
        
        parsed_data = json.loads(content)
        return jsonify(parsed_data)
    except Exception as e:
        print(f"Erreur LLM analyse: {e}")
        return jsonify({
            "analysis_markdown": "### Erreur\nImpossible de générer un résumé automatique. Diagnostic manuel requis.",
            "kb_article_id": None
        })

# ─────────────────────────────────────────────
# ROUTE : Extraction de Mots-clés (Recherche KB)
# ─────────────────────────────────────────────
EXTRACT_KEYWORDS_PROMPT = """Tu es un expert en support informatique de niveau 3.
Analyse le ticket fourni et extrais exactement DEUX (2) mots-clés techniques les plus précis pour effectuer une recherche dans une base de connaissances.
Règle très importante : Chaque mot-clé doit être constitué d'UN SEUL MOT EXACT (pas de phrases, pas d'espaces).
Exemples de bons mots-clés : "BSOD", "VPN", "GlobalProtect", "Imprimante", "Certificat".
Tu dois UNIQUEMENT renvoyer un objet JSON valide avec cette structure exacte :
{
  "keywords": ["mot1", "mot2"]
}
Ne rajoute aucun texte avant ou après le JSON."""

@app.route("/extract_keywords", methods=["POST"])
def extract_keywords():
    data = request.get_json()
    if not data or "description" not in data:
        return jsonify({"error": "Description requise."}), 400
        
    description = data["description"]
    
    if not llm:
        import re
        words = re.findall(r'\b\w{4,}\b', description)
        fallback_keywords = words[:2] if len(words) >= 2 else (words + ["erreur"])[:2]
        return jsonify({"keywords": fallback_keywords})
        
    try:
        messages = [SystemMessage(content=EXTRACT_KEYWORDS_PROMPT), HumanMessage(content=f"Ticket :\n{description}")]
        response = llm.invoke(messages)
        content = response.content.strip()
        print(f"DEBUG: Extract keywords response content: {content}")
        if content.startswith("```"): 
            content = content.split("\n", 1)[1].rsplit("```", 1)[0].strip()
        
        parsed_data = json.loads(content)
        keywords = parsed_data.get("keywords", [])
        if not isinstance(keywords, list) or len(keywords) < 2:
            import re
            words = re.findall(r'\b\w{4,}\b', description)
            keywords = words[:2] if len(words) >= 2 else (words + ["erreur"])[:2]
        
        return jsonify({"keywords": keywords[:2]})
    except Exception as e:
        print(f"Erreur LLM extract_keywords: {e}")
        import re
        words = re.findall(r'\b\w{4,}\b', description)
        fallback_keywords = words[:2] if len(words) >= 2 else (words + ["erreur"])[:2]
        return jsonify({"keywords": fallback_keywords})

# ─────────────────────────────────────────────
# ROUTE : Chatbot IA
# ─────────────────────────────────────────────
CHAT_SYSTEM_PROMPT_BASE = """Tu es l'assistant du support IT. Tu as accès aux tickets de l'utilisateur ci-dessous. Si l'utilisateur pose une question sur ses tickets, utilise ces informations pour lui répondre précisément. Ne demande jamais de numéro de ticket si tu l'as déjà dans ta liste.
Règles STRICTES :
1. Réponds TOUJOURS en français.
2. Sois CONCIS et DIRECT : maximum 3 phrases par réponse.
3. Va droit au but : donne la solution ou la question de diagnostic la plus utile immédiatement.
4. Pas d'introduction, pas de conclusion vide.
5. Si le problème est clair, donne des étapes numérotées courtes (max 3 étapes).
6. Si tu as besoin d'info, pose UNE seule question précise."""

@app.route("/chat", methods=["POST"])
def chat_with_bot():
    data = request.get_json()
    if not data or "user_message" not in data:
        return jsonify({"error": "Le champ 'user_message' est requis."}), 400
        
    user_message = data["user_message"]
    session_id = data.get("session_id", "default")
    user_tickets = data.get("user_tickets", [])
    
    # Construire le prompt système dynamique
    tickets_context = "\n\nTickets de l'utilisateur :\n"
    if user_tickets:
        try:
            tickets_context += json.dumps(user_tickets, ensure_ascii=False, indent=2)
        except Exception:
            tickets_context += "Aucun ticket lisible."
    else:
        tickets_context += "L'utilisateur n'a aucun ticket en cours."
        
    dynamic_system_prompt = CHAT_SYSTEM_PROMPT_BASE + tickets_context
    
    if not llm:
        return jsonify(_mock_chat(user_message))
        
    try:
        if session_id not in chat_histories:
            chat_histories[session_id] = [SystemMessage(content=dynamic_system_prompt)]
        else:
            chat_histories[session_id][0] = SystemMessage(content=dynamic_system_prompt)
            
        history = chat_histories[session_id]
        history.append(HumanMessage(content=user_message))
        
        if len(history) > 21:
            chat_histories[session_id] = [history[0]] + history[-20:]
            history = chat_histories[session_id]
            
        response = llm.invoke(history)
        history.append(AIMessage(content=response.content))
        
        return jsonify({"bot_reply": response.content})
    except Exception as e:
        print(f"Erreur LLM chat: {e}")
        return jsonify(_mock_chat(user_message))

# ─────────────────────────────────────────────
# HEALTH CHECK
# ─────────────────────────────────────────────
@app.route("/", methods=["GET"])
def root():
    return jsonify({
        "status":  "running",
        "ai_mode": "Groq LLaMA-3" if llm else "Mock (simulation)",
        "storage": "Odoo ir.attachment (PostgreSQL)",
    })

# ─────────────────────────────────────────────
# HELPERS
# ─────────────────────────────────────────────
def _cors_preflight():
    from flask import make_response
    res = make_response("", 200)
    res.headers["Access-Control-Allow-Origin"]  = "*"
    res.headers["Access-Control-Allow-Methods"] = "GET, POST, DELETE, OPTIONS"
    res.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization"
    return res

def _mock_classify(description: str) -> dict:
    desc_lower = description.lower()
    cat, prio, sol, conf = "Logiciel", "1", "Veuillez redémarrer l'application.", 50.0
    if any(w in desc_lower for w in ["internet", "wifi", "réseau", "vpn", "connexion"]):
        cat, prio, sol, conf = "Réseau", "2", "Vérifiez le routeur.", 85.0
    elif any(w in desc_lower for w in ["accès", "mot de passe"]):
        cat, prio, sol, conf = "Accès", "1", "Changez votre mot de passe.", 90.0
    return {"category": cat, "priority": prio, "confidence": conf, "suggested_solution": sol}

def _mock_chat(user_message: str) -> dict:
    reply = "Simulation IA : Je comprends. Pouvez-vous détailler ?"
    if "bonjour" in user_message.lower():
        reply = "Bonjour ! Je suis l'assistant IT simulé."
    return {"bot_reply": reply}

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8000, debug=False)
