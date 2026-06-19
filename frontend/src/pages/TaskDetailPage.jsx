import { useEffect, useState, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { tasksApi, commentsApi } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import TaskStatusBadge from '../components/TaskStatusBadge';
import toast from 'react-hot-toast';
import { format, isPast, parseISO, formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';

export default function TaskDetailPage() {
  const { projectId, id } = useParams();
  const { user }          = useAuth();
  const navigate          = useNavigate();

  const isEncadrant   = user.role === 'encadrant';
  const isTeamLeader  = user.role === 'team_leader';
  const canManageTasks = isEncadrant || isTeamLeader;

  const [task, setTask]             = useState(null);
  const [comments, setComments]     = useState([]);
  const [newComment, setNewComment] = useState('');
  const [loading, setLoading]       = useState(true);
  const [sending, setSending]       = useState(false);
  const bottomRef   = useRef(null);
  const inputRef    = useRef(null);

  /* Chargement */
  useEffect(() => {
    Promise.all([tasksApi.get(projectId, id), commentsApi.list(id)])
      .then(([tRes, cRes]) => {
        setTask(tRes.data);
        setComments(cRes.data);
      })
      .catch(() => {
        toast.error('Tâche introuvable');
        navigate(`/projects/${projectId}`);
      })
      .finally(() => setLoading(false));
  }, [projectId, id, navigate]);

  /* Scroll vers le bas à chaque nouveau commentaire */
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [comments]);

  /* Changement de statut */
  const handleStatusChange = async (statut) => {
    try {
      await tasksApi.updateStatus(projectId, id, statut);
      setTask((t) => ({ ...t, statut }));
      toast.success('Statut mis à jour');
    } catch {
      toast.error('Impossible de mettre à jour');
    }
  };

  /* Envoi d'un commentaire */
  const handleSend = async (e) => {
    e.preventDefault();
    if (!newComment.trim()) return;
    setSending(true);
    try {
      const { data } = await commentsApi.create(id, { contenu: newComment.trim() });
      setComments((prev) => [...prev, data]);
      setNewComment('');
      inputRef.current?.focus();
    } catch {
      toast.error("Impossible d'envoyer le commentaire");
    } finally {
      setSending(false);
    }
  };

  /* Suppression commentaire */
  const handleDeleteComment = async (commentId) => {
    try {
      await commentsApi.remove(id, commentId);
      setComments((prev) => prev.filter((c) => c.id !== commentId));
    } catch {
      toast.error('Impossible de supprimer');
    }
  };

  /* Loader */
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-32 gap-3 text-gray-400">
        <svg className="animate-spin w-8 h-8 text-purple-400" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        <span className="text-sm">Chargement de la tâche…</span>
      </div>
    );
  }
  if (!task) return null;

  const isLate  = task.deadline && isPast(parseISO(task.deadline)) && task.statut !== 'done';
  const isDone  = task.statut === 'done';

  return (
    <div className="max-w-3xl mx-auto space-y-6">

      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-gray-400">
        <Link to="/projects" className="hover:text-purple-600 transition-colors">Projets</Link>
        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
        <Link to={`/projects/${projectId}`} className="hover:text-purple-600 transition-colors">Projet</Link>
        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
        <span className="text-gray-700 font-medium truncate">{task.titre}</span>
      </nav>

      {/* Carte tâche */}
      <div className={`card space-y-5 ${isLate ? 'border-red-200' : ''}`}>
        {/* Bandeau retard */}
        {isLate && (
          <div className="flex items-center gap-2 text-sm font-medium text-red-600 bg-red-50 -mx-6 -mt-6 px-6 py-3 rounded-t-xl border-b border-red-100">
            <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            Cette tâche est en retard deadline dépassée
          </div>
        )}

        {/* Header titre + statut */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <h1 className={`text-xl font-bold flex-1 leading-tight ${isDone ? 'line-through text-gray-400' : 'text-gray-900'}`}>
            {task.titre}
          </h1>
          <div className="flex items-center gap-2 flex-shrink-0">
            <TaskStatusBadge statut={task.statut} />
          </div>
        </div>

        {/* Description */}
        {task.description && (
          <p className="text-gray-600 leading-relaxed whitespace-pre-wrap bg-gray-50 rounded-lg px-4 py-3 text-sm">
            {task.description}
          </p>
        )}

        {/* Méta-données */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-1">
          <MetaCard
            label="Assigné à"
            value={task.assignee_nom || 'Non assigné'}
            icon={
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            }
          />
          <MetaCard
            label="Deadline"
            value={task.deadline
              ? format(parseISO(task.deadline), 'dd MMM yyyy', { locale: fr })
              : ''}
            icon={
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            }
            alert={isLate}
          />
          <MetaCard
            label="Créée le"
            value={format(parseISO(task.created_at), 'dd MMM yyyy', { locale: fr })}
            icon={
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            }
          />
          <MetaCard
            label="Commentaires"
            value={comments.length}
            icon={
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            }
          />
        </div>

        {/* Changer le statut */}
        <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-gray-100">
          <span className="text-sm font-medium text-gray-600">Changer le statut :</span>
          <div className="flex gap-2">
            {[
              { value: 'todo',        label: 'À faire',   color: 'gray' },
              { value: 'in_progress', label: 'En cours',  color: 'blue' },
              { value: 'done',        label: 'Terminé',   color: 'green' },
            ].map(({ value, label, color }) => {
              const colors = {
                gray:  task.statut === value ? 'bg-gray-700 text-white' : 'border-gray-300 text-gray-600 hover:bg-gray-50',
                blue:  task.statut === value ? 'bg-blue-600 text-white' : 'border-blue-200 text-blue-600 hover:bg-blue-50',
                green: task.statut === value ? 'bg-green-600 text-white' : 'border-green-200 text-green-600 hover:bg-green-50',
              };
              return (
                <button
                  key={value}
                  onClick={() => handleStatusChange(value)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${colors[color]}`}
                >
                  {label}
                </button>
              );
            })}
          </div>
          {canManageTasks && (
            <Link
              to={`/projects/${projectId}/tasks/${id}/edit`}
              className="ml-auto btn-secondary text-xs py-1.5"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              Modifier la tâche
            </Link>
          )}
        </div>
      </div>

      {/* Section commentaires */}
      <div className="card space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-gray-800 flex items-center gap-2">
            <svg className="w-5 h-5 text-purple-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            Discussion
            <span className="text-sm font-normal text-gray-400">({comments.length})</span>
          </h2>
        </div>

        {/* Liste des commentaires */}
        <div className={`space-y-1 ${comments.length > 5 ? 'max-h-[420px] overflow-y-auto pr-2' : ''}`}>
          {comments.length === 0 && (
            <div className="text-center py-10 text-gray-400">
              <svg className="w-10 h-10 mx-auto mb-2 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              <p className="text-sm font-medium">Aucun commentaire</p>
              <p className="text-xs mt-1">Soyez le premier à commenter cette tâche</p>
            </div>
          )}

          {comments.map((c, idx) => {
            const isMine   = c.user_id === user.id;
            const prevSame = idx > 0 && comments[idx - 1].user_id === c.user_id;

            return (
              <div
                key={c.id}
                className={`flex gap-3 ${isMine ? 'flex-row-reverse' : ''} ${prevSame ? 'mt-1' : 'mt-4'}`}
              >
                {/* Avatar masqué si même auteur que message précédent */}
                <div className="w-8 flex-shrink-0">
                  {!prevSame && (
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                      isMine
                        ? 'bg-gradient-to-br from-purple-500 to-indigo-600 text-white'
                        : 'bg-gradient-to-br from-gray-300 to-gray-400 text-white'
                    }`}>
                      {c.auteur_nom?.charAt(0).toUpperCase()}
                    </div>
                  )}
                </div>

                {/* Bulle */}
                <div className={`flex flex-col gap-0.5 max-w-[75%] ${isMine ? 'items-end' : 'items-start'}`}>
                  {/* Nom + heure seulement sur le 1er message d'un groupe */}
                  {!prevSame && (
                    <span className="text-xs text-gray-400 px-1">
                      {isMine ? 'Vous' : c.auteur_nom}
                      {' · '}
                      {formatDistanceToNow(parseISO(c.created_at), { addSuffix: true, locale: fr })}
                    </span>
                  )}

                  <div className={`group relative rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                    isMine
                      ? 'bg-purple-700 text-white rounded-tr-sm'
                      : 'bg-gray-100 text-gray-800 rounded-tl-sm'
                  }`}>
                    {c.contenu}

                    {/* Bouton supprimer au survol */}
                    {(isMine || user.role === 'encadrant') && (
                      <button
                        onClick={() => handleDeleteComment(c.id)}
                        className={`absolute -top-2 ${isMine ? '-left-2' : '-right-2'} w-5 h-5 rounded-full bg-red-500 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-sm`}
                        title="Supprimer"
                      >
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    )}
                  </div>

                  {/* Heure exacte au survol */}
                  <span className={`text-xs text-gray-300 px-1 hidden group-hover:block`}>
                    {format(parseISO(c.created_at), "HH:mm", { locale: fr })}
                  </span>
                </div>
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>

        {/* Zone de saisie */}
        <form onSubmit={handleSend} className="flex gap-2 pt-3 border-t border-gray-100">
          {/* Avatar utilisateur */}
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0 self-end mb-1">
            {user.nom?.charAt(0).toUpperCase()}
          </div>

          <div className="flex-1 relative">
            <textarea
              ref={inputRef}
              rows={1}
              className="input resize-none pr-12 py-2.5 leading-relaxed"
              placeholder="Écrire un commentaire… (Entrée pour envoyer)"
              value={newComment}
              onChange={(e) => {
                setNewComment(e.target.value);
                // Auto-resize
                e.target.style.height = 'auto';
                e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend(e);
                }
              }}
              disabled={sending}
            />
            <button
              type="submit"
              disabled={sending || !newComment.trim()}
              className="absolute right-2 bottom-2 w-7 h-7 rounded-lg bg-purple-700 text-white flex items-center justify-center hover:bg-purple-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {sending ? (
                <svg className="animate-spin w-3.5 h-3.5" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              ) : (
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              )}
            </button>
          </div>
        </form>
        <p className="text-xs text-gray-400 text-right -mt-2">
          Maj+Entrée pour sauter une ligne
        </p>
      </div>
    </div>
  );
}

/* Sous-composant MetaCard */
function MetaCard({ label, value, icon, alert }) {
  return (
    <div className={`rounded-xl p-3 ${alert ? 'bg-red-50 border border-red-100' : 'bg-gray-50'}`}>
      <div className={`flex items-center gap-1.5 mb-1 ${alert ? 'text-red-400' : 'text-gray-400'}`}>
        {icon}
        <span className="text-xs font-medium uppercase tracking-wide">{label}</span>
      </div>
      <p className={`text-sm font-semibold ${alert ? 'text-red-600' : 'text-gray-800'}`}>
        {alert && '⚠ '}{value}
      </p>
    </div>
  );
}
