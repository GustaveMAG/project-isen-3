-- Migration : Ajout validation des livrables
-- À exécuter dans Railway Postgres console

-- Ajouter les colonnes de validation
ALTER TABLE deliverables
ADD COLUMN statut VARCHAR(20) NOT NULL DEFAULT 'en_attente';

ALTER TABLE deliverables
ADD CONSTRAINT deliverables_statut_check
CHECK (statut IN ('en_attente', 'valide', 'rejete'));

ALTER TABLE deliverables
ADD COLUMN commentaire_validation TEXT;

ALTER TABLE deliverables
ADD COLUMN valide_par INTEGER REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE deliverables
ADD COLUMN date_validation TIMESTAMP;

-- Vérification
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'deliverables'
AND column_name IN ('statut', 'commentaire_validation', 'valide_par', 'date_validation');
