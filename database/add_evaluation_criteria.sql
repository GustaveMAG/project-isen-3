-- Migration : Ajout grille d'évaluation par critères
-- À exécuter dans Railway Postgres console

-- Créer la table evaluation_criteria
CREATE TABLE evaluation_criteria (
  id              SERIAL PRIMARY KEY,
  evaluation_id   INTEGER NOT NULL REFERENCES evaluations(id) ON DELETE CASCADE,
  nom_critere     VARCHAR(255) NOT NULL,
  note            DECIMAL(4,2) CHECK (note >= 0 AND note <= 20),
  coefficient     INTEGER NOT NULL DEFAULT 1 CHECK (coefficient >= 1),
  commentaire     TEXT,
  created_at      TIMESTAMP DEFAULT NOW()
);

-- Créer l'index
CREATE INDEX idx_criteria_evaluation ON evaluation_criteria(evaluation_id);

-- Vérification
SELECT table_name, column_name, data_type
FROM information_schema.columns
WHERE table_name = 'evaluation_criteria'
ORDER BY ordinal_position;
