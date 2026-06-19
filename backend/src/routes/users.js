const express = require('express');
const db      = require('../config/db');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

// GET /api/users  utile pour l'encadrant (ajouter membres)
//   ?role=etudiant            → un seul rôle
//   ?roles=etudiant,team_leader → plusieurs rôles (séparés par des virgules)
router.get('/', requireRole('encadrant'), async (req, res) => {
  try {
    const { role, roles } = req.query;
    let query = 'SELECT id, nom, email, role FROM users';
    const params = [];

    const roleList = roles
      ? roles.split(',').map((r) => r.trim()).filter(Boolean)
      : role
        ? [role]
        : [];

    if (roleList.length) {
      const placeholders = roleList.map((_, i) => `$${i + 1}`).join(', ');
      query += ` WHERE role IN (${placeholders})`;
      params.push(...roleList);
    }
    query += ' ORDER BY nom ASC';
    const { rows } = await db.query(query, params);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

// PATCH /api/users/:id/role  encadrant : promouvoir / rétrograder team leader
// N'autorise que la bascule entre 'etudiant' et 'team_leader'
// (impossible de toucher aux encadrants / jury)
router.patch('/:id/role', requireRole('encadrant'), async (req, res) => {
  const { id } = req.params;
  const { role } = req.body;

  if (!['etudiant', 'team_leader'].includes(role)) {
    return res.status(400).json({ message: 'Rôle invalide (etudiant ou team_leader)' });
  }

  try {
    const { rows } = await db.query(
      `UPDATE users SET role = $1
        WHERE id = $2 AND role IN ('etudiant', 'team_leader')
      RETURNING id, nom, email, role`,
      [role, id]
    );
    if (!rows.length) {
      return res.status(404).json({ message: 'Membre introuvable (ou rôle non modifiable)' });
    }
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

module.exports = router;
