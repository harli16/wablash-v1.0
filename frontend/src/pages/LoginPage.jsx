import { useState, useEffect } from 'react';
import { login } from '../api';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    // Debug: tampilkan base URL API yang dipakai
    console.log(
      'API_BASE =',
      process.env.REACT_APP_API_BASE || process.env.REACT_APP_BACKEND_URL
    );
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const { token } = await login(username, password);
      localStorage.setItem('token', token);
      // ✅ Redirect langsung ke halaman QR
      window.location.href = '/qr';
    } catch (err) {
      setError(`Login gagal: ${err.message}`);
    }
  };

  return (
    <div style={{ padding: 20, fontFamily: 'ui-sans-serif, system-ui' }}>
      <h2>Login</h2>
      {error && <p style={{ color: 'red' }}>{error}</p>}
      <form onSubmit={handleLogin}>
        <input
          placeholder="Username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        /><br />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        /><br />
        <button type="submit">Login</button>
      </form>
    </div>
  );
}
