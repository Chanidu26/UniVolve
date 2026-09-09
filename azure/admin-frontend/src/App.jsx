import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { GoogleLogin } from '@react-oauth/google';
import AdminEvents from './pages/AdminEvents.jsx';
import ManageEvent from './pages/ManageEvent.jsx';
import ViewProfile from './pages/ViewProfile.jsx';
import api from './api/client.js';

export default function App() {
  const [user, setUser] = useState(null);
  const navigate = useNavigate();
  const token = localStorage.getItem('vms_token');

  useEffect(() => {
    if (token) api.get('/auth/me').then(r => setUser(r.data)).catch(logout);
  }, [token]);

  const logout = () => { localStorage.removeItem('vms_token'); setUser(null); };

  const handleGoogleSuccess = async (credentialResponse) => {
    try {
      const { data } = await api.post('/auth/google', { credential: credentialResponse.credential });
      localStorage.setItem('vms_token', data.token);
      setUser(data.user);
      navigate('/');
    } catch (e) { console.error('Google sign-in failed', e); }
  };

  if (!token) return (
    <div className="hero">
      <span className="logo-pill">🎓 UniVolve</span>
      <h1>Admin Portal</h1>
      <p>Manage campus events, define volunteer roles, and review applications for the Faculty of Engineering.</p>
      <div className="hero-actions">
        <GoogleLogin onSuccess={handleGoogleSuccess} onError={() => console.error('Google sign-in failed')} />
      </div>
    </div>
  );

  return (
    <>
      <nav>
        <b>🎓 UniVolve — Admin</b>
        <span style={{ marginLeft: 'auto', fontSize: 13, fontWeight: 500 }}>{user?.full_name}</span>
        <span className="pill">{user?.system_role}</span>
        <button className="secondary" onClick={logout}>Logout</button>
      </nav>
      <div className="container">
        <Routes>
          <Route path="/" element={<AdminEvents />} />
          <Route path="/manage/:id" element={<ManageEvent />} />
          <Route path="/profile/:userId" element={<ViewProfile />} />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </div>
    </>
  );
}
