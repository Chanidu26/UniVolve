import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api, { photoUrl } from '../api/client.js';
import UserChip from '../components/UserChip.jsx';
import VolunteerPickerModal from '../components/VolunteerPickerModal.jsx';

export default function AdminEvents() {
  const [events, setEvents] = useState([]);
  const [filters, setFilters] = useState({ q: '', location: '', status: '' });
  const [pickerEventId, setPickerEventId] = useState(null); // which event the modal is for
  const load = () => api.get('/events', { params: filters }).then(r => setEvents(r.data));
  useEffect(() => { load(); }, []);
  useEffect(() => { const timer = setTimeout(load, 250); return () => clearTimeout(timer); }, [filters]);
  const remove = async id => { if (confirm('Delete this event?')) { await api.delete(`/events/${id}`); load(); } };
  const setStatus = async (id, status) => { await api.put(`/events/${id}`, { status }); load(); };

  const assignOrganizer = async (volunteer) => {
    await api.put(`/events/${pickerEventId}`, { organizer_id: volunteer.id });
    setPickerEventId(null);
    load();
  };

  return (
    <>
      {pickerEventId && (
        <VolunteerPickerModal
          onPick={assignOrganizer}
          onClose={() => setPickerEventId(null)}
        />
      )}

      <h2 style={{ marginBottom: 16 }}>Admin — Manage Events</h2>

      <div className="card" style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <input style={{ flex: '2 1 220px', margin: 0 }} placeholder="Search title or description"
          value={filters.q} onChange={e => setFilters({ ...filters, q: e.target.value })} />
        <input style={{ flex: '1 1 160px', margin: 0 }} placeholder="Filter location"
          value={filters.location} onChange={e => setFilters({ ...filters, location: e.target.value })} />
        <select style={{ flex: '1 1 140px', margin: 0 }} value={filters.status}
          onChange={e => setFilters({ ...filters, status: e.target.value })}>
          <option value="">All statuses</option><option value="DRAFT">Draft</option><option value="PUBLISHED">Published</option><option value="CLOSED">Closed</option>
        </select>
      </div>

      {events.length === 0 && <div className="card">No events match your filters.</div>}
      {events.map(e => (
        <div key={e.id} className="card">
          <div style={{ display: 'flex', gap: 20 }}>
            {e.image_url && (
              <img src={photoUrl(e.image_url)} alt={e.title}
                style={{ width: 200, height: 150, objectFit: 'cover', borderRadius: 12, flex: 'none' }} />
            )}
            <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <h3 style={{ margin: 0 }}>{e.title} <span className={`badge ${e.status}`}>{e.status}</span></h3>
              <p style={{ margin: 0, fontSize: 13.5, color: '#666' }}>📅 {new Date(e.event_date).toLocaleString()} &nbsp;·&nbsp; 📍 {e.location}</p>
              {e.organizer_id && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 13, color: '#555' }}>Organizer:</span>
                  <UserChip id={e.organizer_id} name={e.organizer_name} url={e.organizer_picture} size={26} />
                </div>
              )}
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 'auto', paddingTop: 8 }}>
                <button className="secondary" onClick={() => setPickerEventId(e.id)}>
                  {e.organizer_id ? 'Change Organizer' : 'Assign Organizer'}
                </button>
                <button onClick={() => setStatus(e.id, e.status === 'PUBLISHED' ? 'CLOSED' : 'PUBLISHED')}>
                  {e.status === 'PUBLISHED' ? 'Close' : 'Publish'}
                </button>
                <Link to={`/manage/${e.id}`}><button className="ghost">Manage Roles/Apps</button></Link>
                <button className="danger" onClick={() => remove(e.id)}>Delete</button>
              </div>
            </div>
          </div>
        </div>
      ))}
    </>
  );
}
