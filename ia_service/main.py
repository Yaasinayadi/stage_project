from flask import Flask, request, jsonify
from flask_cors import CORS
import os
import json

from langchain_groq import ChatGroq
from langchain.schema import SystemMessage, HumanMessage, AIMessage

app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}})

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

CLASSIFY_SYSTEM_PROMPT = """Tu es un expert en support IT de niveau 3. 
Analyse et réponds UNIQUEMENT en JSON valide avec cette structure exacte :
{
  "category": "<Réseau, Logiciel, Matériel, Accès, Messagerie, Infrastructure, Autre>",
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

CHAT_SYSTEM_PROMPT = """Tu es un assistant virtuel de support IT intelligent. Tu aides l'utilisateur à diagnostiquer ses soucis réseau, accès, logiciel. Réponds poliment et en français."""

@app.route("/chat", methods=["POST"])
def chat_with_bot():
    data = request.get_json()
    if not data or "user_message" not in data:
        return jsonify({"error": "Le champ 'user_message' est requis."}), 400
        
    user_message = data["user_message"]
    session_id = data.get("session_id", "default")
    
    if not llm:
        return jsonify(_mock_chat(user_message))
        
    try:
        if session_id not in chat_histories:
            chat_histories[session_id] = [SystemMessage(content=CHAT_SYSTEM_PROMPT)]
            
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

def _mock_classify(description: str) -> dict:
    desc_lower = description.lower()
    cat, prio, sol, conf = "Logiciel", "1", "Veuillez redémarrer l'application.", 50.0
    if any(w in desc_lower for w in ["internet", "wifi", "réseau", "vpn", "connexion"]):
        cat, prio, sol, conf = "Réseau", "2", "Vérifiez le routeur.", 85.0
    elif any(w in desc_lower for w in ["accès", "mot de passe"]):
        cat, prio, sol, conf = "Accès", "1", "Changez votre mot de passe.", 90.0
    return {
        "category": cat,
        "priority": prio,
        "confidence": conf,
        "suggested_solution": sol
    }

def _mock_chat(user_message: str) -> dict:
    reply = "Simulation IA : Je comprends. Pouvez-vous détailler ?"
    if "bonjour" in user_message.lower(): 
        reply = "Bonjour ! Je suis l'assistant IT simulé."
    return {"bot_reply": reply}

@app.route("/", methods=["GET"])
def root():
    has_key = llm is not None
    return jsonify({
        "status": "running",
        "ai_mode": "Groq LLaMA-3" if has_key else "Mock (simulation)",
    })

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8000)
