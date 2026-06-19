const express = require('express');
const { body, validationResult } = require('express-validator');
const db = require('../config/db');
const { authenticate, requireRole } = require('../middleware/auth');
const { blockIfClosed } = require('../middleware/projectLock');
const { notify } = require('../services/notificationService');

// Niveau « Projet » (parent) regroupe plusieurs équipes (table projects).
const router = express.Router();
router.use(authenticate);

// Helper : l'encadrant possède-t-il ce programme ?
async function isOwner(programmeId, userId) {
  const { rows } = await db.query(
    'SELECT 1 FROM programmes WHERE id=$1 AND encadrant_id=$2',
    [programmeId, userId]
  );
  return rows.length > 0;
}

// Helper : l'utilisateur peut-il consulter ce programme ?
// Jury : oui · Encadrant : seulement le sien · Étudiant/TL : membre d'une équipe du programme
async function canAccessProgramme(programmeId, user) {
  if (user.role === 'jury') return true;
  if (user.role === 'encadrant') return isOwner(programmeId, user.id);
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

// GET /api/programmes
// Liste les « Projets » visibles selon le rôle.
router.get('/', async (req, res) => {
  const { user } = req;
  try {
    let sql;
    let params = [];

    const base = `
      SELECT pg.*,
             u.nom AS encadrant_nom,
             COUNT(DISTINCT pr.id) AS nb_equipes
        FROM programmes pg
        JOIN users u ON u.id = pg.encadrant_id
        LEFT JOIN projects pr ON pr.programme_id = pg.id
    `;

    if (user.role === 'encadrant') {
      sql = `${base} WHERE pg.encadrant_id = $1 GROUP BY pg.id, u.nom ORDER BY pg.created_at DESC`;
      params = [user.id];
    } else if (user.role === 'jury') {
      sql = `${base} GROUP BY pg.id, u.nom ORDER BY pg.created_at DESC`;
    } else {
      // étudiant / team_leader : programmes où il appartient à une équipe
      sql = `${base}
        WHERE pg.id IN (
          SELECT pr2.programme_id
            FROM project_members pm
            JOIN projects pr2 ON pr2.id = pm.project_id
           WHERE pm.user_id = $1
        )
        GROUP BY pg.id, u.nom ORDER BY pg.created_at DESC`;
      params = [user.id];
    }

    const { rows } = await db.query(sql, params);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

// GET /api/programmes/:id
// Détail d'un Projet + ses équipes.
router.get('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    if (!(await canAccessProgramme(id, req.user))) {
      return res.status(403).json({ message: 'Accès refusé' });
    }

    const { rows } = await db.query(
      `SELECT pg.*, u.nom AS encadrant_nom
         FROM programmes pg
         JOIN users u ON u.id = pg.encadrant_id
        WHERE pg.id = $1`,
      [id]
    );
    if (!rows.length) return res.status(404).json({ message: 'Projet introuvable' });

    // Équipes rattachées + progression (tâches done / total)
    const { rows: teams } = await db.query(
      `SELECT pr.*,
              COUNT(DISTINCT pm.user_id) AS nb_membres,
              COUNT(DISTINCT t.id)       AS nb_taches,
              COUNT(DISTINCT t.id) FILTER (WHERE t.statut = 'done') AS nb_done
         FROM projects pr
         LEFT JOIN project_members pm ON pm.project_id = pr.id
         LEFT JOIN tasks t            ON t.project_id  = pr.id
        WHERE pr.programme_id = $1
        GROUP BY pr.id
        ORDER BY pr.created_at ASC`,
      [id]
    );

    res.json({ ...rows[0], teams });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

// POST /api/programmes
router.post(
  '/',
  requireRole('encadrant'),
  [
    body('titre').trim().notEmpty().withMessage('Titre requis'),
    body('date_debut').optional({ nullable: true, checkFalsy: true }).isDate().withMessage('Date de début invalide'),
    body('date_fin').optional({ nullable: true, checkFalsy: true }).isDate().withMessage('Date de fin invalide'),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    try {
      const { titre, description, date_debut, date_fin } = req.body;
      const { rows } = await db.query(
        `INSERT INTO programmes (titre, description, date_debut, date_fin, encadrant_id)
         VALUES ($1, $2, $3, $4, $5) RETURNING *`,
        [titre, description || null, date_debut || null, date_fin || null, req.user.id]
      );
      res.status(201).json(rows[0]);
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: 'Erreur serveur' });
    }
  }
);

// PUT /api/programmes/:id
router.put(
  '/:id',
  requireRole('encadrant'),
  blockIfClosed,
  [
    body('titre').trim().notEmpty().withMessage('Titre requis'),
    body('date_debut').optional({ nullable: true, checkFalsy: true }).isDate().withMessage('Date de début invalide'),
    body('date_fin').optional({ nullable: true, checkFalsy: true }).isDate().withMessage('Date de fin invalide'),
  ],
  async (req, res) => {
    const { id } = req.params;
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    try {
      if (!(await isOwner(id, req.user.id))) return res.status(403).json({ message: 'Accès refusé' });

      const { titre, description, date_debut, date_fin } = req.body;
      const { rows } = await db.query(
        `UPDATE programmes SET titre=$1, description=$2, date_debut=$3, date_fin=$4
          WHERE id=$5 RETURNING *`,
        [titre, description || null, date_debut || null, date_fin || null, id]
      );
      if (!rows.length) return res.status(404).json({ message: 'Projet introuvable' });
      res.json(rows[0]);
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: 'Erreur serveur' });
    }
  }
);

