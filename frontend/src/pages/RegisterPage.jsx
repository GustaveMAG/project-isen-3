import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import toast from 'react-hot-toast';

const ROLES = [
  { value: 'etudiant',     label: 'Étudiant' },
  { value: 'team_leader',  label: 'Team Leader' },
  { value: 'encadrant',    label: 'Encadrant' },
  { value: 'jury',         label: 'Jury' },
];

export default function RegisterPage() {
  const { register } = useAuth();
  const navigate     = useNavigate();
  const [form, setForm]     = useState({ nom: '', email: '', password: '', role: 'etudiant' });
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.password.length < 6) { setError('Mot de passe trop court (6 caractères min)'); return; }
    setError('');
    setLoading(true);
    try {
      const user = await register(form);
      toast.success('Compte créé avec succès !');
      navigate(user.role === 'encadrant' ? '/dashboard' : '/projects');
    } catch (err) {
      setError(err.response?.data?.message || 'Erreur lors de la création du compte');
    } finally {
      setLoading(false);
    }
  };

  const update = (field) => (e) => setForm({ ...form, [field]: e.target.value });

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="bg-white p-8 rounded-xl shadow w-full max-w-md">

        <h1 className="text-2xl font-bold text-center mb-1" style={{ color: '#3D1A6E' }}>JUNIA</h1>
        <p className="text-center text-gray-500 text-sm mb-6">Créer un compte</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-gray-600 mb-1">Nom complet</label>
            <input
              type="text"
              value={form.nom}
              onChange={update('nom')}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-purple-500"
              placeholder="Alice Martin"
              required
              autoFocus
            />
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">Email</label>
            <input
              type="email"
              value={form.email}
              onChange={update('email')}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-purple-500"
              placeholder="alice@junia.com"
              required
            />
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">Mot de passe</label>
            <input
              type="password"
              value={form.password}
              onChange={update('password')}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-purple-500"
              placeholder="Minimum 6 caractères"
              required
            />
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">Rôle</label>
            <select
              value={form.role}
              onChange={update('role')}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-purple-500"
            >
              {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </div>

          {error && <p className="text-red-500 text-sm">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2 rounded-lg text-white text-sm font-semibold"
            style={{ backgroundColor: '#3D1A6E' }}
          >
            {loading ? 'Création...' : 'Créer le compte'}
          </button>
        </form>

        <p className="text-center text-sm text-gray-500 mt-4">
          Déjà un compte ?{' '}
          <Link to="/login" className="font-medium" style={{ color: '#3D1A6E' }}>Se connecter</Link>
        </p>
      </div>
    </div>
  );
}
