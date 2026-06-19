const db = require('../config/db');

async function notify(userId, message, lien = null, type = 'info') {
  try {
    await db.query(
      `INSERT INTO notifications (user_id, message, lien, type) VALUES ($1, $2, $3, $4)`,
      [userId, message, lien, type]
    );
  } catch (err) {
    console.error('Erreur notification:', err.message);
  }
}

module.exports = { notify };
