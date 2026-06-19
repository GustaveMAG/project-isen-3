-- ============================================================
-- Schéma PostgreSQL - Plateforme de gestion projets étudiants
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Nettoyage (ordre inversé des dépendances)
DROP TABLE IF EXISTS evaluations CASCADE;
DROP TABLE IF EXISTS comments CASCADE;
DROP TABLE IF EXISTS deliverables CASCADE;
DROP TABLE IF EXISTS tasks CASCADE;
DROP TABLE IF EXISTS project_members CASCADE;
DROP TABLE IF EXISTS projects CASCADE;
DROP TABLE IF EXISTS programmes CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- ============================================================
-- USERS
-- ============================================================
CREATE TABLE users (
  id          SERIAL PRIMARY KEY,
  nom         VARCHAR(100) NOT NULL,
  email       VARCHAR(255) NOT NULL UNIQUE,
  password    TEXT NOT NULL,                -- bcrypt hash
  role        VARCHAR(20) NOT NULL CHECK (role IN ('encadrant', 'etudiant', 'team_leader', 'jury')),
  created_at  TIMESTAMP DEFAULT NOW()
);

-- ============================================================
-- PROGRAMMES  (niveau « Projet » le sujet global, parent des équipes)
-- ============================================================
CREATE TABLE programmes (
  id            SERIAL PRIMARY KEY,
  titre         VARCHAR(255) NOT NULL,
  description   TEXT,                       -- le sujet global
  date_debut    DATE,
  date_fin      DATE,
  etat          VARCHAR(20) NOT NULL DEFAULT 'en_cours'
                  CHECK (etat IN ('en_cours', 'en_retard', 'termine', 'cloture')),
  date_cloture  TIMESTAMP,
  encadrant_id  INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at    TIMESTAMP DEFAULT NOW()
);
CREATE INDEX idx_programmes_encadrant ON programmes(encadrant_id);

-- ============================================================
-- PROJECTS  (niveau « Équipe » un groupe et son espace de travail)
-- ============================================================
CREATE TABLE projects (
  id            SERIAL PRIMARY KEY,
  programme_id  INTEGER REFERENCES programmes(id) ON DELETE CASCADE,
  titre         VARCHAR(255) NOT NULL,
  description   TEXT,
  date_debut    DATE,
  date_fin      DATE,
  etat          VARCHAR(20) NOT NULL DEFAULT 'en_cours'
                  CHECK (etat IN ('en_cours', 'en_retard', 'termine', 'cloture')),
  date_cloture  TIMESTAMP,
  encadrant_id  INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at    TIMESTAMP DEFAULT NOW()
);
CREATE INDEX idx_projects_programme ON projects(programme_id);

-- ============================================================
-- PROJECT MEMBERS  (table de liaison many-to-many)
-- ============================================================
CREATE TABLE project_members (
  project_id  INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  joined_at   TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (project_id, user_id)
);

-- ============================================================
-- TASKS
-- ============================================================
CREATE TABLE tasks (
  id            SERIAL PRIMARY KEY,
  project_id    INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  titre         VARCHAR(255) NOT NULL,
  description   TEXT,
  statut        VARCHAR(20) NOT NULL DEFAULT 'todo'
                  CHECK (statut IN ('todo', 'in_progress', 'done')),
  priorite      VARCHAR(20) NOT NULL DEFAULT 'normale'
                  CHECK (priorite IN ('basse', 'normale', 'haute', 'urgente')),
  assigne_a     INTEGER REFERENCES users(id) ON DELETE SET NULL,
  deadline      DATE,
  created_at    TIMESTAMP DEFAULT NOW(),
  updated_at    TIMESTAMP DEFAULT NOW()
);

