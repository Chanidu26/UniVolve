import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/client.js';
import Avatar from '../components/Avatar.jsx';

export default function VolunteerDirectory() {
  const navigate = useNavigate();
  const [volunteers, setVolunteers] = useState([]);
  const [query, setQuery] = useState('');
  const [skill, setSkill] = useState('');

  useEffect(() => { api.get('/users').then(r => setVolunteers(r.data)); }, []);

  const skills = useMemo(() => [...new Set(volunteers.flatMap(v => v.skills || []))].sort(), [volunteers]);
  const filtered = volunteers.filter(v => {
    const text = `${v.full_name} ${v.email}`.toLowerCase();
    return text.includes(query.toLowerCase()) && (!skill || v.skills?.includes(skill));
  });

  return (
    <div>
      <h2 style={{ marginBottom: 16 }}>Find Volunteers</h2>
      <div className="card" style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <input className="search-box" style={{ flex: '2 1 260px', margin: 0 }} placeholder="Search by name or email..." value={query} onChange={e => setQuery(e.target.value)} />
        <select style={{ flex: '1 1 200px', margin: 0 }} value={skill} onChange={e => setSkill(e.target.value)}>
          <option value="">All skills</option>
          {skills.map(item => <option key={item} value={item}>{item}</option>)}
        </select>
      </div>
      {filtered.length === 0 && <div className="card">No volunteers match your search.</div>}
      <div className="volunteer-list">
        {filtered.map(volunteer => <button key={volunteer.id} className="volunteer-item" onClick={() => navigate(`/profile/${volunteer.id}`)} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, textAlign: 'left', color: 'var(--ink)', background: '#fff', border: '1.5px solid var(--line)' }}>
          <Avatar name={volunteer.full_name} url={volunteer.profile_picture_url} size={52} />
          <span className="volunteer-info">
            <span className="name">{volunteer.full_name}</span>
            <span className="email">{volunteer.email}</span>
            {volunteer.skills?.length > 0 && <span className="skills">🏷 {volunteer.skills.join(', ')}</span>}
          </span>
          <span style={{ color: 'var(--brand)', fontWeight: 700 }}>View profile →</span>
        </button>)}
      </div>
    </div>
  );
}