// PATCH /api/programmes/:id/etat
// Clôture / réouverture du Projet (impacte toutes les équipes via le verrou).
router.patch(
  '/:id/etat',
  requireRole('encadrant'),
  [body('etat').isIn(['en_cours', 'en_retard', 'termine', 'cloture']).withMessage('État invalide')],
  async (req, res) => {
    const { id } = req.params;
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    try {
      if (!(await isOwner(id, req.user.id))) return res.status(403).json({ message: 'Accès refusé' });

      const { etat } = req.body;
      const prev = await db.query('SELECT etat FROM programmes WHERE id=$1', [id]);
      if (!prev.rows.length) return res.status(404).json({ message: 'Projet introuvable' });
      const wasClosed = prev.rows[0].etat === 'cloture';

      const { rows } = await db.query(
        `UPDATE programmes
            SET etat = $1::varchar,
                date_cloture = CASE WHEN $1::varchar = 'cloture' THEN NOW() ELSE NULL END
          WHERE id = $2 RETURNING *`,
        [etat, id]
      );

      // Notifie tous les membres de toutes les équipes lors de la clôture
      if (etat === 'cloture' && !wasClosed) {
        const { rows: members } = await db.query(
          `SELECT DISTINCT pm.user_id
             FROM project_members pm
             JOIN projects pr ON pr.id = pm.project_id
            WHERE pr.programme_id = $1`,
          [id]
        );
        const msg = `Le projet « ${rows[0].titre} » a été clôturé.`;
        await Promise.all(members.map((m) => notify(m.user_id, msg, `/programmes/${id}`, 'info')));
      }

      res.json(rows[0]);
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: 'Erreur serveur' });
    }
  }
);

// DELETE /api/programmes/:id
router.delete('/:id', requireRole('encadrant'), async (req, res) => {
  const { id } = req.params;
  try {
    if (!(await isOwner(id, req.user.id))) return res.status(403).json({ message: 'Accès refusé' });
    const { rows } = await db.query('DELETE FROM programmes WHERE id=$1 RETURNING id', [id]);
    if (!rows.length) return res.status(404).json({ message: 'Projet introuvable' });
    res.json({ message: 'Projet supprimé' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

module.exports = router;
