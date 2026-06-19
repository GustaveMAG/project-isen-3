import { useEffect, useState, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { projectsApi, tasksApi, deliverablesApi, deliverableTemplatesApi, usersApi, deliverableCommentsApi, feedbackApi, helpApi, evaluationsApi, milestonesApi, fileUrl, API_BASE } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import ProgressBar from '../components/ProgressBar';
import TaskStatusBadge from '../components/TaskStatusBadge';
import KanbanBoard from '../components/KanbanBoard';
import { downloadXlsx } from '../lib/xlsx';
import toast from 'react-hot-toast';
import { format, isPast, parseISO, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isSameMonth, addMonths, subMonths, startOfWeek, endOfWeek } from 'date-fns';
import { fr } from 'date-fns/locale';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const TABS = [
  { key: 'tasks',        label: 'Tâches',    icon: '📋' },
  { key: 'deliverables', label: 'Livrables', icon: '📁' },
  { key: 'milestones',   label: 'Jalons',    icon: '🎯' },
  { key: 'calendar',     label: 'Calendrier', icon: '📅' },
  { key: 'stats',        label: 'Statistiques', icon: '📊' },
  { key: 'feedback',     label: 'Feedback',  icon: '💬' },
  { key: 'aide',         label: 'Aide',      icon: '🆘' },
  { key: 'evaluation',   label: 'Évaluation', icon: '📈' },
  { key: 'members',      label: 'Équipe',    icon: '👥' },
];

export default function ProjectDetailPage() {
  const { id }        = useParams();
  const { user }      = useAuth();
  const navigate      = useNavigate();
  const isEncadrant   = user.role === 'encadrant';
  const isTeamLeader  = user.role === 'team_leader';
  const isJury        = user.role === 'jury';
  const canManageTasks = isEncadrant || isTeamLeader;
  const canEvaluate   = isEncadrant || isJury;

  const [project, setProject]           = useState(null);
  const [tasks, setTasks]               = useState([]);
  const [deliverables, setDeliverables] = useState([]);
  const [deliverableTemplates, setDeliverableTemplates] = useState([]);
  const [showTemplateForm, setShowTemplateForm] = useState(false);
  const [templateForm, setTemplateForm] = useState({ titre: '', description: '', type: 'rapport', date_limite: '', obligatoire: true });
  const [allStudents, setAllStudents]   = useState([]);
  const [loading, setLoading]           = useState(true);
  const [tab, setTab]                   = useState('tasks');
  const [taskFilter, setTaskFilter]     = useState('all');
  const [taskView, setTaskView]         = useState('list');
  const [feedbacks, setFeedbacks]       = useState([]);
  const [newFeedback, setNewFeedback]   = useState('');
  const [helpRequests, setHelpRequests] = useState([]);
  const [helpForm, setHelpForm]         = useState({ titre: '', description: '' });
  const [showHelpForm, setShowHelpForm] = useState(false);
  const [helpReplyId, setHelpReplyId]   = useState(null);
  const [helpReplyForm, setHelpReplyForm] = useState({ reponse: '', statut: 'resolu' });
  const [delivComments, setDelivComments] = useState({}); // { delivId: [comments] }
  const [delivCommentInputs, setDelivCommentInputs] = useState({});
  const [openDelivComments, setOpenDelivComments] = useState({});
  const [evaluations, setEvaluations] = useState([]);
  const [evalForm, setEvalForm] = useState({ commentaire: '', date_soutenance: '' });
  const [evalCriteria, setEvalCriteria] = useState([
    { nom_critere: 'Qualité technique', note: '', coefficient: 3, commentaire: '' },
    { nom_critere: 'Documentation', note: '', coefficient: 2, commentaire: '' },
    { nom_critere: 'Respect des délais', note: '', coefficient: 2, commentaire: '' },
    { nom_critere: 'Travail d\'équipe', note: '', coefficient: 2, commentaire: '' },
    { nom_critere: 'Innovation', note: '', coefficient: 1, commentaire: '' },
    { nom_critere: 'Présentation / Soutenance', note: '', coefficient: 2, commentaire: '' },
  ]);
  const [milestones, setMilestones] = useState([]);
  const [showMilestoneForm, setShowMilestoneForm] = useState(false);
  const [editingMilestone, setEditingMilestone] = useState(null);
  const [milestoneForm, setMilestoneForm] = useState({ titre: '', description: '', date_echeance: '', statut: 'a_venir' });
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportOpts, setExportOpts] = useState({ taches: true, evaluation: true, membres: true });

  /* Chargement initial */
  const load = useCallback(async () => {
    try {
      // L'équipe d'abord : on a besoin de son programme_id pour les livrables attendus / jalons (communs au Projet parent)
      const pRes = await projectsApi.get(id);
      const progId = pRes.data.programme_id;
      const [tRes, dRes, fRes, hRes, eRes, mRes, dtRes] = await Promise.all([
        tasksApi.list(id),
        deliverablesApi.list(id),
        feedbackApi.list(id).catch(() => ({ data: [] })),
        helpApi.list(id).catch(() => ({ data: [] })),
        evaluationsApi.list(id).catch(() => ({ data: [] })),
        progId ? milestonesApi.list(progId).catch(() => ({ data: [] })) : Promise.resolve({ data: [] }),
        progId ? deliverableTemplatesApi.list(progId).catch(() => ({ data: [] })) : Promise.resolve({ data: [] }),
      ]);
      setProject(pRes.data);
      // Tri par priorité: urgente > haute > normale > basse
      const priorityOrder = { urgente: 0, haute: 1, normale: 2, basse: 3 };
      const sortedTasks = tRes.data.sort((a, b) =>
        (priorityOrder[a.priorite] || 2) - (priorityOrder[b.priorite] || 2)
      );
      setTasks(sortedTasks);
      setDeliverables(dRes.data);
      setDeliverableTemplates(dtRes.data);
      setFeedbacks(fRes.data);
      setHelpRequests(hRes.data);
      setEvaluations(eRes.data);
      setMilestones(mRes.data);
      // Pré-remplir le formulaire si une éval existe
      if (eRes.data.length > 0) {
        const e = eRes.data[0];
        setEvalForm({
          commentaire: e.commentaire || '',
          date_soutenance: e.date_soutenance || '',
        });
        // Charger les critères existants
        if (e.criteria && e.criteria.length > 0) {
          setEvalCriteria(e.criteria.map(c => ({
            nom_critere: c.nom_critere,
            note: c.note || '',
            coefficient: c.coefficient,
            commentaire: c.commentaire || ''
          })));
        }
      }
      if (isEncadrant) {
        const { data } = await usersApi.list({ roles: 'etudiant,team_leader' });
        setAllStudents(data);
      }
    } catch {
      toast.error('Projet introuvable');
      navigate('/projects');
    } finally {
      setLoading(false);
    }
  }, [id, isEncadrant, navigate]);

  useEffect(() => { load(); }, [load]);

  /* Actions projet */
  const handleDeleteProject = async () => {
    if (!window.confirm(`Supprimer le projet « ${project.titre} » ? Cette action est irréversible.`)) return;
    try {
      await projectsApi.remove(id);
      toast.success('Projet supprimé');
      navigate('/projects');
    } catch {
      toast.error('Impossible de supprimer le projet');
    }
  };

  /* Clôture / réouverture */
  const handleCloseProject = async () => {
    setProject(prev => ({ ...prev, etat: 'cloture' }));
    setShowCloseModal(false);
    try {
      await projectsApi.updateEtat(id, 'cloture');
      toast.success('Projet clôturé');
      load();
    } catch {
      toast.error('Impossible de clôturer le projet');
      load();
    }
  };

  const handleReopenProject = async () => {
    setProject(prev => ({ ...prev, etat: 'en_cours' }));
    try {
      await projectsApi.updateEtat(id, 'en_cours');
      toast.success('Projet rouvert');
      load();
    } catch {
      toast.error('Impossible de rouvrir le projet');
      load();
    }
  };

  /* Export Excel (un seul fichier, un onglet par section) */
  const handleExport = () => {
    const sheets = [];

    if (exportOpts.taches && tasks.length) {
      const labels = { todo: 'À faire', in_progress: 'En cours', done: 'Terminée' };
      sheets.push({
        name: 'Tâches',
        columns: [
          { label: 'Titre', value: 'titre', width: 32 },
          { label: 'Description', value: 'description', width: 40 },
          { label: 'Statut', value: (t) => labels[t.statut] || t.statut, width: 14 },
          { label: 'Priorité', value: 'priorite', width: 12 },
          { label: 'Assigné à', value: (t) => t.assignee_nom || '', width: 22 },
          { label: 'Deadline', value: (t) => t.deadline ? format(parseISO(t.deadline), 'd MMM yyyy', { locale: fr }) : '', width: 16 },
        ],
        rows: tasks,
      });
    }

    if (exportOpts.evaluation && evaluations.length) {
      const ev = evaluations[0];
      sheets.push({
        name: 'Évaluation',
        columns: [
          { label: 'Critère', value: 'critere', width: 30 },
          { label: 'Note /20', value: 'note', width: 10 },
          { label: 'Coefficient', value: 'coef', width: 12 },
          { label: 'Commentaire', value: 'comm', width: 40 },
        ],
        rows: [
          ...(ev.criteria || []).map((c) => ({ critere: c.nom_critere, note: c.note, coef: c.coefficient, comm: c.commentaire })),
          { critere: 'NOTE GLOBALE', note: ev.note_globale, coef: '', comm: ev.commentaire || '' },
        ],
      });
    }

    if (exportOpts.membres && project.members.length) {
      const roleLabels = { etudiant: 'Étudiant', team_leader: 'Team leader' };
      sheets.push({
        name: 'Membres',
        columns: [
          { label: 'Nom', value: 'nom', width: 26 },
          { label: 'Email', value: 'email', width: 32 },
          { label: 'Rôle', value: (m) => roleLabels[m.role] || m.role, width: 16 },
        ],
        rows: project.members,
      });
    }

    if (!sheets.length) {
      toast.error('Rien à exporter (les sections cochées sont vides)');
      return;
    }

    const safeTitle = (project.titre || 'equipe').replace(/[^\w\-]+/g, '_');
    downloadXlsx(`export_${safeTitle}`, sheets);
    toast.success('Export Excel téléchargé');
    setShowExportModal(false);
  };

  /* Actions membres */
  const handleAddMember = async (userId) => {
    try {
      await projectsApi.addMember(id, { user_id: userId });
      toast.success('Membre ajouté à l\'équipe');
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Erreur');
    }
  };
  const handleRemoveMember = async (userId, nom) => {
    if (!window.confirm(`Retirer ${nom} du projet ?`)) return;
    try {
      await projectsApi.removeMember(id, userId);
      toast.success(`${nom} retiré du projet`);
      load();
    } catch {
      toast.error('Impossible de retirer ce membre');
    }
  };

  const handleToggleLeader = async (m) => {
    const newRole = m.role === 'team_leader' ? 'etudiant' : 'team_leader';
    try {
      await usersApi.updateRole(m.id, newRole);
      toast.success(newRole === 'team_leader'
        ? `${m.nom} est maintenant team leader`
        : `Rôle team leader retiré à ${m.nom}`);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Erreur');
    }
  };

  /* Actions tâches */
  const handleStatusChange = async (taskId, statut) => {
    try {
      await tasksApi.updateStatus(id, taskId, statut);
      setTasks((prev) => prev.map((t) => t.id === taskId ? { ...t, statut } : t));
    } catch {
      toast.error('Impossible de mettre à jour le statut');
    }
  };
  const handleDeleteTask = async (taskId, titre) => {
    if (!window.confirm(`Supprimer la tâche « ${titre} » ?`)) return;
    try {
      await tasksApi.remove(id, taskId);
      setTasks((prev) => prev.filter((t) => t.id !== taskId));
      toast.success('Tâche supprimée');
    } catch {
      toast.error('Impossible de supprimer la tâche');
    }
  };

  /* Téléchargement cross-origin */
  const handleDownload = async (url, nom) => {
    try {
      const fullUrl = fileUrl(url);
      const res = await fetch(fullUrl);
      if (!res.ok) throw new Error('Fichier introuvable');
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = nom;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(blobUrl);
    } catch {
      toast.error('Impossible de télécharger le fichier');
    }
  };

  /* Actions livrables */
  const [selectedTemplateId, setSelectedTemplateId] = useState(null);

  const handleUpload = async (e, templateId = null) => {
    const file = e.target.files[0];
    if (!file) return;
    const fd = new FormData();
    fd.append('file', file);
    if (templateId) {
      fd.append('template_id', templateId);
    }
    const toastId = toast.loading(`Envoi de ${file.name}…`);
    try {
      const { data } = await deliverablesApi.upload(id, fd);
      setDeliverables((prev) => [data, ...prev]);
      toast.success('Fichier déposé avec succès', { id: toastId });
      setSelectedTemplateId(null);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Erreur lors de l\'upload', { id: toastId });
    }
    e.target.value = '';
  };
  const handleDeleteDeliverable = async (delId, nom) => {
    if (!window.confirm(`Supprimer « ${nom} » ?`)) return;
    try {
      await deliverablesApi.remove(id, delId);
      setDeliverables((prev) => prev.filter((d) => d.id !== delId));
      toast.success('Livrable supprimé');
    } catch {
      toast.error('Impossible de supprimer');
    }
  };

  /* Demandes d'aide */
  const handleSubmitHelp = async (e) => {
    e.preventDefault();
    if (!helpForm.titre.trim() || !helpForm.description.trim()) return;
    try {
      const { data } = await helpApi.create(id, helpForm);
      setHelpRequests(prev => [data, ...prev]);
      setHelpForm({ titre: '', description: '' });
      setShowHelpForm(false);
      toast.success('Demande envoyée à l\'encadrant');
    } catch {
      toast.error('Impossible d\'envoyer la demande');
    }
  };

  const handleReplyHelp = async (helpId) => {
    if (!helpReplyForm.reponse.trim()) return;
    try {
      const { data } = await helpApi.reply(helpId, helpReplyForm);
      setHelpRequests(prev => prev.map(h => h.id === helpId ? { ...h, ...data } : h));
      setHelpReplyId(null);
      setHelpReplyForm({ reponse: '', statut: 'resolu' });
      toast.success('Réponse envoyée');
      load(); // Recharger pour mettre à jour les counts
    } catch {
      toast.error('Impossible d\'envoyer la réponse');
    }
  };

  /* Feedback encadrant */
  const handleAddFeedback = async (e) => {
    e.preventDefault();
    if (!newFeedback.trim()) return;
    try {
      const { data } = await feedbackApi.create(id, { contenu: newFeedback });
      setFeedbacks(prev => [data, ...prev]);
      setNewFeedback('');
      toast.success('Feedback envoyé');
    } catch {
      toast.error('Impossible d\'envoyer le feedback');
    }
  };

  /* Commentaires livrables */
  const loadDelivComments = async (delivId) => {
    if (delivComments[delivId]) return;
    const { data } = await deliverableCommentsApi.list(delivId);
    setDelivComments(prev => ({ ...prev, [delivId]: data }));
  };
  const toggleDelivComments = async (delivId) => {
    await loadDelivComments(delivId);
    setOpenDelivComments(prev => ({ ...prev, [delivId]: !prev[delivId] }));
  };
  const handleDelivComment = async (e, delivId) => {
    e.preventDefault();
    const contenu = delivCommentInputs[delivId];
    if (!contenu?.trim()) return;
    try {
      const { data } = await deliverableCommentsApi.create(delivId, { contenu });
      setDelivComments(prev => ({ ...prev, [delivId]: [...(prev[delivId] || []), data] }));
      setDelivCommentInputs(prev => ({ ...prev, [delivId]: '' }));
    } catch {
      toast.error('Impossible d\'ajouter le commentaire');
    }
  };

  /* Calculs */
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-32 gap-3 text-gray-400">
        <svg className="animate-spin w-8 h-8 text-purple-400" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        <span className="text-sm">Chargement du projet…</span>
      </div>
    );
  }
  if (!project) return null;

  const doneTasks    = tasks.filter((t) => t.statut === 'done').length;
  const lateTasks    = tasks.filter((t) => t.deadline && isPast(parseISO(t.deadline)) && t.statut !== 'done').length;
  const pct          = tasks.length > 0 ? Math.round((doneTasks / tasks.length) * 100) : 0;
  const isClosed     = project.etat === 'cloture';
  const memberIds    = project.members.map((m) => m.id);
  const nonMembers   = allStudents.filter((s) => !memberIds.includes(s.id));
  const filteredTasks = taskFilter === 'all' ? tasks : tasks.filter((t) => t.statut === taskFilter);

  const pendingHelp = helpRequests.filter(h => h.statut === 'en_attente').length;
  const tabCounts = {
    tasks:        tasks.length,
    deliverables: deliverables.length,
    feedback:     feedbacks.length,
    aide:         helpRequests.length,
    members:      project.members.length,
  };

  return (
    <>
      {/* Hero Header */}
      <div className="bg-gradient-to-br from-primary-900 via-primary-800 to-primary-700 px-7 pt-6 pb-0 relative overflow-hidden">
        {/* Decorative circles */}
        <div className="absolute -top-12 -right-12 w-48 h-48 rounded-full bg-white/5" />
        <div className="absolute bottom-0 right-32 w-24 h-24 rounded-full bg-accent-500/10" />

        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-sm text-white/50 mb-4 relative z-10">
          <Link to="/programmes" className="hover:text-white/80 transition-colors">Projets</Link>
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          {project.programme_id && (
            <>
              <Link to={`/programmes/${project.programme_id}`} className="hover:text-white/80 transition-colors truncate max-w-[180px]">
                {project.programme_titre || 'Projet'}
              </Link>
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </>
          )}
          <span className="text-white/80 font-medium truncate">{project.titre} <span className="text-white/40 font-normal">(équipe)</span></span>
        </nav>

        {/* Title + actions */}
        <div className="flex flex-wrap items-start justify-between gap-4 relative z-10">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-2xl font-bold text-white leading-tight">{project.titre}</h1>
              <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                project.etat === 'cloture' ? 'bg-gray-500 text-white' :
                project.etat === 'termine' ? 'bg-green-500 text-white' :
                project.etat === 'en_retard' ? 'bg-red-500 text-white' :
                'bg-blue-500 text-white'
              }`}>
                {project.etat === 'en_cours' && 'En cours'}
                {project.etat === 'en_retard' && 'En retard'}
                {project.etat === 'termine' && 'Terminé'}
                {project.etat === 'cloture' && 'Clôturé'}
              </span>
            </div>
            {project.description && (
              <p className="text-white/60 mt-1.5 text-sm leading-relaxed max-w-2xl">{project.description}</p>
            )}
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button onClick={() => setShowExportModal(true)} className="inline-flex items-center gap-2 px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white text-sm font-medium rounded-lg transition-colors border border-white/20">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Exporter
            </button>
            {isEncadrant && !isClosed && (
              <Link to={`/projects/${id}/edit`} className="inline-flex items-center gap-2 px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white text-sm font-medium rounded-lg transition-colors border border-white/20">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                Modifier
              </Link>
            )}
            {isEncadrant && (
              <button onClick={handleDeleteProject} className="inline-flex items-center gap-2 px-3 py-1.5 bg-red-500/20 hover:bg-red-500/30 text-red-300 text-sm font-medium rounded-lg transition-colors border border-red-400/20">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                Supprimer
              </button>
            )}
          </div>
        </div>

        {/* Meta info row */}
        <div className="flex flex-wrap items-center gap-5 mt-4 relative z-10 text-sm">
          <div className="flex items-center gap-2 text-white/70">
            <span>👨‍🏫</span>
            <span>Encadrant : <strong className="text-white">{project.encadrant_nom}</strong></span>
          </div>
          <div className="flex items-center gap-2 text-white/70">
            <span>👥</span>
            <div className="flex items-center gap-1">
              {project.members.slice(0, 4).map((m, i) => (
                <div
                  key={m.id}
                  className="w-6 h-6 rounded-full border border-white/30 flex items-center justify-center text-[10px] font-bold text-white -ml-1.5 first:ml-0"
                  style={{ background: `hsl(${(i * 70 + 200)}deg 55% 55%)` }}
                  title={m.nom}
                >
                  {m.nom.charAt(0)}
                </div>
              ))}
              <span className="text-white/60 text-xs ml-1">{project.members.length} membre{project.members.length > 1 ? 's' : ''}</span>
            </div>
          </div>
          {project.date_fin && (
            <div className="flex items-center gap-1.5 text-white/70">
              <span>{isPast(parseISO(project.date_fin)) && pct < 100 ? '⚠️' : '📅'}</span>
              <span>Deadline : <strong className={`${isPast(parseISO(project.date_fin)) && pct < 100 ? 'text-red-300' : 'text-white'}`}>
                {format(parseISO(project.date_fin), 'dd MMM yyyy', { locale: fr })}
              </strong></span>
            </div>
          )}
          <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${
            pct === 100 ? 'bg-purple-400/20 text-purple-200'
            : lateTasks > 0 ? 'bg-red-400/20 text-red-300'
            : 'bg-green-400/20 text-green-300'
          }`}>
            <span className={`w-1.5 h-1.5 rounded-full ${pct === 100 ? 'bg-purple-300' : lateTasks > 0 ? 'bg-red-400' : 'bg-green-400'}`} />
            {pct === 100 ? 'Terminé' : lateTasks > 0 ? `${lateTasks} en retard` : 'En bonne voie'}
          </div>
        </div>

        {/* Sélecteur d'état + clôture (encadrant uniquement, projet ouvert) */}
        {isEncadrant && !isClosed && (
          <div className="mt-5 relative z-10 flex flex-wrap items-end gap-3">
            <div>
              <label className="block text-xs text-white/50 mb-2">Changer l'état du projet :</label>
              <select
                value={project.etat || 'en_cours'}
                onChange={async (e) => {
                  const newEtat = e.target.value;
                  const labels = {
                    en_cours: 'En cours',
                    en_retard: 'En retard',
                    termine: 'Terminé',
                  };
                  // Mise à jour optimiste (immédiate)
                  setProject(prev => ({ ...prev, etat: newEtat }));
                  try {
                    await projectsApi.updateEtat(id, newEtat);
                    toast.success(`État changé : ${labels[newEtat]}`);
                  } catch (err) {
                    // Rollback si erreur
                    toast.error('Impossible de changer l\'état');
                    load(); // Recharger depuis le serveur
                  }
                }}
                className="bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 font-medium focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-200 cursor-pointer"
                style={{ color: '#1F2937' }}
              >
                <option value="en_cours">En cours</option>
                <option value="en_retard">En retard</option>
                <option value="termine">Terminé</option>
              </select>
            </div>
            <button
              onClick={() => setShowCloseModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 text-white text-sm font-semibold rounded-lg transition-colors border border-white/20"
            >
              🔒 Clôturer le projet
            </button>
          </div>
        )}

        {/* Bannière projet clôturé (visible par tous) */}
        {isClosed && (
          <div className="mt-5 relative z-10 flex flex-wrap items-center justify-between gap-3 bg-white/10 border border-white/20 rounded-xl px-4 py-3">
            <div className="flex items-center gap-3">
              <span className="text-2xl">🔒</span>
              <div>
                <p className="text-white font-semibold text-sm">Projet clôturé lecture seule</p>
                <p className="text-white/60 text-xs">
                  {project.date_cloture
                    ? `Clôturé le ${format(parseISO(project.date_cloture), "dd MMMM yyyy 'à' HH:mm", { locale: fr })}`
                    : 'Aucune modification n\'est possible.'}
                </p>
              </div>
            </div>
            {isEncadrant && (
              <button
                onClick={handleReopenProject}
                className="inline-flex items-center gap-2 px-4 py-2 bg-white text-gray-900 text-sm font-semibold rounded-lg hover:bg-gray-100 transition-colors"
              >
                ↻ Rouvrir le projet
              </button>
            )}
          </div>
        )}

        <div className="mt-5 relative z-10">
          <div className="flex justify-between text-xs text-white/50 mb-1.5">
            <span>Progression</span>
            <span>{doneTasks}/{tasks.length} tâches · {pct}%</span>
          </div>
          <div className="h-2 bg-white/15 rounded-full overflow-hidden">
            <div
              className="h-full bg-accent-500 rounded-full transition-all duration-700"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>

        {/* Onglets (dans le hero) */}
        <nav className="flex gap-1 mt-5 -mb-px relative z-10 overflow-x-auto">
          {TABS.map(({ key, label, icon }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap flex-shrink-0 ${
                tab === key
                  ? 'border-accent-500 text-white'
                  : 'border-transparent text-white/50 hover:text-white/80'
              }`}
            >
              <span>{icon}</span>
              {label}
              <span className={`text-xs rounded-full px-1.5 py-0.5 font-semibold ${
                tab === key ? 'bg-white/20 text-white' : 'bg-white/10 text-white/50'
              }`}>
                {tabCounts[key]}
              </span>
            </button>
          ))}
        </nav>
      </div>

    <div className="p-7 space-y-5">

      {/* ONGLET TÂCHES */}
      {tab === 'tasks' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3 flex-wrap">
              {/* Filtres statut seulement en vue liste */}
              {taskView === 'list' && (
                <div className="flex gap-2 flex-wrap">
                  {[
                    { value: 'all',         label: 'Toutes',    count: tasks.length },
                    { value: 'todo',        label: 'À faire',   count: tasks.filter((t) => t.statut === 'todo').length },
                    { value: 'in_progress', label: 'En cours',  count: tasks.filter((t) => t.statut === 'in_progress').length },
                    { value: 'done',        label: 'Terminées', count: tasks.filter((t) => t.statut === 'done').length },
                  ].map(({ value, label, count }) => (
                    <button
                      key={value}
                      onClick={() => setTaskFilter(value)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                        taskFilter === value
                          ? 'bg-purple-700 text-white'
                          : 'bg-white border border-gray-300 text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      {label} ({count})
                    </button>
                  ))}
                </div>
              )}

              {/* Toggle Liste / Kanban */}
              <div className="flex rounded-lg border border-gray-200 overflow-hidden">
                <button
                  onClick={() => setTaskView('list')}
                  title="Vue liste"
                  className={`px-3 py-1.5 text-xs font-medium flex items-center gap-1.5 transition-colors ${
                    taskView === 'list'
                      ? 'bg-purple-700 text-white'
                      : 'bg-white text-gray-500 hover:bg-gray-50'
                  }`}
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                  </svg>
                  Liste
                </button>
                <button
                  onClick={() => setTaskView('kanban')}
                  title="Vue Kanban"
                  className={`px-3 py-1.5 text-xs font-medium flex items-center gap-1.5 transition-colors ${
                    taskView === 'kanban'
                      ? 'bg-purple-700 text-white'
                      : 'bg-white text-gray-500 hover:bg-gray-50'
                  }`}
                >
                  <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M3 3h7v7H3V3zm11 0h7v7h-7V3zM3 14h7v7H3v-7zm11 0h7v7h-7v-7z" />
                  </svg>
                  Kanban
                </button>
              </div>
            </div>

            {canManageTasks && !isClosed && (
              <Link to={`/projects/${id}/tasks/new`} className="btn-primary">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Nouvelle tâche
              </Link>
            )}
          </div>

          {/* Vue Kanban */}
          {taskView === 'kanban' && (
            tasks.length === 0 ? (
              <div className="card text-center py-14 text-gray-400">
                <p className="text-3xl mb-2">📋</p>
                <p className="font-medium">Aucune tâche pour ce projet</p>
              </div>
            ) : (
              <KanbanBoard
                tasks={tasks}
                projectId={id}
                userId={user.id}
                isEncadrant={canManageTasks}
                canChangeStatus={!isJury && !isClosed}
                onStatusChange={handleStatusChange}
                onDelete={handleDeleteTask}
              />
            )
          )}

          {/* Vue Liste */}
          {taskView === 'list' && (
            filteredTasks.length === 0 ? (
              <div className="card text-center py-14 text-gray-400">
                <p className="text-3xl mb-2">✅</p>
                <p className="font-medium">
                  {taskFilter === 'all'
                    ? 'Aucune tâche pour ce projet'
                    : `Aucune tâche « ${taskFilter === 'todo' ? 'À faire' : taskFilter === 'in_progress' ? 'En cours' : 'Terminée'} »`}
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {filteredTasks.map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    projectId={id}
                    userId={user.id}
                    isEncadrant={canManageTasks}
                    canChangeStatus={!isJury && !isClosed}
                    onStatusChange={handleStatusChange}
                    onDelete={handleDeleteTask}
                  />
                ))}
              </div>
            )
          )}
        </div>
      )}

      {/* ONGLET LIVRABLES */}
      {tab === 'deliverables' && (
        <div className="space-y-6">
          {/* Section : Livrables attendus */}
          <div className="card p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900">
                Livrables attendus
                <span className="ml-2 text-xs font-normal text-gray-400">définis au niveau du projet</span>
              </h3>
              {isEncadrant && project.programme_id && (
                <Link to={`/programmes/${project.programme_id}`} className="text-sm text-purple-600 hover:text-purple-800 font-medium">
                  Gérer au niveau du projet →
                </Link>
              )}
            </div>

            {/* Formulaire ajout template (encadrant only) */}
            {isEncadrant && showTemplateForm && (
                <div className="bg-gray-50 rounded-lg p-4 mb-4 space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="label text-xs">Titre</label>
                      <input
                        type="text"
                        className="input text-sm"
                        value={templateForm.titre}
                        onChange={(e) => setTemplateForm({ ...templateForm, titre: e.target.value })}
                        placeholder="Ex: Rapport final"
                      />
                    </div>
                    <div>
                      <label className="label text-xs">Type</label>
                      <select
                        className="input text-sm"
                        value={templateForm.type}
                        onChange={(e) => setTemplateForm({ ...templateForm, type: e.target.value })}
                      >
                        <option value="rapport">Rapport</option>
                        <option value="code">Code source</option>
                        <option value="maquette">Maquette</option>
                        <option value="presentation">Présentation</option>
                        <option value="documentation">Documentation</option>
                        <option value="autre">Autre</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="label text-xs">Description</label>
                    <textarea
                      className="input text-sm resize-none"
                      rows={2}
                      value={templateForm.description}
                      onChange={(e) => setTemplateForm({ ...templateForm, description: e.target.value })}
                      placeholder="Détails..."
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="label text-xs">Date limite</label>
                      <input
                        type="date"
                        className="input text-sm"
                        value={templateForm.date_limite}
                        onChange={(e) => setTemplateForm({ ...templateForm, date_limite: e.target.value })}
                      />
                    </div>
                    <div className="flex items-center gap-2 pt-6">
                      <input
                        type="checkbox"
                        checked={templateForm.obligatoire}
                        onChange={(e) => setTemplateForm({ ...templateForm, obligatoire: e.target.checked })}
                        className="rounded"
                      />
                      <label className="text-sm text-gray-700">Obligatoire</label>
                    </div>
                  </div>
                  <button
                    onClick={async () => {
                      if (!templateForm.titre) {
                        toast.error('Titre requis');
                        return;
                      }
                      try {
                        await deliverableTemplatesApi.create(id, {
                          ...templateForm,
                          date_limite: templateForm.date_limite || null
                        });
                        toast.success('Livrable attendu ajouté');
                        setTemplateForm({ titre: '', description: '', type: 'rapport', date_limite: '', obligatoire: true });
                        setShowTemplateForm(false);
                        load();
                      } catch {
                        toast.error('Erreur lors de l\'ajout');
                      }
                    }}
                    className="btn-primary text-sm"
                  >
                    Ajouter
                  </button>
                </div>
              )}

              {/* Liste templates */}
              {deliverableTemplates.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-4">Aucun livrable attendu défini</p>
              ) : (
                <div className="space-y-2">
                  {deliverableTemplates.map(t => {
                    const matching = deliverables.find(d => d.template_id === t.id);
                    return (
                      <div key={t.id} className="flex items-center justify-between border rounded-lg p-3 bg-white">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm">{t.titre}</span>
                            <span className="text-xs bg-gray-100 px-2 py-0.5 rounded">{t.type}</span>
                            {t.obligatoire && <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded">Obligatoire</span>}
                          </div>
                          {t.description && <p className="text-xs text-gray-500 mt-0.5">{t.description}</p>}
                          {t.date_limite && (
                            <p className="text-xs text-gray-400 mt-0.5">
                              Limite : {format(parseISO(t.date_limite), 'dd MMM yyyy', { locale: fr })}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          {matching ? (
                            <>
                              <span className={`text-xs font-semibold px-2 py-1 rounded ${
                                matching.statut === 'valide' ? 'bg-green-100 text-green-700' :
                                matching.statut === 'rejete' ? 'bg-red-100 text-red-700' :
                                'bg-yellow-100 text-yellow-700'
                              }`}>
                                {matching.statut === 'valide' ? '✓ Validé' :
                                 matching.statut === 'rejete' ? '✗ Rejeté' :
                                 '⏳ En attente'}
                              </span>

                              {/* Boutons validation (encadrant uniquement) si en attente */}
                              {matching.statut === 'en_attente' && isEncadrant && !isClosed && (
                                <>
                                  <button
                                    onClick={async () => {
                                      const commentaire = prompt('Commentaire de validation (optionnel) :');
                                      if (commentaire === null) return;
                                      try {
                                        await deliverablesApi.validate(id, matching.id, { statut: 'valide', commentaire });
                                        toast.success('Livrable validé');
                                        load();
                                      } catch {
                                        toast.error('Erreur');
                                      }
                                    }}
                                    className="text-xs px-3 py-1 bg-green-500 text-white rounded hover:bg-green-600"
                                  >
                                    Valider
                                  </button>
                                  <button
                                    onClick={async () => {
                                      const commentaire = prompt('Raison du rejet (optionnel) :');
                                      if (commentaire === null) return;
                                      try {
                                        await deliverablesApi.validate(id, matching.id, { statut: 'rejete', commentaire });
                                        toast.success('Livrable rejeté');
                                        load();
                                      } catch {
                                        toast.error('Erreur');
                                      }
                                    }}
                                    className="text-xs px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600"
                                  >
                                    Rejeter
                                  </button>
                                </>
                              )}

                              {/* Bouton re-upload si rejeté (non-jury) */}
                              {matching.statut === 'rejete' && !isJury && !isClosed && (
                                <label className="text-xs px-3 py-1 bg-orange-500 text-white rounded cursor-pointer hover:bg-orange-600">
                                  Re-déposer
                                  <input
                                    type="file"
                                    className="hidden"
                                    onChange={(e) => handleUpload(e, t.id)}
                                  />
                                </label>
                              )}
                            </>
                          ) : (
                            <>
                              {!isJury && !isClosed ? (
                                <label className="text-xs px-3 py-1 bg-purple-600 text-white rounded cursor-pointer hover:bg-purple-700">
                                  Déposer
                                  <input
                                    type="file"
                                    className="hidden"
                                    onChange={(e) => handleUpload(e, t.id)}
                                  />
                                </label>
                              ) : (
                                <span className="text-xs text-red-600 font-medium">❌ Non déposé</span>
                              )}
                            </>
                          )}
                          {isEncadrant && (
                            <button
                              onClick={async () => {
                                if (!window.confirm('Supprimer ce livrable attendu ?')) return;
                                try {
                                  await deliverableTemplatesApi.remove(id, t.id);
                                  toast.success('Supprimé');
                                  load();
                                } catch {
                                  toast.error('Erreur');
                                }
                              }}
                              className="text-gray-400 hover:text-red-500"
                            >
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
          </div>

          {/* Section : Upload et liste des fichiers */}
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500">
              {deliverables.length} fichier{deliverables.length !== 1 ? 's' : ''} déposé{deliverables.length !== 1 ? 's' : ''}
            </p>
            {!isJury && !isClosed && (
              <label className="btn-primary cursor-pointer">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
                Déposer un fichier
                <input type="file" className="hidden" onChange={handleUpload} />
              </label>
            )}
          </div>

          {deliverables.length === 0 ? (
            <div className="card text-center py-14 text-gray-400">
              <p className="text-4xl mb-3">📂</p>
              <p className="font-medium">Aucun livrable déposé</p>
              <p className="text-sm mt-1">Cliquez sur « Déposer un fichier » pour commencer</p>
            </div>
          ) : (
            <div className="card p-0 divide-y divide-gray-100">
              {deliverables.map((d) => (
                <div key={d.id}>
                <div className="flex items-center gap-4 px-5 py-4 hover:bg-gray-50 transition-colors">
                  {/* Icône selon extension */}
                  <div className="w-9 h-9 rounded-lg bg-purple-50 flex items-center justify-center flex-shrink-0">
                    <span className="text-base">{getFileIcon(d.nom_fichier)}</span>
                  </div>

                  {/* Infos */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <a
                        href={fileUrl(d.url)}
                        target="_blank"
                        rel="noreferrer"
                        className="text-sm font-medium text-primary-700 hover:text-primary-900 hover:underline truncate"
                      >
                        {d.nom_fichier}
                      </a>
                      {/* Badge statut */}
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded ${
                        d.statut === 'valide' ? 'bg-green-100 text-green-700' :
                        d.statut === 'rejete' ? 'bg-red-100 text-red-700' :
                        'bg-yellow-100 text-yellow-700'
                      }`}>
                        {d.statut === 'valide' ? 'Validé' :
                         d.statut === 'rejete' ? 'Rejeté' :
                         'En attente'}
                      </span>
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5">
                      Déposé par <span className="font-medium">{d.uploade_par_nom}</span>
                      {' · '}
                      {format(parseISO(d.created_at), "dd MMM yyyy 'à' HH:mm", { locale: fr })}
                    </p>
                    {d.commentaire_validation && (
                      <p className="text-xs text-gray-600 mt-1 italic">
                        "{d.commentaire_validation}"
                      </p>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {/* Boutons Validation (encadrant uniquement) */}
                    {isEncadrant && d.statut === 'en_attente' && (
                      <>
                        <button
                          onClick={async () => {
                            const commentaire = prompt('Commentaire de validation (optionnel) :');
                            if (commentaire === null) return; // Annulé
                            try {
                              await deliverablesApi.validate(id, d.id, { statut: 'valide', commentaire });
                              toast.success('Livrable validé');
                              load();
                            } catch (err) {
                              toast.error('Erreur lors de la validation');
                            }
                          }}
                          className="text-xs font-medium px-3 py-1.5 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
                          title="Valider"
                        >
                          Valider
                        </button>
                        <button
                          onClick={async () => {
                            const commentaire = prompt('Raison du rejet (optionnel) :');
                            if (commentaire === null) return; // Annulé
                            try {
                              await deliverablesApi.validate(id, d.id, { statut: 'rejete', commentaire });
                              toast.success('Livrable rejeté');
                              load();
                            } catch (err) {
                              toast.error('Erreur lors du rejet');
                            }
                          }}
                          className="text-xs font-medium px-3 py-1.5 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
                          title="Rejeter"
                        >
                          Rejeter
                        </button>
                      </>
                    )}

                    <button
                      onClick={() => toggleDelivComments(d.id)}
                      className="text-gray-400 hover:text-purple-600 transition-colors"
                      title="Commentaires"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => handleDownload(d.url, d.nom_fichier)}
                      className="text-gray-400 hover:text-gray-700 transition-colors"
                      title="Télécharger"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                    </button>
                    {(isEncadrant || d.uploade_par === user.id) && (
                      <button
                        onClick={() => handleDeleteDeliverable(d.id, d.nom_fichier)}
                        className="text-gray-400 hover:text-red-500 transition-colors"
                        title="Supprimer"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    )}
                  </div>
                </div>

                {/* Commentaires du livrable */}
                {openDelivComments[d.id] && (
                  <div className="px-5 pb-4 bg-gray-50 border-t border-gray-100">
                    <div className="space-y-2 py-3">
                      {(delivComments[d.id] || []).length === 0 && (
                        <p className="text-xs text-gray-400">Aucun commentaire</p>
                      )}
                      {(delivComments[d.id] || []).map(c => (
                        <div key={c.id} className="text-sm">
                          <span className="font-medium text-gray-700">{c.auteur_nom}</span>
                          {c.auteur_role === 'encadrant' && (
                            <span className="ml-1 text-xs bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded-full">Encadrant</span>
                          )}
                          <span className="text-gray-500 ml-1">{c.contenu}</span>
                        </div>
                      ))}
                    </div>
                    <form onSubmit={(e) => handleDelivComment(e, d.id)} className="flex gap-2">
                      <input
                        value={delivCommentInputs[d.id] || ''}
                        onChange={e => setDelivCommentInputs(prev => ({ ...prev, [d.id]: e.target.value }))}
                        placeholder="Ajouter un commentaire..."
                        className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-purple-400"
                      />
                      <button type="submit" className="btn-primary py-1.5 px-3 text-xs">Envoyer</button>
                    </form>
                  </div>
                )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ONGLET JALONS */}
      {tab === 'milestones' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-gray-900">
              Jalons du projet
              <span className="ml-2 text-xs font-normal text-gray-400">communs à toutes les équipes</span>
            </h2>
            {isEncadrant && project.programme_id && (
              <Link to={`/programmes/${project.programme_id}`} className="text-sm text-purple-600 hover:text-purple-800 font-medium">
                Gérer au niveau du projet →
              </Link>
            )}
          </div>

          {/* Formulaire ajout/modification */}
          {showMilestoneForm && (
            <div className="card space-y-4">
              <h3 className="font-semibold text-gray-900">
                {editingMilestone ? 'Modifier le jalon' : 'Nouveau jalon'}
              </h3>
              <div>
                <label className="label">Titre</label>
                <input
                  type="text"
                  className="input"
                  value={milestoneForm.titre}
                  onChange={(e) => setMilestoneForm({ ...milestoneForm, titre: e.target.value })}
                  placeholder="Ex: Livraison version 1.0"
                />
              </div>
              <div>
                <label className="label">Description</label>
                <textarea
                  className="input resize-none"
                  rows={3}
                  value={milestoneForm.description}
                  onChange={(e) => setMilestoneForm({ ...milestoneForm, description: e.target.value })}
                  placeholder="Décrivez ce jalon..."
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Date échéance</label>
                  <input
                    type="date"
                    className="input"
                    value={milestoneForm.date_echeance}
                    onChange={(e) => setMilestoneForm({ ...milestoneForm, date_echeance: e.target.value })}
                  />
                </div>
                <div>
                  <label className="label">Statut</label>
                  <select
                    className="input"
                    value={milestoneForm.statut}
                    onChange={(e) => setMilestoneForm({ ...milestoneForm, statut: e.target.value })}
                  >
                    <option value="a_venir">À venir</option>
                    <option value="en_cours">En cours</option>
                    <option value="atteint">Atteint</option>
                    <option value="manque">Manqué</option>
                  </select>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={async () => {
                    if (!milestoneForm.titre || !milestoneForm.date_echeance) {
                      toast.error('Titre et date sont requis');
                      return;
                    }
                    try {
                      if (editingMilestone) {
                        await milestonesApi.update(id, editingMilestone.id, milestoneForm);
                        toast.success('Jalon modifié');
                      } else {
                        await milestonesApi.create(id, milestoneForm);
                        toast.success('Jalon créé');
                      }
                      setShowMilestoneForm(false);
                      setEditingMilestone(null);
                      setMilestoneForm({ titre: '', description: '', date_echeance: '', statut: 'a_venir' });
                      load();
                    } catch (err) {
                      toast.error('Erreur lors de l\'enregistrement');
                    }
                  }}
                  className="btn-primary"
                >
                  {editingMilestone ? 'Mettre à jour' : 'Créer'}
                </button>
                <button
                  onClick={() => {
                    setShowMilestoneForm(false);
                    setEditingMilestone(null);
                    setMilestoneForm({ titre: '', description: '', date_echeance: '', statut: 'a_venir' });
                  }}
                  className="btn-secondary"
                >
                  Annuler
                </button>
              </div>
            </div>
          )}

          {/* Timeline des jalons */}
          {milestones.length === 0 ? (
            <div className="card text-center py-14 text-gray-400">
              <p className="text-4xl mb-3">🎯</p>
              <p className="font-medium">Aucun jalon défini</p>
              <p className="text-sm mt-1">Les jalons permettent de suivre les étapes clés du projet</p>
            </div>
          ) : (
            <div className="card p-6">
              <div className="relative">
                {/* Ligne verticale */}
                <div className="absolute left-8 top-0 bottom-0 w-0.5 bg-gray-200"></div>

                {/* Jalons */}
                <div className="space-y-6">
                  {milestones.map((m, index) => {
                    const isPassed = isPast(parseISO(m.date_echeance));
                    return (
                      <div key={m.id} className="relative pl-20">
                        {/* Cercle timeline */}
                        <div className={`absolute left-5 top-2 w-6 h-6 rounded-full border-4 border-white ${
                          m.statut === 'atteint' ? 'bg-green-500' :
                          m.statut === 'manque' ? 'bg-red-500' :
                          m.statut === 'en_cours' ? 'bg-blue-500' :
                          'bg-gray-300'
                        } shadow-md`}></div>

                        {/* Contenu */}
                        <div className="bg-gray-50 rounded-lg p-4 hover:bg-gray-100 transition-colors">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <h3 className="font-semibold text-gray-900">{m.titre}</h3>
                                <span className={`text-xs font-semibold px-2 py-0.5 rounded ${
                                  m.statut === 'atteint' ? 'bg-green-100 text-green-700' :
                                  m.statut === 'manque' ? 'bg-red-100 text-red-700' :
                                  m.statut === 'en_cours' ? 'bg-blue-100 text-blue-700' :
                                  'bg-gray-100 text-gray-600'
                                }`}>
                                  {m.statut === 'atteint' ? 'Atteint' :
                                   m.statut === 'manque' ? 'Manqué' :
                                   m.statut === 'en_cours' ? 'En cours' :
                                   'À venir'}
                                </span>
                              </div>
                              {m.description && (
                                <p className="text-sm text-gray-600 mb-2">{m.description}</p>
                              )}
                              <p className="text-xs text-gray-400">
                                Échéance : {format(parseISO(m.date_echeance), "dd MMMM yyyy", { locale: fr })}
                                {isPassed && m.statut === 'a_venir' && (
                                  <span className="ml-2 text-red-500 font-medium">⚠ Échéance dépassée</span>
                                )}
                              </p>
                            </div>

                            {/* Actions (gérées au niveau Projet masquées sur la page équipe) */}
                            {false && (
                              <div className="flex items-center gap-2 flex-shrink-0">
                                <button
                                  onClick={() => {
                                    setEditingMilestone(m);
                                    setMilestoneForm({
                                      titre: m.titre,
                                      description: m.description || '',
                                      date_echeance: m.date_echeance,
                                      statut: m.statut
                                    });
                                    setShowMilestoneForm(true);
                                  }}
                                  className="text-gray-400 hover:text-blue-600 transition-colors"
                                  title="Modifier"
                                >
                                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                      d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                  </svg>
                                </button>
                                <button
                                  onClick={async () => {
                                    if (!window.confirm('Supprimer ce jalon ?')) return;
                                    try {
                                      await milestonesApi.remove(id, m.id);
                                      toast.success('Jalon supprimé');
                                      load();
                                    } catch (err) {
                                      toast.error('Erreur lors de la suppression');
                                    }
                                  }}
                                  className="text-gray-400 hover:text-red-500 transition-colors"
                                  title="Supprimer"
                                >
                                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                  </svg>
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ONGLET CALENDRIER */}
      {tab === 'calendar' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-gray-900">
              {format(currentMonth, 'MMMM yyyy', { locale: fr })}
            </h2>
            <div className="flex gap-2">
              <button
                onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
                className="px-3 py-2 text-sm bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                ← Mois précédent
              </button>
              <button
                onClick={() => setCurrentMonth(new Date())}
                className="px-3 py-2 text-sm bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Aujourd'hui
              </button>
              <button
                onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
                className="px-3 py-2 text-sm bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Mois suivant →
              </button>
            </div>
          </div>

          <div className="card p-6">
            {/* En-têtes jours de la semaine */}
            <div className="grid grid-cols-7 gap-2 mb-2">
              {['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'].map(day => (
                <div key={day} className="text-center text-sm font-semibold text-gray-600 py-2">
                  {day}
                </div>
              ))}
            </div>

            {/* Grille calendrier */}
            <div className="grid grid-cols-7 gap-2">
              {(() => {
                const monthStart = startOfMonth(currentMonth);
                const monthEnd = endOfMonth(currentMonth);
                const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 });
                const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
                const calendarDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

                return calendarDays.map(day => {
                  const isCurrentMonth = isSameMonth(day, currentMonth);
                  const isToday = isSameDay(day, new Date());

                  // Trouver les tâches avec deadline ce jour
                  const dayTasks = tasks.filter(t =>
                    t.deadline && isSameDay(parseISO(t.deadline), day)
                  );

                  // Trouver les jalons avec échéance ce jour
                  const dayMilestones = milestones.filter(m =>
                    m.date_echeance && isSameDay(parseISO(m.date_echeance), day)
                  );

                  return (
                    <div
                      key={day.toISOString()}
                      className={`min-h-[100px] border rounded-lg p-2 ${
                        !isCurrentMonth ? 'bg-gray-50 text-gray-400' :
                        isToday ? 'bg-purple-50 border-purple-400' :
                        'bg-white border-gray-200'
                      }`}
                    >
                      {/* Numéro du jour */}
                      <div className={`text-sm font-semibold mb-1 ${
                        isToday ? 'text-purple-700' : 'text-gray-700'
                      }`}>
                        {format(day, 'd')}
                      </div>

                      {/* Tâches du jour */}
                      <div className="space-y-1">
                        {dayTasks.map(t => (
                          <div
                            key={`task-${t.id}`}
                            className={`text-xs px-1.5 py-0.5 rounded truncate ${
                              t.statut === 'done' ? 'bg-green-100 text-green-700' :
                              isPast(parseISO(t.deadline)) ? 'bg-red-100 text-red-700' :
                              'bg-blue-100 text-blue-700'
                            }`}
                            title={t.titre}
                          >
                            📋 {t.titre}
                          </div>
                        ))}

                        {/* Jalons du jour */}
                        {dayMilestones.map(m => (
                          <div
                            key={`milestone-${m.id}`}
                            className={`text-xs px-1.5 py-0.5 rounded truncate ${
                              m.statut === 'atteint' ? 'bg-green-100 text-green-700' :
                              m.statut === 'manque' ? 'bg-red-100 text-red-700' :
                              m.statut === 'en_cours' ? 'bg-blue-100 text-blue-700' :
                              'bg-gray-100 text-gray-700'
                            }`}
                            title={m.titre}
                          >
                            🎯 {m.titre}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
          </div>

          {/* Légende */}
          <div className="card">
            <h3 className="font-semibold text-gray-900 mb-3">Légende</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded bg-blue-100 border border-blue-200"></div>
                <span className="text-gray-700">Tâche en cours</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded bg-green-100 border border-green-200"></div>
                <span className="text-gray-700">Tâche terminée</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded bg-red-100 border border-red-200"></div>
                <span className="text-gray-700">Tâche en retard</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded bg-gray-100 border border-gray-200"></div>
                <span className="text-gray-700">Jalon à venir</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ONGLET STATISTIQUES */}
      {tab === 'stats' && (
        <div className="space-y-6">
          <h2 className="text-lg font-bold text-gray-900">Statistiques du projet</h2>

          {/* Graphique 1 : Avancement des tâches (camembert) */}
          <div className="card">
            <h3 className="font-semibold text-gray-900 mb-4">Répartition des tâches</h3>
            {tasks.length === 0 ? (
              <p className="text-gray-400 text-center py-8">Aucune tâche à afficher</p>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={[
                      { name: 'À faire', value: tasks.filter(t => t.statut === 'todo').length, color: '#9CA3AF' },
                      { name: 'En cours', value: tasks.filter(t => t.statut === 'in_progress').length, color: '#3B82F6' },
                      { name: 'Terminé', value: tasks.filter(t => t.statut === 'done').length, color: '#10B981' },
                    ]}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, value }) => `${name}: ${value}`}
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {[
                      { name: 'À faire', value: tasks.filter(t => t.statut === 'todo').length, color: '#9CA3AF' },
                      { name: 'En cours', value: tasks.filter(t => t.statut === 'in_progress').length, color: '#3B82F6' },
                      { name: 'Terminé', value: tasks.filter(t => t.statut === 'done').length, color: '#10B981' },
                    ].map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Graphique 2 : Répartition par priorité (barres) */}
          <div className="card">
            <h3 className="font-semibold text-gray-900 mb-4">Tâches par priorité</h3>
            {tasks.length === 0 ? (
              <p className="text-gray-400 text-center py-8">Aucune tâche à afficher</p>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart
                  data={[
                    { priorite: 'Basse', count: tasks.filter(t => t.priorite === 'basse').length, color: '#9CA3AF' },
                    { priorite: 'Normale', count: tasks.filter(t => t.priorite === 'normale').length, color: '#3B82F6' },
                    { priorite: 'Haute', count: tasks.filter(t => t.priorite === 'haute').length, color: '#F59E0B' },
                    { priorite: 'Urgente', count: tasks.filter(t => t.priorite === 'urgente').length, color: '#EF4444' },
                  ]}
                  margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="priorite" />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="count" name="Nombre de tâches" fill="#8B5CF6" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Graphique 3 : Statut des jalons (barres) */}
          <div className="card">
            <h3 className="font-semibold text-gray-900 mb-4">Statut des jalons</h3>
            {milestones.length === 0 ? (
              <p className="text-gray-400 text-center py-8">Aucun jalon à afficher</p>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart
                  data={[
                    { statut: 'À venir', count: milestones.filter(m => m.statut === 'a_venir').length, color: '#9CA3AF' },
                    { statut: 'En cours', count: milestones.filter(m => m.statut === 'en_cours').length, color: '#3B82F6' },
                    { statut: 'Atteint', count: milestones.filter(m => m.statut === 'atteint').length, color: '#10B981' },
                    { statut: 'Manqué', count: milestones.filter(m => m.statut === 'manque').length, color: '#EF4444' },
                  ]}
                  margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="statut" />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="count" name="Nombre de jalons" fill="#F59E0B" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Graphique 4 : Statut des livrables (barres) */}
          <div className="card">
            <h3 className="font-semibold text-gray-900 mb-4">Validation des livrables</h3>
            {deliverables.length === 0 ? (
              <p className="text-gray-400 text-center py-8">Aucun livrable à afficher</p>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart
                  data={[
                    { statut: 'En attente', count: deliverables.filter(d => d.statut === 'en_attente').length, color: '#F59E0B' },
                    { statut: 'Validé', count: deliverables.filter(d => d.statut === 'valide').length, color: '#10B981' },
                    { statut: 'Rejeté', count: deliverables.filter(d => d.statut === 'rejete').length, color: '#EF4444' },
                  ]}
                  margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="statut" />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="count" name="Nombre de livrables" fill="#10B981" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Résumé chiffré */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="card text-center">
              <p className="text-3xl font-bold text-purple-600">{tasks.length}</p>
              <p className="text-sm text-gray-500 mt-1">Tâches totales</p>
            </div>
            <div className="card text-center">
              <p className="text-3xl font-bold text-green-600">
                {tasks.length > 0 ? Math.round((tasks.filter(t => t.statut === 'done').length / tasks.length) * 100) : 0}%
              </p>
              <p className="text-sm text-gray-500 mt-1">Progression</p>
            </div>
            <div className="card text-center">
              <p className="text-3xl font-bold text-orange-600">{milestones.length}</p>
              <p className="text-sm text-gray-500 mt-1">Jalons</p>
            </div>
            <div className="card text-center">
              <p className="text-3xl font-bold text-blue-600">{deliverables.length}</p>
              <p className="text-sm text-gray-500 mt-1">Livrables</p>
            </div>
          </div>
        </div>
      )}

      {/* ONGLET FEEDBACK */}
      {tab === 'feedback' && (
        <div className="space-y-4">
          {isEncadrant && !isClosed && (
            <form onSubmit={handleAddFeedback} className="card space-y-3">
              <h3 className="text-sm font-semibold text-gray-700">Ajouter un feedback</h3>
              <textarea
                value={newFeedback}
                onChange={e => setNewFeedback(e.target.value)}
                placeholder="Votre retour sur l'avancement du projet..."
                className="input min-h-[80px] resize-none"
                rows={3}
              />
              <button type="submit" className="btn-primary">Envoyer le feedback</button>
            </form>
          )}

          {feedbacks.length === 0 ? (
            <div className="card text-center py-14 text-gray-400">
              <p className="text-4xl mb-3">💬</p>
              <p className="font-medium">Aucun feedback pour l'instant</p>
            </div>
          ) : (
            <div className="space-y-3">
              {feedbacks.map(f => (
                <div key={f.id} className="card">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-7 h-7 rounded-full bg-purple-100 flex items-center justify-center text-purple-700 font-bold text-xs">
                      {f.encadrant_nom?.charAt(0)}
                    </div>
                    <span className="text-sm font-semibold text-gray-800">{f.encadrant_nom}</span>
                    <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">Encadrant</span>
                    <span className="text-xs text-gray-400 ml-auto">
                      {format(parseISO(f.created_at), "dd MMM yyyy 'à' HH:mm", { locale: fr })}
                    </span>
                  </div>
                  <p className="text-sm text-gray-700 leading-relaxed">{f.contenu}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ONGLET AIDE */}
      {tab === 'aide' && (
        <div className="space-y-4">

          {/* Bouton / formulaire étudiant (pas jury) */}
          {!isEncadrant && !isJury && !isClosed && (
            <>
              {!showHelpForm ? (
                <button onClick={() => setShowHelpForm(true)} className="btn-primary">
                  🆘 Demander de l'aide
                </button>
              ) : (
                <form onSubmit={handleSubmitHelp} className="card space-y-3">
                  <h3 className="text-sm font-semibold text-gray-700">Nouvelle demande d'aide</h3>
                  <input
                    placeholder="Titre résumez votre difficulté"
                    value={helpForm.titre}
                    onChange={e => setHelpForm({ ...helpForm, titre: e.target.value })}
                    className="input"
                    required
                  />
                  <textarea
                    placeholder="Décrivez le problème en détail..."
                    value={helpForm.description}
                    onChange={e => setHelpForm({ ...helpForm, description: e.target.value })}
                    className="input min-h-[80px] resize-none"
                    rows={3}
                    required
                  />
                  <div className="flex gap-2">
                    <button type="submit" className="btn-primary">Envoyer</button>
                    <button type="button" onClick={() => setShowHelpForm(false)} className="btn-secondary">Annuler</button>
                  </div>
                </form>
              )}
            </>
          )}

          {/* Liste des demandes */}
          {helpRequests.length === 0 ? (
            <div className="card text-center py-14 text-gray-400">
              <p className="text-4xl mb-3">🆘</p>
              <p className="font-medium">Aucune demande d'aide</p>
            </div>
          ) : (
            <div className="space-y-3">
              {helpRequests.map(h => (
                <div key={h.id} className={`card border-l-4 ${
                  h.statut === 'resolu' ? 'border-green-400' :
                  h.statut === 'pris_en_charge' ? 'border-blue-400' :
                  'border-yellow-400'
                }`}>
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div>
                      <span className="font-semibold text-gray-800">{h.titre}</span>
                      <p className="text-xs text-gray-400 mt-0.5">
                        Par {h.auteur_nom} · {format(parseISO(h.created_at), "dd MMM yyyy", { locale: fr })}
                      </p>
                    </div>
                    <span className={`text-xs px-2 py-1 rounded-full font-medium flex-shrink-0 ${
                      h.statut === 'resolu'         ? 'bg-green-100 text-green-700' :
                      h.statut === 'pris_en_charge' ? 'bg-blue-100 text-blue-700' :
                                                      'bg-yellow-100 text-yellow-700'
                    }`}>
                      {h.statut === 'resolu' ? '✅ Résolu' :
                       h.statut === 'pris_en_charge' ? '🔵 Pris en charge' : '🟡 En attente'}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 mb-2">{h.description}</p>
                  {h.reponse && (
                    <div className="bg-purple-50 rounded-lg p-3 border border-purple-100 mt-2">
                      <p className="text-xs font-semibold text-purple-700 mb-1">Réponse de l'encadrant</p>
                      <p className="text-sm text-gray-700">{h.reponse}</p>
                    </div>
                  )}

                  {/* Bouton répondre encadrant */}
                  {isEncadrant && h.statut !== 'resolu' && (
                    helpReplyId === h.id ? (
                      <div className="space-y-2 mt-3">
                        <textarea
                          value={helpReplyForm.reponse}
                          onChange={e => setHelpReplyForm({ ...helpReplyForm, reponse: e.target.value })}
                          placeholder="Votre réponse..."
                          className="input resize-none text-sm"
                          rows={2}
                        />
                        <div className="flex gap-2">
                          <select
                            value={helpReplyForm.statut}
                            onChange={e => setHelpReplyForm({ ...helpReplyForm, statut: e.target.value })}
                            className="input text-sm w-auto"
                          >
                            <option value="pris_en_charge">🔵 Pris en charge</option>
                            <option value="resolu">✅ Marquer résolu</option>
                          </select>
                          <button onClick={() => handleReplyHelp(h.id)} className="btn-primary text-sm">Envoyer</button>
                          <button onClick={() => setHelpReplyId(null)} className="btn-secondary text-sm">Annuler</button>
                        </div>
                      </div>
                    ) : (
                      <button onClick={() => setHelpReplyId(h.id)} className="btn-secondary text-sm mt-2">
                        Répondre
                      </button>
                    )
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ONGLET ÉVALUATION */}
      {tab === 'evaluation' && (
        <div className="space-y-5">
          {/* Formulaire de saisie (encadrant + jury) */}
          {canEvaluate && !isClosed && (
            <div className="card p-6">
              <h3 className="text-base font-bold text-gray-900 mb-4 flex items-center gap-2">
                📊 Grille d'évaluation
              </h3>
              <form onSubmit={async (e) => {
                e.preventDefault();
                try {
                  await evaluationsApi.create(id, {
                    commentaire: evalForm.commentaire,
                    date_soutenance: evalForm.date_soutenance || null,
                    criteria: evalCriteria.map(c => ({
                      nom_critere: c.nom_critere,
                      note: c.note ? parseFloat(c.note) : null,
                      coefficient: c.coefficient,
                      commentaire: c.commentaire || null
                    }))
                  });
                  toast.success(evaluations.length > 0 ? 'Évaluation mise à jour' : 'Évaluation enregistrée');
                  load();
                } catch {
                  toast.error('Erreur lors de l\'enregistrement');
                }
              }} className="space-y-6">

                {/* Note globale calculée */}
                <div className="bg-purple-50 rounded-lg p-4 border border-purple-200">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-gray-700">Note globale pondérée</span>
                    <div className="flex items-center gap-2">
                      <span className="text-3xl font-bold text-purple-700">
                        {(() => {
                          let total = 0, coef = 0;
                          evalCriteria.forEach(c => {
                            if (c.note) {
                              total += parseFloat(c.note) * c.coefficient;
                              coef += c.coefficient;
                            }
                          });
                          return coef > 0 ? (total / coef).toFixed(2) : '';
                        })()}
                      </span>
                      <span className="text-xl text-gray-400">/ 20</span>
                    </div>
                  </div>
                </div>

                {/* Critères */}
                <div className="space-y-4">
                  {evalCriteria.map((critere, index) => (
                    <div key={index} className="border border-gray-200 rounded-lg p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <h4 className="font-semibold text-gray-900">{critere.nom_critere}</h4>
                          <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
                            Coef. {critere.coefficient}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            step="0.5"
                            min="0"
                            max="20"
                            value={critere.note}
                            onChange={(e) => {
                              const newCriteria = [...evalCriteria];
                              newCriteria[index].note = e.target.value;
                              setEvalCriteria(newCriteria);
                            }}
                            className="w-20 border border-gray-300 rounded-lg px-3 py-1.5 text-sm text-center focus:outline-none focus:border-purple-500"
                            placeholder=""
                          />
                          <span className="text-sm text-gray-500">/ 20</span>
                        </div>
                      </div>
                      <input
                        type="text"
                        value={critere.commentaire}
                        onChange={(e) => {
                          const newCriteria = [...evalCriteria];
                          newCriteria[index].commentaire = e.target.value;
                          setEvalCriteria(newCriteria);
                        }}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-purple-500"
                        placeholder="Commentaire (optionnel)..."
                      />
                    </div>
                  ))}
                </div>

                {/* Date soutenance et commentaire global */}
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Date de soutenance
                    </label>
                    <input
                      type="date"
                      value={evalForm.date_soutenance}
                      onChange={(e) => setEvalForm({ ...evalForm, date_soutenance: e.target.value })}
                      className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-purple-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Commentaire global
                    </label>
                    <textarea
                      value={evalForm.commentaire}
                      onChange={(e) => setEvalForm({ ...evalForm, commentaire: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-purple-500"
                      rows={4}
                      placeholder="Appréciation générale du projet..."
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg text-white text-sm font-semibold"
                  style={{ backgroundColor: '#3D1A6E' }}
                >
                  {evaluations.length > 0 ? 'Mettre à jour l\'évaluation' : 'Enregistrer l\'évaluation'}
                </button>
              </form>
            </div>
          )}

          {/* Affichage de l'évaluation */}
          {evaluations.length === 0 && !canEvaluate && (
            <div className="card text-center py-14 text-gray-400">
              <p className="text-5xl mb-3">📊</p>
              <p className="font-medium">Aucune évaluation pour le moment</p>
              <p className="text-sm mt-1">Votre projet n'a pas encore été évalué</p>
            </div>
          )}
          {evaluations.length > 0 && (
            <div className="card p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
                  ✅ Évaluation finale
                </h3>
                <div className="flex items-center gap-3">
                {canEvaluate && !isClosed && (
                  <button
                    onClick={async () => {
                      if (!window.confirm('Supprimer cette évaluation ?')) return;
                      try {
                        await evaluationsApi.remove(id, evaluations[0].id);
                        toast.success('Évaluation supprimée');
                        setEvalForm({ commentaire: '', date_soutenance: '' });
                        setEvalCriteria([
                          { nom_critere: 'Qualité technique', note: '', coefficient: 3, commentaire: '' },
                          { nom_critere: 'Documentation', note: '', coefficient: 2, commentaire: '' },
                          { nom_critere: 'Respect des délais', note: '', coefficient: 2, commentaire: '' },
                          { nom_critere: 'Travail d\'équipe', note: '', coefficient: 2, commentaire: '' },
                          { nom_critere: 'Innovation', note: '', coefficient: 1, commentaire: '' },
                          { nom_critere: 'Présentation / Soutenance', note: '', coefficient: 2, commentaire: '' },
                        ]);
                        load();
                      } catch {
                        toast.error('Impossible de supprimer');
                      }
                    }}
                    className="text-xs text-red-500 hover:text-red-700"
                  >
                    Supprimer
                  </button>
                )}
                </div>
              </div>
              {evaluations.map((ev) => (
                <div key={ev.id} className="space-y-4">
                  {/* Note globale */}
                  <div className="bg-purple-50 rounded-lg p-4 border border-purple-200">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                          <span className="text-4xl font-bold text-purple-700">
                            {ev.note_globale}
                          </span>
                          <span className="text-2xl text-gray-400">/ 20</span>
                        </div>
                        {ev.date_soutenance && (
                          <div className="text-sm text-gray-600">
                            <span className="font-medium">Soutenance :</span>{' '}
                            {format(parseISO(ev.date_soutenance), 'dd MMMM yyyy', { locale: fr })}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Détail des critères */}
                  {ev.criteria && ev.criteria.length > 0 && (
                    <div className="space-y-3">
                      <h4 className="font-semibold text-gray-900 text-sm">Détail par critère</h4>
                      {ev.criteria.map((c, idx) => (
                        <div key={idx} className="border border-gray-200 rounded-lg p-3 bg-gray-50">
                          <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-gray-900 text-sm">{c.nom_critere}</span>
                              <span className="text-xs bg-gray-200 text-gray-600 px-2 py-0.5 rounded">
                                Coef. {c.coefficient}
                              </span>
                            </div>
                            <div className="flex items-center gap-1">
                              <span className="text-lg font-bold text-purple-700">{c.note}</span>
                              <span className="text-sm text-gray-400">/ 20</span>
                            </div>
                          </div>
                          {c.commentaire && (
                            <p className="text-sm text-gray-600 mt-1 italic">"{c.commentaire}"</p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Commentaire global */}
                  {ev.commentaire && (
                    <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                      <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Appréciation générale</p>
                      <p className="text-sm text-gray-700 whitespace-pre-wrap">{ev.commentaire}</p>
                    </div>
                  )}

                  <p className="text-xs text-gray-400">
                    Évalué par {ev.evaluateur_nom} · {format(parseISO(ev.created_at), 'dd MMM yyyy à HH:mm', { locale: fr })}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ONGLET ÉQUIPE */}
      {tab === 'members' && (
        <div className="space-y-5">
          <h2 className="text-lg font-bold text-gray-900">Membres de l'équipe</h2>
          {/* Membres actuels */}
          {project.members.length === 0 ? (
            <div className="card text-center py-14 text-gray-400">
              <p className="text-4xl mb-3">👥</p>
              <p className="font-medium">Aucun membre dans ce projet</p>
              {isEncadrant && <p className="text-sm mt-1">Ajoutez des étudiants ci-dessous</p>}
            </div>
          ) : (
            <div className="card p-0 divide-y divide-gray-100">
              {project.members.map((m) => (
                <div key={m.id} className="flex items-center gap-4 px-5 py-4">
                  {/* Avatar */}
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                    {m.nom.charAt(0).toUpperCase()}
                  </div>
                  {/* Infos */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900">{m.nom}</p>
                    <p className="text-xs text-gray-400 truncate">{m.email}</p>
                  </div>
                  {/* Badge rôle */}
                  {m.role === 'team_leader' ? (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium flex-shrink-0">⭐ Team leader</span>
                  ) : (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-orange-100 text-orange-600 font-medium flex-shrink-0">Étudiant</span>
                  )}
                  {/* Promouvoir / rétrograder team leader */}
                  {isEncadrant && !isClosed && (
                    <button
                      onClick={() => handleToggleLeader(m)}
                      className={`text-xs font-medium px-2.5 py-1 rounded-lg border transition-colors flex-shrink-0 ${
                        m.role === 'team_leader'
                          ? 'border-gray-200 text-gray-500 hover:bg-gray-50'
                          : 'border-amber-300 text-amber-700 hover:bg-amber-50'
                      }`}
                      title={m.role === 'team_leader' ? 'Retirer le rôle team leader' : 'Promouvoir team leader'}
                    >
                      {m.role === 'team_leader' ? 'Retirer leader' : '⭐ Promouvoir'}
                    </button>
                  )}
                  {/* Retirer */}
                  {isEncadrant && !isClosed && (
                    <button
                      onClick={() => handleRemoveMember(m.id, m.nom)}
                      className="text-gray-300 hover:text-red-500 transition-colors flex-shrink-0"
                      title={`Retirer ${m.nom}`}
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M13 7a4 4 0 11-8 0 4 4 0 018 0zM9 14a6 6 0 00-6 6v1h12v-1a6 6 0 00-6-6zM21 12h-6" />
                      </svg>
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Encadrant */}
          <div className="card flex items-center gap-4">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-purple-700 to-purple-900 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
              {project.encadrant_nom.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-900">{project.encadrant_nom}</p>
              <p className="text-xs text-gray-400">Responsable du projet</p>
            </div>
            <span className="text-xs px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 font-medium">
              Encadrant
            </span>
          </div>

          {/* Ajouter des membres (encadrant only) */}
          {isEncadrant && !isClosed && nonMembers.length > 0 && (
            <div className="card">
              <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                <svg className="w-4 h-4 text-purple-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                </svg>
                Ajouter un membre
              </h3>
              <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                {nonMembers.map((s) => (
                  <div
                    key={s.id}
                    className="flex items-center justify-between gap-3 rounded-lg border border-gray-100 px-3 py-2 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-7 h-7 rounded-full bg-gray-200 flex items-center justify-center text-gray-600 text-xs font-bold flex-shrink-0">
                        {s.nom.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-800 truncate flex items-center gap-2">
                          {s.nom}
                          {s.role === 'team_leader' && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 font-medium">Team leader</span>
                          )}
                        </p>
                        <p className="text-xs text-gray-400 truncate">{s.email}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => handleAddMember(s.id)}
                      className="flex-shrink-0 text-xs font-medium text-purple-600 hover:text-purple-800 border border-purple-200 hover:border-purple-400 rounded-lg px-3 py-1 transition-colors"
                    >
                      + Ajouter
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
          {isEncadrant && nonMembers.length === 0 && project.members.length > 0 && (
            <p className="text-center text-sm text-gray-400">
              Tous les membres disponibles sont déjà dans cette équipe.
            </p>
          )}
        </div>
      )}
    </div>

    {/* Modale de confirmation de clôture */}
    {showExportModal && (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
        onClick={() => setShowExportModal(false)}
      >
        <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center gap-3 mb-4">
            <span className="text-3xl">📊</span>
            <h3 className="text-lg font-bold text-gray-900">Exporter en Excel</h3>
          </div>
          <p className="text-sm text-gray-500 mb-4">Un seul fichier Excel, un onglet par section cochée :</p>
          <div className="space-y-2">
            {[
              { key: 'taches', label: 'Tâches', count: tasks.length },
              { key: 'evaluation', label: 'Évaluation (critères + note)', count: evaluations.length },
              { key: 'membres', label: 'Membres de l\'équipe', count: project.members.length },
            ].map((opt) => (
              <label key={opt.key} className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 hover:bg-gray-50 cursor-pointer">
                <input
                  type="checkbox"
                  checked={exportOpts[opt.key]}
                  onChange={(e) => setExportOpts((o) => ({ ...o, [opt.key]: e.target.checked }))}
                  className="w-4 h-4 accent-purple-600"
                />
                <span className="flex-1 text-sm font-medium text-gray-800">{opt.label}</span>
                <span className="text-xs text-gray-400">{opt.count}</span>
              </label>
            ))}
          </div>
          <div className="flex gap-3 mt-5">
            <button
              onClick={handleExport}
              disabled={!exportOpts.taches && !exportOpts.evaluation && !exportOpts.membres}
              className="btn-primary text-sm flex-1 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Télécharger
            </button>
            <button onClick={() => setShowExportModal(false)} className="btn-secondary text-sm">Annuler</button>
          </div>
        </div>
      </div>
    )}

    {showCloseModal && (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
        onClick={() => setShowCloseModal(false)}
      >
        <div
          className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center gap-3 mb-4">
            <span className="text-3xl">🔒</span>
            <h3 className="text-lg font-bold text-gray-900">Clôturer le projet ?</h3>
          </div>
          <p className="text-sm text-gray-600 leading-relaxed">
            Le projet <strong>« {project.titre} »</strong> passera en <strong>lecture seule</strong> :
            plus aucune tâche, livrable, jalon ou évaluation ne pourra être modifié.
            Les membres de l'équipe seront notifiés.
          </p>
          <p className="text-xs text-gray-400 mt-2">
            Vous pourrez rouvrir le projet à tout moment.
          </p>
          <div className="flex justify-end gap-3 mt-6">
            <button
              onClick={() => setShowCloseModal(false)}
              className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            >
              Annuler
            </button>
            <button
              onClick={handleCloseProject}
              className="px-4 py-2 text-sm font-semibold text-white bg-purple-600 hover:bg-purple-700 rounded-lg transition-colors"
            >
              Clôturer le projet
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  );
}

/* Sous-composants */
function TaskCard({ task, projectId, userId, isEncadrant, canChangeStatus = true, onStatusChange, onDelete }) {
  const isLate = task.deadline && isPast(parseISO(task.deadline)) && task.statut !== 'done';
  // isEncadrant reçoit en fait canManageTasks (encadrant OU team_leader)
  const canEdit = isEncadrant;

  return (
    <div className={`card p-4 flex gap-4 hover:shadow-sm transition-shadow ${isLate ? 'border-red-200 bg-red-50/30' : ''}`}>
      {/* Statut : modifiable ou lecture seule (jury / projet clôturé) */}
      <div className="flex-shrink-0 pt-0.5">
        {canChangeStatus ? (
          <select
            value={task.statut}
            onChange={(e) => onStatusChange(task.id, e.target.value)}
            className="text-xs rounded-lg border-gray-200 bg-transparent focus:ring-purple-500 cursor-pointer"
          >
            <option value="todo">À faire</option>
            <option value="in_progress">En cours</option>
            <option value="done">Terminé</option>
          </select>
        ) : (
          <TaskStatusBadge statut={task.statut} />
        )}
      </div>

      {/* Contenu */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <Link
            to={`/projects/${projectId}/tasks/${task.id}`}
            className={`font-semibold hover:text-purple-700 transition-colors leading-tight ${
              task.statut === 'done' ? 'line-through text-gray-400' : 'text-gray-900'
            }`}
          >
            {task.titre}
          </Link>
          <TaskStatusBadge statut={task.statut} />
        </div>

        {task.description && (
          <p className="text-xs text-gray-500 mt-1 line-clamp-1">{task.description}</p>
        )}

        <div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-gray-400">
          {task.assignee_nom && (
            <span className="flex items-center gap-1">
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              {task.assignee_nom}
            </span>
          )}
          {task.deadline && (
            <span className={`flex items-center gap-1 ${isLate ? 'text-red-500 font-semibold' : ''}`}>
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              {isLate && '⚠ '}
              {format(parseISO(task.deadline), 'dd MMM yyyy', { locale: fr })}
            </span>
          )}
        </div>
      </div>

      {/* Actions */}
      {canEdit && (
        <div className="flex flex-col items-end gap-1 flex-shrink-0">
          <Link
            to={`/projects/${projectId}/tasks/${task.id}/edit`}
            className="text-xs text-gray-400 hover:text-gray-700 transition-colors"
          >
            Modifier
          </Link>
          <button
            onClick={() => onDelete(task.id, task.titre)}
            className="text-xs text-gray-300 hover:text-red-500 transition-colors"
          >
            Supprimer
          </button>
          <Link
            to={`/projects/${projectId}/tasks/${task.id}`}
            className="text-xs text-purple-400 hover:text-purple-700 transition-colors mt-1"
          >
            Commentaires →
          </Link>
        </div>
      )}
    </div>
  );
}

function StatBadge({ label, value, color }) {
  const colors = {
    gray:  'text-gray-600 bg-gray-100',
    green: 'text-green-700 bg-green-100',
    blue:  'text-blue-700 bg-blue-100',
    red:   'text-red-700 bg-red-100',
  };
  return (
    <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full ${colors[color]}`}>
      <span className="font-bold">{value}</span>
      <span className="text-xs">{label}</span>
    </div>
  );
}

function InfoRow({ label, value, icon, alert }) {
  return (
    <div className="flex items-center gap-2">
      <span>{icon}</span>
      <div>
        <span className="text-gray-400 text-xs">{label}</span>
        <p className={`font-medium ${alert ? 'text-red-600' : 'text-gray-800'}`}>{value}</p>
      </div>
    </div>
  );
}

function getFileIcon(filename) {
  const ext = filename.split('.').pop()?.toLowerCase();
  const map = {
    pdf:  '📄', doc: '📝', docx: '📝',
    xls:  '📊', xlsx: '📊', csv: '📊',
    ppt:  '📑', pptx: '📑',
    zip:  '🗜️', rar: '🗜️', '7z': '🗜️',
    jpg:  '🖼️', jpeg: '🖼️', png: '🖼️', gif: '🖼️', svg: '🖼️',
    mp4:  '🎬', avi: '🎬', mov: '🎬',
    mp3:  '🎵', wav: '🎵',
    txt:  '📃',
  };
  return map[ext] || '📎';
}
