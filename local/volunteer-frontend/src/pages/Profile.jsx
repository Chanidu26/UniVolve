import { useEffect, useRef, useState } from 'react';
import api, { uploadPhoto, photoUrl } from '../api/client.js';
import Avatar from '../components/Avatar.jsx';

const SKILL_OPTIONS = [
  'Announcing', 'Graphic Design', 'Video Editing', 'Photography',
  'Event Management', 'First Aid', 'Translation', 'Marketing',
  'Social Media', 'Web Development', 'Music / DJ', 'Catering',
  'Security', 'Decoration', 'Transportation', 'Teaching / Training',
];

const PLATFORMS = ['LinkedIn', 'GitHub', 'Portfolio', 'Behance', 'Dribbble', 'YouTube', 'Instagram', 'Twitter/X', 'Other'];

const fmtHours = (h) => Number(h || 0).toFixed(2);

export default function Profile({ onUpdate }) {
  const [p, setP] = useState(null);
  const [hours, setHours] = useState(null);   // FR-07 verified hours dashboard
  const [skills, setSkills] = useState([]);
  const [links, setLinks] = useState([]);           // [{platform, url}]
  const [bio, setBio] = useState('');
  const [fullName, setFullName] = useState('');
  const [msg, setMsg] = useState('');
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
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
    });
    api.get('/users/me/hours').then(r => setHours(r.data)).catch(() => setHours(null));
  }, []);

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

      {/* ── Volunteering hours (FR-07) ── */}
      {hours && (
        <div className="card">
          <h3 style={{ marginBottom: 14 }}>My Volunteering Hours</h3>
          <div className="profile-stats">
            <div className="stat">
              <div className="num">{fmtHours(hours.total_hours)}</div>
              <div className="lbl">Verified Hours</div>
            </div>
            <div className="stat">
              <div className="num">{hours.events_attended}</div>
              <div className="lbl">Events Attended</div>
            </div>
            <div className="stat">
              <div className="num">{hours.pending_verification}</div>
              <div className="lbl">Awaiting Verification</div>
            </div>
          </div>

          {hours.history.length === 0 ? (
            <p className="muted" style={{ marginTop: 14 }}>
              No attendance recorded yet. Once an organizer marks you present and verifies your
              hours, they will show up here.
            </p>
          ) : (
            <div className="table-scroll" style={{ marginTop: 16 }}>
              <table>
                <thead>
                  <tr><th>Event</th><th>Role</th><th>Date</th><th>Hours</th><th>Status</th></tr>
                </thead>
                <tbody>
                  {hours.history.map(h => (
                    <tr key={h.id}>
                      <td>{h.event_title}</td>
                      <td>{h.role_name}</td>
                      <td style={{ fontSize: 12, color: '#666' }}>
                        {new Date(h.event_date).toLocaleDateString()}
                      </td>
                      <td className="hours-num">{fmtHours(h.hours_logged)}</td>
                      <td>
                        {h.status === 'PRESENT' && h.verified_at
                          ? <span className="badge VERIFIED">VERIFIED</span>
                          : <span className={`badge ${h.status}`}>{h.status}</span>}
                        {h.status === 'PRESENT' && !h.verified_at &&
                          <div><small className="muted">awaiting verification</small></div>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

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

        <button type="submit" disabled={saving} style={{ width: '100%', padding: 12, fontSize: 15 }}>
          {saving ? 'Saving…' : 'Save Profile'}
        </button>
      </form>
    </div>
  );
}
