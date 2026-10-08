import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api, { uploadEventPhoto } from '../api/client.js';

const empty = { title: '', description: '', event_date: '', location: '', status: 'DRAFT' };

export default function CreateEvent() {
  const navigate = useNavigate();
  const [form, setForm] = useState(empty);
  const [photo, setPhoto] = useState(null);
  const set = key => event => setForm({ ...form, [key]: event.target.value });

  const create = async event => {
    event.preventDefault();
    const { data: created } = await api.post('/events', form);
    if (photo) await uploadEventPhoto(created.id, photo);
    navigate('/events');
  };

  return (
    <div style={{ maxWidth: 760, margin: '0 auto' }}>
      <h2 style={{ marginBottom: 16 }}>Create Event</h2>
      <div className="card">
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
          <input type="file" accept="image/*" onChange={event => setPhoto(event.target.files[0])} />
          <button type="submit">Create Event</button>
        </form>
      </div>
    </div>
  );
}