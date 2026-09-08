import { useEffect, useState } from 'react';
import Avatar from './Avatar.jsx';
import api from '../api/client.js';

export default function VolunteerPickerModal({ onPick, onClose, title = 'Assign Organizer', actionLabel = 'Assign' }) {
  const [volunteers, setVolunteers] = useState([]);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(null);

  useEffect(() => { api.get('/users').then(r => setVolunteers(r.data)); }, []);

  const filtered = volunteers.filter(v =>
    v.full_name.toLowerCase().includes(search.toLowerCase()) ||
    v.email.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{title}</h3>
          <button className="ghost" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <input className="search-box" placeholder="Search by name or email..."
            value={search} onChange={e => setSearch(e.target.value)} autoFocus />
          <div className="volunteer-list">
            {filtered.length === 0 && <p style={{ color: '#999', textAlign: 'center' }}>No volunteers registered yet</p>}
            {filtered.map(v => (
              <div key={v.id} className={`volunteer-item${selected?.id === v.id ? ' selected' : ''}`}
                onClick={() => setSelected(v)}>
                <Avatar name={v.full_name} url={v.profile_picture_url} size={44} />
                <div className="volunteer-info">
                  <div className="name">{v.full_name}</div>
                  <div className="email">{v.email}</div>
                  {v.skills?.length > 0 && <div className="skills">🏷 {v.skills.join(', ')}</div>}
                </div>
                {selected?.id === v.id && <span style={{ color: '#1a1a5e', fontSize: 20 }}>✓</span>}
              </div>
            ))}
          </div>
        </div>
        <div className="modal-footer">
          <button className="ghost" onClick={onClose}>Cancel</button>
          <button disabled={!selected} onClick={() => selected && onPick(selected)}>
            {actionLabel}{selected ? ` ${selected.full_name}` : ''}
          </button>
        </div>
      </div>
    </div>
  );
}
