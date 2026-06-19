-- Migration : Ajout système de livrables attendus
-- À exécuter dans Railway Postgres console

-- Créer la table deliverable_templates
CREATE TABLE deliverable_templates (
  id              SERIAL PRIMARY KEY,
  project_id      INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  titre           VARCHAR(255) NOT NULL,
  description     TEXT,
  type            VARCHAR(50) NOT NULL CHECK (type IN ('rapport', 'code', 'maquette', 'presentation', 'documentation', 'autre')),
  date_limite     DATE,
  obligatoire     BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMP DEFAULT NOW()
);

-- Créer l'index
CREATE INDEX idx_deliverable_templates_project ON deliverable_templates(project_id);

-- Ajouter template_id aux deliverables existants
ALTER TABLE deliverables
ADD COLUMN template_id INTEGER REFERENCES deliverable_templates(id) ON DELETE SET NULL;

-- Vérification
SELECT table_name, column_name, data_type
FROM information_schema.columns
WHERE table_name = 'deliverable_templates'
ORDER BY ordinal_position;
