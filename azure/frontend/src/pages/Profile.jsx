import { useEffect, useState } from 'react';
import api from '../api/client.js';

export default function Profile({ onUpdate }) {
  const [p, setP] = useState(null); const [msg, setMsg] = useState('');
  useEffect(() => { api.get('/auth/me').then(r => setP(r.data)); }, []);
  if (!p) return null;
  const set = (k) => (e) => setP({ ...p, [k]: e.target.value });

  const save = async (e) => {
    e.preventDefault();
    const { data } = await api.put('/auth/me', {
      full_name: p.full_name, bio: p.bio, profile_picture_url: p.profile_picture_url,
      skills: typeof p.skills === 'string' ? p.skills.split(',').map(s => s.trim()).filter(Boolean) : p.skills,
      portfolio_links: typeof p.portfolio_links === 'string' ? p.portfolio_links.split(',').map(s => s.trim()).filter(Boolean) : p.portfolio_links,
    });
    setP(data); onUpdate && onUpdate(data); setMsg('Profile saved');
  };

  return (
    <div className="card" style={{ maxWidth: 560, margin: '24px auto' }}>
      <h2>My Profile</h2>
      {msg && <p style={{ color: 'green' }}>{msg}</p>}
      {p.profile_picture_url && <img src={p.profile_picture_url} alt="" style={{ width: 96, height: 96, borderRadius: '50%', objectFit: 'cover' }} />}
      <form onSubmit={save}>
        <label>Full name</label>
        <input value={p.full_name || ''} onChange={set('full_name')} />
        <label>Bio</label>
        <textarea value={p.bio || ''} onChange={set('bio')} />
        <label>Skills (comma separated)</label>
        <input value={Array.isArray(p.skills) ? p.skills.join(', ') : p.skills || ''} onChange={set('skills')} />
        <label>Portfolio links (comma separated)</label>
        <input value={Array.isArray(p.portfolio_links) ? p.portfolio_links.join(', ') : p.portfolio_links || ''} onChange={set('portfolio_links')} />
        <label>Profile picture URL</label>
        <input value={p.profile_picture_url || ''} onChange={set('profile_picture_url')} />
        <button type="submit">Save</button>
      </form>
    </div>
  );
}
