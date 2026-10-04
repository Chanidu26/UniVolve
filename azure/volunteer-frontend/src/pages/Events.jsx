import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api, { photoUrl } from '../api/client.js';

export default function Events({ user }) {
  const [events, setEvents] = useState([]); const [msg, setMsg] = useState('');
  const [filters, setFilters] = useState({ q: '', location: '', date: '' });
  const load = () => api.get('/events', { params: filters }).then(r => setEvents(r.data));
  useEffect(() => { const timer = setTimeout(load, 150); return () => clearTimeout(timer); }, [filters]);

  const apply = async (roleId) => {
    try { await api.post('/applications', { event_role_id: roleId }); setMsg('Application submitted!'); }
    catch (e) { setMsg(e.response?.data?.error || 'Failed'); }
  };

  const recommended = e => user?.skills?.some(skill =>
    `${e.title} ${e.description || ''}`.toLowerCase().includes(skill.toLowerCase()));

  return (
    <>
      <h2>Volunteering Events</h2>
      <div className="card" style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <input style={{ flex: '2 1 220px', margin: 0 }} placeholder="Search events"
          value={filters.q} onChange={e => setFilters({ ...filters, q: e.target.value })} />
        <input style={{ flex: '1 1 160px', margin: 0 }} placeholder="Location"
          value={filters.location} onChange={e => setFilters({ ...filters, location: e.target.value })} />
        <input style={{ flex: '1 1 150px', margin: 0 }} type="date" value={filters.date}
          onChange={e => setFilters({ ...filters, date: e.target.value })} />
      </div>
      {msg && <p>{msg}</p>}
      {events.length === 0 && <div className="card">No applications or events match your search.</div>}
      {events.map(e => (
        <div key={e.id} className="card">
          <div style={{ display: 'flex', gap: 20 }}>
            {e.image_url && (
              <img src={photoUrl(e.image_url)} alt={e.title}
                style={{ width: 200, height: 150, objectFit: 'cover', borderRadius: 12, flex: 'none' }} />
            )}
            <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                <h3 style={{ margin: 0 }}>{e.title} <span className={`badge ${e.status}`}>{e.status}</span>{recommended(e) && <span className="pill" style={{ marginLeft: 8 }}>Recommended</span>}</h3>
                {user?.id === e.organizer_id && <Link to={`/manage/${e.id}`}><button style={{ flex: 'none' }}>Manage Event</button></Link>}
              </div>
              {e.description && <p style={{ margin: 0, color: '#666', fontSize: 14 }}>{e.description}</p>}
              <p style={{ margin: 0, fontSize: 13.5, color: '#666' }}>
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
                    <td>{r.role_name}{r.description && <div style={{ color: '#666', fontSize: 12.5, marginTop: 2 }}>{r.description}</div>}</td>
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
