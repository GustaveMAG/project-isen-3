const db = require('../config/db');

const WRITE_METHODS = ['POST', 'PUT', 'PATCH', 'DELETE'];

// Verrou « projet clôturé »
// Bloque toute écriture (POST/PUT/PATCH/DELETE) sur un projet clôturé.
// Les lectures (GET) passent toujours. À monter APRÈS authenticate.
// Cherche l'id du projet dans les params imbriqués (projectId ou id).
async function blockIfClosed(req, res, next) {
  if (!WRITE_METHODS.includes(req.method)) return next();

  try {
    // Niveau « Projet » (programme) : bloque si le programme est clôturé
    const programmeId = req.params.programmeId;
    if (programmeId) {
      const { rows } = await db.query('SELECT etat FROM programmes WHERE id = $1', [programmeId]);
      if (rows.length && rows[0].etat === 'cloture') {
        return res.status(403).json({
          message: 'Projet clôturé : aucune modification n\'est possible. Rouvrez le projet pour le modifier.',
        });
      }
      return next();
    }

    // Niveau « Équipe » (projects) : bloque si l'équipe OU son programme est clôturé
    const projectId = req.params.projectId || req.params.id;
    if (!projectId) return next(); // rien d'identifiable → on laisse passer

    const { rows } = await db.query(
      `SELECT pr.etat AS team_etat, pg.etat AS prog_etat
         FROM projects pr
         LEFT JOIN programmes pg ON pg.id = pr.programme_id
        WHERE pr.id = $1`,
      [projectId]
    );
    if (rows.length && (rows[0].team_etat === 'cloture' || rows[0].prog_etat === 'cloture')) {
      return res.status(403).json({
        message: 'Projet clôturé : aucune modification n\'est possible. Rouvrez le projet pour le modifier.',
      });
    }
    next();
  } catch (err) {
    console.error('Erreur blockIfClosed:', err);
    res.status(500).json({ message: 'Erreur serveur' });
  }
}

module.exports = { blockIfClosed };
