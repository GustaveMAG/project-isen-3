import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Layout from './components/Layout';

import LoginPage        from './pages/LoginPage';
import RegisterPage     from './pages/RegisterPage';
import DashboardPage    from './pages/DashboardPage';
import ProgrammesPage   from './pages/ProgrammesPage';
import ProgrammeDetailPage from './pages/ProgrammeDetailPage';
import ProgrammeFormPage from './pages/ProgrammeFormPage';
import ProjectDetailPage from './pages/ProjectDetailPage';
import ProjectFormPage  from './pages/ProjectFormPage';
import TaskFormPage     from './pages/TaskFormPage';
import TaskDetailPage   from './pages/TaskDetailPage';
import NotificationsPage from './pages/NotificationsPage';

// Guards
function RequireAuth({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="flex h-screen items-center justify-center text-gray-400">Chargement...</div>;
  return user ? children : <Navigate to="/login" replace />;
}

function RequireRole({ role, children }) {
  const { user } = useAuth();
  return user?.role === role ? children : <Navigate to="/programmes" replace />;
}

function RedirectHome() {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user)   return <Navigate to="/login" replace />;
  return <Navigate to={user.role === 'encadrant' ? '/dashboard' : '/programmes'} replace />;
}

// App
export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Toaster position="top-right" toastOptions={{ duration: 3000 }} />
        <Routes>
          {/* Public */}
          <Route path="/login"    element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />

          {/* Protégé */}
          <Route
            path="/*"
            element={
              <RequireAuth>
                <Layout>
                  <Routes>
                    <Route path="/" element={<RedirectHome />} />

                    {/* Tableau de bord encadrant uniquement */}
                    <Route
                      path="/dashboard"
                      element={
                        <RequireRole role="encadrant">
                          <DashboardPage />
                        </RequireRole>
                      }
                    />

                    {/* Notifications */}
                    <Route path="/notifications" element={<NotificationsPage />} />

                    {/* Projets (niveau parent) */}
                    <Route path="/programmes"          element={<ProgrammesPage />} />
                    <Route path="/programmes/new"      element={<RequireRole role="encadrant"><ProgrammeFormPage /></RequireRole>} />
                    <Route path="/programmes/:id"      element={<ProgrammeDetailPage />} />
                    <Route path="/programmes/:id/edit" element={<RequireRole role="encadrant"><ProgrammeFormPage /></RequireRole>} />

                    {/* Équipes (niveau enfant) */}
                    <Route path="/projects"          element={<Navigate to="/programmes" replace />} />
                    <Route path="/projects/:id"      element={<ProjectDetailPage />} />
                    <Route path="/projects/:id/edit" element={<RequireRole role="encadrant"><ProjectFormPage /></RequireRole>} />

                    {/* Tâches */}
                    <Route path="/projects/:projectId/tasks/new"       element={<TaskFormPage />} />
                    <Route path="/projects/:projectId/tasks/:id"       element={<TaskDetailPage />} />
                    <Route path="/projects/:projectId/tasks/:id/edit"  element={<TaskFormPage />} />

                    {/* 404 */}
                    <Route path="*" element={<Navigate to="/" replace />} />
                  </Routes>
                </Layout>
              </RequireAuth>
            }
          />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
