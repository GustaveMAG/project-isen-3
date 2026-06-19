const express = require('express');
const { body, validationResult } = require('express-validator');
const db      = require('../config/db');
const { authenticate } = require('../middleware/auth');
const { blockIfClosed } = require('../middleware/projectLock');
const { notify } = require('../services/notificationService');

const router = express.Router({ mergeParams: true });
router.use(authenticate);
router.use(blockIfClosed); // refuse les écritures si le projet est clôturé

// GET /api/projects/:projectId/feedback
router.get('/', async (req, res) => {
  const { projectId } = req.params;
  try {
    const { rows } = await db.query(
      `SELECT pf.*, u.nom AS encadrant_nom
       FROM project_feedback pf
       JOIN users u ON u.id = pf.encadrant_id
       WHERE pf.project_id = $1
       ORDER BY pf.created_at DESC`,
      [projectId]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

// POST /api/projects/:projectId/feedback encadrant seulement
router.post('/', [body('contenu').trim().notEmpty().withMessage('Contenu requis')], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  if (req.user.role !== 'encadrant') {
    return res.status(403).json({ message: 'Réservé aux encadrants' });
  }

  const { projectId } = req.params;
  try {
    const { rows } = await db.query(
      `INSERT INTO project_feedback (project_id, encadrant_id, contenu)
       VALUES ($1,$2,$3) RETURNING *`,
      [projectId, req.user.id, req.body.contenu]
    );
    const { rows: full } = await db.query(
      `SELECT pf.*, u.nom AS encadrant_nom FROM project_feedback pf
       JOIN users u ON u.id = pf.encadrant_id WHERE pf.id = $1`,
      [rows[0].id]
    );

    // Notifier tous les membres du projet
    const members = await db.query(
      `SELECT pm.user_id FROM project_members pm WHERE pm.project_id = $1`,
      [projectId]
    );
    const proj = await db.query('SELECT titre FROM projects WHERE id=$1', [projectId]);
    for (const m of members.rows) {
      await notify(m.user_id,
        `Nouveau feedback de votre encadrant sur le projet ${proj.rows[0]?.titre}`,
        `/projects/${projectId}`
      );
    }
    res.status(201).json(full[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

module.exports = router;
