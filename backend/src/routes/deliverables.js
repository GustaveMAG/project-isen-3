const express = require('express');
const multer  = require('multer');
const path    = require('path');
const fs      = require('fs');
const db      = require('../config/db');
const { authenticate } = require('../middleware/auth');
const { blockIfClosed } = require('../middleware/projectLock');
const { notify } = require('../services/notificationService');

const router = express.Router({ mergeParams: true });
router.use(authenticate);
router.use(blockIfClosed); // refuse les écritures si le projet est clôturé

// Multer config
const uploadDir = path.join(__dirname, '../../', process.env.UPLOAD_DIR || 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${unique}${path.extname(file.originalname)}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: (parseInt(process.env.MAX_FILE_SIZE_MB) || 10) * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    // Refuse les exécutables
    const forbidden = ['.exe', '.bat', '.sh', '.cmd'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (forbidden.includes(ext)) {
      return cb(new Error('Type de fichier non autorisé'));
    }
    cb(null, true);
  },
});

// helper accès projet
async function canAccess(projectId, user) {
  if (user.role === 'encadrant' || user.role === 'jury') {
    const { rows } = await db.query(
      'SELECT 1 FROM projects WHERE id=$1 AND encadrant_id=$2',
      [projectId, user.id]
    );
    return rows.length > 0 || user.role === 'jury'; // Jury voit tous les projets
  }
  const { rows } = await db.query(
    'SELECT 1 FROM project_members WHERE project_id=$1 AND user_id=$2',
    [projectId, user.id]
  );
  return rows.length > 0;
}

// GET /api/projects/:projectId/deliverables
router.get('/', async (req, res) => {
  const { projectId } = req.params;
  try {
    if (!(await canAccess(projectId, req.user))) {
      return res.status(403).json({ message: 'Accès refusé' });
    }

    const { rows } = await db.query(
      `SELECT d.*, u.nom AS uploade_par_nom, dt.titre AS template_titre, dt.type AS template_type
       FROM deliverables d
       LEFT JOIN users u ON u.id = d.uploade_par
       LEFT JOIN deliverable_templates dt ON dt.id = d.template_id
       WHERE d.project_id = $1
       ORDER BY d.created_at DESC`,
      [projectId]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

// POST /api/projects/:projectId/deliverables
router.post('/', upload.single('file'), async (req, res) => {
  const { projectId } = req.params;
  if (!req.file) return res.status(400).json({ message: 'Fichier requis' });

  // Jury ne peut pas uploader
  if (req.user.role === 'jury') {
    fs.unlinkSync(req.file.path);
    return res.status(403).json({ message: 'Le jury ne peut pas déposer de livrables' });
  }

  try {
    if (!(await canAccess(projectId, req.user))) {
      fs.unlinkSync(req.file.path);
      return res.status(403).json({ message: 'Accès refusé' });
    }

    const url = `/uploads/${req.file.filename}`;
    const template_id = req.body.template_id || null;
    const { rows } = await db.query(
      `INSERT INTO deliverables (project_id, template_id, nom_fichier, url, uploade_par)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [projectId, template_id, req.file.originalname, url, req.user.id]
    );
    // Notifier l'encadrant du projet
    const proj = await db.query('SELECT titre, encadrant_id FROM projects WHERE id=$1', [projectId]);
    if (proj.rows[0]?.encadrant_id) {
      await notify(proj.rows[0].encadrant_id, `Nouveau livrable déposé : « ${req.file.originalname} » sur le projet ${proj.rows[0].titre}`, `/projects/${projectId}`);
    }
    res.status(201).json(rows[0]);
  } catch (err) {
    if (req.file?.path) fs.unlinkSync(req.file.path);
    console.error(err);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

// PATCH /api/projects/:projectId/deliverables/:id/validate
router.patch('/:id/validate', async (req, res) => {
  const { projectId, id } = req.params;
  const { statut, commentaire } = req.body;

  // Seuls les encadrants peuvent valider
  if (req.user.role !== 'encadrant') {
    return res.status(403).json({ message: 'Seuls les encadrants peuvent valider les livrables' });
  }

  if (!['valide', 'rejete'].includes(statut)) {
    return res.status(400).json({ message: 'Statut invalide (valide ou rejete attendu)' });
  }

  try {
    // Vérifier que l'encadrant est bien encadrant de ce projet
    const { rows: projects } = await db.query(
      'SELECT 1 FROM projects WHERE id=$1 AND encadrant_id=$2',
      [projectId, req.user.id]
    );
    if (!projects.length) {
      return res.status(403).json({ message: 'Accès refusé' });
    }

    // Mettre à jour le livrable
    const { rows } = await db.query(
      `UPDATE deliverables
       SET statut=$1, commentaire_validation=$2, valide_par=$3, date_validation=NOW()
       WHERE id=$4 AND project_id=$5
       RETURNING *`,
      [statut, commentaire || null, req.user.id, id, projectId]
    );

    if (!rows.length) {
      return res.status(404).json({ message: 'Livrable introuvable' });
    }

    // Notifier tous les membres du projet
    const { rows: members } = await db.query(
      'SELECT user_id FROM project_members WHERE project_id=$1',
      [projectId]
    );
    const { rows: projData } = await db.query('SELECT titre FROM projects WHERE id=$1', [projectId]);
    const projectTitle = projData[0]?.titre || 'Projet';

    const message = statut === 'valide'
      ? `Livrable validé : « ${rows[0].nom_fichier} » sur ${projectTitle}`
      : `Livrable rejeté : « ${rows[0].nom_fichier} » sur ${projectTitle}`;

    for (const m of members) {
      await notify(m.user_id, message, `/projects/${projectId}`);
    }

    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

// DELETE /api/projects/:projectId/deliverables/:id
router.delete('/:id', async (req, res) => {
  const { projectId, id } = req.params;
  try {
    if (!(await canAccess(projectId, req.user))) {
      return res.status(403).json({ message: 'Accès refusé' });
    }

    const { rows } = await db.query(
      'DELETE FROM deliverables WHERE id=$1 AND project_id=$2 RETURNING *',
      [id, projectId]
    );
    if (!rows.length) return res.status(404).json({ message: 'Livrable introuvable' });

    // Supprimer le fichier physique
    const filePath = path.join(__dirname, '../../', rows[0].url);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

    res.json({ message: 'Livrable supprimé' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

module.exports = router;
