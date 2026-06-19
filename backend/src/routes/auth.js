const express   = require('express');
const bcrypt    = require('bcrypt');
const jwt       = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const db        = require('../config/db');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// POST /api/auth/register
router.post(
  '/register',
  [
    body('nom').trim().notEmpty().withMessage('Nom requis'),
    body('email').isEmail().normalizeEmail().withMessage('Email invalide'),
    body('password').isLength({ min: 6 }).withMessage('Mot de passe min 6 caractères'),
    body('role').isIn(['encadrant', 'etudiant', 'team_leader', 'jury']).withMessage('Rôle invalide'),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { nom, email, password, role } = req.body;
    try {
      const existing = await db.query('SELECT id FROM users WHERE email = $1', [email]);
      if (existing.rows.length) {
        return res.status(409).json({ message: 'Email déjà utilisé' });
      }

      const hash = await bcrypt.hash(password, 10);
      const { rows } = await db.query(
        'INSERT INTO users (nom, email, password, role) VALUES ($1,$2,$3,$4) RETURNING id, nom, email, role',
        [nom, email, hash, role]
      );

      const token = jwt.sign({ userId: rows[0].id }, process.env.JWT_SECRET, {
        expiresIn: process.env.JWT_EXPIRES_IN || '7d',
      });

      res.status(201).json({ user: rows[0], token });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: 'Erreur serveur' });
    }
  }
);

// POST /api/auth/login
router.post(
  '/login',
  [
    body('email').isEmail().normalizeEmail(),
    body('password').notEmpty(),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { email, password } = req.body;
    try {
      const { rows } = await db.query('SELECT * FROM users WHERE email = $1', [email]);
      if (!rows.length) {
        return res.status(401).json({ message: 'Identifiants incorrects' });
      }

      const valid = await bcrypt.compare(password, rows[0].password);
      if (!valid) return res.status(401).json({ message: 'Identifiants incorrects' });

      const { password: _, ...user } = rows[0];
      const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, {
        expiresIn: process.env.JWT_EXPIRES_IN || '7d',
      });

      res.json({ user, token });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: 'Erreur serveur' });
    }
  }
);

// GET /api/auth/me
router.get('/me', authenticate, (req, res) => {
  res.json({ user: req.user });
});

module.exports = router;
