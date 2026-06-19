# JUNIA Plateforme de gestion et de suivi de projets étudiants

Application web permettant à des encadrants de piloter des projets étudiants : chaque **projet** (sujet) regroupe plusieurs **équipes**, qui gèrent leurs tâches, déposent leurs livrables et sont évaluées.

---

## Fonctionnalités

- **Authentification** sécurisée (JWT) avec 4 rôles : encadrant, étudiant, team leader, jury
- **Projets & équipes** : structure à deux niveaux (un projet contient plusieurs équipes)
- **Tâches** : création, assignation, priorités, vues **liste** et **Kanban** (drag & drop)
- **Livrables** : dépôt de fichiers, validation par l'encadrant, livrables attendus définis au niveau du projet
- **Jalons** : suivi des étapes clés du projet
- **Évaluations** : grille de critères pondérés et note finale, avec graphiques
- **Tableau de bord** : statistiques, progression, regroupement des équipes par projet
- **Notifications** in-app, **demandes d'aide**, **feedback** encadrant
- **Clôture de projet** (passage en lecture seule) et **export Excel** (.xlsx)

---

## Stack technique

**Frontend**
- React 18 + React Router
- Tailwind CSS
- Axios, date-fns, Recharts (graphiques), @hello-pangea/dnd (Kanban), SheetJS (export Excel)

**Backend**
- Node.js + Express
- PostgreSQL (`pg`)
- JWT (authentification), bcrypt (mots de passe), Multer (upload de fichiers)

---

## Architecture (modèle de données)

```
Projet (programme)
├─ Sujet, dates, état
├─ Livrables attendus  (communs à toutes les équipes)
├─ Jalons              (communs à toutes les équipes)
└─ Équipes
   ├─ Membres
   ├─ Tâches
   ├─ Livrables déposés
   └─ Évaluation
```

---

## Prérequis

- [Node.js](https://nodejs.org/) 18+
- [PostgreSQL](https://www.postgresql.org/) 14+

---

## Installation

### 1. Cloner le dépôt

```bash
git clone https://github.com/GustaveMAG/project-isen-3.git
cd project-isen-3
```

### 2. Base de données

Créer une base PostgreSQL puis charger le schéma :

```bash
createdb student_projects
psql -d student_projects -f database/schema.sql
```

### 3. Backend

```bash
cd backend
npm install
cp .env.example .env      # puis renseigner les variables (voir ci-dessous)
npm start                 # démarre l'API sur http://localhost:5000
```

Variables d'environnement (`backend/.env`) :

| Variable | Description |
|---|---|
| `PORT` | Port de l'API (défaut : 5000) |
| `DATABASE_URL` | Chaîne de connexion PostgreSQL |
| `JWT_SECRET` | Clé secrète pour signer les tokens |
| `JWT_EXPIRES_IN` | Durée de validité des tokens (ex. `7d`) |
| `UPLOAD_DIR` | Dossier de stockage des fichiers uploadés |
| `MAX_FILE_SIZE_MB` | Taille max des uploads (Mo) |
| `CLIENT_URL` | URL du frontend (CORS) |

### 4. Frontend

```bash
cd frontend
npm install
npm start                 # démarre l'app sur http://localhost:3000
```

Le frontend est configuré pour relayer les appels API vers `http://localhost:5000`.

---

## Structure du projet

```
project-isen-3/
├─ backend/        API Express (routes, middlewares, services)
│  └─ src/
│     ├─ routes/         points d'entrée de l'API
│     ├─ middleware/     authentification, contrôle d'accès
│     ├─ services/       logique métier (notifications…)
│     └─ config/         connexion base de données
├─ frontend/       Application React
│  └─ src/
│     ├─ pages/          écrans de l'application
│     ├─ components/     composants réutilisables
│     ├─ contexts/       état global (authentification)
│     └─ lib/            client API, utilitaires
└─ database/       Schéma SQL et migrations
```

---

## Rôles & permissions

| Rôle | Droits principaux |
|---|---|
| **Encadrant** | Crée les projets et les équipes, gère les livrables attendus, les jalons, évalue |
| **Team leader** | Gère les tâches de son équipe |
| **Étudiant** | Travaille sur ses tâches, dépose des livrables, demande de l'aide |
| **Jury** | Consulte les projets et évalue (lecture seule sur le reste) |
