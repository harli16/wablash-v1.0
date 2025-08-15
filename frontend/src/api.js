// src/api.js

// ==== Detect API Base URL ====
const envBase =
  process.env.REACT_APP_API_BASE ||
  process.env.REACT_APP_BACKEND_URL ||
  '';

const runtimeDefault = (() => {
  if (typeof window !== 'undefined') {
    // Mode development (localhost FE → localhost:3001 BE)
    if (window.location.hostname === 'localhost') {
      return `${window.location.protocol}//localhost:3001`;
    }
    // Mode production (Docker / domain) → pakai origin FE
    return window.location.origin;
  }
  return '';
})();

const API_BASE = envBase || runtimeDefault;

if (!API_BASE) {
  console.warn('[API] API_BASE is empty. Set REACT_APP_BACKEND_URL or REACT_APP_API_BASE.');
}

// ==== Helper: Auth Header ====
function authHeader() {
  const token = localStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

// ==== Helper: fetch wrapper (optional, dipakai di WA endpoints) ====
async function jsonFetch(url, options = {}) {
  const res = await fetch(url, options);
  // handle 204
  if (res.status === 204) return { ok: true };
  const ct = res.headers.get('content-type') || '';
  const body = ct.includes('application/json') ? await res.json() : await res.text();
  if (!res.ok) {
    const msg = typeof body === 'string' ? body : (body?.message || body?.error || `HTTP ${res.status}`);
    throw new Error(msg);
  }
  return body;
}

// ==== Auth ====
export async function login(username, password) {
  const res = await fetch(`${API_BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password })
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json(); // { token }
}

// ==== WhatsApp Status & QR ====
export async function waStatus() {
  return jsonFetch(`${API_BASE}/api/wa/status`, { headers: authHeader() });
}

export async function waQR() {
  // Endpoint baru: /api/wa/qr
  // - 204 jika sudah connected
  // - 404 jika QR belum tersedia
  // - 200 { ok:true, qr:'data:image/png;base64,...' }
  const res = await fetch(`${API_BASE}/api/wa/qr`, { headers: authHeader() });
  if (res.status === 204) return { ok: true, qr: '' };
  if (!res.ok) {
    // kembalikan objek seragam supaya UI gampang
    let msg;
    try { const j = await res.json(); msg = j?.message || j?.error; } catch { msg = await res.text(); }
    throw new Error(msg || `HTTP ${res.status}`);
  }
  return res.json();
}

// Endpoint reset yang benar: /api/wa/reset
export async function resetWaSession() {
  return jsonFetch(`${API_BASE}/api/wa/reset`, {
    method: 'POST',
    headers: { ...authHeader(), 'Content-Type': 'application/json' }
  });
}

// --- Alias untuk kompatibilitas kode lama (jika masih ada pemanggilan lama) ---
export const resetSession = resetWaSession; // biar import lama tidak error

// ==== Kirim Pesan ====
// ==== Kirim Pesan ====
export async function sendMessage(number, message, name) {
  let res;
  try {
    // kirim 'name' hanya kalau ada string non-kosong
    const body = { number, message };
    if (typeof name === 'string' && name.trim().length) {
      body.name = name.trim();
    }

    res = await fetch(`${API_BASE}/api/message/send`, {
      method: 'POST',
      headers: { ...authHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch (netErr) {
    return { ok: false, code: 'SEND_FAILED', message: netErr?.message || 'Network error' };
  }

  let data;
  try {
    data = await res.json();
  } catch {
    data = { ok: false, code: 'SEND_FAILED', message: 'Tidak bisa parse response' };
  }

  if (!res.ok && typeof data.code === 'undefined') {
    data.ok = false;
    data.code = 'SEND_FAILED';
  }

  return data;
}

// --- tambahkan di src/api.js ---
// --- REPLACE this function in src/api.js ---
export async function getMessageLogsPaged(params = {}) {
  // params: { page, pageSize, start, end, q, status, type }
  const qs = new URLSearchParams();
  if (params.page) qs.set('page', String(params.page));
  if (params.pageSize) qs.set('pageSize', String(params.pageSize));
  if (params.start) qs.set('start', params.start);  // YYYY-MM-DD
  if (params.end) qs.set('end', params.end);        // YYYY-MM-DD
  if (params.q) qs.set('q', params.q);

  // FE status -> BE status
  if (params.status && params.status !== 'all') {
    if (params.status === 'ok') qs.set('status', 'sent');
    else if (params.status === 'fail') qs.set('status', 'failed');
    else qs.set('status', params.status);
  }

  if (params.type && params.type !== 'all') qs.set('type', params.type);

  // ⬇️ pakai API_BASE + authHeader (bukan path relatif)
  const url = `${API_BASE}/api/wa/logs?${qs.toString()}`;
  const resp = await fetch(url, {
    headers: { 'Content-Type': 'application/json', ...authHeader() },
  });

  // guard kalau server balikin HTML (SPA)
  const ct = resp.headers.get('content-type') || '';
  const text = await resp.text();
  if (!ct.includes('application/json')) {
    throw new Error(`Unexpected response (not JSON): ${resp.status} ${text.slice(0, 120)}`);
  }

  const json = JSON.parse(text);
  if (!resp.ok) {
    throw new Error(json?.message || json?.error || `HTTP ${resp.status}`);
  }
  return json; // { ok, page, pageSize, total, totalPages, items: [...] }
}

export async function getMessageLogById(id) {
  const url = `${API_BASE}/api/wa/logs/${encodeURIComponent(id)}`;
  return jsonFetch(url, { headers: authHeader() }); // -> { ok:true, item:{...} }
}

// export async function getMessageLogsPaged(params = {}) {
//   // params: { page, pageSize, start, end, q, status, type }
//   const qs = new URLSearchParams();
//   if (params.page) qs.set('page', String(params.page));
//   if (params.pageSize) qs.set('pageSize', String(params.pageSize));
//   if (params.start) qs.set('start', params.start);        // YYYY-MM-DD
//   if (params.end) qs.set('end', params.end);              // YYYY-MM-DD
//   if (params.q) qs.set('q', params.q);
//   if (params.status && params.status !== 'all') {
//     // FE: ok/fail -> BE: sent/failed ; sisanya pass-through
//     if (params.status === 'ok') qs.set('status', 'sent');
//     else if (params.status === 'fail') qs.set('status', 'failed');
//     else qs.set('status', params.status);
//   }
//   if (params.type && params.type !== 'all') qs.set('type', params.type);

//   const resp = await fetch(`/api/wa/logs?${qs.toString()}`, {
//     headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token') || ''}` }
//   });
//   if (!resp.ok) {
//     const t = await resp.text().catch(()=>'');
//     throw new Error(`Fetch logs gagal (${resp.status}) ${t}`);
//   }
//   return resp.json(); // { ok, page, pageSize, total, totalPages, items: [...] }
// }

// export async function sendMessage(number, message) {
//   let res;
//   try {
//     res = await fetch(`${API_BASE}/api/message/send`, {
//       method: 'POST',
//       headers: { ...authHeader(), 'Content-Type': 'application/json' },
//       body: JSON.stringify({ number, message })
//     });
//   } catch (netErr) {
//     return { ok: false, code: 'SEND_FAILED', message: netErr?.message || 'Network error' };
//   }

//   let data;
//   try {
//     data = await res.json();
//   } catch (_) {
//     data = { ok: false, code: 'SEND_FAILED', message: 'Tidak bisa parse response' };
//   }

//   if (!res.ok && typeof data.code === 'undefined') {
//     data.ok = false;
//     data.code = 'SEND_FAILED';
//   }

//   return data;
// }

// // ==== Logs ====
// export async function getMessageLogs(limit = 100) {
//   const res = await fetch(`${API_BASE}/api/message/logs?limit=${limit}`, { headers: authHeader() });

//   let data;
//   try {
//     data = await res.json();
//   } catch (_) {
//     data = { ok: false, items: [], message: 'Tidak bisa parse response' };
//   }

//   if (!res.ok && typeof data.ok === 'undefined') {
//     data.ok = false;
//   }

//   return data; // { ok, items }
// }

// ==== User Management ====
export async function getUsers() {
  const res = await fetch(`${API_BASE}/api/users`, { headers: authHeader() });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function addUser(username, password, role) {
  const res = await fetch(`${API_BASE}/api/users`, {
    method: 'POST',
    headers: { ...authHeader(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password, role })
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function deleteUser(userId) {
  const res = await fetch(`${API_BASE}/api/users/${userId}`, {
    method: 'DELETE',
    headers: authHeader()
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

// (opsional) kalau butuh debug di komponen
export { API_BASE };

// --- Message Logs (sesuai BE kamu yang balikin array) ---
export async function getMessageLogs() {
  const token =
    (typeof localStorage !== 'undefined' && localStorage.getItem('token')) || '';
  const base =
    process.env.REACT_APP_BACKEND_URL ||
    process.env.REACT_APP_API_BASE ||
    '';

  const url = `${base}/api/message/logs`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });

  // BE kamu mengembalikan array langsung (atau {message: "..."} saat error)
  const data = await res.json().catch(() => []);
  if (!res.ok) {
    const msg = (data && data.message) || `HTTP ${res.status}`;
    throw new Error(msg);
  }
  // normalisasi: pastikan output berupa array
  return Array.isArray(data) ? data : (data.rows || data.logs || []);
}
