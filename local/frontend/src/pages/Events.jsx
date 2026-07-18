import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/client.js';

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
          <h3>{e.title} <small>({e.status})</small></h3>
          <p>{e.description}</p>
          <p>📅 {new Date(e.event_date).toLocaleString()} — 📍 {e.location}</p>
          {e.organizer_name && <p>Organizer: {e.organizer_name}</p>}
          {user?.id === e.organizer_id && <Link to={`/manage/${e.id}`}><button>Manage Event</button></Link>}
          <table>
            <thead><tr><th>Role</th><th>Slots</th><th></th></tr></thead>
            <tbody>
              {e.roles.map(r => (
                <tr key={r.id}>
                  <td>{r.role_name}{r.description && <div><small>{r.description}</small></div>}</td>
                  <td>{r.filled_slots}/{r.total_slots}</td>
                  <td><button disabled={r.filled_slots >= r.total_slots} onClick={() => apply(r.id)}>
                    {r.filled_slots >= r.total_slots ? 'Full' : 'Apply'}</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </>
  );
}
