-- Migration : Mise à jour contrainte états du projet (4 états simplifiés)
-- À exécuter dans Railway Postgres console

-- Supprimer l'ancienne contrainte
ALTER TABLE projects
DROP CONSTRAINT IF EXISTS projects_etat_check;

-- Ajouter la nouvelle contrainte (4 états uniquement)
ALTER TABLE projects
ADD CONSTRAINT projects_etat_check
CHECK (etat IN ('en_cours', 'en_retard', 'termine', 'cloture'));

-- Mettre à jour les anciennes valeurs vers les nouvelles
UPDATE projects SET etat = 'en_cours' WHERE etat IN ('propose', 'valide');
UPDATE projects SET etat = 'termine' WHERE etat IN ('livre', 'soutenu');

-- Vérification
SELECT 'États du projet mis à jour' AS statut;
SELECT etat, COUNT(*) as nb FROM projects GROUP BY etat;