-- ============================================================
-- DELIVERABLE TEMPLATES (Livrables attendus)
-- ============================================================
-- Définis au niveau « Projet » (programme), communs à toutes les équipes
CREATE TABLE deliverable_templates (
  id              SERIAL PRIMARY KEY,
  programme_id    INTEGER REFERENCES programmes(id) ON DELETE CASCADE,
  project_id      INTEGER REFERENCES projects(id) ON DELETE CASCADE,  -- legacy, conservé
  titre           VARCHAR(255) NOT NULL,
  description     TEXT,
  type            VARCHAR(50) NOT NULL CHECK (type IN ('rapport', 'code', 'maquette', 'presentation', 'documentation', 'autre')),
  date_limite     DATE,
  obligatoire     BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_deliverable_templates_programme ON deliverable_templates(programme_id);

-- ============================================================
-- DELIVERABLES
-- ============================================================
CREATE TABLE deliverables (
  id                      SERIAL PRIMARY KEY,
  project_id              INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  template_id             INTEGER REFERENCES deliverable_templates(id) ON DELETE SET NULL,
  nom_fichier             VARCHAR(255) NOT NULL,
  url                     TEXT NOT NULL,             -- chemin relatif ou URL stockage
  uploade_par             INTEGER REFERENCES users(id) ON DELETE SET NULL,
  statut                  VARCHAR(20) NOT NULL DEFAULT 'en_attente'
                            CHECK (statut IN ('en_attente', 'valide', 'rejete')),
  commentaire_validation  TEXT,
  valide_par              INTEGER REFERENCES users(id) ON DELETE SET NULL,
  date_validation         TIMESTAMP,
  created_at              TIMESTAMP DEFAULT NOW()
);

-- ============================================================
-- COMMENTS
-- ============================================================
CREATE TABLE comments (
  id          SERIAL PRIMARY KEY,
  task_id     INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  contenu     TEXT NOT NULL,
  created_at  TIMESTAMP DEFAULT NOW()
);

-- ============================================================
-- MILESTONES
-- ============================================================
-- Définis au niveau « Projet » (programme), communs à toutes les équipes
CREATE TABLE milestones (
  id              SERIAL PRIMARY KEY,
  programme_id    INTEGER REFERENCES programmes(id) ON DELETE CASCADE,
  project_id      INTEGER REFERENCES projects(id) ON DELETE CASCADE,  -- legacy, conservé
  titre           VARCHAR(255) NOT NULL,
  description     TEXT,
  date_echeance   DATE NOT NULL,
  statut          VARCHAR(20) NOT NULL DEFAULT 'a_venir'
                    CHECK (statut IN ('a_venir', 'en_cours', 'atteint', 'manque')),
  created_at      TIMESTAMP DEFAULT NOW()
);

-- ============================================================
-- INDEX
-- ============================================================
CREATE INDEX idx_projects_encadrant   ON projects(encadrant_id);
CREATE INDEX idx_tasks_project        ON tasks(project_id);
CREATE INDEX idx_tasks_assigne        ON tasks(assigne_a);
CREATE INDEX idx_deliverables_project ON deliverables(project_id);
CREATE INDEX idx_comments_task        ON comments(task_id);
CREATE INDEX idx_pm_user              ON project_members(user_id);
CREATE INDEX idx_milestones_project   ON milestones(project_id);
CREATE INDEX idx_milestones_programme ON milestones(programme_id);

-- ============================================================
-- TRIGGER : updated_at auto-refresh sur tasks
-- ============================================================
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tasks_updated_at
  BEFORE UPDATE ON tasks
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- DONNÉES DE TEST (optionnel commenter en prod)
-- ============================================================
-- Encadrant
INSERT INTO users (nom, email, password, role) VALUES
  ('Prof. Dupont', 'dupont@junia.com',
   '$2b$10$example_hash_replace_me', 'encadrant');

-- Étudiants
INSERT INTO users (nom, email, password, role) VALUES
  ('Alice Martin',  'alice@student.junia.com',  '$2b$10$example_hash_replace_me', 'etudiant'),
  ('Bob Lefevre',   'bob@student.junia.com',    '$2b$10$example_hash_replace_me', 'etudiant'),
  ('Clara Petit',   'clara@student.junia.com',  '$2b$10$example_hash_replace_me', 'etudiant');

-- ============================================================
-- NOTIFICATIONS
-- ============================================================
DROP TABLE IF EXISTS notifications CASCADE;
CREATE TABLE notifications (
  id         SERIAL PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type       VARCHAR(50) DEFAULT 'info' CHECK (type IN ('info', 'tache', 'livrable', 'evaluation', 'aide', 'jalon', 'commentaire')),
  message    TEXT    NOT NULL,
  lien       TEXT,
  lu         BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX idx_notifs_user_unread ON notifications(user_id, lu) WHERE lu = FALSE;

-- ============================================================
-- DELIVERABLE COMMENTS + ENCADRANT FEEDBACK
-- ============================================================
DROP TABLE IF EXISTS deliverable_comments CASCADE;
CREATE TABLE deliverable_comments (
  id             SERIAL PRIMARY KEY,
  deliverable_id INTEGER NOT NULL REFERENCES deliverables(id) ON DELETE CASCADE,
  user_id        INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  contenu        TEXT    NOT NULL,
  created_at     TIMESTAMP DEFAULT NOW()
);

DROP TABLE IF EXISTS project_feedback CASCADE;
CREATE TABLE project_feedback (
  id          SERIAL PRIMARY KEY,
  project_id  INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  encadrant_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  contenu     TEXT    NOT NULL,
  created_at  TIMESTAMP DEFAULT NOW()
);

-- ============================================================
-- EVALUATIONS
-- ============================================================
DROP TABLE IF EXISTS evaluations CASCADE;
CREATE TABLE evaluations (
  id              SERIAL PRIMARY KEY,
  project_id      INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  evaluateur_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  note_globale    DECIMAL(4,2) CHECK (note_globale >= 0 AND note_globale <= 20),
  commentaire     TEXT,
  date_soutenance DATE,
  created_at      TIMESTAMP DEFAULT NOW(),
  updated_at      TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_evaluations_project ON evaluations(project_id);

-- ============================================================
-- EVALUATION CRITERIA (Critères d'évaluation détaillés)
-- ============================================================
DROP TABLE IF EXISTS evaluation_criteria CASCADE;
CREATE TABLE evaluation_criteria (
  id              SERIAL PRIMARY KEY,
  evaluation_id   INTEGER NOT NULL REFERENCES evaluations(id) ON DELETE CASCADE,
  nom_critere     VARCHAR(255) NOT NULL,
  note            DECIMAL(4,2) CHECK (note >= 0 AND note <= 20),
  coefficient     INTEGER NOT NULL DEFAULT 1 CHECK (coefficient >= 1),
  commentaire     TEXT,
  created_at      TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_criteria_evaluation ON evaluation_criteria(evaluation_id);

-- Trigger : updated_at auto-refresh sur evaluations
CREATE TRIGGER evaluations_updated_at
  BEFORE UPDATE ON evaluations
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
