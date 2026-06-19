const express = require('express');
const { body, validationResult } = require('express-validator');
const db      = require('../config/db');
const { authenticate } = require('../middleware/auth');
const { blockIfClosed } = require('../middleware/projectLock');
const { notify } = require('../services/notificationService');

const router = express.Router({ mergeParams: true }); // hérite projectId
router.use(authenticate);
router.use(blockIfClosed); // refuse les écritures si le projet est clôturé

// helper : vérifie accès au projet
async function canAccessProject(projectId, user) {
  // Jury peut voir tous les projets
  if (user.role === 'jury') return true;

  if (user.role === 'encadrant') {
    const { rows } = await db.query(
      'SELECT 1 FROM projects WHERE id=$1 AND encadrant_id=$2',
      [projectId, user.id]
    );
    return rows.length > 0;
  }
  const { rows } = await db.query(
    'SELECT 1 FROM project_members WHERE project_id=$1 AND user_id=$2',
    [projectId, user.id]
  );
  return rows.length > 0;
}

// helper : vérifie si peut modifier les tâches (encadrant OU team_leader)
async function canManageTasks(projectId, user) {
  // Encadrant du projet
  if (user.role === 'encadrant') {
    const { rows } = await db.query(
      'SELECT 1 FROM projects WHERE id=$1 AND encadrant_id=$2',
      [projectId, user.id]
    );
    return rows.length > 0;
  }
  // Team Leader membre du projet
  if (user.role === 'team_leader') {
    const { rows } = await db.query(
      'SELECT 1 FROM project_members WHERE project_id=$1 AND user_id=$2',
      [projectId, user.id]
    );
    return rows.length > 0;
  }
  return false;
}

