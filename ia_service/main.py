from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
import os
import json
import sqlite3
from werkzeug.utils import secure_filename

from langchain_groq import ChatGroq
from langchain.schema import SystemMessage, HumanMessage, AIMessage

app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}})

# ─────────────────────────────────────────────
# CONFIG CHEMINS
# ─────────────────────────────────────────────
BASE_DIR    = os.path.dirname(os.path.abspath(__file__))
UPLOAD_DIR  = os.path.join(BASE_DIR, "uploads")
DB_PATH     = os.path.join(BASE_DIR, "attachments.db")

os.makedirs(UPLOAD_DIR, exist_ok=True)

ALLOWED_EXTENSIONS = {
    "image/jpeg":    ".jpg",
    "image/png":     ".png",
    "image/gif":     ".gif",
    "image/webp":    ".webp",
    "application/pdf": ".pdf",
    "text/plain":    ".txt",
    "text/csv":      ".csv",
    "application/zip": ".zip",
    "application/vnd.ms-excel": ".xls",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": ".xlsx",
    "application/msword": ".doc",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
}
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 Mo
MAX_FILES_PER_TICKET = 5

# ─────────────────────────────────────────────
# BASE DE DONNÉES SQLite — TABLE attachments
# ─────────────────────────────────────────────
def init_db():
    """Initialise la base SQLite et crée la table attachments si elle n'existe pas."""
    conn = sqlite3.connect(DB_PATH)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS attachments (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            ticket_id   INTEGER NOT NULL,
            filename    TEXT    NOT NULL,
            filepath    TEXT    NOT NULL,
            mimetype    TEXT    NOT NULL,
            file_size   INTEGER NOT NULL,
            created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    conn.commit()
    conn.close()

init_db()

def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

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

# ─────────────────────────────────────────────
# ROUTE : Chatbot IA
# ─────────────────────────────────────────────
CHAT_SYSTEM_PROMPT = """Tu es un assistant expert en support IT. Règles STRICTES :
1. Réponds TOUJOURS en français.
2. Sois CONCIS et DIRECT : maximum 3 phrases par réponse.
3. Va droit au but : donne la solution ou la question de diagnostic la plus utile immédiatement.
4. Pas d'introduction ("Bien sûr !", "Je comprends votre problème..."), pas de conclusion vide.
5. Si le problème est clair, donne des étapes numérotées courtes (max 3 étapes).
6. Si tu as besoin d'info, pose UNE seule question précise."""

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

# ─────────────────────────────────────────────
# ROUTES : Gestion des Pièces Jointes (Fichiers)
# ─────────────────────────────────────────────

@app.route("/api/ticket/<int:ticket_id>/upload", methods=["POST", "OPTIONS"])
def upload_files(ticket_id):
    """Upload des fichiers pour un ticket (multipart/form-data, champ 'files')."""
    if request.method == "OPTIONS":
        return _cors_preflight()

    files = request.files.getlist("files")
    if not files or all(f.filename == "" for f in files):
        return jsonify({"status": 400, "message": "Aucun fichier reçu."}), 400

    # Vérifier le nombre de fichiers déjà présents pour ce ticket
    conn = get_db()
    existing_count = conn.execute(
        "SELECT COUNT(*) FROM attachments WHERE ticket_id = ?", (ticket_id,)
    ).fetchone()[0]

    if existing_count + len(files) > MAX_FILES_PER_TICKET:
        conn.close()
        return jsonify({
            "status": 400,
            "message": f"Maximum {MAX_FILES_PER_TICKET} fichiers par ticket. Ce ticket en a déjà {existing_count}."
        }), 400

    # Dossier de stockage par ticket : uploads/{ticket_id}/
    ticket_dir = os.path.join(UPLOAD_DIR, str(ticket_id))
    os.makedirs(ticket_dir, exist_ok=True)

    created = []
    try:
        for f in files:
            mimetype = f.content_type or "application/octet-stream"

            # Validation type
            if mimetype not in ALLOWED_EXTENSIONS:
                conn.close()
                return jsonify({
                    "status": 400,
                    "message": f"Type de fichier non autorisé : {f.filename} ({mimetype})"
                }), 400

            # Lecture + validation taille
            file_data = f.read()
            if len(file_data) > MAX_FILE_SIZE:
                conn.close()
                return jsonify({
                    "status": 400,
                    "message": f'"{f.filename}" dépasse 10 Mo.'
                }), 400

            # Nom de fichier sécurisé
            safe_name = secure_filename(f.filename)
            # Unicité : préfixe timestamp si collision
            final_path = os.path.join(ticket_dir, safe_name)
            if os.path.exists(final_path):
                import time
                name_part, ext_part = os.path.splitext(safe_name)
                safe_name = f"{name_part}_{int(time.time())}{ext_part}"
                final_path = os.path.join(ticket_dir, safe_name)

            # Écriture sur disque
            with open(final_path, "wb") as out:
                out.write(file_data)

            # Enregistrement en base
            cursor = conn.execute(
                "INSERT INTO attachments (ticket_id, filename, filepath, mimetype, file_size) VALUES (?, ?, ?, ?, ?)",
                (ticket_id, f.filename, final_path, mimetype, len(file_data))
            )
            att_id = cursor.lastrowid

            created.append({
                "id":        att_id,
                "name":      f.filename,
                "mimetype":  mimetype,
                "file_size": len(file_data),
                "url":       f"/api/attachment/{att_id}/download",
            })

        conn.commit()
    except Exception as e:
        conn.rollback()
        conn.close()
        return jsonify({"status": 500, "message": f"Erreur lors de l'upload : {str(e)}"}), 500

    conn.close()
    return jsonify({
        "status":  201,
        "message": f"{len(created)} fichier(s) uploadé(s) avec succès.",
        "data":    created
    }), 201


@app.route("/api/ticket/<int:ticket_id>/attachments", methods=["GET", "OPTIONS"])
def get_attachments(ticket_id):
    """Retourne la liste des pièces jointes d'un ticket."""
    if request.method == "OPTIONS":
        return _cors_preflight()

    conn = get_db()
    rows = conn.execute(
        "SELECT id, filename, mimetype, file_size, created_at FROM attachments WHERE ticket_id = ? ORDER BY created_at DESC",
        (ticket_id,)
    ).fetchall()
    conn.close()

    data = [{
        "id":          row["id"],
        "name":        row["filename"],
        "mimetype":    row["mimetype"],
        "file_size":   row["file_size"],
        "create_date": row["created_at"],
        "url":         f"/api/attachment/{row['id']}/download",
    } for row in rows]

    return jsonify({"status": 200, "data": data})


@app.route("/api/attachment/<int:attachment_id>/download", methods=["GET", "OPTIONS"])
def download_attachment(attachment_id):
    """Télécharge un fichier par son ID."""
    if request.method == "OPTIONS":
        return _cors_preflight()

    conn = get_db()
    row = conn.execute(
        "SELECT filename, filepath, mimetype FROM attachments WHERE id = ?",
        (attachment_id,)
    ).fetchone()
    conn.close()

    if not row:
        return jsonify({"status": 404, "message": "Fichier introuvable."}), 404

    if not os.path.exists(row["filepath"]):
        return jsonify({"status": 404, "message": "Fichier absent du disque."}), 404

    return send_file(
        row["filepath"],
        mimetype=row["mimetype"],
        as_attachment=True,
        download_name=row["filename"]
    )


@app.route("/api/attachment/<int:attachment_id>", methods=["DELETE", "OPTIONS"])
def delete_attachment(attachment_id):
    """Supprime un fichier (disque + base)."""
    if request.method == "OPTIONS":
        return _cors_preflight()

    conn = get_db()
    row = conn.execute(
        "SELECT filepath FROM attachments WHERE id = ?",
        (attachment_id,)
    ).fetchone()

    if not row:
        conn.close()
        return jsonify({"status": 404, "message": "Pièce jointe introuvable."}), 404

    # Supprimer du disque
    if os.path.exists(row["filepath"]):
        os.remove(row["filepath"])

    # Supprimer de la base
    conn.execute("DELETE FROM attachments WHERE id = ?", (attachment_id,))
    conn.commit()
    conn.close()

    return jsonify({"status": 200, "message": "Fichier supprimé avec succès."})

# ─────────────────────────────────────────────
# HEALTH CHECK
# ─────────────────────────────────────────────
@app.route("/", methods=["GET"])
def root():
    conn = get_db()
    attachment_count = conn.execute("SELECT COUNT(*) FROM attachments").fetchone()[0]
    conn.close()
    return jsonify({
        "status":           "running",
        "ai_mode":          "Groq LLaMA-3" if llm else "Mock (simulation)",
        "upload_dir":       UPLOAD_DIR,
        "attachment_count": attachment_count,
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
