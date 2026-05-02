<div align="center">

# 🛡️ Système de Gestion IT Support Intelligent

### Projet de Fin d'Études · Full-Stack Helpdesk avec IA embarquée

[![Odoo](https://img.shields.io/badge/Odoo-19.0-714B67?style=for-the-badge&logo=odoo&logoColor=white)](https://www.odoo.com/)
[![Next.js](https://img.shields.io/badge/Next.js-16-000000?style=for-the-badge&logo=next.js&logoColor=white)](https://nextjs.org/)
[![Python](https://img.shields.io/badge/Python-3.11-3776AB?style=for-the-badge&logo=python&logoColor=white)](https://python.org/)
[![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?style=for-the-badge&logo=docker&logoColor=white)](https://docs.docker.com/compose/)
[![LLaMA](https://img.shields.io/badge/LLaMA--3.3-70B-FF6B35?style=for-the-badge)](https://groq.com/)

</div>

---

## 📂 Identité & Architecture

Un **Helpdesk IT full-stack** unifiant la puissance d'Odoo 19 comme ERP headless et Next.js comme interface moderne, connectés par une couche d'intelligence artificielle propulsée par **Groq / LLaMA-3.3-70B**.

Le cœur de la sécurité repose sur un champ calculé unifié `x_support_role` (`user` | `tech` | `admin`) qui mappe les groupes Odoo vers le frontend Next.js sans duplication de logique. Chaque endpoint REST consomme ce champ pour appliquer une autorisation fine.

```
┌─────────────────────────────────────────────────────────────────────┐
│                        NAVIGATEUR (port 3000)                       │
│                     Next.js 16 · TypeScript · Tailwind              │
└───────────────────────────────┬─────────────────────────────────────┘
                                │  REST JSON (Axios)
         ┌──────────────────────┴──────────────────────┐
         │                                             │
         ▼                                             ▼
┌─────────────────────┐                    ┌──────────────────────┐
│   Odoo 19 ERP       │                    │  IA Service          │
│   (port 8069)       │◄──────────────────►│  Flask + LangChain   │
│                     │  proxy /ai-analyze │  (port 8000)         │
│  models :           │                    │                       │
│  · support.ticket   │                    │  endpoints :          │
│  · support.sla      │                    │  POST /classify_ticket│
│  · support.knowledge│                    │  POST /ai_analyze     │
│  · pfe.it.domain    │                    │  POST /extract_kw     │
│  · res.users (+ext) │                    │  POST /chat           │
│                     │                    │  POST /upload         │
│  PostgreSQL 15      │                    │  SQLite (attachments) │
└─────────────────────┘                    └──────────────────────┘
```

### 🧠 L'Intelligence embarquée

Le microservice IA (`ia_service/`) est construit avec **Flask + LangChain** et communique avec le modèle **`llama-3.3-70b-versatile`** via l'API Groq (inférence < 2 s) :

| Endpoint IA | Rôle |
|---|---|
| `POST /classify_ticket` | Classifie le ticket dans l'un des 8 domaines IT et fixe la priorité (0→3) avec un score de confiance |
| `POST /ai_analyze_detailed` | Génère un diagnostic Markdown structuré : résumé, causes probables, plan d'action |
| `POST /extract_keywords` | Extrait 2 mots-clés techniques pour le moteur de recherche RAG dans la Knowledge Base |
| `POST /chat` | Chatbot IT conversationnel avec historique de session en mémoire (jusqu'à 20 échanges) |
| `POST /api/ticket/<id>/upload` | Stockage de pièces jointes (10 Mo max, 5 fichiers/ticket) via SQLite |

> En l'absence de clé Groq, chaque endpoint bascule automatiquement sur un mode **mock intelligent** sans lever d'exception — le système reste pleinement fonctionnel.

---

## 🏗️ Stack Technologique

### Backend — Odoo 19 + PostgreSQL 15

| Composant | Détail |
|---|---|
| **ERP** | Odoo 19.0 (image officielle Docker) |
| **Base de données** | PostgreSQL 15 |
| **Module custom** | `pfe_it_support` (installable, application) |
| **Dépendances Odoo** | `base`, `web`, `mail` |

**Modèles Odoo définis :**

| Modèle | Description |
|---|---|
| `support.ticket` | Ticket IT avec workflow 8 états, SLA auto-calculé, chatter `mail.thread` |
| `support.sla` | Règle SLA par priorité (Basse 48h / Moyenne 24h / Haute 8h / Critique 2h) |
| `support.knowledge` | Article KB avec contenu HTML riche, tags, publication, lien ticket source |
| `support.knowledge.tag` | Tags libres Many2many pour la recherche et l'indexation RAG |
| `support.ticket.comment` | Commentaires internes de ticket |
| `pfe.it.domain` | Domaines d'expertise IT (8 prédéfinis : Réseau, Logiciel, Matériel…) |
| `res.users` (héritage) | Extension avec `x_support_role` (computed), `it_domain_ids` (Many2many) et `role` étendu |

**Groupes de sécurité :**

| XML ID | Rôle applicatif | `x_support_role` |
|---|---|---|
| `base.group_user` | Utilisateur standard | `user` |
| `pfe_it_support.group_support_technician` | Technicien IT | `tech` |
| `base.group_system` | Administrateur | `admin` |

### Frontend — Next.js 16 + React 19

| Librairie | Version | Usage |
|---|---|---|
| `next` | 16.2.3 | App Router, SSR/CSR hybride |
| `react` | 19.2.4 | UI composants |
| `tailwindcss` | ^4 | Design system utility-first |
| `axios` | ^1.15.0 | Appels REST vers Odoo et l'IA |
| `recharts` | ^3.8.1 | Graphiques SLA, performance agents |
| `lucide-react` | ^1.8.0 | Icônes SVG cohérentes |
| `dompurify` | ^3.4.1 | Sanitisation HTML de la KB (sécurité XSS) |
| `sonner` | ^2.0.7 | Système de toast unifié |
| `next-themes` | ^0.4.6 | Mode sombre / clair |
| `swiper` | ^12.1.3 | Carousel tickets |

### Service IA — Flask + LangChain + Groq

| Librairie | Usage |
|---|---|
| `flask` + `flask-cors` | API REST microservice |
| `langchain` + `langchain-groq` | Chaîne LLM avec gestion des messages (System/Human/AI) |
| `python-dotenv` | Chargement `.env` partagé |
| `sqlite3` (stdlib) | Persistance légère des pièces jointes |

---

## 🛠️ Guide d'Exécution Rapide (Zéro à Cent)

### Prérequis

- **Docker** & **Docker Compose** installés (toutes les dépendances Node, Python, Odoo sont gérées par les conteneurs — aucune installation locale requise)
- Un compte [Groq](https://console.groq.com/) pour obtenir une clé API (optionnel — le système fonctionne en mode mock sans clé)

### 1. Cloner le dépôt

```bash
git clone https://github.com/Yaasinayadi/stage_project.git
cd stage_project
```

### 2. Configurer l'environnement

```bash
cp .env.example .env
```

Éditez `.env` et renseignez les valeurs suivantes :

```dotenv
# Nom de la base de données Odoo à créer
ODOO_DB=pfe_db

# Clé API Groq (facultative — mode mock activé si absente)
GROQ_API_KEY=gsk_xxxxxxxxxxxxxxxxxxxx
```

### 3. Builder et démarrer tous les services

**Linux / macOS :**
```bash
docker compose up --build
```

**Windows (PowerShell — en tant qu'Administrateur) :**
```powershell
docker compose up --build
```

> ⏳ Le premier build télécharge les images et installe toutes les dépendances — comptez 3 à 8 minutes selon votre connexion.

### 4. Créer la base Odoo (premier lancement uniquement)

Une fois les conteneurs démarrés, ouvrez `http://localhost:8069` dans votre navigateur :

1. Remplissez le formulaire de création de base :
   - **Database Name** : `pfe_db` (identique à `ODOO_DB` dans `.env`)
   - **Email** : `admin@gmail.com`  ·  **Password** : `12345678`
2. Cliquez **Create database** et attendez l'initialisation complète.

### 5. Installer le module

Dans un terminal séparé, exécutez la commande `exec` dans le conteneur Odoo :

**Linux / macOS :**
```bash
docker compose exec web odoo -d pfe_db -u pfe_it_support --stop-after-init
```

**Windows (PowerShell) :**
```powershell
docker compose exec web odoo -d pfe_db -u pfe_it_support --stop-after-init
```

Cette commande installe le module `pfe_it_support` et **injecte automatiquement** :
- Les 8 domaines IT (`Réseau`, `Logiciel`, `Matériel`, `Accès`, `Messagerie`, `Sécurité`, `Infrastructure`, `Autre`)
- Les 4 règles SLA préconfigurées
- **Les 3 comptes de test** (voir tableau ci-dessous)

Après l'initialisation, relancez Docker Compose normalement :
```bash
docker compose up
```

### 6. Accéder à l'application

| Service | URL |
|---|---|
| 🌐 **Frontend** (interface principale) | `http://localhost:3000` |
| ⚙️ **Backend Odoo** (admin ERP) | `http://localhost:8069` |
| 🤖 **Microservice IA** (health check) | `http://localhost:8000` |

---

## 🔑 Comptes de Test Préconfigurés

Les comptes suivants sont injectés automatiquement via `data/user_data.xml` (mécanisme `noupdate="1"` — les données existantes ne sont jamais écrasées) :

| Rôle | Email | Mot de passe | Accès |
|---|---|---|---|
| 👤 **Utilisateur** | `user@gmail.com` | `12345678` | Soumission de tickets, suivi, chatbot |
| 🔧 **Technicien** | `tech@gmail.com` | `12345678` | File d'attente, acceptation, résolution, KB |
| 🛡️ **Administrateur** | `admin@gmail.com` | `12345678` | Dashboard analytics, dispatch, gestion utilisateurs, SLA |

---

## 📁 Structure du Dépôt

```
stage_project/
│
├── 📄 docker-compose.yml          # Orchestration 4 services : db, web, ia_api, frontend
├── 📄 .env.example                # Template de configuration (ODOO_DB, GROQ_API_KEY)
│
├── 🗂️  addons_custom/
│   └── pfe_it_support/            # Module Odoo custom (installable: True)
│       ├── __manifest__.py        # Déclaration du module, version 1.0
│       ├── models/
│       │   ├── ticket.py          # support.ticket — workflow 8 états + SLA auto
│       │   ├── sla.py             # support.sla — règles de priorité
│       │   ├── knowledge.py       # support.knowledge — KB riche (HTML + RAG preview)
│       │   ├── knowledge_tag.py   # support.knowledge.tag — tags Many2many
│       │   ├── comment.py         # support.ticket.comment — fil de discussion
│       │   ├── it_domain.py       # pfe.it.domain — domaines expertise
│       │   └── res_users.py       # res.users (héritage) — x_support_role, it_domain_ids
│       ├── controllers/
│       │   ├── main.py            # 20+ endpoints REST : auth, tickets, KB, agents, SLA
│       │   └── ticket_controller.py  # Endpoints file d'attente, assignation, dispatch
│       ├── security/
│       │   ├── security.xml       # Groupe group_support_technician
│       │   └── ir.model.access.csv   # ACLs par modèle et par groupe
│       ├── data/
│       │   ├── it_domain_data.xml # 8 domaines IT (noupdate=1)
│       │   ├── sla_data.xml       # 4 règles SLA (noupdate=1)
│       │   └── user_data.xml      # 3 comptes de démo (noupdate=1)
│       └── views/                 # Vues Odoo back-office (optionnel)
│
├── 🗂️  frontend/                   # Application Next.js 16 (App Router)
│   ├── Dockerfile
│   ├── package.json
│   └── src/
│       ├── app/
│       │   ├── layout.tsx         # Layout racine + ThemeProvider
│       │   ├── page.tsx           # Redirection vers /login
│       │   ├── login/             # Page d'authentification
│       │   ├── register/          # Page d'inscription
│       │   ├── welcome/           # Dashboard rôle-adaptatif (user/tech/admin)
│       │   ├── tickets/           # Gestion complète des tickets (tableau, filtres, détails)
│       │   ├── tech/              # Espace technicien (file d'attente, mes tickets)
│       │   ├── analytics/         # Dashboard SLA & performance agents
│       │   ├── profile/           # Profil utilisateur
│       │   └── users/             # Gestion des utilisateurs (admin only)
│       ├── components/
│       │   ├── TicketDetailsModal.tsx    # Modal détail ticket — IA, résolution, KB, PJ
│       │   ├── TicketModal.tsx           # Formulaire création ticket
│       │   ├── KnowledgeModal.tsx        # Éditeur d'article KB (HTML riche)
│       │   ├── SlaPerformanceModal.tsx   # Drill-down SLA par agent (graphes + ranking)
│       │   ├── SlaAlertBanner.tsx        # Bannière alertes SLA temps réel
│       │   ├── SlaBadge.tsx             # Badge statut SLA (on_track/at_risk/breached)
│       │   ├── Chatbot.tsx              # Chat IA flottant avec historique session
│       │   ├── Sidebar.tsx              # Navigation latérale responsive
│       │   ├── StatsCard.tsx            # Carte KPI réutilisable
│       │   └── ProtectedRoute.tsx       # Guard de route basé sur x_support_role
│       └── lib/
│           ├── config.ts          # ODOO_URL, ODOO_DB (point unique de vérité)
│           └── auth.tsx           # Contexte React d'authentification
│
├── 🗂️  ia_service/                 # Microservice IA (Flask + LangChain)
│   ├── Dockerfile
│   ├── requirements.txt           # flask, langchain-groq, python-dotenv…
│   ├── main.py                    # 8 endpoints IA + gestion pièces jointes
│   ├── attachments.db             # SQLite — métadonnées fichiers uploadés
│   └── uploads/                   # Stockage physique des pièces jointes (par ticket_id/)
│
└── 🗂️  infos/                      # Documentation technique du projet
```

---

## 🌟 Fonctionnalités Implémentées

### 🎫 Gestion des Tickets

- **Workflow complet** : `Nouveau → Assigné → En Cours → Attente Client → Bloqué → Escaladé → Résolu → Fermé`
- **Niveaux de priorité** : 4 niveaux (Basse / Moyenne / Haute / Critique) avec SLA automatique associé
- **File d'attente intelligente** : les techniciens ne voient que les tickets correspondant à leur domaine d'expertise (`it_domain_ids`)
- **Système d'acceptation** : un ticket assigné doit être accepté (`x_accepted`) avant de rejoindre "Mes Tickets"
- **Escalade & dé-escalade** : workflow d'escalade vers l'administrateur avec notification chatter
- **Pièces jointes** : upload multi-fichiers (images, PDF, docs) — 5 max / 10 Mo max par fichier

### 🤖 Analyse IA Intégrée

- **Classification automatique** : à l'ouverture d'un ticket, LLaMA-3.3-70B identifie la catégorie IT, la priorité suggérée et un score de confiance
- **Diagnostic détaillé** : analyse en 3 parties (résumé, causes probables, plan d'action) rendue en Markdown dans le modal ticket
- **Suggestion KB** : après l'analyse, le moteur RAG extrait des mots-clés et retrouve l'article de la Knowledge Base le plus pertinent
- **Chatbot IT** : assistant conversationnel flottant avec mémoire de session (20 tours) pour guider les utilisateurs

### 📚 Base de Connaissances

- **Articles HTML riches** : éditeur intégré, support des listes, titres, code inline
- **Système de tags** : Many2many libre pour la recherche et l'indexation RAG
- **Statut de publication** : brouillon / publié — seuls les articles publiés sont visibles par les utilisateurs et exportés pour le RAG
- **Conversion de ticket** : un ticket résolu peut être directement transformé en article KB
- **Export RAG** : endpoint `GET /api/knowledge/export` retournant tous les articles publiés en texte brut pour l'indexation LLM

### 📊 Analytiques & SLA

- **Calcul SLA en temps réel** : deadline calculée à la création (`create_date + SLA hours`), gel automatique à la résolution (`date_done`)
- **Statuts SLA** : `on_track` / `at_risk` (< 1h avant échéance) / `breached`
- **Dashboard SLA** : vue graphique Recharts des KPIs globaux par état, priorité et période (Aujourd'hui / Semaine / Mois / Global)
- **Drill-down agent** : modal de performance par technicien — volume traité, taux SLA respecté, MTTR, classement avec badges colorés

### 🔐 Sécurité & Rôles

- **Champ unifié `x_support_role`** : computed Odoo synchronisé avec les `group_ids`, consommé par tous les endpoints REST sans couche d'autorisation supplémentaire
- **Guards frontend** : composant `ProtectedRoute` vérifiant le rôle stocké en `localStorage` avant l'affichage de chaque page
- **ACLs Odoo** : matrix complète `ir.model.access.csv` — ex. seuls les techniciens et admins peuvent écrire dans `support.knowledge`
- **Double vérification email** : à l'inscription, le backend retourne un `409` avec flag `email_exists: true` si l'adresse est déjà utilisée

### 🎨 Design & UX

- **Mode sombre / clair** natif via `next-themes`
- **Responsive design** complet : sidebar collapsible, modals adaptées mobile
- **Toasts unifiés** via `sonner` sur toutes les actions critiques
- **Sanitisation XSS** : contenu HTML de la KB systématiquement passé via `DOMPurify` avant rendu

---

## 🌐 Référence des Endpoints API

### Authentification (`/api/auth/`)

| Méthode | Endpoint | Description |
|---|---|---|
| `POST` | `/api/auth/login` | Authentification email + mot de passe |
| `POST` | `/api/auth/register` | Création d'un compte utilisateur |
| `POST` | `/api/auth/me` | Récupération du profil par `user_id` |
| `POST` | `/api/auth/update_profile` | Mise à jour nom / téléphone |
| `POST` | `/api/auth/change_password` | Changement de mot de passe avec vérification |

### Tickets (`/api/ticket*`)

| Méthode | Endpoint | Description |
|---|---|---|
| `GET` | `/api/tickets` | Liste filtrée (par `user_id`, `assigned_to`, `category`) |
| `POST` | `/api/ticket/create` | Création d'un ticket |
| `PUT` | `/api/ticket/update/<id>` | Mise à jour générique |
| `DELETE` | `/api/ticket/<id>` | Suppression (admin) |
| `POST` | `/api/ticket/<id>/resolve` | Résolution + publication KB optionnelle |
| `POST` | `/api/ticket/<id>/escalate` | Escalade vers admin |
| `POST` | `/api/ticket/<id>/unescalate` | Annulation d'escalade |
| `POST` | `/api/ticket/<id>/wait` | Passage en attente client |
| `POST` | `/api/ticket/<id>/resume` | Reprise du traitement |
| `PATCH` | `/api/ticket/<id>/assign` | Auto-assignation technicien |
| `PATCH` | `/api/ticket/<id>/accept` | Acceptation mission |
| `POST` | `/api/ticket/<id>/dispatch` | Assignation manuelle (admin) |
| `GET` | `/api/tickets/queue` | File d'attente (filtrée par expertise) |

### Knowledge Base (`/api/knowledge*`)

| Méthode | Endpoint | Description |
|---|---|---|
| `GET` | `/api/knowledge` | Liste paginée avec filtres (catégorie, recherche, publié) |
| `GET` | `/api/knowledge/<id>` | Détail complet d'un article |
| `PUT` | `/api/knowledge/<id>` | Mise à jour (auteur ou admin) |
| `DELETE` | `/api/knowledge/<id>` | Suppression (admin only) |
| `POST` | `/api/knowledge/create` | Création d'article |
| `GET` | `/api/knowledge/export` | Export RAG texte brut |

### Agents & Catégories

| Méthode | Endpoint | Description |
|---|---|---|
| `GET` | `/api/agents` | Liste des techniciens |
| `GET` | `/api/agents/suggest?category=` | Suggestion agents par expertise + charge |
| `GET` | `/api/categories` | Domaines IT disponibles |

### Service IA (port 8000)

| Méthode | Endpoint | Description |
|---|---|---|
| `POST` | `/classify_ticket` | Classification LLaMA-3 |
| `POST` | `/ai_analyze_detailed` | Diagnostic structuré Markdown |
| `POST` | `/extract_keywords` | Extraction mots-clés RAG |
| `POST` | `/chat` | Chatbot conversationnel |
| `POST` | `/api/ticket/<id>/upload` | Upload pièces jointes |
| `GET` | `/api/ticket/<id>/attachments` | Liste des PJ d'un ticket |
| `GET` | `/api/attachment/<id>/download` | Téléchargement d'un fichier |
| `DELETE` | `/api/attachment/<id>` | Suppression d'un fichier |

---

<div align="center">

**PFE — Système de Gestion IT Support Intelligent** · Odoo 19 × Next.js 16 × LLaMA-3.3

</div>
