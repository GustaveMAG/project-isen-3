const express = require('express');
const router  = express.Router();
const db      = require('../config/db');
const { authenticate } = require('../middleware/auth');

// GET /api/notifications liste des notifs de l'utilisateur connecté
router.get('/', authenticate, async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50`,
      [req.user.id]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

// PATCH /api/notifications/:id/lu marquer une notif comme lue
router.patch('/:id/lu', authenticate, async (req, res) => {
  try {
    const { rows } = await db.query(
      `UPDATE notifications SET lu = TRUE WHERE id = $1 AND user_id = $2 RETURNING *`,
      [req.params.id, req.user.id]
    );
    if (!rows[0]) return res.status(404).json({ message: 'Notification introuvable' });
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

// PATCH /api/notifications/tout-lire marquer toutes comme lues
router.patch('/tout-lire', authenticate, async (req, res) => {
  try {
    await db.query(
      `UPDATE notifications SET lu = TRUE WHERE user_id = $1 AND lu = FALSE`,
      [req.user.id]
    );
    res.json({ message: 'Toutes les notifications marquées comme lues' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

module.exports = router;
