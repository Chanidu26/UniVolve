import { useEffect, useState } from 'react';
import api from '../api/client.js';

export default function VolunteerRequests() {
  const [apps, setApps] = useState([]);
  const load = () => api.get('/applications/mine').then(r => setApps(r.data.filter(a => a.status === 'INVITED')));
  useEffect(() => { load(); }, []);

  const respond = async (appId, response) => {
    try { await api.put(`/applications/${appId}/respond`, { response }); load(); }
    catch (e) { alert(e.response?.data?.error || 'Failed'); }
  };

  return (
    <>
      <h2 style={{ marginBottom: 16 }}>Volunteer Requests</h2>
      {apps.length === 0 && <div className="card"><p style={{ color: 'var(--ink-soft)' }}>No pending invitations.</p></div>}
      {apps.map(a => (
        <div key={a.id} className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
            <div>
              <h3 style={{ marginBottom: 4 }}>{a.role_name} <span className="badge INVITED">INVITED</span></h3>
              <p style={{ color: 'var(--ink-soft)', fontSize: 13 }}>{a.event_title} — 📅 {new Date(a.event_date).toLocaleString()} — 📍 {a.location}</p>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => respond(a.id, 'ACCEPTED')}>Accept</button>
              <button className="danger" onClick={() => respond(a.id, 'DECLINED')}>Decline</button>
            </div>
          </div>
        </div>
      ))}
    </>
  );
}
