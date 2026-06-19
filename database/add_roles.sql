-- Migration : Ajout rôles team_leader et jury
-- À exécuter dans Railway Postgres console

-- Supprimer l'ancienne contrainte
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;

-- Ajouter la nouvelle contrainte avec les 4 rôles
ALTER TABLE users ADD CONSTRAINT users_role_check
  CHECK (role IN ('encadrant', 'etudiant', 'team_leader', 'jury'));

-- Vérification
SELECT 'Rôles team_leader et jury ajoutés avec succès' AS statut;

-- Optionnel : créer un compte jury de test
INSERT INTO users (nom, email, password, role) VALUES
  ('Jury Test', 'jury@junia.com', '$2b$10$Azv0rL7uehKtkqMJC07VAuuxIngou.nxRvFcXenviaD1kZef2Oq0G', 'jury')
ON CONFLICT (email) DO NOTHING;

SELECT 'Compte jury créé (jury@junia.com / Demo1234!)' AS info;
