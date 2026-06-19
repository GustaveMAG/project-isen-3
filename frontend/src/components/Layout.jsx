import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import NotificationDropdown from './NotificationDropdown';

const NAV = {
  encadrant: [
    { to: '/dashboard',  label: 'Tableau de bord' },
    { to: '/programmes', label: 'Projets' },
  ],
  etudiant: [
    { to: '/programmes', label: 'Mes projets' },
  ],
  team_leader: [
    { to: '/programmes', label: 'Mes projets' },
  ],
  jury: [
    { to: '/programmes', label: 'Projets' },
  ],
};

export default function Layout({ children }) {
  const { user, logout } = useAuth();
  const navigate  = useNavigate();
  const location  = useLocation();

  const handleLogout = () => { logout(); navigate('/login'); };
  const links = NAV[user?.role] || [];

  return (
    <div className="min-h-screen bg-gray-50">

      {/* Navbar */}
      <nav className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between sticky top-0 z-30">
        <div className="flex items-center gap-6">
          <span className="font-bold text-lg" style={{ color: '#3D1A6E' }}>JUNIA</span>
          <div className="flex items-center gap-1">
            {links.map(({ to, label }) => {
              const active = location.pathname === to || (to !== '/dashboard' && location.pathname.startsWith(to));
              return (
                <Link
                  key={to}
                  to={to}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    active
                      ? 'text-white'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                  style={active ? { backgroundColor: '#3D1A6E' } : {}}
                >
                  {label}
                </Link>
              );
            })}
          </div>
        </div>

        <div className="flex items-center gap-3">
          {user?.role === 'encadrant' && (
            <Link
              to="/programmes/new"
              className="text-sm px-3 py-1.5 rounded-lg text-white font-medium"
              style={{ backgroundColor: '#FF6B35' }}
            >
              + Nouveau projet
            </Link>
          )}
          <NotificationDropdown />
          <span className="text-sm text-gray-600">{user?.nom} <span className="font-medium capitalize">{user?.role}</span></span>
          <button
            onClick={handleLogout}
            className="text-sm text-red-500 hover:underline"
          >
            Déconnexion
          </button>
        </div>
      </nav>

      {/* Content */}
      <div className="flex-1">
        {children}
      </div>
    </div>
  );
}
