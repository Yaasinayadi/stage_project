from flask import Flask, request, jsonify
from flask_cors import CORS
import os
import json
import re as _re

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
        return jsonify({"error": "Connexion à l'IA non configurée"}), 503
        
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
        print(f"Erreur LLM classification: {e}", flush=True)
        return jsonify({"error": str(e)}), 500

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
@app.route("/chat", methods=["POST"])
def chat_with_bot():
    data = request.get_json()
    if not data or "user_message" not in data:
        return jsonify({"error": "Le champ 'user_message' est requis."}), 400
        
    user_message = data["user_message"]
    session_id = data.get("session_id", "default")
    context = data.get("context", {})
    user_tickets = context.get("user_tickets_details", [])
    live_dashboard_stats = context.get("live_dashboard_stats", {})
    user_name = data.get("user_name", "Utilisateur")

    # ── Compression de la liste des tickets ──
    if user_tickets:
        try:
            compressed_lines = []
            for t in user_tickets:
                ref     = t.get("ref", "")
                statut  = t.get("statut", "")
                assigne = t.get("assigne_a") or "Non assigné"
                createur = t.get("createur") or "Système"
                sujet   = t.get("sujet", "")
                compressed_lines.append(f"{ref}|{statut}|{assigne}|{createur}|{sujet}")
            tickets_data_str = "\n".join(compressed_lines)
        except Exception:
            tickets_data_str = "Erreur de lecture des tickets."
    else:
        tickets_data_str = "LISTE VIDE"

    # ── Statistiques dynamiques injectées depuis le frontend ──
    total_tickets         = live_dashboard_stats.get("total", 0)
    resolved_count        = live_dashboard_stats.get("resolved", 0)
    in_progress_count     = live_dashboard_stats.get("in_progress", 0)
    overdue_count         = live_dashboard_stats.get("overdue", 0)
    latest_ticket         = live_dashboard_stats.get("latest_ticket", "Aucun")
    latest_resolved       = live_dashboard_stats.get("latest_resolved_ticket", "Aucun")
    latest_in_progress    = live_dashboard_stats.get("latest_in_progress_ticket", "Aucun")

    stats_injection = (
        f"\n[STATISTIQUES EN TEMPS RÉEL]\n"
        f"Total tickets: {total_tickets}\n"
        f"Résolus: {resolved_count}\n"
        f"En cours: {in_progress_count}\n"
        f"En retard: {overdue_count}\n"
        f"Dernier ticket résolu: {latest_resolved}\n"
        f"Dernier ticket en cours: {latest_in_progress}\n"
        f"Ticket le plus récent (tous statuts): {latest_ticket}\n"
        f"[/STATISTIQUES]\n"
    )

    dynamic_system_prompt = f"""ALERTE : Tu es intégré à Odoo. Voici les tickets de l'utilisateur {user_name} (format: ref|statut|assigné|créateur|sujet) :
{tickets_data_str}
{stats_injection}
RÈGLES STRICTES :
1. Ne demande JAMAIS l'ID ou le nom à l'utilisateur.
2. Si l'utilisateur demande la LISTE de ses tickets (plusieurs), génère EXACTEMENT la balise : [SHOW_TICKETS: TK-XXXX, TK-YYYY].
3. Si l'utilisateur pose une question sur UN SEUL ticket précis (ex: statut, assigné, priorité), réponds avec une phrase courte et professionnelle. Inclus OBLIGATOIREMENT à la fin de ta réponse la balise : [TICKET_ID: TK-XXXX] où XXXX est la référence numérique du ticket concerné.
4. Les statuts Odoo correspondent à ceci : new = Nouveau | waiting_material = En attente de matériel | in_progress = En cours | done / resolved / closed = Résolu | escalated = Escaladé.
5. Pour déterminer l'état d'assignation : Pas d'assigné = Non assigné. Assigné mais x_accepted est False = Assigné (en attente de confirmation). Assigné et x_accepted est True = En cours de traitement.
6. N'UTILISE AUCUN EMOJI. Rédige ton texte de manière ultra-concise et professionnelle.
7. Si la liste de l'utilisateur est VIDE (LISTE VIDE), dis simplement : "Vous n'avez pas de tickets ouverts".
8. Si le ticket est en statut 'escalated', tu DOIS impérativement utiliser cette formulation précise : "Le ticket [Référence] a été escaladé par [escalated_by_name] et attend une ré-assignation par l'administrateur."
9. STATISTIQUES EXACTES (TRÈS IMPORTANT) : Pour toutes les questions sur "combien", "dernier", "total", utilise EXCLUSIVEMENT les valeurs de [STATISTIQUES EN TEMPS RÉEL]. Ces valeurs sont calculées par le système et sont 100% exactes. Ne calcule jamais toi-même.
10. Si l'utilisateur demande UNIQUEMENT de "compter" ou le "nombre" de tickets, donne la réponse chiffrée et NE METS AUCUNE balise [SHOW_TICKETS].
11. Pour "dernier ticket résolu" : utilise la valeur de "Dernier ticket résolu" dans [STATISTIQUES EN TEMPS RÉEL]. Cherche ensuite son sujet dans la liste des tickets et réponds naturellement. Finis par [SHOW_TICKETS: TK-XXXX].
12. Pour "dernier ticket résolu par X" : dans la liste des tickets, filtre les tickets dont l'assigné = X et le statut = résolu, prends celui avec le ref le plus grand (plus récent). Finis par [SHOW_TICKETS: TK-XXXX].
13. Pour "tickets créés par X" ou "liste des tickets de X" : génère la balise [SHOW_TICKETS] en incluant TOUTES les références correspondantes (ex: [SHOW_TICKETS: TK-0001, TK-0002])."""

    if not llm:
        return jsonify({"bot_reply": "Erreur système: Connexion à l'IA non configurée (Clé API manquante).", "text": "Erreur système: Connexion à l'IA non configurée.", "ticket_id": None})
        
    try:
        if session_id not in chat_histories:
            chat_histories[session_id] = [SystemMessage(content=dynamic_system_prompt)]
        else:
            chat_histories[session_id][0] = SystemMessage(content=dynamic_system_prompt)
            
        history = chat_histories[session_id]
        history.append(HumanMessage(content=user_message))
        
        # Garder max 5 échanges (11 messages: sys + 5 paires)
        if len(history) > 11:
            chat_histories[session_id] = [history[0]] + history[-10:]
            history = chat_histories[session_id]

        def try_invoke(hist):
            return llm.invoke(hist)
            
        try:
            response = try_invoke(history)
        except Exception as api_err:
            err_str = str(api_err)
            print(f"Erreur LLM (tentative 1): {api_err}", flush=True)
            if "413" in err_str or "Request too large" in err_str or "rate_limit_exceeded" in err_str:
                # Fallback 1: historique réduit à 2 derniers messages
                h2 = [history[0]] + history[-2:]
                try:
                    response = try_invoke(h2)
                    chat_histories[session_id] = h2
                except Exception as api_err2:
                    print(f"Erreur LLM (tentative 2): {api_err2}", flush=True)
                    # Fallback 2: sans la liste des tickets, juste les stats
                    minimal_prompt = f"Assistant IT de {user_name}. {stats_injection} Réponds à la question. Utilise [SHOW_TICKETS: TK-...] pour les tickets."
                    h3 = [SystemMessage(content=minimal_prompt), HumanMessage(content=user_message)]
                    response = try_invoke(h3)
                    chat_histories[session_id] = h3
            else:
                raise api_err

        raw_reply = response.content
        history.append(AIMessage(content=raw_reply))
        
        # Extraire un ticket unique si présent dans la réponse
        ticket_id = None
        ticket_id_match = _re.search(r'\[TICKET_ID:\s*(TK-\d+)\]', raw_reply)
        if ticket_id_match:
            ticket_id = ticket_id_match.group(1)
            clean_text = _re.sub(r'\s*\[TICKET_ID:\s*TK-\d+\]', '', raw_reply).strip()
        else:
            clean_text = raw_reply
        
        return jsonify({
            "bot_reply": clean_text,
            "text": clean_text,
            "ticket_id": ticket_id
        })
    except Exception as e:
        import traceback
        print(f"Erreur LLM chat: {traceback.format_exc()}", flush=True)
        return jsonify({"bot_reply": "Désolé, une erreur est survenue. Veuillez réessayer.", "text": "Désolé, une erreur est survenue.", "ticket_id": None})

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

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8000, debug=False)
