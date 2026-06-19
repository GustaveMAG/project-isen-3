require('dotenv').config();
const express  = require('express');
const cors     = require('cors');
const path     = require('path');

const authRoutes               = require('./routes/auth');
const programmeRoutes          = require('./routes/programmes');
const projectRoutes            = require('./routes/projects');
const taskRoutes               = require('./routes/tasks');
const deliverableRoutes        = require('./routes/deliverables');
const deliverableTemplateRoutes= require('./routes/deliverableTemplates');
const commentRoutes            = require('./routes/comments');
const deliverableCommentRoutes = require('./routes/deliverableComments');
const feedbackRoutes           = require('./routes/feedback');
const userRoutes               = require('./routes/users');
const notificationRoutes       = require('./routes/notifications');
const helpRoutes               = require('./routes/help');
const helpReplyRoutes          = require('./routes/helpReply');
const evaluationRoutes         = require('./routes/evaluations');
const milestoneRoutes          = require('./routes/milestones');

const app  = express();
const PORT = process.env.PORT || 5000;

// Middlewares globaux
app.use(cors({
  origin: true,
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Servir les fichiers uploadés avec CORS pour permettre le téléchargement cross-origin
app.use('/uploads', (req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET');
  res.header('Access-Control-Expose-Headers', 'Content-Disposition');
  next();
}, express.static(path.join(__dirname, '../uploads')));

// Routes
app.use('/api/auth',       authRoutes);
app.use('/api/users',      userRoutes);
app.use('/api/programmes', programmeRoutes);
app.use('/api/projects',   projectRoutes);

// Niveau « Projet » (programme) : livrables attendus & jalons communs aux équipes
app.use('/api/programmes/:programmeId/deliverable-templates', deliverableTemplateRoutes);
app.use('/api/programmes/:programmeId/milestones',            milestoneRoutes);

// Niveau « Équipe » (projects) : tâches & livrables déposés
app.use('/api/projects/:projectId/tasks',        taskRoutes);
app.use('/api/projects/:projectId/deliverables', deliverableRoutes);

// Commentaires sous /tasks/:taskId
app.use('/api/tasks/:taskId/comments', commentRoutes);

// Commentaires livrables
app.use('/api/deliverables/:deliverableId/comments', deliverableCommentRoutes);

// Feedback encadrant
app.use('/api/projects/:projectId/feedback', feedbackRoutes);

// Notifications
app.use('/api/notifications', notificationRoutes);

// Demandes d'aide
app.use('/api/projects/:id/help', helpRoutes);
app.use('/api/help',              helpReplyRoutes);

// Évaluations
app.use('/api/projects/:projectId/evaluations', evaluationRoutes);

// Health check
app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));

// Gestion d'erreurs globale
app.use((err, _req, res, _next) => {
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ message: 'Fichier trop volumineux' });
  }
  console.error(err.stack);
  res.status(500).json({ message: err.message || 'Erreur serveur' });
});

app.listen(PORT, () => {
  console.log(`🚀 Serveur démarré sur http://localhost:${PORT}`);
});
