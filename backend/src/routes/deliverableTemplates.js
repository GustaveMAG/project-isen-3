const express = require('express');
const { body, validationResult } = require('express-validator');
const db = require('../config/db');
const { authenticate, requireRole } = require('../middleware/auth');
const { blockIfClosed } = require('../middleware/projectLock');

// Monté sous /api/programmes/:programmeId/deliverable-templates
// Les livrables attendus sont définis au niveau « Projet » (programme),
// communs à toutes les équipes.
const router = express.Router({ mergeParams: true });
router.use(authenticate);
router.use(blockIfClosed); // refuse les écritures si le programme est clôturé

// Helper : vérifier que l'encadrant supervise ce programme
async function isProgrammeEncadrant(programmeId, userId) {
  const { rows } = await db.query(
    'SELECT 1 FROM programmes WHERE id=$1 AND encadrant_id=$2',
    [programmeId, userId]
  );
  return rows.length > 0;
}

// Helper : l'utilisateur peut-il consulter ce programme ?
async function canAccessProgramme(programmeId, user) {
  if (user.role === 'jury') return true;
  if (user.role === 'encadrant') return isProgrammeEncadrant(programmeId, user.id);
  const { rows } = await db.query(
    `SELECT 1 FROM project_members pm
       JOIN projects pr ON pr.id = pm.project_id
      WHERE pr.programme_id = $1 AND pm.user_id = $2 LIMIT 1`,
    [programmeId, user.id]
  );
  return rows.length > 0;
}

// GET /api/programmes/:programmeId/deliverable-templates
router.get('/', async (req, res) => {
  const { programmeId } = req.params;
  try {
    if (!(await canAccessProgramme(programmeId, req.user))) {
      return res.status(403).json({ message: 'Accès refusé' });
    }
    const { rows } = await db.query(
      `SELECT * FROM deliverable_templates
       WHERE programme_id = $1
       ORDER BY date_limite ASC NULLS LAST, created_at ASC`,
      [programmeId]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

// POST /api/programmes/:programmeId/deliverable-templates
router.post(
  '/',
  requireRole('encadrant'),
  [
    body('titre').trim().notEmpty().withMessage('Titre requis'),
    body('type').isIn(['rapport', 'code', 'maquette', 'presentation', 'documentation', 'autre']).withMessage('Type invalide'),
    body('date_limite').optional({ nullable: true }).isDate().withMessage('Date invalide'),
    body('obligatoire').optional().isBoolean(),
  ],
  async (req, res) => {
    const { programmeId } = req.params;
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    try {
      if (!(await isProgrammeEncadrant(programmeId, req.user.id))) {
        return res.status(403).json({ message: 'Accès refusé' });
      }

      const { titre, description, type, date_limite, obligatoire } = req.body;
      const { rows } = await db.query(
        `INSERT INTO deliverable_templates (programme_id, titre, description, type, date_limite, obligatoire)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [programmeId, titre, description || null, type, date_limite || null, obligatoire !== undefined ? obligatoire : true]
      );
      res.status(201).json(rows[0]);
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: 'Erreur serveur' });
    }
  }
);

// PUT /api/programmes/:programmeId/deliverable-templates/:id
router.put(
  '/:id',
  requireRole('encadrant'),
  [
    body('titre').trim().notEmpty().withMessage('Titre requis'),
    body('type').isIn(['rapport', 'code', 'maquette', 'presentation', 'documentation', 'autre']).withMessage('Type invalide'),
    body('date_limite').optional({ nullable: true }).isDate().withMessage('Date invalide'),
    body('obligatoire').optional().isBoolean(),
  ],
  async (req, res) => {
    const { programmeId, id } = req.params;
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    try {
      if (!(await isProgrammeEncadrant(programmeId, req.user.id))) {
        return res.status(403).json({ message: 'Accès refusé' });
      }

      const { titre, description, type, date_limite, obligatoire } = req.body;
      const { rows } = await db.query(
        `UPDATE deliverable_templates
         SET titre=$1, description=$2, type=$3, date_limite=$4, obligatoire=$5
         WHERE id=$6 AND programme_id=$7
         RETURNING *`,
        [titre, description || null, type, date_limite || null, obligatoire !== undefined ? obligatoire : true, id, programmeId]
      );

      if (!rows.length) {
        return res.status(404).json({ message: 'Template introuvable' });
      }
      res.json(rows[0]);
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: 'Erreur serveur' });
    }
  }
);

// DELETE /api/programmes/:programmeId/deliverable-templates/:id
router.delete('/:id', requireRole('encadrant'), async (req, res) => {
  const { programmeId, id } = req.params;
  try {
    if (!(await isProgrammeEncadrant(programmeId, req.user.id))) {
      return res.status(403).json({ message: 'Accès refusé' });
    }

    const { rows } = await db.query(
      'DELETE FROM deliverable_templates WHERE id=$1 AND programme_id=$2 RETURNING id',
      [id, programmeId]
    );

    if (!rows.length) {
      return res.status(404).json({ message: 'Template introuvable' });
    }
    res.json({ message: 'Template supprimé' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

module.exports = router;
