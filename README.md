# 🚀 Système de Gestion IT Support Intelligent

**Projet de Fin d'Études (PFE)** visant à concevoir et développer un **Helpdesk Intelligent** de nouvelle génération. L'objectif est d'automatiser le traitement du support IT, d'accélérer les temps de résolution et d'améliorer l'expérience utilisateur grâce à l'Intelligence Artificielle.

---

## 🛠️ Stack Technologique (Approche Headless)

Notre système s'appuie sur une architecture distribuée moderne combinant la puissance d'un véritable ERP backend à la fluidité d'un frontend SSR réactif.

* **🎨 Frontend** : Next.js 14, Tailwind CSS, Recharts
* **🔙 Backend Métier** : Odoo (PostgreSQL) - Jouant le rôle d'ERP Headless
* **🤖 Microservice IA** : Groq API / Modèles de Machine Learning NLP
* **🐳 Infrastructure** : Conteneurisation complète avec Docker & Docker Compose

---

## 🌟 Fonctionnalités Actuelles (WIP - En cours)

Bien que le projet soit encore en phase de développement actif, plusieurs étapes clés sont déjà opérationnelles :

### 👤 Rôle Utilisateur (Portail Client)
* ✅ **Création de ticket intuitive** : Assistant IA générant automatiquement la catégorie et la priorité à partir de la description du problème.
* ✅ **Gestion des Pièces Jointes** : Téléchargement et intégration de fichiers (logs, images).
* ✅ **Collaboration & Suivi** : Système interactif de commentaires pour discuter avec l'équipe support.

### 🧑‍💻 Rôle Administrateur / IT Support
* ✅ **Dashboard Global Analytique** : Supervision complète et interactive via graphiques dynamiques incluant des KPIs majeurs (MTTR, SLA compliance, volume tendanciel, répartition catégorielle IA).

---

## 📋 Prérequis

Pour installer et faire tourner localement le projet, seuls deux outils sont nécessaires sur votre machine :
- [**Git**](https://git-scm.com/)
- [**Docker Desktop**](https://www.docker.com/products/docker-desktop/) (configuré et démarré)

---

## 🚀 Installation et Lancement

1. **Cloner le répertoire** sur votre machine :
   ```bash
   git clone https://github.com/Yaasinayadi/stage_project.git
   cd stage_project
   ```

2. **Démarrer les conteneurs** (ce processus construira et lancera le frontend, Odoo, l'API IA et PostgreSQL) :
   ```bash
   docker compose up --build
   ```

3. **Accès aux environnements** :
   - 🌐 **Web App (Next.js)** : [http://localhost:3000](http://localhost:3000)
   - ⚙️ **Backend ERP (Odoo)** : [http://localhost:8069](http://localhost:8069)
     - *(Identifiants Odoo : admin / admin)*

---

## 📁 Structure du Projet

* `/frontend/` : Code source React / Next.js de l'interface client et des tableaux de bord.
* `/addons_custom/pfe_it_support/` : Le module Odoo métier structurant les modèles (Tickets, SLAs, Commentaires) et exposant son API.
* `/ia_service/` (ou équivalent) : Le code Python de notre architecture d'Intelligence Artificielle.
* `docker-compose.yml` : Fichier de déploiement et d'orchestration pour l'ensemble de ces services.

---

## 🗺️ Feuille de Route (Roadmap Restante)

Les prochains sprints de développement couvriront les points suivants :
- [ ] 🚧 **Listing & Gestion Admin** : Interface Back-office dans Next.js pour visualiser l'ensemble des tickets, les éditer et les clôturer.
- [ ] 🤖 **Assignation Intelligente** : Règles conditionnelles pour router automatiquement un ticket au bon technicien selon le pronostic de l'IA.
- [ ] 📩 **Notifications Emails Automatiques** : Alertes de mise à jour pour que le client ou l'agent reçoive les derniers statuts.
