const jwt = require('jsonwebtoken');
const db  = require('../config/db');

async function authenticate(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Token manquant' });
  }

  const token = header.split(' ')[1];

  // 1) Vérification du token (erreur → 401)
  let payload;
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    return res.status(401).json({ message: 'Token invalide ou expiré' });
  }

  // 2) Récupération de l'utilisateur (erreur DB → 500, pas 401)
  try {
    const { rows } = await db.query(
      'SELECT id, nom, email, role FROM users WHERE id = $1',
      [payload.userId]
    );
    if (!rows.length) return res.status(401).json({ message: 'Utilisateur introuvable' });
    req.user = rows[0];
    next();
  } catch (err) {
    console.error('Erreur auth (DB):', err.message);
    return res.status(500).json({ message: 'Erreur serveur' });
  }
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ message: 'Accès refusé' });
    }
    next();
  };
}

module.exports = { authenticate, requireRole };
