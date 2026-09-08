import { Routes, Route, Navigate, Link, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import Welcome from './pages/Welcome.jsx';
import Login from './pages/Login.jsx';
import AdminEvents from './pages/AdminEvents.jsx';
import ManageEvent from './pages/ManageEvent.jsx';
import ViewProfile from './pages/ViewProfile.jsx';
import Avatar from './components/Avatar.jsx';
import api from './api/client.js';

export default function App() {
  const [user, setUser] = useState(null);
  const navigate = useNavigate();
  const token = localStorage.getItem('vms_token');

  useEffect(() => {
    if (token) api.get('/auth/me').then(r => setUser(r.data)).catch(logout);
  }, [token]);

  const logout = () => { localStorage.removeItem('vms_token'); setUser(null); navigate('/login'); };

  return (
    <>
      <nav>
        <b>🎓 UniVolve — Admin</b>
        {user && <>
          <Link to="/">Events</Link>
          <div className="nav-user">
            <span style={{ fontSize: 13, fontWeight: 500 }}>{user.full_name}</span>
            <span className="pill">{user.system_role}</span>
            <Avatar name={user.full_name} url={user.profile_picture_url} size={34} />
            <button className="secondary" onClick={logout} style={{ padding: '8px 14px', fontSize: 12.5 }}>Logout</button>
          </div>
        </>}
      </nav>
      <div className="container">
        <Routes>
          <Route path="/login" element={<Login onLogin={setUser} />} />
          <Route path="/" element={token ? <AdminEvents /> : <Welcome />} />
          <Route path="/manage/:id" element={<ManageEvent />} />
          <Route path="/profile/:userId" element={<ViewProfile />} />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </div>
    </>
  );
}
