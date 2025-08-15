import React from 'react';
import { useNavigate } from 'react-router-dom';

export default function DashboardAdmin() {
  const navigate = useNavigate();

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Dashboard Admin</h1>
      <p className="mb-4">Selamat datang di halaman admin. Menu khusus admin akan muncul di sini.</p>

      <div className="space-x-4">
        <button
          onClick={() => navigate('/admin/users')}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          Manajemen User
        </button>
        <button
          onClick={() => navigate('/admin/logs')}
          className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
        >
          Log Pengiriman
        </button>
      </div>
    </div>
  );
}
