import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api, { uploadEventPhoto, photoUrl } from '../api/client.js';
import UserChip from '../components/UserChip.jsx';
import VolunteerPickerModal from '../components/VolunteerPickerModal.jsx';

const empty = { title: '', description: '', event_date: '', location: '', status: 'DRAFT' };

export default function AdminEvents() {
  const [events, setEvents] = useState([]);
  const [form, setForm] = useState(empty);
  const [photo, setPhoto] = useState(null);
  const [pickerEventId, setPickerEventId] = useState(null); // which event the modal is for
  const load = () => api.get('/events').then(r => setEvents(r.data));
  useEffect(() => { load(); }, []);
  const set = k => e => setForm({ ...form, [k]: e.target.value });

  const create = async e => {
    e.preventDefault();
    const { data: created } = await api.post('/events', form);
    if (photo) await uploadEventPhoto(created.id, photo);
    setForm(empty); setPhoto(null); load();
  };
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
          <label>Event Photo</label>
          <input type="file" accept="image/*" onChange={e => setPhoto(e.target.files[0])} />
          <button type="submit">Create Event</button>
        </form>
      </div>

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
