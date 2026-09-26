import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api, { photoUrl } from '../api/client.js';

export default function Events({ user }) {
  const [events, setEvents] = useState([]); const [msg, setMsg] = useState('');
  const load = () => api.get('/events').then(r => setEvents(r.data));
  useEffect(() => { load(); }, []);

  const apply = async (roleId) => {
    try { await api.post('/applications', { event_role_id: roleId }); setMsg('Application submitted!'); }
    catch (e) { setMsg(e.response?.data?.error || 'Failed'); }
  };

  return (
    <>
      <h2>Volunteering Events</h2>
      {msg && <p>{msg}</p>}
      {events.map(e => (
        <div key={e.id} className="card">
          <div style={{ display: 'flex', gap: 20 }}>
            {e.image_url && (
              <img src={photoUrl(e.image_url)} alt={e.title}
                style={{ width: 200, height: 150, objectFit: 'cover', borderRadius: 12, flex: 'none' }} />
            )}
            <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                <h3 style={{ margin: 0 }}>{e.title} <span className={`badge ${e.status}`}>{e.status}</span></h3>
                {user?.id === e.organizer_id && <Link to={`/manage/${e.id}`}><button style={{ flex: 'none' }}>Manage Event</button></Link>}
              </div>
              {e.description && <p style={{ margin: 0, color: 'var(--ink-soft)', fontSize: 14 }}>{e.description}</p>}
              <p style={{ margin: 0, fontSize: 13.5, color: 'var(--ink-soft)' }}>
                📅 {new Date(e.event_date).toLocaleString()} &nbsp;·&nbsp; 📍 {e.location}
              </p>
              {e.organizer_name && (
                <span className="pill" style={{ alignSelf: 'flex-start' }}>Organizer: {e.organizer_name}</span>
              )}
            </div>
          </div>

          {e.roles.length > 0 && (
            <table style={{ marginTop: 18 }}>
              <thead><tr><th>Role</th><th>Slots</th><th></th></tr></thead>
              <tbody>
                {e.roles.map(r => (
                  <tr key={r.id}>
                    <td>{r.role_name}{r.description && <div style={{ color: 'var(--ink-soft)', fontSize: 12.5, marginTop: 2 }}>{r.description}</div>}</td>
                    <td>{r.filled_slots}/{r.total_slots}</td>
                    <td style={{ textAlign: 'right' }}><button disabled={r.filled_slots >= r.total_slots} onClick={() => apply(r.id)}>
                      {r.filled_slots >= r.total_slots ? 'Full' : 'Apply'}</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      ))}
    </>
  );
}
