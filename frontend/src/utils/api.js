const envBase = import.meta.env.VITE_API_BASE || import.meta.env.VITE_BACKEND_URL || '';
const runtimeDefault =
  typeof window !== 'undefined' && window.location.hostname === 'localhost'
    ? `${window.location.protocol}//localhost:3001`
    : '';
export const API_BASE = envBase || runtimeDefault;

export async function api(path, opts = {}) {
  const token = localStorage.getItem('token');
  const headers = {
    ...(opts.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(opts.headers || {}),
  };
  const res = await fetch(`${API_BASE}${path}`, { ...opts, headers });
  if (!res.ok) throw new Error(await res.text());
  const ct = res.headers.get('content-type') || '';
  return ct.includes('application/json') ? res.json() : res.text();
}
