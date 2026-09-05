import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/client.js';
import { photoUrl } from '../api/client.js';
import UserChip from '../components/UserChip.jsx';
import VolunteerPickerModal from '../components/VolunteerPickerModal.jsx';

const CATEGORIES = ['Community Service', 'Environmental', 'Health', 'Education', 'Other'];

const empty = { title: '', description: '', event_date: '', location: '', status: 'DRAFT', category: '' };

const catClass = (cat) => {
  if (!cat) return '';
  return 'cat-' + cat.toLowerCase().replace(/\s+/g, '-');
};

export default function AdminEvents() {
  const [events, setEvents] = useState([]);
  const [form, setForm] = useState(empty);
  const [pickerEventId, setPickerEventId] = useState(null); // which event the modal is for
  const [bannerFile, setBannerFile] = useState(null);        // file for new event banner
  const [bannerUploading, setBannerUploading] = useState(false);
  const [bannerMsg, setBannerMsg] = useState('');
  const load = () => api.get('/events').then(r => setEvents(r.data));
  useEffect(() => { load(); }, []);
  const set = k => e => setForm({ ...form, [k]: e.target.value });

  const create = async e => {
    e.preventDefault();
    const { data: newEvent } = await api.post('/events', form);
    // If a banner file was selected, upload it immediately after creation
    if (bannerFile) {
      await uploadBannerForEvent(newEvent.id, bannerFile);
    }
    setForm(empty);
    setBannerFile(null);
    load();
  };
  const remove = async id => { if (confirm('Delete this event?')) { await api.delete(`/events/${id}`); load(); } };
  const setStatus = async (id, status) => { await api.put(`/events/${id}`, { status }); load(); };

  const assignOrganizer = async (volunteer) => {
    await api.put(`/events/${pickerEventId}`, { organizer_id: volunteer.id });
    setPickerEventId(null);
    load();
  };

  // Banner upload helper
  const uploadBannerForEvent = async (eventId, file) => {
    setBannerUploading(true);
    setBannerMsg('');
    try {
      const formData = new FormData();
      formData.append('banner', file);
      await api.post(`/events/${eventId}/banner`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setBannerMsg('Banner uploaded!');
      load();
    } catch (err) {
      setBannerMsg(err.response?.data?.error || 'Banner upload failed');
    } finally {
      setBannerUploading(false);
    }
  };

  // Handle banner upload for existing events
  const handleBannerChange = async (eventId, e) => {
    const file = e.target.files[0];
    if (!file) return;
    await uploadBannerForEvent(eventId, file);
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

          {/* ── Category Selector ── */}
          <label>Category</label>
          <select value={form.category} onChange={set('category')}>
            <option value="">— Select category —</option>
            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>

          {/* ── Banner Image Upload ── */}
          <label>Banner Image</label>
          <div className="banner-upload">
            <input
              type="file"
              accept=".jpg,.jpeg,.png,.webp,.gif"
              onChange={e => setBannerFile(e.target.files[0] || null)}
              style={{ margin: 0 }}
            />
            {bannerFile && <span style={{ fontSize: 12, color: '#666' }}>{bannerFile.name}</span>}
          </div>

          <button type="submit">Create Event</button>
        </form>
      </div>

      {bannerMsg && <p className={`msg ${bannerMsg.includes('failed') ? 'err' : 'ok'}`}>{bannerMsg}</p>}

      {events.map(e => {
        const bannerSrc = e.banner_image_url ? photoUrl(e.banner_image_url) : null;
        return (
          <div key={e.id} className="card">
            {bannerSrc && <img className="card-banner" src={bannerSrc} alt={`${e.title} banner`} />}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8 }}>
              <div>
                <h3 style={{ marginBottom: 4 }}>
                  {e.title} <span className={`badge ${e.status}`}>{e.status}</span>
                  {e.category && <span className={`badge category ${catClass(e.category)}`}>{e.category}</span>}
                </h3>
                <p style={{ color: '#666', fontSize: 13 }}>📅 {new Date(e.event_date).toLocaleString()} — 📍 {e.location}</p>
                {e.organizer_id && (
                  <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 13, color: '#555' }}>Organizer:</span>
                    <UserChip id={e.organizer_id} name={e.organizer_name} url={e.organizer_picture} size={26} />
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <label className="ghost" style={{ display: 'inline-flex', alignItems: 'center', cursor: 'pointer' }}>
                  <button type="button" className="ghost" onClick={() => document.getElementById(`banner-${e.id}`).click()} disabled={bannerUploading}>
                    {bannerSrc ? 'Change Banner' : 'Upload Banner'}
                  </button>
                  <input id={`banner-${e.id}`} type="file" accept=".jpg,.jpeg,.png,.webp,.gif"
                    style={{ display: 'none' }} onChange={(ev) => handleBannerChange(e.id, ev)} />
                </label>
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
        );
      })}
    </>
  );
}
