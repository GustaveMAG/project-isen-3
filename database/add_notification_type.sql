-- Migration : Ajout type de notification
-- À exécuter dans Railway Postgres console

-- Ajouter la colonne type
ALTER TABLE notifications
ADD COLUMN type VARCHAR(50) DEFAULT 'info';

-- Ajouter la contrainte CHECK
ALTER TABLE notifications
ADD CONSTRAINT notifications_type_check
CHECK (type IN ('info', 'tache', 'livrable', 'evaluation', 'aide', 'jalon', 'commentaire'));

-- Vérification
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'notifications'
ORDER BY ordinal_position;
