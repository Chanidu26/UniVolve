import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/client.js';
import UserChip from '../components/UserChip.jsx';
import VolunteerPickerModal from '../components/VolunteerPickerModal.jsx';

const empty = { title: '', description: '', event_date: '', location: '', status: 'DRAFT' };

export default function AdminEvents() {
  const [events, setEvents] = useState([]);
  const [form, setForm] = useState(empty);
  const [pickerEventId, setPickerEventId] = useState(null); // which event the modal is for
  const load = () => api.get('/events').then(r => setEvents(r.data));
  useEffect(() => { load(); }, []);
  const set = k => e => setForm({ ...form, [k]: e.target.value });

  const create = async e => { e.preventDefault(); await api.post('/events', form); setForm(empty); load(); };
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

      <div className="card">
        <h3 style={{ marginBottom: 12 }}>Create Event</h3>
        <form onSubmit={create}>
          <label>Title</label>
          <input placeholder="Event title" value={form.title} onChange={set('title')} required />
          <label>Description</label>
          <textarea placeholder="Description" value={form.description} onChange={set('description')} />
          <label>Date & Time</label>
          <input type="datetime-local" value={form.event_date} onChange={set('event_date')} required />
          <label>Location</label>
          <input placeholder="Location" value={form.location} onChange={set('location')} />
          <button type="submit">Create Event</button>
        </form>
      </div>

      {events.map(e => (
        <div key={e.id} className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8 }}>
            <div>
              <h3 style={{ marginBottom: 4 }}>{e.title} <span className={`badge ${e.status}`}>{e.status}</span></h3>
              <p style={{ color: '#666', fontSize: 13 }}>📅 {new Date(e.event_date).toLocaleString()} — 📍 {e.location}</p>
              {e.organizer_id && (
                <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 13, color: '#555' }}>Organizer:</span>
                  <UserChip id={e.organizer_id} name={e.organizer_name} url={e.organizer_picture} size={26} />
                </div>
              )}
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
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
      ))}
    </>
  );
}
