const express = require('express');
const { body, validationResult } = require('express-validator');
const db      = require('../config/db');
const { authenticate } = require('../middleware/auth');
const { notify } = require('../services/notificationService');

const router = express.Router({ mergeParams: true });
router.use(authenticate);

// GET /api/help/pending toutes les demandes pour l'encadrant connecté
router.get('/pending', async (req, res) => {
  if (req.user.role !== 'encadrant') {
    return res.status(403).json({ message: 'Réservé aux encadrants' });
  }
  try {
    const { rows } = await db.query(
      `SELECT hr.*, p.titre AS projet_titre,
              u1.nom AS auteur_nom
       FROM help_requests hr
       JOIN projects p ON p.id = hr.project_id
       JOIN users u1 ON u1.id = hr.auteur_id
       WHERE p.encadrant_id = $1
       ORDER BY hr.statut ASC, hr.created_at ASC`,
      [req.user.id]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

// PATCH /api/help/:id/repondre
router.patch('/:id/repondre', [
  body('reponse').trim().notEmpty().withMessage('Réponse requise'),
  body('statut').isIn(['pris_en_charge', 'resolu']).withMessage('Statut invalide'),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  if (req.user.role !== 'encadrant') {
    return res.status(403).json({ message: 'Réservé aux encadrants' });
  }

  const { id } = req.params;
  const { reponse, statut } = req.body;

  try {
    const { rows } = await db.query(
      `UPDATE help_requests
       SET reponse = $1, statut = $2, repondu_par = $3, repondu_le = NOW()
       WHERE id = $4 RETURNING *`,
      [reponse, statut, req.user.id, id]
    );
    if (!rows[0]) return res.status(404).json({ message: 'Demande introuvable' });

    // Notifier l'auteur de la demande
    const label = statut === 'resolu' ? '✅ Résolue' : '🔵 Prise en charge';
    await notify(
      rows[0].auteur_id,
      `${label} votre demande d'aide « ${rows[0].titre} » a reçu une réponse`,
      `/projects/${rows[0].project_id}`
    );

    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

module.exports = router;
