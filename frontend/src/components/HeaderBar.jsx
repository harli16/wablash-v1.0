// src/components/HeaderBar.jsx
import { useContext, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Bell, ChevronDown, LogOut, User, HelpCircle } from 'lucide-react';
import { AuthContext } from '../context/AuthContext';

const TITLES = {
  '/dashboard': 'Dashboard',
  '/send': 'Kirim Pesan',
  '/logs': 'Log Pengiriman',
  '/templates': 'Template Pesan',
  '/profile': 'Profil Saya',
  '/help': 'Bantuan',
};

function getInitials(name = '') {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map(p => p[0]?.toUpperCase() || '').join('') || 'SM';
}

export default function HeaderBar() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const auth = useContext(AuthContext);
  const user = auth?.user || { name: 'Staff Marketing', email: 'user@lp3i.ac.id' };

  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const close = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const onLogout = async () => {
    try {
      if (auth?.logout) await auth.logout();
      else localStorage.removeItem('token');
    } finally {
      navigate('/login', { replace: true });
    }
  };

  return (
    <header className="relative z-40 h-16 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between px-6">
      <h1 className="text-2xl font-semibold">{TITLES[pathname] || 'Dashboard'}</h1>

      <div className="flex items-center space-x-4">
        <button className="relative text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200">
          <Bell className="w-6 h-6" />
          <span className="absolute top-0 right-0 h-2 w-2 bg-red-500 rounded-full" />
        </button>

        <div className="relative" ref={ref}>
          <button onClick={() => setOpen(v => !v)} className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full flex items-center justify-center font-semibold text-white" style={{ background: '#6366f1' }}>
              {getInitials(user.name)}
            </div>
            <div className="hidden sm:block text-left">
              <p className="font-semibold text-sm">{user.name}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">{user.email}</p>
            </div>
            <ChevronDown className="w-4 h-4 text-gray-500" />
          </button>

          {open && (
            <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg overflow-hidden">
              <button
                onClick={() => { setOpen(false); navigate('/profile'); }}
                className="w-full px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
              >
                <User className="w-4 h-4" /> Profil Saya
              </button>
              <button
                onClick={() => { setOpen(false); navigate('/help'); }}
                className="w-full px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
              >
                <HelpCircle className="w-4 h-4" /> Bantuan
              </button>
              <div className="h-px bg-gray-200 dark:bg-gray-700" />
              <button
                onClick={onLogout}
                className="w-full px-4 py-2 text-sm text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20 flex items-center gap-2"
              >
                <LogOut className="w-4 h-4" /> Logout
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
