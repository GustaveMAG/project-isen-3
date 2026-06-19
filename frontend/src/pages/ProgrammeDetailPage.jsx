import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  programmesApi, projectsApi, deliverableTemplatesApi, milestonesApi,
} from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import toast from 'react-hot-toast';
import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';

const TABS = [
  { key: 'equipes',   label: 'Équipes',           icon: '👥' },
  { key: 'livrables', label: 'Livrables attendus', icon: '📁' },
  { key: 'jalons',    label: 'Jalons',             icon: '🎯' },
];

const TYPE_LABELS = {
  rapport: 'Rapport', code: 'Code', maquette: 'Maquette',
  presentation: 'Présentation', documentation: 'Documentation', autre: 'Autre',
};
const MS_STATUS = {
  a_venir:  { label: 'À venir',  cls: 'bg-gray-100 text-gray-600' },
  en_cours: { label: 'En cours', cls: 'bg-blue-100 text-blue-700' },
  atteint:  { label: 'Atteint',  cls: 'bg-green-100 text-green-700' },
  manque:   { label: 'Manqué',   cls: 'bg-red-100 text-red-700' },
};

export default function ProgrammeDetailPage() {
  const { id }   = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isEncadrant = user?.role === 'encadrant';

  const [programme, setProgramme] = useState(null);
  const [teams, setTeams]         = useState([]);
  const [templates, setTemplates] = useState([]);
  const [milestones, setMilestones] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [tab, setTab]             = useState('equipes');

  const [showTeamForm, setShowTeamForm]   = useState(false);
  const [teamForm, setTeamForm]           = useState({ titre: '', description: '' });
  const [showTplForm, setShowTplForm]     = useState(false);
  const [tplForm, setTplForm]             = useState({ titre: '', description: '', type: 'rapport', date_limite: '', obligatoire: true });
  const [showMsForm, setShowMsForm]       = useState(false);
  const [msForm, setMsForm]               = useState({ titre: '', description: '', date_echeance: '', statut: 'a_venir' });

  const load = useCallback(async () => {
    try {
      const [pRes, tplRes, msRes] = await Promise.all([
        programmesApi.get(id),
        deliverableTemplatesApi.list(id).catch(() => ({ data: [] })),
        milestonesApi.list(id).catch(() => ({ data: [] })),
      ]);
      setProgramme(pRes.data);
      setTeams(pRes.data.teams || []);
      setTemplates(tplRes.data);
      setMilestones(msRes.data);
    } catch {
      toast.error('Projet introuvable');
      navigate('/programmes');
    } finally {
      setLoading(false);
    }
  }, [id, navigate]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <div className="flex justify-center py-20 text-gray-400">Chargement…</div>;
  if (!programme) return null;

  const isClosed = programme.etat === 'cloture';

  /* Actions Projet */
  const handleDelete = async () => {
    if (!window.confirm(`Supprimer le projet « ${programme.titre} » et toutes ses équipes ? Action irréversible.`)) return;
    try {
      await programmesApi.remove(id);
      toast.success('Projet supprimé');
      navigate('/programmes');
    } catch {
      toast.error('Impossible de supprimer');
    }
  };

  const handleEtat = async (etat) => {
    setProgramme((p) => ({ ...p, etat }));
    try {
      await programmesApi.updateEtat(id, etat);
      toast.success(etat === 'cloture' ? 'Projet clôturé' : 'Projet rouvert');
      load();
    } catch {
      toast.error('Erreur');
      load();
    }
  };

  /* Équipes */
  const handleCreateTeam = async (e) => {
    e.preventDefault();
    if (!teamForm.titre.trim()) return;
    try {
      await projectsApi.create({ ...teamForm, programme_id: Number(id) });
      toast.success('Équipe créée');
      setTeamForm({ titre: '', description: '' });
      setShowTeamForm(false);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Erreur');
    }
  };

  /* Livrables attendus */
  const handleCreateTpl = async (e) => {
    e.preventDefault();
    if (!tplForm.titre.trim()) return;
    try {
      await deliverableTemplatesApi.create(id, tplForm);
      toast.success('Livrable attendu ajouté');
      setTplForm({ titre: '', description: '', type: 'rapport', date_limite: '', obligatoire: true });
      setShowTplForm(false);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Erreur');
    }
  };
  const handleDeleteTpl = async (tplId) => {
    if (!window.confirm('Supprimer ce livrable attendu ?')) return;
    try {
      await deliverableTemplatesApi.remove(id, tplId);
      toast.success('Supprimé');
      load();
    } catch {
      toast.error('Erreur');
    }
  };

  /* Jalons */
  const handleCreateMs = async (e) => {
    e.preventDefault();
    if (!msForm.titre.trim() || !msForm.date_echeance) {
      toast.error('Titre et date d\'échéance requis');
      return;
    }
    try {
      await milestonesApi.create(id, msForm);
      toast.success('Jalon ajouté');
      setMsForm({ titre: '', description: '', date_echeance: '', statut: 'a_venir' });
      setShowMsForm(false);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Erreur');
    }
  };
  const handleUpdateMsStatus = async (m, statut) => {
    try {
      await milestonesApi.update(id, m.id, {
        titre: m.titre, description: m.description || '',
        date_echeance: m.date_echeance.slice(0, 10), statut,
      });
      load();
    } catch {
      toast.error('Erreur');
    }
  };
  const handleDeleteMs = async (msId) => {
    if (!window.confirm('Supprimer ce jalon ?')) return;
    try {
      await milestonesApi.remove(id, msId);
      toast.success('Supprimé');
      load();
    } catch {
      toast.error('Erreur');
    }
  };

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div className="rounded-2xl p-6 relative overflow-hidden" style={{ background: 'linear-gradient(135deg,#3D1A6E,#5b21b6)' }}>
        <nav className="flex items-center gap-2 text-sm text-white/50 mb-4">
          <Link to="/programmes" className="hover:text-white/80">Projets</Link>
          <span>›</span>
          <span className="text-white/80 font-medium truncate">{programme.titre}</span>
        </nav>

        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-2xl font-bold text-white leading-tight">{programme.titre}</h1>
              {isClosed && (
                <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-gray-500 text-white">Clôturé</span>
              )}
            </div>
            {programme.description && (
              <p className="text-white/70 mt-1.5 text-sm leading-relaxed max-w-2xl">{programme.description}</p>
            )}
          </div>
          {isEncadrant && (
            <div className="flex items-center gap-2 flex-shrink-0">
              {!isClosed && (
                <button
                  onClick={() => { setTab('equipes'); setShowTeamForm(true); }}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-white text-sm font-semibold rounded-lg shadow-sm"
                  style={{ backgroundColor: '#FF6B35' }}
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Nouvelle équipe
                </button>
              )}
              {!isClosed && (
                <Link to={`/programmes/${id}/edit`} className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white text-sm font-medium rounded-lg border border-white/20">
                  Modifier
                </Link>
              )}
              <button onClick={handleDelete} className="px-3 py-1.5 bg-red-500/20 hover:bg-red-500/30 text-red-200 text-sm font-medium rounded-lg border border-red-400/20">
                Supprimer
              </button>
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-5 mt-4 text-sm">
          <span className="text-white/70">👨‍🏫 Encadrant : <strong className="text-white">{programme.encadrant_nom}</strong></span>
          <span className="text-white/70">👥 {teams.length} équipe{teams.length !== 1 ? 's' : ''}</span>
          {programme.date_fin && (
            <span className="text-white/70">📅 Échéance : <strong className="text-white">{format(parseISO(programme.date_fin), 'dd MMM yyyy', { locale: fr })}</strong></span>
          )}
        </div>

        {/* Clôture / réouverture */}
        {isEncadrant && (
          <div className="mt-5">
            {isClosed ? (
              <div className="flex flex-wrap items-center justify-between gap-3 bg-white/10 border border-white/20 rounded-xl px-4 py-3">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">🔒</span>
                  <div>
                    <p className="text-white font-semibold text-sm">Projet clôturé lecture seule</p>
                    <p className="text-white/60 text-xs">
                      {programme.date_cloture
                        ? `Clôturé le ${format(parseISO(programme.date_cloture), "dd MMMM yyyy 'à' HH:mm", { locale: fr })}`
                        : 'Toutes les équipes sont verrouillées.'}
                    </p>
                  </div>
                </div>
                <button onClick={() => handleEtat('en_cours')} className="px-4 py-2 bg-white text-gray-900 text-sm font-semibold rounded-lg hover:bg-gray-100">
                  ↻ Rouvrir le projet
                </button>
              </div>
            ) : (
              <button
                onClick={() => window.confirm('Clôturer le projet ? Toutes les équipes passeront en lecture seule et leurs membres seront notifiés.') && handleEtat('cloture')}
                className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white text-sm font-semibold rounded-lg border border-white/20"
              >
                🔒 Clôturer le projet
              </button>
            )}
          </div>
        )}
      </div>

      {/* Onglets */}
      <div className="flex gap-1 border-b border-gray-200">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === t.key ? 'border-purple-600 text-purple-700' : 'border-transparent text-gray-500 hover:text-gray-800'
            }`}
          >
            <span className="mr-1.5">{t.icon}</span>{t.label}
            {t.key === 'equipes'   && teams.length > 0      && <span className="ml-1.5 text-xs text-gray-400">{teams.length}</span>}
            {t.key === 'livrables' && templates.length > 0  && <span className="ml-1.5 text-xs text-gray-400">{templates.length}</span>}
            {t.key === 'jalons'    && milestones.length > 0 && <span className="ml-1.5 text-xs text-gray-400">{milestones.length}</span>}
          </button>
        ))}
      </div>

      {/* Équipes */}
      {tab === 'equipes' && (
        <div className="space-y-4">
          {isEncadrant && !isClosed && (
            <div className="flex justify-end">
              <button onClick={() => setShowTeamForm(!showTeamForm)} className="btn-primary text-sm">
                {showTeamForm ? 'Annuler' : '+ Nouvelle équipe'}
              </button>
            </div>
          )}

          {showTeamForm && (
            <form onSubmit={handleCreateTeam} className="card space-y-3">
              <h3 className="text-sm font-semibold text-gray-700">Nouvelle équipe</h3>
              <input className="input" placeholder="Nom de l'équipe *" value={teamForm.titre}
                onChange={(e) => setTeamForm({ ...teamForm, titre: e.target.value })} autoFocus required />
              <textarea className="input resize-none" rows={2} placeholder="Description (optionnel)" value={teamForm.description}
                onChange={(e) => setTeamForm({ ...teamForm, description: e.target.value })} />
              <div className="flex gap-2">
                <button type="submit" className="btn-primary text-sm">Créer l'équipe</button>
                <button type="button" onClick={() => setShowTeamForm(false)} className="btn-secondary text-sm">Annuler</button>
              </div>
            </form>
          )}

          {teams.length === 0 ? (
            <div className="card text-center py-14 text-gray-400">
              <p className="text-4xl mb-2">👥</p>
              <p className="font-medium">Aucune équipe pour le moment</p>
              {isEncadrant && !isClosed && (
                <>
                  <p className="text-sm mt-1">Créez une première équipe pour ce projet.</p>
                  <button onClick={() => setShowTeamForm(true)} className="btn-primary text-sm mt-4 inline-flex mx-auto">
                    + Créer une équipe
                  </button>
                </>
              )}
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {teams.map((tm) => {
                const nbT = Number(tm.nb_taches || 0);
                const nbD = Number(tm.nb_done || 0);
                const pct = nbT > 0 ? Math.round((nbD / nbT) * 100) : 0;
                return (
                  <Link key={tm.id} to={`/projects/${tm.id}`} className="card hover:shadow-md hover:-translate-y-0.5 transition-all block group">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <h3 className="font-semibold text-gray-900 group-hover:text-purple-700 line-clamp-2">{tm.titre}</h3>
                      {tm.etat === 'cloture' && <span className="text-xs px-2 py-0.5 rounded-full bg-gray-200 text-gray-600">Clôturée</span>}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-gray-500 mb-3">
                      <span>👤 {Number(tm.nb_membres || 0)} membre{Number(tm.nb_membres) !== 1 ? 's' : ''}</span>
                      <span>✓ {nbD}/{nbT} tâches</span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full bg-purple-600 rounded-full transition-all" style={{ width: `${pct}%` }} />
                    </div>
                    <p className="text-right text-xs text-gray-400 mt-1">{pct}%</p>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Livrables attendus */}
      {tab === 'livrables' && (
        <div className="space-y-4">
          {isEncadrant && !isClosed && (
            <div className="flex justify-end">
              <button onClick={() => setShowTplForm(!showTplForm)} className="btn-secondary text-sm">
                {showTplForm ? 'Annuler' : '+ Définir un livrable attendu'}
              </button>
            </div>
          )}

          {showTplForm && (
            <form onSubmit={handleCreateTpl} className="card space-y-3">
              <input className="input" placeholder="Titre du livrable *" value={tplForm.titre}
                onChange={(e) => setTplForm({ ...tplForm, titre: e.target.value })} autoFocus required />
              <textarea className="input resize-none" rows={2} placeholder="Description (optionnel)" value={tplForm.description}
                onChange={(e) => setTplForm({ ...tplForm, description: e.target.value })} />
              <div className="grid grid-cols-2 gap-3">
                <select className="input" value={tplForm.type} onChange={(e) => setTplForm({ ...tplForm, type: e.target.value })}>
                  {Object.entries(TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
                <input type="date" className="input" value={tplForm.date_limite}
                  onChange={(e) => setTplForm({ ...tplForm, date_limite: e.target.value })} />
              </div>
              <label className="flex items-center gap-2 text-sm text-gray-600">
                <input type="checkbox" checked={tplForm.obligatoire}
                  onChange={(e) => setTplForm({ ...tplForm, obligatoire: e.target.checked })} />
                Livrable obligatoire
              </label>
              <button type="submit" className="btn-primary text-sm">Ajouter</button>
            </form>
          )}

          {templates.length === 0 ? (
            <div className="card text-center py-14 text-gray-400">
              <p className="text-4xl mb-2">📁</p>
              <p className="font-medium">Aucun livrable attendu défini</p>
            </div>
          ) : (
            <div className="card p-0 divide-y divide-gray-100">
              {templates.map((t) => (
                <div key={t.id} className="flex items-center gap-4 px-5 py-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-gray-900">{t.titre}</p>
                      <span className="text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-600">{TYPE_LABELS[t.type] || t.type}</span>
                      {t.obligatoire
                        ? <span className="text-xs px-2 py-0.5 rounded bg-red-50 text-red-600">Obligatoire</span>
                        : <span className="text-xs px-2 py-0.5 rounded bg-gray-50 text-gray-400">Optionnel</span>}
                    </div>
                    {t.description && <p className="text-sm text-gray-500 mt-0.5">{t.description}</p>}
                    {t.date_limite && <p className="text-xs text-gray-400 mt-1">📅 {format(parseISO(t.date_limite), 'dd MMM yyyy', { locale: fr })}</p>}
                  </div>
                  {isEncadrant && !isClosed && (
                    <button onClick={() => handleDeleteTpl(t.id)} className="text-gray-300 hover:text-red-500" title="Supprimer">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Jalons */}
      {tab === 'jalons' && (
        <div className="space-y-4">
          {isEncadrant && !isClosed && (
            <div className="flex justify-end">
              <button onClick={() => setShowMsForm(!showMsForm)} className="btn-primary text-sm">
                {showMsForm ? 'Annuler' : '+ Ajouter un jalon'}
              </button>
            </div>
          )}

          {showMsForm && (
            <form onSubmit={handleCreateMs} className="card space-y-3">
              <input className="input" placeholder="Titre du jalon *" value={msForm.titre}
                onChange={(e) => setMsForm({ ...msForm, titre: e.target.value })} autoFocus required />
              <textarea className="input resize-none" rows={2} placeholder="Description (optionnel)" value={msForm.description}
                onChange={(e) => setMsForm({ ...msForm, description: e.target.value })} />
              <div className="grid grid-cols-2 gap-3">
                <input type="date" className="input" value={msForm.date_echeance}
                  onChange={(e) => setMsForm({ ...msForm, date_echeance: e.target.value })} required />
                <select className="input" value={msForm.statut} onChange={(e) => setMsForm({ ...msForm, statut: e.target.value })}>
                  {Object.entries(MS_STATUS).map(([v, s]) => <option key={v} value={v}>{s.label}</option>)}
                </select>
              </div>
              <button type="submit" className="btn-primary text-sm">Créer le jalon</button>
            </form>
          )}

          {milestones.length === 0 ? (
            <div className="card text-center py-14 text-gray-400">
              <p className="text-4xl mb-2">🎯</p>
              <p className="font-medium">Aucun jalon défini</p>
            </div>
          ) : (
            <div className="card p-0 divide-y divide-gray-100">
              {milestones.map((m) => {
                const st = MS_STATUS[m.statut] || MS_STATUS.a_venir;
                return (
                  <div key={m.id} className="flex items-center gap-4 px-5 py-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-gray-900">{m.titre}</p>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${st.cls}`}>{st.label}</span>
                      </div>
                      {m.description && <p className="text-sm text-gray-500 mt-0.5">{m.description}</p>}
                      <p className="text-xs text-gray-400 mt-1">📅 {format(parseISO(m.date_echeance), 'dd MMM yyyy', { locale: fr })}</p>
                    </div>
                    {isEncadrant && !isClosed && (
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <select value={m.statut} onChange={(e) => handleUpdateMsStatus(m, e.target.value)}
                          className="text-xs rounded-lg border-gray-200 cursor-pointer">
                          {Object.entries(MS_STATUS).map(([v, s]) => <option key={v} value={v}>{s.label}</option>)}
                        </select>
                        <button onClick={() => handleDeleteMs(m.id)} className="text-gray-300 hover:text-red-500" title="Supprimer">
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
