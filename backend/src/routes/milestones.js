const express = require('express');
const { body, validationResult } = require('express-validator');
const db = require('../config/db');
const { authenticate } = require('../middleware/auth');
const { blockIfClosed } = require('../middleware/projectLock');

// Monté sous /api/programmes/:programmeId/milestones
// Les jalons sont définis au niveau « Projet » (programme), communs à toutes les équipes.
const router = express.Router({ mergeParams: true });
router.use(authenticate);
router.use(blockIfClosed); // refuse les écritures si le programme est clôturé

// Helpers
async function isProgrammeEncadrant(programmeId, user) {
  if (user.role !== 'encadrant') return false;
  const { rows } = await db.query(
    'SELECT 1 FROM programmes WHERE id=$1 AND encadrant_id=$2',
    [programmeId, user.id]
  );
  return rows.length > 0;
}

async function canAccessProgramme(programmeId, user) {
  if (user.role === 'jury') return true;
  if (user.role === 'encadrant') {
    const { rows } = await db.query(
      'SELECT 1 FROM programmes WHERE id=$1 AND encadrant_id=$2',
      [programmeId, user.id]
    );
    return rows.length > 0;
  }
  // étudiant / team_leader : membre d'une équipe rattachée à ce programme
  const { rows } = await db.query(
    `SELECT 1
       FROM project_members pm
       JOIN projects pr ON pr.id = pm.project_id
      WHERE pr.programme_id = $1 AND pm.user_id = $2
      LIMIT 1`,
    [programmeId, user.id]
  );
  return rows.length > 0;
}

// GET /api/programmes/:programmeId/milestones
router.get('/', async (req, res) => {
  const { programmeId } = req.params;
  try {
    if (!(await canAccessProgramme(programmeId, req.user))) {
      return res.status(403).json({ message: 'Accès refusé' });
    }
    const { rows } = await db.query(
      `SELECT * FROM milestones
       WHERE programme_id = $1
       ORDER BY date_echeance ASC, created_at ASC`,
      [programmeId]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

// POST /api/programmes/:programmeId/milestones
router.post(
  '/',
  [
    body('titre').trim().notEmpty().withMessage('Titre requis'),
    body('date_echeance').isDate().withMessage('Date échéance invalide'),
    body('statut').optional().isIn(['a_venir', 'en_cours', 'atteint', 'manque']),
  ],
  async (req, res) => {
    const { programmeId } = req.params;
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    try {
      if (!(await isProgrammeEncadrant(programmeId, req.user))) {
        return res.status(403).json({ message: 'Seul l\'encadrant du projet peut créer des jalons' });
      }

      const { titre, description, date_echeance, statut } = req.body;
      const { rows } = await db.query(
        `INSERT INTO milestones (programme_id, titre, description, date_echeance, statut)
         VALUES ($1, $2, $3, $4, $5) RETURNING *`,
        [programmeId, titre, description || null, date_echeance, statut || 'a_venir']
      );
      res.status(201).json(rows[0]);
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: 'Erreur serveur' });
    }
  }
);

// PUT /api/programmes/:programmeId/milestones/:id
router.put(
  '/:id',
  [
    body('titre').trim().notEmpty().withMessage('Titre requis'),
    body('date_echeance').isDate().withMessage('Date échéance invalide'),
    body('statut').isIn(['a_venir', 'en_cours', 'atteint', 'manque']).withMessage('Statut invalide'),
  ],
  async (req, res) => {
    const { programmeId, id } = req.params;
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    try {
      if (!(await isProgrammeEncadrant(programmeId, req.user))) {
        return res.status(403).json({ message: 'Seul l\'encadrant du projet peut modifier des jalons' });
      }

      const { titre, description, date_echeance, statut } = req.body;
      const { rows } = await db.query(
        `UPDATE milestones
         SET titre=$1, description=$2, date_echeance=$3, statut=$4
         WHERE id=$5 AND programme_id=$6
         RETURNING *`,
        [titre, description || null, date_echeance, statut, id, programmeId]
      );

      if (!rows.length) {
        return res.status(404).json({ message: 'Jalon introuvable' });
      }
      res.json(rows[0]);
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: 'Erreur serveur' });
    }
  }
);

// DELETE /api/programmes/:programmeId/milestones/:id
router.delete('/:id', async (req, res) => {
  const { programmeId, id } = req.params;
  try {
    if (!(await isProgrammeEncadrant(programmeId, req.user))) {
      return res.status(403).json({ message: 'Seul l\'encadrant du projet peut supprimer des jalons' });
    }

    const { rows } = await db.query(
      'DELETE FROM milestones WHERE id=$1 AND programme_id=$2 RETURNING id',
      [id, programmeId]
    );

    if (!rows.length) {
      return res.status(404).json({ message: 'Jalon introuvable' });
    }
    res.json({ message: 'Jalon supprimé' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

module.exports = router;
