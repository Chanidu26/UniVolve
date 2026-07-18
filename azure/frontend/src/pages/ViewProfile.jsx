import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Avatar from '../components/Avatar.jsx';
import api from '../api/client.js';

export default function ViewProfile() {
  const { userId } = useParams();
  const navigate = useNavigate();
  const [p, setP] = useState(null);

  useEffect(() => { api.get(`/users/${userId}`).then(r => setP(r.data)).catch(() => navigate('/')); }, [userId]);
  if (!p) return <div className="container"><p>Loading...</p></div>;

  return (
    <div style={{ maxWidth: 600, margin: '0 auto' }}>
      <div className="card">
        <div className="profile-header">
          <Avatar name={p.full_name} url={p.profile_picture_url} size={80} />
          <div>
            <h2 style={{ margin: 0 }}>{p.full_name}</h2>
            <p style={{ color: '#666', fontSize: 13, margin: '4px 0' }}>{p.email}</p>
            <span className={`badge ${p.system_role}`} style={{ background: '#eef0ff', color: '#1a1a5e' }}>
              {p.system_role}
            </span>
          </div>
        </div>

        {p.bio && (
          <div style={{ marginBottom: 16 }}>
            <h4 style={{ marginBottom: 6, color: '#444' }}>About</h4>
            <p style={{ fontSize: 14, lineHeight: 1.6, color: '#555' }}>{p.bio}</p>
          </div>
        )}

        {p.skills?.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <h4 style={{ marginBottom: 8, color: '#444' }}>Skills</h4>
            <div>{p.skills.map(s => <span key={s} className="skill-tag">{s}</span>)}</div>
          </div>
        )}

        {p.portfolio_links?.length > 0 && (
          <div>
            <h4 style={{ marginBottom: 8, color: '#444' }}>Portfolio</h4>
            {p.portfolio_links.map(link => (
              <div key={link}>
                <a href={link} target="_blank" rel="noreferrer" style={{ color: '#1a1a5e', fontSize: 14 }}>{link}</a>
              </div>
            ))}
          </div>
        )}
      </div>
      <button className="ghost" onClick={() => navigate(-1)} style={{ marginTop: 4 }}>← Back</button>
    </div>
  );
}
