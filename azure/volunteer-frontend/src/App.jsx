import { Routes, Route, Link, Navigate, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { GoogleLogin } from '@react-oauth/google';
import Events from './pages/Events.jsx';
import MyApplications from './pages/MyApplications.jsx';
import VolunteerRequests from './pages/VolunteerRequests.jsx';
import Profile from './pages/Profile.jsx';
import ViewProfile from './pages/ViewProfile.jsx';
import ManageEvent from './pages/ManageEvent.jsx';
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
      <h1>University Volunteering<br />&amp; Event Management</h1>
      <p>Faculty-wide volunteering platform. Discover campus events, apply for volunteer roles, and build a verifiable portfolio.</p>
      <div className="hero-actions">
        <GoogleLogin onSuccess={handleGoogleSuccess} onError={() => console.error('Google sign-in failed')} />
      </div>
    </div>
  );

  return (
    <>
      <nav>
        <b>🎓 UniVolve</b>
        <Link to="/">Events</Link>
        <Link to="/requests">Volunteer Requests</Link>
        <Link to="/my-applications">My Applications</Link>
        <Link to="/profile">My Profile</Link>
        <span style={{ marginLeft: 'auto', fontSize: 13, fontWeight: 500 }}>{user?.full_name}</span>
        <span className="pill">{user?.system_role}</span>
        <button className="secondary" onClick={logout}>Logout</button>
      </nav>
      <div className="container">
        <Routes>
          <Route path="/" element={<Events user={user} />} />
          <Route path="/requests" element={<VolunteerRequests />} />
          <Route path="/my-applications" element={<MyApplications />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/profile/:userId" element={<ViewProfile />} />
          <Route path="/manage/:id" element={<ManageEvent />} />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </div>
    </>
  );
}
