// src/routes/PrivateRoute.jsx
import { useContext, useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { AuthContext } from "../context/AuthContext";

export default function PrivateRoute({ children }) {
  const loc = useLocation();
  const { token: ctxToken } = useContext(AuthContext) || {};
  const [ready, setReady] = useState(false);
  const [hasToken, setHasToken] = useState(!!ctxToken);

  useEffect(() => {
    // sinkronkan dengan localStorage supaya aman saat refresh
    const t = ctxToken || localStorage.getItem("token");
    setHasToken(!!t);
    setReady(true);
  }, [ctxToken]);

  // bisa diganti skeleton/loader kalau mau
  if (!ready) return null;

  if (!hasToken) {
    return <Navigate to="/login" replace state={{ from: loc }} />;
  }
  return children;
}
