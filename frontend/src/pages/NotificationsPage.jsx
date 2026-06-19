import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { notificationsApi } from '../lib/api';
import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import toast from 'react-hot-toast';

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState([]);

  const load = async () => {
    try {
      const { data } = await notificationsApi.list();
      setNotifications(data);
    } catch (err) {
      toast.error('Erreur chargement notifications');
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleMarkAsRead = async (id) => {
    try {
      await notificationsApi.markAsRead(id);
      load();
    } catch (err) {
      toast.error('Erreur');
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await notificationsApi.markAllAsRead();
      toast.success('Toutes les notifications marquées comme lues');
      load();
    } catch (err) {
      toast.error('Erreur');
    }
  };

  const getIcon = (type) => {
    switch (type) {
      case 'tache': return '📋';
      case 'livrable': return '📁';
      case 'evaluation': return '📊';
      case 'aide': return '🆘';
      case 'jalon': return '🎯';
      case 'commentaire': return '💬';
      default: return '🔔';
    }
  };

  const getTypeLabel = (type) => {
    switch (type) {
      case 'tache': return 'Tâche';
      case 'livrable': return 'Livrable';
      case 'evaluation': return 'Évaluation';
      case 'aide': return 'Aide';
      case 'jalon': return 'Jalon';
      case 'commentaire': return 'Commentaire';
      default: return 'Info';
    }
  };

  const unreadCount = notifications.filter(n => !n.lu).length;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Centre de notifications</h1>
        <p className="text-sm text-gray-500 mt-1">
          {unreadCount} non lue{unreadCount !== 1 ? 's' : ''} sur {notifications.length} au total
        </p>
      </div>

      {/* Actions */}
      {unreadCount > 0 && (
        <div className="flex justify-end">
          <button
            onClick={handleMarkAllAsRead}
            className="btn-secondary text-sm"
          >
            Tout marquer comme lu
          </button>
        </div>
      )}

      {/* Liste des notifications */}
      <div className="card p-0 divide-y divide-gray-100">
        {notifications.length === 0 ? (
          <div className="text-center py-14 text-gray-400">
            <p className="text-5xl mb-3">🔔</p>
            <p className="font-medium">Aucune notification</p>
            <p className="text-sm mt-1">Vous êtes à jour !</p>
          </div>
        ) : (
          notifications.map((notif) => (
            <div
              key={notif.id}
              className={`flex items-start gap-4 px-6 py-4 hover:bg-gray-50 transition-colors ${
                !notif.lu ? 'bg-purple-50' : ''
              }`}
            >
              {/* Icône */}
              <div className="text-3xl flex-shrink-0 mt-1">
                {getIcon(notif.type)}
              </div>

              {/* Contenu */}
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
                        {getTypeLabel(notif.type)}
                      </span>
                      {!notif.lu && (
                        <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded font-medium">
                          Nouveau
                        </span>
                      )}
                    </div>
                    <p className={`text-sm ${!notif.lu ? 'font-semibold text-gray-900' : 'text-gray-700'}`}>
                      {notif.message}
                    </p>
                    <p className="text-xs text-gray-400 mt-1">
                      {format(parseISO(notif.created_at), "dd MMMM yyyy 'à' HH:mm", { locale: fr })}
                    </p>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {notif.lien && (
                      <Link
                        to={notif.lien}
                        onClick={() => !notif.lu && handleMarkAsRead(notif.id)}
                        className="text-xs px-3 py-1.5 bg-purple-600 text-white rounded hover:bg-purple-700"
                      >
                        Voir
                      </Link>
                    )}
                    {!notif.lu && (
                      <button
                        onClick={() => handleMarkAsRead(notif.id)}
                        className="text-xs px-3 py-1.5 bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
                      >
                        Marquer lu
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
