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
  const [recommendations, setRecommendations] = useState([]);
  const [recommendation, setRecommendation] = useState('');
  const [recommendationMessage, setRecommendationMessage] = useState('');

  useEffect(() => {
    api.get(`/users/${userId}`).then(r => { setP(r.data); setRecommendations(r.data.recommendations || []); }).catch(() => navigate('/'));
  }, [userId]);

  const submitRecommendation = async (event) => {
    event.preventDefault();
    try {
      const { data } = await api.post(`/users/${userId}/recommendations`, { text: recommendation });
      setRecommendations([data, ...recommendations]); setRecommendation(''); setRecommendationMessage('Recommendation added.');
    } catch (e) { setRecommendationMessage(e.response?.data?.error || 'Could not add recommendation'); }
  };

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

        <div style={{ marginTop: 22 }}>
          <h4 style={{ color: '#444', marginBottom: 10 }}>Recommendations</h4>
          {recommendations.length === 0 && <p style={{ color: '#999', fontSize: 14 }}>No recommendations yet.</p>}
          {recommendations.map(r => <div key={r.id} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: 12, background: '#f8f9ff', borderRadius: 8, marginBottom: 8 }}><Avatar name={r.recommender_name} url={photoUrl(r.recommender_picture)} size={34} /><div><p style={{ margin: 0, lineHeight: 1.5 }}>{r.text}</p><small style={{ color: '#777' }}>Recommended by {r.recommender_name}</small></div></div>)}
          <form onSubmit={submitRecommendation} style={{ marginTop: 12 }}>
            <textarea rows={3} minLength={10} maxLength={1000} placeholder="Write a recommendation (10-1000 characters)" value={recommendation} onChange={e => setRecommendation(e.target.value)} required />
            <button type="submit">Recommend {p.full_name}</button>
          </form>
          {recommendationMessage && <p style={{ marginTop: 8, color: '#666' }}>{recommendationMessage}</p>}
        </div>
      </div>
    </div>
  );
}
