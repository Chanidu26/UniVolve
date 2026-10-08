import { useEffect, useState } from 'react';
import api from '../api/client.js';
import Avatar from '../components/Avatar.jsx';
import VolunteerPickerModal from '../components/VolunteerPickerModal.jsx';

export default function RecommendSomeone() {
  const [user, setUser] = useState(null);
  const [target, setTarget] = useState(null);
  const [text, setText] = useState('');
  const [message, setMessage] = useState('');
  const [pickerOpen, setPickerOpen] = useState(false);
  useEffect(() => { api.get('/auth/me').then(r => setUser(r.data)); }, []);
  const submit = async (event) => {
    event.preventDefault();
    if (!target) return setMessage('Select a volunteer first');
    if (text.trim().length < 10) return setMessage('Write at least 10 characters');
    try { await api.post(`/users/${target.id}/recommendations`, { text }); setText(''); setTarget(null); setMessage('Recommendation submitted.'); }
    catch (e) { setMessage(e.response?.data?.error || 'Could not submit recommendation'); }
  };
  return <div style={{ maxWidth: 620, margin: '0 auto' }}>
    {pickerOpen && <VolunteerPickerModal title="Recommend a Volunteer" actionLabel="Select" excludeUserId={user?.id} onPick={v => { setTarget(v); setPickerOpen(false); }} onClose={() => setPickerOpen(false)} />}
    <h2 style={{ marginBottom: 16 }}>Recommend Someone</h2>
    <div className="card">
      <p style={{ color: '#666', marginBottom: 16 }}>Choose a volunteer and share a recommendation that will appear on their profile.</p>
      <form onSubmit={submit}>
        <label>Volunteer</label>
        <button type="button" className="secondary" onClick={() => setPickerOpen(true)} style={{ width: '100%', textAlign: 'left', margin: '4px 0 14px' }}>
          {target ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}><Avatar name={target.full_name} url={target.profile_picture_url} size={28} />{target.full_name} ({target.email})</span> : 'Select a volunteer'}
        </button>
        <label>Recommendation</label>
        <textarea rows={5} minLength={10} maxLength={1000} required placeholder="Write at least 10 characters" value={text} onChange={e => setText(e.target.value)} />
        <button type="submit">Submit recommendation</button>
      </form>
      {message && <p style={{ marginTop: 12, color: '#666' }}>{message}</p>}
    </div>
  </div>;
}