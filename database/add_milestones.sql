-- Migration : Ajout des jalons (milestones)
-- À exécuter dans Railway Postgres console

-- Créer la table milestones
CREATE TABLE milestones (
  id              SERIAL PRIMARY KEY,
  project_id      INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  titre           VARCHAR(255) NOT NULL,
  description     TEXT,
  date_echeance   DATE NOT NULL,
  statut          VARCHAR(20) NOT NULL DEFAULT 'a_venir',
  created_at      TIMESTAMP DEFAULT NOW()
);

-- Ajouter la contrainte CHECK
ALTER TABLE milestones
ADD CONSTRAINT milestones_statut_check
CHECK (statut IN ('a_venir', 'en_cours', 'atteint', 'manque'));

-- Créer l'index
CREATE INDEX idx_milestones_project ON milestones(project_id);

-- Vérification
SELECT table_name, column_name, data_type
FROM information_schema.columns
WHERE table_name = 'milestones'
ORDER BY ordinal_position;
