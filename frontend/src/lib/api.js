import axios from 'axios';

export const API_BASE = process.env.REACT_APP_API_URL || '';

const api = axios.create({
  baseURL: API_BASE ? `${API_BASE}/api` : '/api',
});

// Construit l'URL complète d'un fichier uploadé (ex: /uploads/xxx.pdf)
export function fileUrl(url) {
  if (!url) return '#';
  if (url.startsWith('http')) return url;
  return `${API_BASE}${url}`;
}

// Attache le JWT à chaque requête
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Redirige vers /login si 401
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

// Auth
export const authApi = {
  login:    (data) => api.post('/auth/login', data),
  register: (data) => api.post('/auth/register', data),
  me:       ()     => api.get('/auth/me'),
};

// Programmes (niveau « Projet » parent des équipes)
export const programmesApi = {
  list:       ()         => api.get('/programmes'),
  get:        (id)       => api.get(`/programmes/${id}`),
  create:     (data)     => api.post('/programmes', data),
  update:     (id, data) => api.put(`/programmes/${id}`, data),
  updateEtat: (id, etat) => api.patch(`/programmes/${id}/etat`, { etat }),
  remove:     (id)       => api.delete(`/programmes/${id}`),
};

// Projects (niveau « Équipe »)
export const projectsApi = {
  list:          ()         => api.get('/projects'),
  dashboard:     ()         => api.get('/projects/stats/dashboard'),
  get:           (id)       => api.get(`/projects/${id}`),
  create:        (data)     => api.post('/projects', data),
  update:        (id, data) => api.put(`/projects/${id}`, data),
  updateEtat:    (id, etat) => api.patch(`/projects/${id}/etat`, { etat }),
  remove:        (id)       => api.delete(`/projects/${id}`),
  addMember:     (id, data) => api.post(`/projects/${id}/members`, data),
  removeMember:  (id, uid)  => api.delete(`/projects/${id}/members/${uid}`),
};

// Tasks
export const tasksApi = {
  list:         (pid, params) => api.get(`/projects/${pid}/tasks`, { params }),
  get:          (pid, id)     => api.get(`/projects/${pid}/tasks/${id}`),
  create:       (pid, data)   => api.post(`/projects/${pid}/tasks`, data),
  update:       (pid, id, data) => api.put(`/projects/${pid}/tasks/${id}`, data),
  updateStatus: (pid, id, statut) =>
    api.patch(`/projects/${pid}/tasks/${id}/status`, { statut }),
  remove: (pid, id) => api.delete(`/projects/${pid}/tasks/${id}`),
};

// Deliverables
export const deliverablesApi = {
  list:     (pid)      => api.get(`/projects/${pid}/deliverables`),
  upload:   (pid, fd)  => api.post(`/projects/${pid}/deliverables`, fd, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
  validate: (pid, id, data) => api.patch(`/projects/${pid}/deliverables/${id}/validate`, data),
  remove:   (pid, id)  => api.delete(`/projects/${pid}/deliverables/${id}`),
};

// Comments
export const commentsApi = {
  list:   (tid)      => api.get(`/tasks/${tid}/comments`),
  create: (tid, data) => api.post(`/tasks/${tid}/comments`, data),
  remove: (tid, id)   => api.delete(`/tasks/${tid}/comments/${id}`),
};

// Deliverable Comments
export const deliverableCommentsApi = {
  list:   (did)        => api.get(`/deliverables/${did}/comments`),
  create: (did, data)  => api.post(`/deliverables/${did}/comments`, data),
};

// Feedback encadrant
export const feedbackApi = {
  list:   (pid)        => api.get(`/projects/${pid}/feedback`),
  create: (pid, data)  => api.post(`/projects/${pid}/feedback`, data),
};

// Notifications
export const notificationsApi = {
  list:          ()   => api.get('/notifications'),
  markAsRead:    (id) => api.patch(`/notifications/${id}/lu`),
  markAllAsRead: ()   => api.patch('/notifications/tout-lire'),
};

// Demandes d'aide
export const helpApi = {
  list:    (pid)       => api.get(`/projects/${pid}/help`),
  pending: ()          => api.get('/help/pending'),
  create:  (pid, data) => api.post(`/projects/${pid}/help`, data),
  reply:   (id, data)  => api.patch(`/help/${id}/repondre`, data),
};

// Users
export const usersApi = {
  list:       (params)   => api.get('/users', { params }),
  updateRole: (id, role) => api.patch(`/users/${id}/role`, { role }),
};

// Évaluations
export const evaluationsApi = {
  list:   (pid)        => api.get(`/projects/${pid}/evaluations`),
  create: (pid, data)  => api.post(`/projects/${pid}/evaluations`, data),
  remove: (pid, id)    => api.delete(`/projects/${pid}/evaluations/${id}`),
};

// Milestones (niveau « Projet » / programme communs aux équipes)
export const milestonesApi = {
  list:   (progId)         => api.get(`/programmes/${progId}/milestones`),
  create: (progId, data)   => api.post(`/programmes/${progId}/milestones`, data),
  update: (progId, id, data) => api.put(`/programmes/${progId}/milestones/${id}`, data),
  remove: (progId, id)     => api.delete(`/programmes/${progId}/milestones/${id}`),
};

// Deliverable Templates (niveau « Projet » / programme communs)
export const deliverableTemplatesApi = {
  list:   (progId)         => api.get(`/programmes/${progId}/deliverable-templates`),
  create: (progId, data)   => api.post(`/programmes/${progId}/deliverable-templates`, data),
  update: (progId, id, data) => api.put(`/programmes/${progId}/deliverable-templates/${id}`, data),
  remove: (progId, id)     => api.delete(`/programmes/${progId}/deliverable-templates/${id}`),
};

export default api;
