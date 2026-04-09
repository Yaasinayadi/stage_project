# 📄 Cahier des Charges - Système de Gestion IT Support Intelligent (PFE)

## 🎯 1. Contexte et Objectif du Projet
L'objectif de ce Projet de Fin d'Études (PFE) est de concevoir et développer une application web de type **Helpdesk Intelligent** pour automatiser et optimiser la gestion des tickets de support IT. 
Le but est de réduire la charge de travail du support de premier niveau (N1), d'accélérer les temps de résolution (respect des SLA) et d'améliorer l'expérience utilisateur grâce à l'Intelligence Artificielle.

---

## 🏗️ 2. Architecture Technique (Approche Moderne "Headless")
Contrairement à une architecture monolithique classique, ce projet adoptera une approche **"Headless ERP"**, séparant clairement le backend métier du frontend utilisateur. 

### 🔙 Backend Central (ERP / Métier) : **Odoo 19**
Odoo 19 agira en tant que backend robuste. Il ne gérera pas les vues web frontales des utilisateurs finaux, mais fournira :
* La base de données via **PostgreSQL**.
* La logique métier (Gestion des tickets, SLA, Utilisateurs, Équipes).
* Le tableau de bord d'administration "Back-Office" natif pour les agents IT de niveau 2/3.
* Une **API REST** (ou XML-RPC/JSON-RPC) pour communiquer avec le frontend web et le service IA.

### 🎨 Frontend Utilisateur ("Headless") : **Next.js (React)**
Pour offrir l'interface la plus professionnelle, fluide et dynamique aux utilisateurs finaux et aux agents de support de premier niveau, nous utiliserons **Next.js**.
* **Avantages** : Server-Side Rendering (SSR) pour des performances optimales, sécurité accrue, et une User Experience (UX) premium.
* **UI/UX** : Utilisation de **Tailwind CSS** et de la librairie de composants **shadcn/ui** (ou Material-UI) pour un design moderne, épuré et réactif (Glassmorphism, Dark mode interactif).

### 🤖 Microservice IA : **Python (FastAPI + LangChain)**
L'intelligence artificielle sera implémentée sous forme de microservice indépendant pour éviter de surcharger Odoo et garantir l'évolutivité.
* **Rôle** : Recevoir le texte des tickets du Frontend, classifier le problème, proposer une résolution, et gérer le Chatbot.
* **Technologies** : FastAPI + intégration des API OpenAI (GPT-4o) ou d'un modèle open-source (Llama 3) via LangChain.

### 🛠️ Infrastucture & Déploiement : **Docker**
Conteneurisation complète (Odoo, Next.js, FastAPI, PostgreSQL) orchestrée via **Docker Compose** pour assurer une reproduction à l'identique entre les environnements de développement et de production.

---

## ⚙️ 3. Fonctionnalités Détaillées

### 👤 Portail Utilisateur (Next.js)
* **Authentification sécurisée** (JWT communiquant avec Odoo).
* **Création de ticket intuitive** avec formulaire intelligent et upload de pièces jointes.
* **Chatbot Assistant IA** : Capable de résoudre les problèmes IT basiques de manière autonome ou de formater la demande avant la création du ticket.
* **Suivi en temps réel** du statut des tickets et historique interactif.

### 🧑‍💻 Portail Agent IT & Admin (Odoo 19 / Interface native ou Next.js)
* **Kanban & Listes** : Visualisation globale des tickets ouverts, en cours et résolus.
* **Priorisation et Routage** : Attribution manuelle ou automatique selon le diagnostic de l'IA.
* **Gestion des SLAs** : Configuration des délais par type d'incident.
* **Tableaux de bord (KPIs)** : Génération de statistiques natives sur les temps de résolution et les performances.

### 🧠 Capacités de l'IA (Microservice)
* **Classification Automatique** : Détection du département (Réseau, Matériel, Logiciel, Accès).
* **Analyse de Sentiment & Urgence** : Identification des mots-clés signalant une urgence critique pour escalader le ticket.
* **Génération de Réponses Auto** : L'IA suggère des solutions potentielles (Knowledge Base) à l'Agent avant qu'il ne réponde.

---

## 🧱 4. Modélisation des Données (Contexte Odoo)

Les modèles (Tables) seront créés en tant que modules Odoo personnalisés héritant des modules standards d'Odoo (`helpdesk` si la version entreprise est dispo, ou custom à partir de `project`).

**Entités Principales :**
1. `res.users` : Utilisateurs et Agents (Héritage standard Odoo).
2. `support.ticket` :
   * `name` (Sujet)
   * `description` (Détail)
   * `state` (Nouveau, En Cours, Attente Client, Résolu)
   * `priority` (Basse, Normale, Haute, Critique - *déduite par IA*)
   * `category_id` (Lien vers la catégorie du ticket - *déduite par IA*)
   * `user_id` (Créateur)
   * `agent_id` (Agent assigné)
   * `sla_deadline` (Date limite de résolution)
3. `support.category` : Réseau, Matériel, Messagerie...
4. `support.sla` : Règles définissant les deadlines.

---

## 🔄 5. Méthodologie et Roadmap (Scrum Agile)

L'approche **Scrum** sera adoptée pour un développement itératif, garantissant l'intégration continue des feedbacks et des composants complexes (comme l'IA).

* **Sprint 1 : Définition & Backbone (S1 - S2)**
  * Configuration Docker (Odoo 19, PostgreSQL, Next.js).
  * Création des modules Odoo backend (Modèles de données, Sécurité, API REST).
  * Maquettes UI/UX du frontend.
* **Sprint 2 : Le Portail Next.js (S3 - S4)**
  * Implémentation du frontend Next.js et connexion à l'API Odoo.
  * Création, affichage et gestion des tickets côté utilisateur.
* **Sprint 3 : L'Intelligence Artificielle (S5 - S6)**
  * Développement du microservice FastAPI.
  * Intégration du LLM (OpenAI) pour le Chatbot documentaire et l'analyse de texte.
  * Connexion du microservice au Frontend (pour le chat) et à Odoo (pour auto-remplir la catégorie).
* **Sprint 4 : Finalisation et Déploiement (S7 - S8)**
  * Mise en place des règles SLA et des alertes dans Odoo.
  * Tests d'intégration de bout en bout.
  * Préparation du document final (Mémoire de PFE) et présentation.

---

## 📈 6. Les + "Professionnels" pour la Soutenance PFE
Pour se démarquer devant le jury, ce projet intègre :
1. **Architecture Headless Decoupled** : Très recherchée sur le marché actuel, prouvant votre capacité à orchestrer différentes technologies expertes (Odoo pour l'ERP, Next.js pour le web).
2. **Microservices de Machine Learning** : Ne pas coder l'IA "en dur" dans le backend, mais l'appeler via un microservice API, ce qui est une excellente pratique d'architecture cloud native.
3. **Qualité de l'Interface** : Utiliser un framework SSR comme Next.js avec un design system professionnel (shadcn) garantit un "effet Waouh" immédiat lors de la démonstration, contrastant avec les applications PFE étudiantes traditionnelles souvent négligées visuellement.
