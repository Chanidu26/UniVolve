import { Routes, Route, Navigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useMsal, useIsAuthenticated } from '@azure/msal-react';
import AdminEvents from './pages/AdminEvents.jsx';
import ManageEvent from './pages/ManageEvent.jsx';
import ViewProfile from './pages/ViewProfile.jsx';
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
        <h2>🎓 Welcome to UniVolve</h2>
        <p>Admin Portal — manage events, volunteer roles, and applications.</p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginTop: 16 }}>
          <button onClick={login}>Login</button>
          <button className="secondary" onClick={login}>Sign Up</button>
        </div>
      </div>
    </div>
  );

  return (
    <>
      <nav>
        <b>🎓 UniVolve — Admin</b>
        <span style={{ marginLeft: 'auto' }}>{user?.full_name} ({user?.system_role})</span>
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
