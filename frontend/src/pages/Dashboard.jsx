// src/pages/Dashboard.jsx
import { useEffect, useRef, useState, useMemo } from "react";
import { Send, PieChart, AlertTriangle, Wifi } from "lucide-react";
import {
  waStatus as fetchWaStatus,
  getMessageLogs,
  waQR,
  resetWaSession,
} from "../api";

// Chart
import { Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  LineElement,
  PointElement,
  LinearScale,
  CategoryScale,
  Filler,
  Tooltip,
  Legend,
} from "chart.js";
ChartJS.register(LineElement, PointElement, LinearScale, CategoryScale, Filler, Tooltip, Legend);

// ----------------- Helpers tanggal & UI -----------------
const ID_DAYS = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];

function toLocalDate(v) {
  const d = typeof v === "string" || typeof v === "number" ? new Date(v) : v;
  return isNaN(d) ? null : d;
}
function ymdLocal(d) {
  const x = toLocalDate(d);
  if (!x) return null;
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(
    x.getDate()
  ).padStart(2, "0")}`;
}
function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}
function lastNDays(n) {
  const out = [];
  const today = startOfToday();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    out.push(d);
  }
  return out;
}
function formatID(n) {
  try {
    return Number(n).toLocaleString("id-ID");
  } catch {
    return String(n);
  }
}

// ----------------- UI helpers -----------------
function StatCard({ icon, badge, title, value }) {
  return (
    <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md flex items-center space-x-4">
      <div className={`p-3 rounded-full ${badge}`}>{icon}</div>
      <div>
        <p className="text-gray-500 dark:text-gray-400 text-sm">{title}</p>
        <p className="text-2xl font-bold">{value}</p>
      </div>
    </div>
  );
}

export default function Dashboard() {
  // ----- state utama -----
  const [status, setStatus] = useState(null);
  const [logs, setLogs] = useState([]);
  const [qr, setQr] = useState("");
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [qrLoading, setQrLoading] = useState(false);
  const timerRef = useRef(null);
  const loggingOutRef = useRef(false);

  // ----- derived state -----
  const isConnected =
    status?.connected === true ||
    String(status?.state || "").toUpperCase() === "CONNECTED";

  const isConnecting = ["CONNECTING", "INITIALIZING", "SCAN_QR", "WAITING_QR", "AUTHENTICATED"].includes(
    String(status?.state || "").toUpperCase()
  );

  function statusLabel() {
    if (isConnected) return "Connected";
    if (isConnecting) return "Connecting";
    return status?.state || "Disconnected";
  }
  function badgeClasses() {
    if (isConnected) return "bg-green-600 text-white";
    if (isConnecting) return "bg-yellow-400 text-black";
    return "bg-red-600 text-white";
  }
  function dotClasses() {
    if (isConnected) return "bg-green-300";
    if (isConnecting) return "bg-yellow-200";
    return "bg-red-300";
  }

  // ----- auth helpers -----
  function forceRelogin(msg) {
    if (loggingOutRef.current) return;
    loggingOutRef.current = true;
    try { localStorage.removeItem("token"); } catch {}
    setErr(msg || "Sesi berakhir, silakan login ulang.");
    setTimeout(() => window.location.replace("/login"), 500);
  }
  function isAuthError(e) {
    const m = String(e?.message || "").toLowerCase();
    return m.includes("token") || m.includes("401") || m.includes("unauthorized");
  }

  // ----- data loader -----
  const LOG_LIMIT = 500; // ambil cukup banyak supaya 7 hari kebelakang ke-cover
  async function loadData() {
    if (loggingOutRef.current) return;
    setErr("");
    try {
      const [s, l] = await Promise.all([fetchWaStatus(), getMessageLogs(LOG_LIMIT)]);
      setStatus(s);
      setLogs(Array.isArray(l?.items) ? l.items : []);

      const nowConnected =
        s?.connected === true || String(s?.state || "").toUpperCase() === "CONNECTED";

      if (!nowConnected) {
        setQrLoading(true);
        try {
          const q = await waQR(); // { ok, qr }
          setQr(q?.qr || "");
        } catch (qe) {
          setQr("");
          if (!/404/.test(String(qe?.message))) console.warn("[QR] error:", qe);
        } finally {
          setQrLoading(false);
        }
      } else {
        setQr("");
      }
    } catch (e) {
      if (isAuthError(e)) return forceRelogin("Sesi login berakhir. Silakan login kembali.");
      setErr(e?.message || "Gagal memuat data dashboard");
    }
  }

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      await loadData();
      if (mounted) setLoading(false);
    })();
    timerRef.current = setInterval(loadData, 5000);
    return () => {
      mounted = false;
      if (timerRef.current) clearInterval(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleResetSession() {
    if (!window.confirm("Reset session WA? Akan minta scan QR ulang.")) return;
    setLoading(true);
    setErr("");
    try {
      await resetWaSession();
      await loadData();
    } catch (e) {
      if (isAuthError(e)) return forceRelogin("Sesi login berakhir. Silakan login kembali.");
      setErr(e?.message || "Gagal reset session");
    } finally {
      setLoading(false);
    }
  }

  // ----- agregasi dari logs (hari ini & 7 hari terakhir) -----
  const { sentToday, failedToday, sentThisMonth, chartLabels, chartCounts } = useMemo(() => {
    const todayKey = ymdLocal(startOfToday());
    const days = lastNDays(7);
    const keys = days.map(ymdLocal);
    const counter = Object.fromEntries(keys.map((k) => [k, 0]));

    let _sentToday = 0;
    let _failedToday = 0;
    let _sentThisMonth = 0;

    for (const item of logs) {
      const ts = item?.createdAt || item?.timestamp || item?.time || item?.date;
      const d = toLocalDate(ts);
      if (!d) continue;
      const key = ymdLocal(d);
      const st = String(item?.status || "").toLowerCase();

      if (key === todayKey) {
        if (st === "sent") _sentToday++;
        if (st === "failed") _failedToday++;
      }

      const now = new Date();
      if (d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear() && st === "sent") {
        _sentThisMonth++;
      }

      if (st === "sent" && key in counter) counter[key]++;
    }

    return {
      sentToday: _sentToday,
      failedToday: _failedToday,
      sentThisMonth: _sentThisMonth,
      chartLabels: days.map((d) => ID_DAYS[d.getDay()]),
      chartCounts: keys.map((k) => counter[k]),
    };
  }, [logs]);

  const TOTAL_MONTHLY_QUOTA = 1000; // TODO: ganti dari API profil kalau ada
  const remainingQuota = Math.max(TOTAL_MONTHLY_QUOTA - sentThisMonth, 0);

  const chartData = {
    labels: chartLabels,
    datasets: [
      {
        label: "Pesan Terkirim",
        data: chartCounts,
        borderColor: "rgb(124, 58, 237)",          // ungu
        backgroundColor: "rgba(124, 58, 237, .15)",
        tension: 0.35,
        fill: true,
        pointRadius: 4,
        pointHoverRadius: 5,
      },
    ],
  };

  return (
    <div className="space-y-6">
      {/* Banner disconnected */}
      {!loading && !isConnected && (
        <div className="rounded border border-amber-300 bg-amber-50 px-3 py-2 text-amber-800">
          WhatsApp belum tersambung. Scan QR untuk menghubungkan kembali.
        </div>
      )}

      {err && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded">
          {err}
        </div>
      )}

      {/* 4 kartu header */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          icon={<Send className="w-6 h-6 text-green-600 dark:text-green-400" />}
          badge="bg-green-100 dark:bg-green-900"
          title="Terkirim Hari Ini"
          value={loading ? "…" : formatID(sentToday)}
        />
        <StatCard
          icon={<PieChart className="w-6 h-6 text-blue-600 dark:text-blue-400" />}
          badge="bg-blue-100 dark:bg-blue-900"
          title="Sisa Kuota Bulan Ini"
          value={loading ? "…" : formatID(remainingQuota)}
        />
        <StatCard
          icon={<AlertTriangle className="w-6 h-6 text-red-600 dark:text-red-400" />}
          badge="bg-red-100 dark:bg-red-900"
          title="Pesan Gagal"
          value={loading ? "…" : formatID(failedToday)}
        />

        {/* Kartu koneksi WA */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md">
          <div className="flex items-center space-x-4">
            <div className="p-3 bg-teal-100 dark:bg-teal-900 rounded-full">
              <Wifi className="w-6 h-6 text-teal-600 dark:text-teal-400" />
            </div>
            <div>
              <p className="text-gray-500 dark:text-gray-400 text-sm">Koneksi WA</p>
              <p className={`text-xl font-bold ${isConnected ? "text-green-600 dark:text-green-400" : "text-yellow-600 dark:text-yellow-400"}`}>
                {isConnected ? "Terhubung" : "Nungguin"}
              </p>
            </div>
          </div>

          <div className="mt-3">
            <div className="flex items-center gap-2">
              <span>Status:</span>
              <span className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-semibold ${badgeClasses()}`} aria-label={`WA status ${statusLabel()}`}>
                <span className="relative flex h-2.5 w-2.5">
                  <span className={`absolute inline-flex h-full w-full rounded-full opacity-75 animate-ping ${dotClasses()}`}></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-white/60" />
                </span>
                {statusLabel()}
              </span>
            </div>

            {status?.phone && (
              <div className="mt-1 text-sm text-gray-700 dark:text-gray-300">Nomor: {status.phone}</div>
            )}

            {!isConnected && (
              <div className="mt-3">
                {qrLoading ? (
                  <div className="text-gray-500 text-sm">Menyiapkan QR...</div>
                ) : qr ? (
                  <img src={qr} alt="QR" className="w-40 h-40 object-contain border rounded" />
                ) : (
                  <div className="text-gray-500 text-sm">QR belum tersedia, menunggu...</div>
                )}
              </div>
            )}

            <button onClick={handleResetSession} className="mt-3 px-3 py-1.5 rounded bg-rose-600 text-white hover:bg-rose-700 text-sm">
              Reset Session
            </button>
          </div>
        </div>
      </div>

      {/* Grafik 7 hari terakhir */}
      <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md">
        <h3 className="text-lg font-semibold mb-4">Statistik Pengiriman 7 Hari Terakhir</h3>
        <Line data={chartData} options={{ responsive: true, scales: { y: { beginAtZero: true } } }} />
      </div>
    </div>
  );
}
