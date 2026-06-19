import { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { projectsApi } from '../lib/api';
import toast from 'react-hot-toast';

export default function ProjectFormPage() {
  const { id }    = useParams();
  const navigate  = useNavigate();
  const isEdit    = Boolean(id);

  const [form, setForm] = useState({
    titre: '', description: '', date_debut: '', date_fin: '',
  });
  const [loading, setLoading]     = useState(false);
  const [fetching, setFetching]   = useState(isEdit);

  useEffect(() => {
    if (!isEdit) return;
    projectsApi.get(id)
      .then(({ data }) => setForm({
        titre:       data.titre       || '',
        description: data.description || '',
        date_debut:  data.date_debut  ? data.date_debut.slice(0, 10) : '',
        date_fin:    data.date_fin    ? data.date_fin.slice(0, 10)   : '',
      }))
      .catch(() => toast.error('Projet introuvable'))
      .finally(() => setFetching(false));
  }, [id, isEdit]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (isEdit) {
        await projectsApi.update(id, form);
        toast.success('Projet mis à jour');
        navigate(`/projects/${id}`);
      } else {
        const { data } = await projectsApi.create(form);
        toast.success('Projet créé');
        navigate(`/projects/${data.id}`);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Erreur');
    } finally {
      setLoading(false);
    }
  };

  if (fetching) return <div className="flex justify-center py-20 text-gray-400">Chargement...</div>;

  return (
    <div className="max-w-xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link to="/projects" className="text-gray-400 hover:text-gray-700">← Retour</Link>
        <h1 className="text-2xl font-bold">{isEdit ? 'Modifier le projet' : 'Nouveau projet'}</h1>
      </div>

      <div className="card">
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="label">Titre *</label>
            <input
              type="text"
              className="input"
              value={form.titre}
              onChange={(e) => setForm({ ...form, titre: e.target.value })}
              required
              autoFocus
            />
          </div>

          <div>
            <label className="label">Description</label>
            <textarea
              className="input resize-none"
              rows={4}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Décrivez le projet..."
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Date de début</label>
              <input
                type="date"
                className="input"
                value={form.date_debut}
                onChange={(e) => setForm({ ...form, date_debut: e.target.value })}
              />
            </div>
            <div>
              <label className="label">Date de fin</label>
              <input
                type="date"
                className="input"
                value={form.date_fin}
                onChange={(e) => setForm({ ...form, date_fin: e.target.value })}
              />
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? 'Enregistrement...' : isEdit ? 'Mettre à jour' : 'Créer le projet'}
            </button>
            <Link to={isEdit ? `/projects/${id}` : '/projects'} className="btn-secondary">
              Annuler
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