// GET /api/projects/:projectId/tasks
router.get('/', async (req, res) => {
  const { projectId } = req.params;
  try {
    if (!(await canAccessProject(projectId, req.user))) {
      return res.status(403).json({ message: 'Accès refusé' });
    }

    const { statut, assigne_a } = req.query;
    let query = `
      SELECT t.*, u.nom AS assignee_nom
      FROM tasks t
      LEFT JOIN users u ON u.id = t.assigne_a
      WHERE t.project_id = $1`;
    const params = [projectId];

    if (statut) {
      params.push(statut);
      query += ` AND t.statut = $${params.length}`;
    }
    if (assigne_a) {
      params.push(assigne_a);
      query += ` AND t.assigne_a = $${params.length}`;
    }
    query += ' ORDER BY t.deadline ASC NULLS LAST, t.created_at ASC';

    const { rows } = await db.query(query, params);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

// GET /api/projects/:projectId/tasks/:id
router.get('/:id', async (req, res) => {
  const { projectId, id } = req.params;
  try {
    if (!(await canAccessProject(projectId, req.user))) {
      return res.status(403).json({ message: 'Accès refusé' });
    }

    const { rows } = await db.query(
      `SELECT t.*, u.nom AS assignee_nom
       FROM tasks t
       LEFT JOIN users u ON u.id = t.assigne_a
       WHERE t.id = $1 AND t.project_id = $2`,
      [id, projectId]
    );
    if (!rows.length) return res.status(404).json({ message: 'Tâche introuvable' });
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

// POST /api/projects/:projectId/tasks
router.post(
  '/',
  [
    body('titre').trim().notEmpty().withMessage('Titre requis'),
    body('statut').optional().isIn(['todo', 'in_progress', 'done']),
    body('priorite').optional().isIn(['basse', 'normale', 'haute', 'urgente']),
    body('deadline').optional({ nullable: true }).isDate(),
    body('assigne_a').optional({ nullable: true }).isInt(),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { projectId } = req.params;
    try {
      if (!(await canManageTasks(projectId, req.user))) {
        return res.status(403).json({ message: 'Seuls les encadrants et team leaders peuvent créer des tâches' });
      }

      const { titre, description, statut, priorite, assigne_a, deadline } = req.body;
      const { rows } = await db.query(
        `INSERT INTO tasks (project_id, titre, description, statut, priorite, assigne_a, deadline)
         VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
        [
          projectId,
          titre,
          description || null,
          statut || 'todo',
          priorite || 'normale',
          assigne_a || null,
          deadline || null,
        ]
      );
      // Notifier l'étudiant assigné
      if (assigne_a) {
        const proj = await db.query('SELECT titre FROM projects WHERE id = $1', [projectId]);
        await notify(assigne_a, `Nouvelle tâche assignée : « ${titre} » sur le projet ${proj.rows[0]?.titre}`, `/projects/${projectId}`);
      }
      res.status(201).json(rows[0]);
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: 'Erreur serveur' });
    }
  }
);

// PUT /api/projects/:projectId/tasks/:id
router.put(
  '/:id',
  [
    body('titre').trim().notEmpty().withMessage('Titre requis'),
    body('statut').isIn(['todo', 'in_progress', 'done']).withMessage('Statut invalide'),
    body('priorite').optional().isIn(['basse', 'normale', 'haute', 'urgente']).withMessage('Priorité invalide'),
    body('deadline').optional({ nullable: true, checkFalsy: true }).isDate().withMessage('Date invalide'),
    body('assigne_a').optional({ nullable: true, checkFalsy: true }).isInt().withMessage('Assigné invalide'),
  ],
  async (req, res) => {
  const { projectId, id } = req.params;

  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  try {
    if (!(await canManageTasks(projectId, req.user))) {
      return res.status(403).json({ message: 'Seuls les encadrants et team leaders peuvent modifier des tâches' });
    }

    const { titre, description, statut, priorite, assigne_a, deadline } = req.body;
    const { rows } = await db.query(
      `UPDATE tasks
       SET titre=$1, description=$2, statut=$3, priorite=$4, assigne_a=$5, deadline=$6
       WHERE id=$7 AND project_id=$8
       RETURNING *`,
      [
        titre,
        description || null,
        statut,
        priorite || 'normale',
        assigne_a || null,
        deadline || null,
        id,
        projectId,
      ]
    );
    if (!rows.length) return res.status(404).json({ message: 'Tâche introuvable' });
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

// PATCH /api/projects/:projectId/tasks/:id/status
router.patch('/:id/status', async (req, res) => {
  const { projectId, id } = req.params;
  const { statut } = req.body;

  if (!['todo', 'in_progress', 'done'].includes(statut)) {
    return res.status(400).json({ message: 'Statut invalide' });
  }

  try {
    // Le jury est en lecture seule sur les tâches (il ne fait qu'évaluer)
    if (req.user.role === 'jury') {
      return res.status(403).json({ message: 'Le jury ne peut pas modifier les tâches' });
    }
    if (!(await canAccessProject(projectId, req.user))) {
      return res.status(403).json({ message: 'Accès refusé' });
    }

    const { rows } = await db.query(
      'UPDATE tasks SET statut=$1 WHERE id=$2 AND project_id=$3 RETURNING *',
      [statut, id, projectId]
    );
    if (!rows.length) return res.status(404).json({ message: 'Tâche introuvable' });
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

// DELETE /api/projects/:projectId/tasks/:id
router.delete('/:id', async (req, res) => {
  const { projectId, id } = req.params;
  try {
    if (!(await canManageTasks(projectId, req.user))) {
      return res.status(403).json({ message: 'Seuls les encadrants et team leaders peuvent supprimer des tâches' });
    }

    const { rows } = await db.query(
      'DELETE FROM tasks WHERE id=$1 AND project_id=$2 RETURNING id',
      [id, projectId]
    );
    if (!rows.length) return res.status(404).json({ message: 'Tâche introuvable' });
    res.json({ message: 'Tâche supprimée' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

module.exports = router;
