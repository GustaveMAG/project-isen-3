const express = require('express');
const { body, validationResult } = require('express-validator');
const db      = require('../config/db');
const { authenticate } = require('../middleware/auth');
const { blockIfClosed } = require('../middleware/projectLock');
const { notify } = require('../services/notificationService');

const router = express.Router({ mergeParams: true });
router.use(authenticate);
router.use(blockIfClosed); // refuse les écritures si le projet est clôturé

// GET /api/projects/:projectId/evaluations
router.get('/', async (req, res) => {
  const { projectId } = req.params;
  try {
    const { rows } = await db.query(
      `SELECT e.*, u.nom AS evaluateur_nom, u.role AS evaluateur_role
       FROM evaluations e
       JOIN users u ON u.id = e.evaluateur_id
       WHERE e.project_id = $1
       ORDER BY e.created_at DESC`,
      [projectId]
    );

    // Charger les critères pour chaque évaluation
    for (const evaluation of rows) {
      const { rows: criteria } = await db.query(
        `SELECT * FROM evaluation_criteria
         WHERE evaluation_id = $1
         ORDER BY created_at ASC`,
        [evaluation.id]
      );
      evaluation.criteria = criteria;
    }

    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

// POST /api/projects/:projectId/evaluations
// Réservé aux encadrants
router.post('/', [
  body('commentaire').optional().trim(),
  body('date_soutenance').optional({ nullable: true }).isDate().withMessage('Date invalide'),
  body('criteria').isArray().withMessage('Critères requis'),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  if (!['encadrant', 'jury'].includes(req.user.role)) {
    return res.status(403).json({ message: 'Réservé aux encadrants et jury' });
  }

  const { projectId } = req.params;
  const { commentaire, date_soutenance, criteria } = req.body;

  try {
    // Vérifier que l'encadrant supervise ce projet
    const proj = await db.query(
      'SELECT id, titre, encadrant_id FROM projects WHERE id = $1',
      [projectId]
    );
    if (!proj.rows[0]) return res.status(404).json({ message: 'Projet introuvable' });
    // L'encadrant ne peut évaluer que ses projets ; le jury peut évaluer n'importe quel projet
    if (req.user.role === 'encadrant' && proj.rows[0].encadrant_id !== req.user.id) {
      return res.status(403).json({ message: 'Vous ne supervisez pas ce projet' });
    }

    // Calculer la note globale pondérée
    let totalPoints = 0;
    let totalCoefficients = 0;
    for (const c of criteria) {
      if (c.note !== null && c.note !== undefined) {
        totalPoints += c.note * c.coefficient;
        totalCoefficients += c.coefficient;
      }
    }
    const note_globale = totalCoefficients > 0 ? (totalPoints / totalCoefficients).toFixed(2) : null;

    // Vérifier si une évaluation existe déjà
    const existing = await db.query(
      'SELECT id FROM evaluations WHERE project_id = $1',
      [projectId]
    );

    let result;
    if (existing.rows.length > 0) {
      // UPDATE évaluation
      const { rows } = await db.query(
        `UPDATE evaluations
         SET note_globale = $1, commentaire = $2, date_soutenance = $3, evaluateur_id = $4
         WHERE project_id = $5
         RETURNING *`,
        [note_globale, commentaire || null, date_soutenance || null, req.user.id, projectId]
      );
      result = rows[0];

      // Supprimer les anciens critères
      await db.query('DELETE FROM evaluation_criteria WHERE evaluation_id = $1', [result.id]);
    } else {
      // INSERT évaluation
      const { rows } = await db.query(
        `INSERT INTO evaluations (project_id, evaluateur_id, note_globale, commentaire, date_soutenance)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [projectId, req.user.id, note_globale, commentaire || null, date_soutenance || null]
      );
      result = rows[0];
    }

    // Insérer les nouveaux critères
    for (const c of criteria) {
      await db.query(
        `INSERT INTO evaluation_criteria (evaluation_id, nom_critere, note, coefficient, commentaire)
         VALUES ($1, $2, $3, $4, $5)`,
        [result.id, c.nom_critere, c.note || null, c.coefficient, c.commentaire || null]
      );
    }

    // Notifier tous les membres du projet
    const members = await db.query(
      'SELECT user_id FROM project_members WHERE project_id = $1',
      [projectId]
    );
    for (const m of members.rows) {
      await notify(
        m.user_id,
        `📊 Votre projet « ${proj.rows[0].titre} » a été évalué : ${note_globale}/20`,
        `/projects/${projectId}`
      );
    }

    res.status(existing.rows.length > 0 ? 200 : 201).json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

// DELETE /api/projects/:projectId/evaluations/:id
router.delete('/:id', async (req, res) => {
  if (!['encadrant', 'jury'].includes(req.user.role)) {
    return res.status(403).json({ message: 'Réservé aux encadrants et jury' });
  }

  const { projectId, id } = req.params;
  try {
    const { rows } = await db.query(
      'DELETE FROM evaluations WHERE id = $1 AND project_id = $2 RETURNING *',
      [id, projectId]
    );
    if (!rows.length) return res.status(404).json({ message: 'Évaluation introuvable' });
    res.json({ message: 'Évaluation supprimée' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

module.exports = router;
