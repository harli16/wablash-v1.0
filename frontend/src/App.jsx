// src/App.js
import { Routes, Route, Navigate } from "react-router-dom";
import jwtDecode from "jwt-decode"; // 🔹 tambah import

// Auth & guard
import { AuthProvider } from "./context/AuthContext";
import ProtectedRoute from "./utils/ProtectedRoute";

// UI (dark mode & role switch)
import UIProvider from "./contexts/UIContext";

// Layout (sidebar + header + <Outlet /> di dalamnya)
import MainLayout from "./layouts/MainLayout";

// Pages user
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import SendMessage from "./pages/SendMessage";
import Logs from "./pages/Logs";
import Templates from "./pages/Templates";
import Profile from "./pages/Profile";
import Help from "./pages/Help";
import MessageLogs from './pages/MessageLogs';
import DashboardAdmin from './pages/admin/DashboardAdmin';

// Admin placeholders (biar ga error kalau route admin dibuka)
function AdminPage({ title }) {
  return (
    <div className="p-6">
      <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md">
        <h2 className="text-xl font-semibold">{title}</h2>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
          Halaman admin belum dibuat. (Nanti kita isi.)
        </p>
      </div>
    </div>
  );
}

// 🔹 Komponen pembungkus untuk proteksi admin
function AdminRoute({ children }) {
  const token = localStorage.getItem("token");
  if (!token) return <Navigate to="/login" />;

  try {
    const decoded = jwtDecode(token);
    if (decoded.role !== "admin") {
      return <Navigate to="/dashboard" />;
    }
    return children;
  } catch (e) {
    return <Navigate to="/login" />;
  }
}

export default function App() {
  return (
    <AuthProvider>
      <UIProvider>
        <Routes>
          {/* Public */}
          <Route path="/login" element={<Login />} />

          {/* Protected root with MainLayout */}
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <MainLayout />
              </ProtectedRoute>
            }
          >
            {/* redirect "/" -> "/dashboard" */}
            <Route index element={<Navigate to="/dashboard" replace />} />

            {/* Menu User */}
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="send" element={<SendMessage />} />
            <Route path="/logs" element={<MessageLogs />} />
            <Route path="logs" element={<Logs />} />
            <Route path="templates" element={<Templates />} />
            <Route path="profile" element={<Profile />} />
            <Route path="help" element={<Help />} />

            {/* Menu Admin (proteksi) */}
            <Route
              path="/admin"
              element={
                <AdminRoute>
                  <DashboardAdmin />
                </AdminRoute>
              }
            />
            <Route
              path="admin/monitoring"
              element={
                <AdminRoute>
                  <AdminPage title="Monitoring Admin" />
                </AdminRoute>
              }
            />
            <Route
              path="admin/users"
              element={
                <AdminRoute>
                  <AdminPage title="Manajemen User" />
                </AdminRoute>
              }
            />
            <Route
              path="admin/templates"
              element={
                <AdminRoute>
                  <AdminPage title="Template Global" />
                </AdminRoute>
              }
            />
            <Route
              path="admin/kontrol"
              element={
                <AdminRoute>
                  <AdminPage title="Kontrol Sistem" />
                </AdminRoute>
              }
            />
          </Route>

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </UIProvider>
    </AuthProvider>
  );
}
