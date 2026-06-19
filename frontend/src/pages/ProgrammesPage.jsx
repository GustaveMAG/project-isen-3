import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { programmesApi } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import toast from 'react-hot-toast';
import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';

const ETAT_BADGE = {
  en_cours:  { label: 'En cours',  cls: 'bg-blue-100 text-blue-700' },
  en_retard: { label: 'En retard', cls: 'bg-red-100 text-red-700' },
  termine:   { label: 'Terminé',   cls: 'bg-green-100 text-green-700' },
  cloture:   { label: 'Clôturé',   cls: 'bg-gray-200 text-gray-600' },
};

export default function ProgrammesPage() {
  const { user } = useAuth();
  const [programmes, setProgrammes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');

  useEffect(() => {
    programmesApi.list()
      .then(({ data }) => setProgrammes(data))
      .catch(() => toast.error('Impossible de charger les projets'))
      .finally(() => setLoading(false));
  }, []);

  const filtered = programmes.filter((p) =>
    p.titre.toLowerCase().includes(filter.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-32 gap-3 text-gray-400">
        <svg className="animate-spin w-8 h-8 text-purple-400" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        <span className="text-sm">Chargement des projets…</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Projets</h1>
          <p className="text-gray-500 mt-1">
            {filtered.length} projet{filtered.length !== 1 ? 's' : ''}
            {filter && ` pour « ${filter} »`}
          </p>
        </div>
        {user.role === 'encadrant' && (
          <Link to="/programmes/new" className="btn-primary">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Nouveau projet
          </Link>
        )}
      </div>

      {/* Recherche */}
      <div className="relative flex-1 max-w-sm">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
        <input
          type="text"
          className="input pl-9"
          placeholder="Rechercher un projet…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
      </div>

      {/* Contenu */}
      {filtered.length === 0 ? (
        <div className="card text-center py-20">
          <div className="text-5xl mb-4">{filter ? '🔍' : '📁'}</div>
          <h3 className="text-lg font-semibold text-gray-700">
            {filter ? 'Aucun projet trouvé' : 'Aucun projet pour le moment'}
          </h3>
          <p className="text-gray-400 text-sm mt-1">
            {filter
              ? `Aucun résultat pour « ${filter} »`
              : user.role === 'encadrant'
                ? 'Créez votre premier projet, puis ajoutez-y des équipes.'
                : 'Un encadrant doit vous ajouter à une équipe.'}
          </p>
          {!filter && user.role === 'encadrant' && (
            <Link to="/programmes/new" className="btn-primary mt-4 inline-flex mx-auto">
              Créer un projet
            </Link>
          )}
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtered.map((p) => <ProgrammeCard key={p.id} programme={p} />)}
        </div>
      )}
    </div>
  );
}

/* Carte projet */
function ProgrammeCard({ programme: p }) {
  const badge = ETAT_BADGE[p.etat] || ETAT_BADGE.en_cours;
  const nbEquipes = Number(p.nb_equipes || 0);

  return (
    <Link
      to={`/programmes/${p.id}`}
      className="card hover:shadow-md hover:-translate-y-0.5 transition-all block group relative overflow-hidden"
    >
      {p.etat === 'cloture' && (
        <div className="absolute top-0 left-0 right-0 h-1 bg-gray-400 rounded-t-xl" />
      )}

      <div className="flex items-start justify-between gap-2 mb-3">
        <h3 className="font-semibold text-gray-900 group-hover:text-purple-700 transition-colors line-clamp-2 leading-snug">
          {p.titre}
        </h3>
        <span className={`flex-shrink-0 text-xs px-2 py-0.5 rounded-full font-medium ${badge.cls}`}>
          {badge.label}
        </span>
      </div>

      {p.description && (
        <p className="text-sm text-gray-500 mb-4 line-clamp-2 leading-relaxed">{p.description}</p>
      )}

      <div className="flex items-center gap-2 text-sm text-purple-700 font-medium">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M17 20h5v-2a4 4 0 00-3-3.87M9 20H4v-2a4 4 0 013-3.87m6-1.13a4 4 0 10-4-4 4 4 0 004 4z" />
        </svg>
        {nbEquipes} équipe{nbEquipes !== 1 ? 's' : ''}
      </div>

      <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between text-xs text-gray-400">
        <span className="flex items-center gap-1">
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
          {p.encadrant_nom}
        </span>
        {p.date_fin && (
          <span>{format(parseISO(p.date_fin), 'dd MMM yyyy', { locale: fr })}</span>
        )}
      </div>
    </Link>
  );
}
