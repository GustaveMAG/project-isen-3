const express = require('express');
const { body, validationResult } = require('express-validator');
const db      = require('../config/db');
const { authenticate } = require('../middleware/auth');
const { notify } = require('../services/notificationService');

const router = express.Router({ mergeParams: true });
router.use(authenticate);

// GET /api/deliverables/:deliverableId/comments
router.get('/', async (req, res) => {
  const { deliverableId } = req.params;
  try {
    const { rows } = await db.query(
      `SELECT dc.*, u.nom AS auteur_nom, u.role AS auteur_role
       FROM deliverable_comments dc
       JOIN users u ON u.id = dc.user_id
       WHERE dc.deliverable_id = $1
       ORDER BY dc.created_at ASC`,
      [deliverableId]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

// POST /api/deliverables/:deliverableId/comments
router.post('/', [body('contenu').trim().notEmpty().withMessage('Contenu requis')], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const { deliverableId } = req.params;
  try {
    const { rows } = await db.query(
      `INSERT INTO deliverable_comments (deliverable_id, user_id, contenu)
       VALUES ($1,$2,$3) RETURNING *`,
      [deliverableId, req.user.id, req.body.contenu]
    );
    const { rows: full } = await db.query(
      `SELECT dc.*, u.nom AS auteur_nom, u.role AS auteur_role
       FROM deliverable_comments dc
       JOIN users u ON u.id = dc.user_id WHERE dc.id = $1`,
      [rows[0].id]
    );

    // Notifier l'auteur du livrable si c'est l'encadrant qui commente
    if (req.user.role === 'encadrant') {
      const deliv = await db.query(
        `SELECT d.nom_fichier, d.uploade_par, p.id AS project_id, p.titre
         FROM deliverables d JOIN projects p ON p.id = d.project_id
         WHERE d.id = $1`, [deliverableId]
      );
      if (deliv.rows[0]?.uploade_par && deliv.rows[0].uploade_par !== req.user.id) {
        await notify(deliv.rows[0].uploade_par,
          `Feedback encadrant sur votre livrable « ${deliv.rows[0].nom_fichier} »`,
          `/projects/${deliv.rows[0].project_id}`
        );
      }
    }
    res.status(201).json(full[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

module.exports = router;
