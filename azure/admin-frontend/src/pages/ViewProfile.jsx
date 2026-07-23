import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Avatar from '../components/Avatar.jsx';
import api, { photoUrl } from '../api/client.js';

const PLATFORM_ICONS = {
  LinkedIn: '🔗', GitHub: '💻', Portfolio: '🌐', Behance: '🎨',
  Dribbble: '🏀', YouTube: '▶️', Instagram: '📸', 'Twitter/X': '🐦', Other: '🔗',
};

export default function ViewProfile() {
  const { userId } = useParams();
  const navigate = useNavigate();
  const [p, setP] = useState(null);

  useEffect(() => {
    api.get(`/users/${userId}`).then(r => setP(r.data)).catch(() => navigate('/'));
  }, [userId]);

  if (!p) return <div style={{ padding: 32 }}>Loading...</div>;

  // parse "Platform::url" links
  const links = (p.portfolio_links || []).map(raw => {
    const [platform, ...rest] = raw.split('::');
    return rest.length ? { platform, url: rest.join('::') } : { platform: 'Other', url: raw };
  });

  return (
    <div style={{ maxWidth: 580, margin: '0 auto' }}>
      <button className="ghost" onClick={() => navigate(-1)} style={{ marginBottom: 14 }}>← Back</button>

      <div className="card">
        {/* Header */}
        <div style={{ display: 'flex', gap: 20, alignItems: 'center', marginBottom: 20 }}>
          <Avatar name={p.full_name} url={photoUrl(p.profile_picture_url)} size={90} />
          <div>
            <h2 style={{ margin: 0 }}>{p.full_name}</h2>
            <p style={{ color: '#777', fontSize: 13, margin: '4px 0 8px' }}>{p.email}</p>
            <span style={{ background: '#eef0ff', color: '#1a1a5e', padding: '3px 12px',
              borderRadius: 12, fontSize: 12, fontWeight: 600 }}>
              {p.system_role}
            </span>
          </div>
        </div>

        {/* Bio */}
        {p.bio && (
          <div style={{ marginBottom: 20 }}>
            <h4 style={{ color: '#444', marginBottom: 8 }}>About</h4>
            <p style={{ fontSize: 14, lineHeight: 1.7, color: '#555' }}>{p.bio}</p>
          </div>
        )}

        {/* Skills */}
        {p.skills?.length > 0 && (
          <div style={{ marginBottom: 20 }}>
            <h4 style={{ color: '#444', marginBottom: 10 }}>Skills</h4>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {p.skills.map(s => (
                <span key={s} style={{
                  background: '#eef0ff', color: '#1a1a5e', padding: '5px 14px',
                  borderRadius: 20, fontSize: 13, fontWeight: 500
                }}>✓ {s}</span>
              ))}
            </div>
          </div>
        )}

        {/* Portfolio links */}
        {links.length > 0 && (
          <div>
            <h4 style={{ color: '#444', marginBottom: 10 }}>Links</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {links.map((l, i) => (
                <a key={i} href={l.url} target="_blank" rel="noreferrer"
                  style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px',
                    background: '#f8f9ff', borderRadius: 8, textDecoration: 'none', color: '#1a1a5e',
                    fontSize: 14, border: '1px solid #e0e3ff' }}>
                  <span style={{ fontSize: 18 }}>{PLATFORM_ICONS[l.platform] || '🔗'}</span>
                  <span style={{ fontWeight: 600, minWidth: 80 }}>{l.platform}</span>
                  <span style={{ color: '#5c6bc0', fontSize: 13, overflow: 'hidden',
                    textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.url}</span>
                </a>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
