import { useEffect, useRef, useState } from 'react';
import api, { uploadPhoto, photoUrl } from '../api/client.js';
import Avatar from '../components/Avatar.jsx';
import VolunteerPickerModal from '../components/VolunteerPickerModal.jsx';

const SKILL_OPTIONS = [
  'Announcing', 'Graphic Design', 'Video Editing', 'Photography',
  'Event Management', 'First Aid', 'Translation', 'Marketing',
  'Social Media', 'Web Development', 'Music / DJ', 'Catering',
  'Security', 'Decoration', 'Transportation', 'Teaching / Training',
];

const PLATFORMS = ['LinkedIn', 'GitHub', 'Portfolio', 'Behance', 'Dribbble', 'YouTube', 'Instagram', 'Twitter/X', 'Other'];

export default function Profile({ onUpdate }) {
  const [p, setP] = useState(null);
  const [skills, setSkills] = useState([]);
  const [links, setLinks] = useState([]);           // [{platform, url}]
  const [bio, setBio] = useState('');
  const [fullName, setFullName] = useState('');
  const [msg, setMsg] = useState('');
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [stats, setStats] = useState(null);
  const [recommendations, setRecommendations] = useState([]);
  const [recommendationTarget, setRecommendationTarget] = useState(null);
  const [showRecommendationPicker, setShowRecommendationPicker] = useState(false);
  const [recommendationText, setRecommendationText] = useState('');
  const [recommendationMessage, setRecommendationMessage] = useState('');
  const fileRef = useRef();

  useEffect(() => {
    api.get('/auth/me').then(r => {
      const u = r.data;
      setP(u);
      setFullName(u.full_name || '');
      setBio(u.bio || '');
      setSkills(u.skills || []);
      // portfolio_links stored as "Platform::url" strings
      setLinks((u.portfolio_links || []).map(raw => {
        const [platform, ...rest] = raw.split('::');
        return rest.length ? { platform, url: rest.join('::') } : { platform: 'Other', url: raw };
      }));
      api.get(`/users/${u.id}/stats`).then(r => setStats(r.data));
      setRecommendations(u.recommendations || []);
    });
  }, []);

  const exportResume = () => {
    const html = `<html><body style="font-family:Arial;padding:40px"><h1>${fullName}</h1><p>${bio}</p><h2>Verified volunteer history</h2><p>Completed events: ${stats?.completed_events || 0}</p><p>Volunteer hours: ${stats?.volunteer_hours || 0}</p><h2>Skills</h2><p>${skills.join(', ') || 'None listed'}</p><h2>Portfolio</h2><p>${links.map(link => `${link.platform}: ${link.url}`).join('<br>') || 'None listed'}</p></body></html>`;
    const win = window.open('', '_blank'); win.document.write(html); win.document.close(); win.print();
  };

  const recommendSomeone = async () => {
    if (!recommendationTarget) return setRecommendationMessage('Select a volunteer first');
    if (recommendationText.trim().length < 10) return setRecommendationMessage('Write at least 10 characters');
    try {
      const { data } = await api.post(`/users/${recommendationTarget.id}/recommendations`, { text: recommendationText });
      setRecommendationText(''); setRecommendationTarget(null); setRecommendationMessage(`Recommendation added for ${data.recommended_user_id}.`);
    } catch (e) { setRecommendationMessage(e.response?.data?.error || 'Could not add recommendation'); }
  };

  // --- Photo upload ---
  const handlePhotoChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    try {
      const { url, user } = await uploadPhoto(file);
      setP(u => ({ ...u, profile_picture_url: url }));
      onUpdate && onUpdate(user);
    } catch { setMsg('Photo upload failed'); }
    finally { setUploading(false); }
  };

  // --- Skills toggle ---
  const toggleSkill = (s) =>
    setSkills(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]);

  // --- Portfolio links ---
  const addLink = () => setLinks(l => [...l, { platform: 'LinkedIn', url: '' }]);
  const removeLink = (i) => setLinks(l => l.filter((_, idx) => idx !== i));
  const setLink = (i, key, val) => setLinks(l => l.map((x, idx) => idx === i ? { ...x, [key]: val } : x));

  // --- Save ---
  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const portfolio_links = links
        .filter(l => l.url.trim())
        .map(l => `${l.platform}::${l.url.trim()}`);
      const { data } = await api.put('/auth/me', { full_name: fullName, bio, skills, portfolio_links });
      setP(data);
      onUpdate && onUpdate(data);
      setMsg('Profile saved ✓');
    } catch { setMsg('Save failed'); }
    finally { setSaving(false); }
  };

  if (!p) return <div style={{ padding: 32 }}>Loading...</div>;

  return (
    <div style={{ maxWidth: 600, margin: '0 auto' }}>
      <h2 style={{ marginBottom: 16 }}>My Profile</h2>
      {showRecommendationPicker && <VolunteerPickerModal title="Recommend a Volunteer" actionLabel="Select" onPick={(volunteer) => { setRecommendationTarget(volunteer); setShowRecommendationPicker(false); }} onClose={() => setShowRecommendationPicker(false)} />}
      {/* ── Photo ── */}
      <div className="card">
        <h3 style={{ marginBottom: 14 }}>Profile Photo</h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <Avatar name={p.full_name} url={photoUrl(p.profile_picture_url)} size={80} />
          <div>
            <button type="button" onClick={() => fileRef.current.click()} disabled={uploading}>
              {uploading ? 'Uploading…' : '📷 Upload Photo'}
            </button>
            <p style={{ fontSize: 12, color: '#888', marginTop: 6 }}>JPG, PNG, WEBP — max 2 MB</p>
            <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }}
              onChange={handlePhotoChange} />
          </div>
        </div>
      </div>

      <form onSubmit={save}>
        {/* ── Basic info ── */}
        <div className="card">
          <h3 style={{ marginBottom: 14 }}>Basic Info</h3>
          {msg && <p style={{ color: msg.includes('✓') ? 'green' : 'crimson', marginBottom: 10 }}>{msg}</p>}
          <label>Full Name</label>
          <input value={fullName} onChange={e => setFullName(e.target.value)} />
          <label>Bio</label>
          <textarea rows={3} value={bio} onChange={e => setBio(e.target.value)}
            placeholder="Tell organizers a bit about yourself…" />
        </div>

        {/* ── Skills ── */}
        <div className="card">
          <h3 style={{ marginBottom: 14 }}>Skills</h3>
          <p style={{ fontSize: 13, color: '#666', marginBottom: 12 }}>Tick all that apply</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {SKILL_OPTIONS.map(s => (
              <label key={s} style={{
                display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px',
                border: `2px solid ${skills.includes(s) ? '#1a1a5e' : '#d0d5e0'}`,
                borderRadius: 20, cursor: 'pointer', fontSize: 13, userSelect: 'none',
                background: skills.includes(s) ? '#eef0ff' : '#fff',
                color: skills.includes(s) ? '#1a1a5e' : '#444',
                fontWeight: skills.includes(s) ? 600 : 400,
              }}>
                <input type="checkbox" style={{ display: 'none' }}
                  checked={skills.includes(s)} onChange={() => toggleSkill(s)} />
                {skills.includes(s) ? '✓ ' : ''}{s}
              </label>
            ))}
          </div>
          {skills.length > 0 && (
            <p style={{ marginTop: 12, fontSize: 13, color: '#5c6bc0' }}>
              Selected: {skills.join(', ')}
            </p>
          )}
        </div>

        {/* ── Portfolio links ── */}
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <h3>Portfolio & Links</h3>
            <button type="button" className="ghost" onClick={addLink} style={{ padding: '6px 14px' }}>
              + Add Link
            </button>
          </div>
          {links.length === 0 && (
            <p style={{ color: '#aaa', fontSize: 13 }}>No links yet — click Add Link to add one.</p>
          )}
          {links.map((l, i) => (
            <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 10, alignItems: 'center' }}>
              <select value={l.platform} onChange={e => setLink(i, 'platform', e.target.value)}
                style={{ width: 140, margin: 0, flexShrink: 0 }}>
                {PLATFORMS.map(pl => <option key={pl}>{pl}</option>)}
              </select>
              <input placeholder="https://…" value={l.url}
                onChange={e => setLink(i, 'url', e.target.value)}
                style={{ margin: 0, flex: 1 }} />
              <button type="button" className="danger"
                onClick={() => removeLink(i)}
                style={{ padding: '8px 12px', flexShrink: 0 }}>✕</button>
            </div>
          ))}
        </div>

        <div className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
          <div><h3>Verified volunteer history</h3><p style={{ color: '#666', marginTop: 6 }}>{stats?.completed_events || 0} completed events · {stats?.volunteer_hours || 0} hours · {stats?.endorsements?.length || 0} endorsements</p></div>
          <button type="button" className="secondary" onClick={exportResume}>Export résumé</button>
        </div>
        <div className="card">
          <h3>Recommendations</h3>
          {recommendations.length === 0 && <p style={{ color: '#999', marginTop: 8 }}>No recommendations yet.</p>}
          {recommendations.map(r => <div key={r.id} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: 12, background: '#f8f9ff', borderRadius: 8, marginTop: 10 }}><Avatar name={r.recommender_name} url={photoUrl(r.recommender_picture)} size={34} /><div><p style={{ margin: 0, lineHeight: 1.5 }}>{r.text}</p><small style={{ color: '#777' }}>Recommended by {r.recommender_name}</small></div></div>)}
        </div>
        <div className="card">
          <h3>Recommend someone</h3>
          <div style={{ marginTop: 12 }}>
            <label>Volunteer</label>
            <button type="button" className="secondary" onClick={() => setShowRecommendationPicker(true)} style={{ width: '100%', textAlign: 'left', marginBottom: 14 }}>
              {recommendationTarget ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}><Avatar name={recommendationTarget.full_name} url={photoUrl(recommendationTarget.profile_picture_url)} size={28} />{recommendationTarget.full_name} ({recommendationTarget.email})</span> : 'Select a volunteer'}
            </button>
            <label>Recommendation</label>
            <textarea rows={3} minLength={10} maxLength={1000} placeholder="Write at least 10 characters" value={recommendationText} onChange={e => setRecommendationText(e.target.value)} required />
            <button type="button" onClick={recommendSomeone}>Submit recommendation</button>
          </div>
          {recommendationMessage && <p style={{ marginTop: 8, color: '#666' }}>{recommendationMessage}</p>}
        </div>

        <button type="submit" disabled={saving} style={{ width: '100%', padding: 12, fontSize: 15 }}>
          {saving ? 'Saving…' : 'Save Profile'}
        </button>
      </form>
    </div>
  );
}
