// src/context/AuthContext.jsx
import { createContext, useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";

export const AuthContext = createContext();

export function AuthProvider({ children }) {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);

  // Pulihkan state dari localStorage
  const restoreFromStorage = useCallback(() => {
    const t = localStorage.getItem("token");
    const u = localStorage.getItem("user");
    setToken(t || null);
    try {
      setUser(u ? JSON.parse(u) : null);
    } catch {
      setUser(null);
    }
  }, []);

  useEffect(() => {
    restoreFromStorage();

    // Sync antar-tab
    const onStorage = (e) => {
      if (e.key === "token" || e.key === "user") {
        restoreFromStorage();
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [restoreFromStorage]);

  const login = ({ token: t, user: u }) => {
    localStorage.setItem("token", t);
    localStorage.setItem("user", JSON.stringify(u || {}));
    setToken(t);
    setUser(u);
    navigate("/dashboard", { replace: true });
  };

  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setToken(null);
    setUser(null);
    navigate("/login", { replace: true });
  };

  return (
    <AuthContext.Provider value={{ user, token, login, logout, restoreFromStorage }}>
      {children}
    </AuthContext.Provider>
  );
}
