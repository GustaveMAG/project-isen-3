import { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { tasksApi, projectsApi } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import toast from 'react-hot-toast';
import { format } from 'date-fns';

const STATUS_OPTIONS = [
  { value: 'todo',        label: 'À faire',   color: 'bg-gray-100 text-gray-700',   dot: 'bg-gray-400' },
  { value: 'in_progress', label: 'En cours',  color: 'bg-blue-50 text-blue-700',    dot: 'bg-blue-500' },
  { value: 'done',        label: 'Terminé',   color: 'bg-green-50 text-green-700',  dot: 'bg-green-500' },
];

const PRIORITE_OPTIONS = [
  { value: 'basse',   label: 'Basse',   color: 'bg-gray-100 text-gray-600',   border: 'border-gray-300' },
  { value: 'normale', label: 'Normale', color: 'bg-blue-50 text-blue-700',    border: 'border-blue-300' },
  { value: 'haute',   label: 'Haute',   color: 'bg-orange-50 text-orange-700', border: 'border-orange-400' },
  { value: 'urgente', label: 'Urgente', color: 'bg-red-50 text-red-700',      border: 'border-red-400' },
];

export default function TaskFormPage() {
  const { projectId, id } = useParams();
  const navigate          = useNavigate();
  const { user }          = useAuth();
  const isEdit            = Boolean(id);

  const [form, setForm] = useState({
    titre: '', description: '', statut: 'todo', priorite: 'normale', assigne_a: '', deadline: '',
  });
  const [members, setMembers]   = useState([]);
  const [project, setProject]   = useState(null);
  const [loading, setLoading]   = useState(false);
  const [fetching, setFetching] = useState(true);
  const [errors, setErrors]     = useState({});

  /* Chargement initial */
  useEffect(() => {
    const init = async () => {
      try {
        const { data: proj } = await projectsApi.get(projectId);
        setProject(proj);
        setMembers(proj.members || []);

        if (isEdit) {
          const { data: task } = await tasksApi.get(projectId, id);
          setForm({
            titre:       task.titre       || '',
            description: task.description || '',
            statut:      task.statut      || 'todo',
            priorite:    task.priorite    || 'normale',
            assigne_a:   task.assigne_a   ? String(task.assigne_a) : '',
            deadline:    task.deadline    ? task.deadline.slice(0, 10) : '',
          });
        }
      } catch {
        toast.error('Impossible de charger les données');
        navigate(`/projects/${projectId}`);
      } finally {
        setFetching(false);
      }
    };
    init();
  }, [projectId, id, isEdit, navigate]);

  /* Validation */
  const validate = () => {
    const e = {};
    if (!form.titre.trim()) e.titre = 'Le titre est requis';
    if (form.deadline && isNaN(Date.parse(form.deadline))) e.deadline = 'Date invalide';
    return e;
  };

  /* Soumission */
  const handleSubmit = async (e) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setErrors({});
    setLoading(true);

    const payload = {
      ...form,
      assigne_a: form.assigne_a || null,
      deadline:  form.deadline  || null,
    };

    try {
      if (isEdit) {
        await tasksApi.update(projectId, id, payload);
        toast.success('Tâche mise à jour');
      } else {
        await tasksApi.create(projectId, payload);
        toast.success('Tâche créée avec succès');
      }
      navigate(`/projects/${projectId}`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Une erreur est survenue');
    } finally {
      setLoading(false);
    }
  };

  const setField = (key, value) => {
    setForm((f) => ({ ...f, [key]: value }));
    if (errors[key]) setErrors((e) => { const n = { ...e }; delete n[key]; return n; });
  };

  /* Loader */
  if (fetching) {
    return (
      <div className="flex flex-col items-center justify-center py-32 gap-3 text-gray-400">
        <svg className="animate-spin w-8 h-8 text-purple-400" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        <span className="text-sm">Chargement…</span>
      </div>
    );
  }

  const today = format(new Date(), 'yyyy-MM-dd');

  return (
    <div className="max-w-2xl mx-auto space-y-6">

      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-gray-400">
        <Link to="/projects" className="hover:text-purple-600 transition-colors">Projets</Link>
        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
        <Link to={`/projects/${projectId}`} className="hover:text-purple-600 transition-colors truncate max-w-[160px]">
          {project?.titre || 'Projet'}
        </Link>
        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
        <span className="text-gray-700 font-medium">
          {isEdit ? 'Modifier la tâche' : 'Nouvelle tâche'}
        </span>
      </nav>

      {/* En-tête */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center flex-shrink-0">
          <svg className="w-5 h-5 text-purple-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
          </svg>
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900">
            {isEdit ? 'Modifier la tâche' : 'Nouvelle tâche'}
          </h1>
          <p className="text-sm text-gray-500">
            Projet : <span className="font-medium text-gray-700">{project?.titre}</span>
          </p>
        </div>
      </div>

      {/* Formulaire */}
      <form onSubmit={handleSubmit} className="space-y-5">

        {/* Titre */}
        <div className="card space-y-5">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
            Informations générales
          </h2>

          <div>
            <label className="label">
              Titre <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              className={`input ${errors.titre ? 'border-red-400 focus:ring-red-400' : ''}`}
              placeholder="Ex : Réaliser la maquette Figma"
              value={form.titre}
              onChange={(e) => setField('titre', e.target.value)}
              autoFocus
            />
            {errors.titre && (
              <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                {errors.titre}
              </p>
            )}
          </div>

          <div>
            <label className="label">Description</label>
            <textarea
              className="input resize-none leading-relaxed"
              rows={4}
              placeholder="Décrivez le travail attendu, les critères d'acceptation…"
              value={form.description}
              onChange={(e) => setField('description', e.target.value)}
            />
            <p className="text-xs text-gray-400 mt-1 text-right">
              {form.description.length} caractère{form.description.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>

        {/* Statut + Deadline */}
        <div className="card space-y-5">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
            Planification
          </h2>

          {/* Statut sélection visuelle */}
          <div>
            <label className="label">Statut</label>
            <div className="grid grid-cols-3 gap-3">
              {STATUS_OPTIONS.map(({ value, label, color, dot }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setField('statut', value)}
                  className={`relative flex items-center gap-2.5 rounded-xl border-2 px-3 py-2.5 text-sm font-medium transition-all ${
                    form.statut === value
                      ? `border-current ${color}`
                      : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300'
                  }`}
                >
                  <span className={`w-2 h-2 rounded-full flex-shrink-0 ${form.statut === value ? dot : 'bg-gray-300'}`} />
                  {label}
                  {form.statut === value && (
                    <svg className="w-3.5 h-3.5 ml-auto" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Priorité sélection visuelle */}
          <div>
            <label className="label">Priorité</label>
            <div className="grid grid-cols-4 gap-3">
              {PRIORITE_OPTIONS.map(({ value, label, color, border }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setField('priorite', value)}
                  className={`relative flex items-center justify-center gap-2 rounded-xl border-2 px-2 py-2.5 text-sm font-medium transition-all ${
                    form.priorite === value
                      ? `${border} ${color}`
                      : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300'
                  }`}
                >
                  {label}
                  {form.priorite === value && (
                    <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Deadline */}
          <div>
            <label className="label">
              Deadline
              {form.deadline && new Date(form.deadline) < new Date(today) && (
                <span className="ml-2 text-xs font-normal text-red-500">⚠ Date dans le passé</span>
              )}
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <input
                type="date"
                className={`input pl-10 ${errors.deadline ? 'border-red-400' : ''}`}
                value={form.deadline}
                onChange={(e) => setField('deadline', e.target.value)}
              />
            </div>
            {errors.deadline && <p className="text-xs text-red-500 mt-1">{errors.deadline}</p>}
            {form.deadline && (
              <button
                type="button"
                onClick={() => setField('deadline', '')}
                className="text-xs text-gray-400 hover:text-red-500 mt-1 transition-colors"
              >
                × Supprimer la deadline
              </button>
            )}
          </div>
        </div>

        {/* Assignation */}
        <div className="card space-y-4">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
            Responsable
          </h2>

          {members.length === 0 ? (
            <p className="text-sm text-gray-400 bg-gray-50 rounded-lg px-4 py-3">
              Aucun membre dans ce projet. Ajoutez des étudiants depuis la page projet.
            </p>
          ) : (
            <div className="space-y-2">
              {/* Option "Non assigné" */}
              <label className={`flex items-center gap-3 rounded-xl border-2 px-4 py-3 cursor-pointer transition-all ${
                !form.assigne_a
                  ? 'border-purple-300 bg-purple-50'
                  : 'border-gray-200 bg-white hover:border-gray-300'
              }`}>
                <input
                  type="radio"
                  name="assignee"
                  value=""
                  checked={!form.assigne_a}
                  onChange={() => setField('assigne_a', '')}
                  className="text-purple-600 focus:ring-purple-500"
                />
                <div className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
                  <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
                <span className={`text-sm font-medium ${!form.assigne_a ? 'text-purple-700' : 'text-gray-500'}`}>
                  Non assigné
                </span>
              </label>

              {/* Membres */}
              {members.map((m) => (
                <label
                  key={m.id}
                  className={`flex items-center gap-3 rounded-xl border-2 px-4 py-3 cursor-pointer transition-all ${
                    form.assigne_a === String(m.id)
                      ? 'border-purple-300 bg-purple-50'
                      : 'border-gray-200 bg-white hover:border-gray-300'
                  }`}
                >
                  <input
                    type="radio"
                    name="assignee"
                    value={m.id}
                    checked={form.assigne_a === String(m.id)}
                    onChange={() => setField('assigne_a', String(m.id))}
                    className="text-purple-600 focus:ring-purple-500"
                  />
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0 ${
                    form.assigne_a === String(m.id)
                      ? 'bg-gradient-to-br from-purple-500 to-indigo-600'
                      : 'bg-gradient-to-br from-gray-300 to-gray-400'
                  }`}>
                    {m.nom.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium truncate ${
                      form.assigne_a === String(m.id) ? 'text-purple-700' : 'text-gray-700'
                    }`}>
                      {m.nom}
                    </p>
                    <p className="text-xs text-gray-400 truncate">{m.email}</p>
                  </div>
                </label>
              ))}
            </div>
          )}
        </div>

        {/* Boutons d'action */}
        <div className="flex items-center gap-3 pb-4">
          <button
            type="submit"
            disabled={loading}
            className="btn-primary flex-1 sm:flex-none justify-center sm:min-w-[180px]"
          >
            {loading ? (
              <>
                <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Enregistrement…
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M5 13l4 4L19 7" />
                </svg>
                {isEdit ? 'Mettre à jour' : 'Créer la tâche'}
              </>
            )}
          </button>

          <Link
            to={`/projects/${projectId}`}
            className="btn-secondary flex-1 sm:flex-none justify-center"
          >
            Annuler
          </Link>

          {/* Bouton supprimer en mode édition */}
          {isEdit && user.role === 'encadrant' && (
            <button
              type="button"
              onClick={async () => {
                if (!window.confirm('Supprimer cette tâche ?')) return;
                try {
                  await tasksApi.remove(projectId, id);
                  toast.success('Tâche supprimée');
                  navigate(`/projects/${projectId}`);
                } catch {
                  toast.error('Impossible de supprimer');
                }
              }}
              className="btn-danger ml-auto"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              Supprimer
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
