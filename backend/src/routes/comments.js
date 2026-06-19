const express = require('express');
const { body, validationResult } = require('express-validator');
const db      = require('../config/db');
const { authenticate } = require('../middleware/auth');

const router = express.Router({ mergeParams: true }); // hérite taskId
router.use(authenticate);

// helper : vérifie que l'utilisateur peut accéder à la tâche
async function canAccessTask(taskId, user) {
  const { rows } = await db.query(
    'SELECT t.project_id FROM tasks t WHERE t.id = $1',
    [taskId]
  );
  if (!rows.length) return false;
  const projectId = rows[0].project_id;

  // Jury peut voir tous les projets
  if (user.role === 'jury') return true;

  if (user.role === 'encadrant') {
    const { rows: r } = await db.query(
      'SELECT 1 FROM projects WHERE id=$1 AND encadrant_id=$2',
      [projectId, user.id]
    );
    return r.length > 0;
  }
  const { rows: r } = await db.query(
    'SELECT 1 FROM project_members WHERE project_id=$1 AND user_id=$2',
    [projectId, user.id]
  );
  return r.length > 0;
}

// GET /api/tasks/:taskId/comments
router.get('/', async (req, res) => {
  const { taskId } = req.params;
  try {
    if (!(await canAccessTask(taskId, req.user))) {
      return res.status(403).json({ message: 'Accès refusé' });
    }

    const { rows } = await db.query(
      `SELECT c.*, u.nom AS auteur_nom
       FROM comments c
       JOIN users u ON u.id = c.user_id
       WHERE c.task_id = $1
       ORDER BY c.created_at ASC`,
      [taskId]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

// POST /api/tasks/:taskId/comments
router.post(
  '/',
  [body('contenu').trim().notEmpty().withMessage('Contenu requis')],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { taskId } = req.params;
    try {
      if (!(await canAccessTask(taskId, req.user))) {
        return res.status(403).json({ message: 'Accès refusé' });
      }

      const { rows } = await db.query(
        `INSERT INTO comments (task_id, user_id, contenu)
         VALUES ($1,$2,$3)
         RETURNING *`,
        [taskId, req.user.id, req.body.contenu]
      );

      // Retourne le commentaire avec le nom de l'auteur
      const { rows: full } = await db.query(
        `SELECT c.*, u.nom AS auteur_nom
         FROM comments c
         JOIN users u ON u.id = c.user_id
         WHERE c.id = $1`,
        [rows[0].id]
      );
      res.status(201).json(full[0]);
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: 'Erreur serveur' });
    }
  }
);

// DELETE /api/tasks/:taskId/comments/:id
// Seul l'auteur ou un encadrant peut supprimer
router.delete('/:id', async (req, res) => {
  const { taskId, id } = req.params;
  try {
    if (!(await canAccessTask(taskId, req.user))) {
      return res.status(403).json({ message: 'Accès refusé' });
    }

    const { rows } = await db.query(
      'SELECT * FROM comments WHERE id=$1 AND task_id=$2',
      [id, taskId]
    );
    if (!rows.length) return res.status(404).json({ message: 'Commentaire introuvable' });

    if (rows[0].user_id !== req.user.id && req.user.role !== 'encadrant') {
      return res.status(403).json({ message: 'Vous ne pouvez supprimer que vos commentaires' });
    }

    await db.query('DELETE FROM comments WHERE id=$1', [id]);
    res.json({ message: 'Commentaire supprimé' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

module.exports = router;
