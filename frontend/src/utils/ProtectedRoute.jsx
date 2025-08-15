// src/utils/ProtectedRoute.jsx
import { useContext, useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { AuthContext } from "../context/AuthContext";

export default function ProtectedRoute({ children }) {
  const location = useLocation();
  const { token: ctxToken, restoreFromStorage } = useContext(AuthContext) || {};
  const [ready, setReady] = useState(false);
  const [hasToken, setHasToken] = useState(false);

  useEffect(() => {
    // Pastikan AuthContext sinkron sama localStorage
    restoreFromStorage?.();
    const t = ctxToken || localStorage.getItem("token");
    setHasToken(!!t);
    setReady(true);
  }, [ctxToken, restoreFromStorage]);

  // Loader sederhana saat cek token
  if (!ready) {
    return null; // atau bisa diganti loader spinner
  }

  // Kalau belum login → redirect ke /login
  if (!hasToken) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  // Kalau login → render halaman
  return children;
}
