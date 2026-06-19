-- ============================================================
-- MIGRATION : couche "Projet" (parent) au-dessus des équipes
-- ------------------------------------------------------------
-- MAPPING vocabulaire UI  <->  base de données :
--   « Projet »  (le sujet global, parent)      = table  programmes
--   « Équipe »  (le groupe + son espace, enfant) = table  projects  (existante)
--
-- Ce qui vit au niveau PARENT (programmes) :
--   - le sujet / la description
--   - les livrables attendus  (deliverable_templates)
--   - les jalons              (milestones)
-- Ce qui reste au niveau ÉQUIPE (projects) :
--   - les membres, les tâches, les dépôts de livrables,
--     les évaluations, le feedback, les demandes d'aide
-- ============================================================

-- 1) Table parente -------------------------------------------------
CREATE TABLE IF NOT EXISTS programmes (
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
CREATE INDEX IF NOT EXISTS idx_programmes_encadrant ON programmes(encadrant_id);

-- 2) Rattachement équipe -> projet parent --------------------------
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS programme_id INTEGER REFERENCES programmes(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_projects_programme ON projects(programme_id);

-- 3) Livrables attendus + jalons remontent au niveau parent --------
ALTER TABLE deliverable_templates
  ADD COLUMN IF NOT EXISTS programme_id INTEGER REFERENCES programmes(id) ON DELETE CASCADE;
ALTER TABLE deliverable_templates ALTER COLUMN project_id DROP NOT NULL;
CREATE INDEX IF NOT EXISTS idx_deliverable_templates_programme ON deliverable_templates(programme_id);

ALTER TABLE milestones
  ADD COLUMN IF NOT EXISTS programme_id INTEGER REFERENCES programmes(id) ON DELETE CASCADE;
ALTER TABLE milestones ALTER COLUMN project_id DROP NOT NULL;
CREATE INDEX IF NOT EXISTS idx_milestones_programme ON milestones(programme_id);

-- 4) Backfill : un projet parent par projet existant (1:1) ---------
--    => tes données actuelles deviennent "une équipe sous son projet"
DO $$
DECLARE
  p       RECORD;
  new_id  INTEGER;
BEGIN
  FOR p IN SELECT * FROM projects WHERE programme_id IS NULL LOOP
    INSERT INTO programmes (titre, description, date_debut, date_fin, etat, date_cloture, encadrant_id, created_at)
    VALUES (p.titre, p.description, p.date_debut, p.date_fin, p.etat, p.date_cloture, p.encadrant_id, p.created_at)
    RETURNING id INTO new_id;

    UPDATE projects             SET programme_id = new_id WHERE id = p.id;
    UPDATE deliverable_templates SET programme_id = new_id WHERE project_id = p.id;
    UPDATE milestones            SET programme_id = new_id WHERE project_id = p.id;
  END LOOP;
END $$;
