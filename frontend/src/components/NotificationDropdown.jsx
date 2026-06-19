import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { notificationsApi } from '../lib/api';
import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';

export default function NotificationDropdown() {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  const load = async () => {
    try {
      const { data } = await notificationsApi.list();
      setNotifications(data.slice(0, 10)); // 10 dernières
      setUnreadCount(data.filter(n => !n.lu).length);
    } catch (err) {
      console.error('Erreur chargement notifications:', err);
    }
  };

  useEffect(() => {
    load();
    const interval = setInterval(load, 30000); // Refresh toutes les 30s
    return () => clearInterval(interval);
  }, []);

  // Fermer au clic extérieur
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  const handleMarkAsRead = async (notifId) => {
    try {
      await notificationsApi.markAsRead(notifId);
      load();
    } catch (err) {
      console.error('Erreur marquage lu:', err);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await notificationsApi.markAllAsRead();
      load();
    } catch (err) {
      console.error('Erreur:', err);
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

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bouton cloche */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-gray-400 hover:text-purple-600 transition-colors"
      >
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-96 bg-white rounded-lg shadow-xl border border-gray-200 z-50">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
            <h3 className="font-semibold text-gray-900">Notifications</h3>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllAsRead}
                className="text-xs text-purple-600 hover:text-purple-800 font-medium"
              >
                Tout marquer comme lu
              </button>
            )}
          </div>

          {/* Liste notifications */}
          <div className="max-h-96 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="text-center py-8 text-gray-400">
                <p className="text-4xl mb-2">🔔</p>
                <p className="text-sm">Aucune notification</p>
              </div>
            ) : (
              notifications.map((notif) => (
                <Link
                  key={notif.id}
                  to={notif.lien || '#'}
                  onClick={() => {
                    if (!notif.lu) handleMarkAsRead(notif.id);
                    setIsOpen(false);
                  }}
                  className={`block px-4 py-3 border-b border-gray-100 hover:bg-gray-50 transition-colors ${
                    !notif.lu ? 'bg-purple-50' : ''
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <span className="text-2xl flex-shrink-0">{getIcon(notif.type)}</span>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm ${!notif.lu ? 'font-semibold text-gray-900' : 'text-gray-700'}`}>
                        {notif.message}
                      </p>
                      <p className="text-xs text-gray-400 mt-1">
                        {format(parseISO(notif.created_at), "dd MMM 'à' HH:mm", { locale: fr })}
                      </p>
                    </div>
                    {!notif.lu && (
                      <span className="w-2 h-2 bg-purple-600 rounded-full flex-shrink-0 mt-1"></span>
                    )}
                  </div>
                </Link>
              ))
            )}
          </div>

          {/* Footer */}
          {notifications.length > 0 && (
            <div className="px-4 py-3 border-t border-gray-200 bg-gray-50">
              <Link
                to="/notifications"
                onClick={() => setIsOpen(false)}
                className="text-sm text-purple-600 hover:text-purple-800 font-medium"
              >
                Voir toutes les notifications →
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
