-- Migration : Ajout table evaluations
-- À exécuter dans Railway Postgres console

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

-- Trigger : updated_at auto-refresh sur evaluations
CREATE TRIGGER evaluations_updated_at
  BEFORE UPDATE ON evaluations
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Vérification
SELECT 'Table evaluations créée avec succès' AS statut;
