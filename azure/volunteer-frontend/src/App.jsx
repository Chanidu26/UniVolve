import { Routes, Route, Link, Navigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useMsal, useIsAuthenticated } from '@azure/msal-react';
import Events from './pages/Events.jsx';
import MyApplications from './pages/MyApplications.jsx';
import Profile from './pages/Profile.jsx';
import ViewProfile from './pages/ViewProfile.jsx';
import ManageEvent from './pages/ManageEvent.jsx';
import api from './api/client.js';
import { loginRequest } from './auth/msalConfig.js';

export default function App() {
  const { instance } = useMsal();
  const isAuthed = useIsAuthenticated();
  const [user, setUser] = useState(null);

  useEffect(() => {
    if (isAuthed) api.get('/auth/me').then(r => setUser(r.data)).catch(console.error);
  }, [isAuthed]);

  const login = () => instance.loginRedirect(loginRequest);
  const logout = () => instance.logoutRedirect();

  if (!isAuthed) return (
    <div className="container">
      <div className="card" style={{ maxWidth: 420, margin: '80px auto', textAlign: 'center' }}>
        <h2>🎓 University VMS</h2>
        <p>Sign in with your university account.</p>
        <button onClick={login}>Sign in / Register</button>
      </div>
    </div>
  );

  return (
    <>
      <nav>
        <b>🎓 University VMS</b>
        <Link to="/">Events</Link>
        <Link to="/my-applications">My Applications</Link>
        <Link to="/profile">My Profile</Link>
        <span style={{ marginLeft: 'auto' }}>{user?.full_name} ({user?.system_role})</span>
        <button className="secondary" onClick={logout}>Logout</button>
      </nav>
      <div className="container">
        <Routes>
          <Route path="/" element={<Events user={user} />} />
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
