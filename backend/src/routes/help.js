const express = require('express');
const { body, validationResult } = require('express-validator');
const db      = require('../config/db');
const { authenticate } = require('../middleware/auth');
const { blockIfClosed } = require('../middleware/projectLock');
const { notify } = require('../services/notificationService');

const router = express.Router({ mergeParams: true });
router.use(authenticate);
router.use(blockIfClosed); // refuse les écritures si le projet est clôturé

// GET /api/projects/:id/help
router.get('/', async (req, res) => {
  const { id } = req.params;
  try {
    const { rows } = await db.query(
      `SELECT hr.*,
              u1.nom AS auteur_nom,
              u2.nom AS repondu_par_nom
       FROM help_requests hr
       JOIN users u1 ON u1.id = hr.auteur_id
       LEFT JOIN users u2 ON u2.id = hr.repondu_par
       WHERE hr.project_id = $1
       ORDER BY hr.created_at DESC`,
      [id]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

// POST /api/projects/:id/help
router.post('/', [
  body('titre').trim().notEmpty().withMessage('Titre requis'),
  body('description').trim().notEmpty().withMessage('Description requise'),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  if (!['etudiant', 'team_leader'].includes(req.user.role)) {
    return res.status(403).json({ message: 'Réservé aux étudiants' });
  }

  const { id } = req.params;
  const { titre, description } = req.body;

  try {
    const { rows } = await db.query(
      `INSERT INTO help_requests (project_id, auteur_id, titre, description)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [id, req.user.id, titre, description]
    );

    // Notifier l'encadrant
    const proj = await db.query(
      'SELECT titre, encadrant_id FROM projects WHERE id = $1', [id]
    );
    if (proj.rows[0]?.encadrant_id) {
      await notify(
        proj.rows[0].encadrant_id,
        `🆘 Nouvelle demande d'aide sur le projet « ${proj.rows[0].titre} » : ${titre}`,
        `/projects/${id}`
      );
    }

    res.status(201).json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

module.exports = router;
