-- Migration : Ajout priorités des tâches
-- À exécuter dans Railway Postgres console

-- Ajouter la colonne priorite
ALTER TABLE tasks
ADD COLUMN priorite VARCHAR(20) NOT NULL DEFAULT 'normale'
CHECK (priorite IN ('basse', 'normale', 'haute', 'urgente'));

-- Vérification
SELECT 'Colonne priorite ajoutée' AS statut;
SELECT id, titre, priorite FROM tasks LIMIT 3;
