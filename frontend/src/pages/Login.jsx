import { useContext, useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { AuthContext } from "../context/AuthContext";
import { login as apiLogin } from "../api";

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, token } = useContext(AuthContext);

  const [username, setUsername] = useState(""); // bisa email/username
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  // === Bonus A: Redirect kalau sudah login ===
  useEffect(() => {
    const t = token || localStorage.getItem("token");
    if (t) {
      const dest = location.state?.from?.pathname || "/dashboard";
      navigate(dest, { replace: true });
    }
  }, [token, navigate, location.state]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErr("");

    if (!username || !password) {
      setErr("Username dan password wajib diisi.");
      return;
    }

    setLoading(true);
    try {
      // Panggil backend (ekspektasi: { token })
      const res = await apiLogin(username, password);

      // Simpan via AuthContext (ini juga set localStorage)
      login({
        token: res.token,
        user: { username }, // kalau backend balikin profil, ganti ke res.user
      });

      // Kalau datang dari ProtectedRoute, override ke halaman asal
      const from = location.state?.from?.pathname;
      if (from) {
        navigate(from, { replace: true });
      }
      // Catatan: AuthContext.login() kamu sudah navigate('/dashboard'),
      // jadi kalau gak ada `from`, kita biarkan navigasi dari context.
    } catch (e) {
      const msg =
        typeof e?.message === "string" && e.message.trim()
          ? e.message
          : "Login gagal. Periksa kredensial atau coba lagi.";
      setErr(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100 px-4">
      <form
        onSubmit={handleSubmit}
        className="bg-white p-6 rounded-xl shadow w-full max-w-sm"
      >
        <h2 className="text-2xl font-bold mb-5 text-center">Login</h2>

        {err ? (
          <div className="mb-4 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {err}
          </div>
        ) : null}

        <label className="block text-sm font-medium mb-1">
          Username / Email
        </label>
        <input
          type="text"
          placeholder="contoh: admin atau user@kampus.ac.id"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className="border rounded w-full px-3 py-2 mb-4 focus:outline-none focus:ring focus:ring-green-200"
          autoFocus
          autoComplete="username"
        />

        <label className="block text-sm font-medium mb-1">Password</label>
        <div className="relative mb-5">
          <input
            type={showPw ? "text" : "password"}
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="border rounded w-full px-3 py-2 pr-10 focus:outline-none focus:ring focus:ring-green-200"
            autoComplete="current-password"
          />
          <button
            type="button"
            onClick={() => setShowPw((s) => !s)}
            className="absolute inset-y-0 right-2 my-auto text-sm text-gray-500 hover:text-gray-700"
            aria-label={showPw ? "Sembunyikan password" : "Tampilkan password"}
          >
            {showPw ? "Hide" : "Show"}
          </button>
        </div>

        <button
          type="submit"
          disabled={loading}
          className={`w-full py-2 rounded text-white ${
            loading
              ? "bg-green-300 cursor-not-allowed"
              : "bg-green-600 hover:bg-green-700"
          } transition`}
        >
          {loading ? "Masuk..." : "Login"}
        </button>
      </form>
    </div>
  );
}
