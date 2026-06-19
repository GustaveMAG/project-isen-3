-- ============================================================
-- MIGRATION : date de clôture des projets
-- Ajoute la colonne date_cloture pour tracer quand un projet
-- a été clôturé. L'état 'cloture' existe déjà dans le CHECK.
-- ============================================================

ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS date_cloture TIMESTAMP;

-- Renseigne une date pour les projets déjà clôturés (best effort)
UPDATE projects
   SET date_cloture = NOW()
 WHERE etat = 'cloture'
   AND date_cloture IS NULL;
