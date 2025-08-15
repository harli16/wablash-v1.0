// src/components/Sidebar.jsx
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard, Send, History, FileText, UserCircle, HelpCircle,
  Moon, Sun
} from 'lucide-react';
import clsx from 'clsx';
import { useUI } from '../contexts/UIContext';

function LinkItem({ to, icon: Icon, label }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        clsx(
          'flex items-center p-3 rounded-lg transition-colors',
          isActive
            ? 'bg-indigo-600 text-white'
            : 'text-gray-600 dark:text-gray-300 hover:bg-indigo-600 hover:text-white'
        )
      }
    >
      <Icon className="w-5 h-5 mr-3" />
      {label}
    </NavLink>
  );
}

export default function Sidebar() {
  const { dark, setDark } = useUI();

  return (
    <aside className="w-64 flex-shrink-0 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col">
      {/* Header logo */}
      <div className="h-16 flex items-center justify-center border-b border-gray-200 dark:border-gray-700">
        {/* <img src="https://i.ibb.co/pWbVv9N/logo-lp3i-tasik.png" alt="Logo LP3I" className="h-10" /> */}
        <span className="ml-2 text-xl font-bold text-indigo-600 dark:text-indigo-400">DyavanMsg V1.0</span>
      </div>

      {/* Menu User ONLY */}
      <nav className="flex-1 overflow-y-auto p-4 space-y-2">
        <h3 className="px-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
          Menu User
        </h3>
        <LinkItem to="/dashboard" icon={LayoutDashboard} label="Dashboard" />
        <LinkItem to="/send" icon={Send} label="Kirim Pesan" />
        <LinkItem to="/logs" icon={History} label="Log Pengiriman" />
        <LinkItem to="/templates" icon={FileText} label="Template Pesan" />
        <LinkItem to="/profile" icon={UserCircle} label="Profil Saya" />
        <LinkItem to="/help" icon={HelpCircle} label="Bantuan" />
      </nav>

      {/* Footer: hanya toggle tema */}
      <div className="p-4 border-t border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <span className="text-sm">Mode Gelap</span>
          <button
            onClick={() => setDark(!dark)}
            className="p-2 rounded-full bg-gray-200 dark:bg-gray-700"
            aria-label="Toggle theme"
          >
            {dark ? <Moon className="w-5 h-5 text-gray-300" /> : <Sun className="w-5 h-5 text-gray-600" />}
          </button>
        </div>
      </div>
    </aside>
  );
}
