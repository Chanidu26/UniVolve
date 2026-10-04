import { useEffect, useState } from 'react';
import api from '../api/client.js';

export default function MyApplications() {
  const [apps, setApps] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [code, setCode] = useState('');
  const [message, setMessage] = useState('');
  const [feedback, setFeedback] = useState({});
  const load = () => { api.get('/applications/mine').then(r => setApps(r.data.filter(a => a.status !== 'INVITED'))); api.get('/attendance/mine').then(r => setAttendance(r.data)); };
  useEffect(() => { load(); }, []);
  const attend = async (eventId, action) => {
    try { await api.post('/attendance', { event_id: eventId, code, action }); setCode(''); setMessage(`${action} recorded.`); load(); }
    catch (e) { setMessage(e.response?.data?.error || 'Attendance failed'); }
  };
  const exportCertificate = (item) => {
    const html = `<html><body style="font-family:Arial;text-align:center;padding:80px"><h1>UniVolve</h1><h2>Volunteer Certificate</h2><p>This certifies that</p><h2>${item.full_name || 'Volunteer'}</h2><p>completed volunteer service at <strong>${item.title}</strong>.</p><p>Total hours: <strong>${item.hours}</strong></p></body></html>`;
    const win = window.open('', '_blank'); win.document.write(html); win.document.close(); win.print();
  };
  const submitFeedback = async (eventId) => {
    const item = feedback[eventId] || {};
    try { await api.post(`/events/${eventId}/feedback`, { rating: Number(item.rating), comment: item.comment || '' }); setMessage('Feedback saved.'); }
    catch (e) { setMessage(e.response?.data?.error || 'Feedback failed'); }
  };
  return (
    <>
      <h2>My Applications</h2>
      <div className="card"><h3>Attendance and certificates</h3><p style={{ color: '#666', fontSize: 13 }}>Enter the code shown in the event QR code, then check in and out.</p>
        <input placeholder="Attendance code" value={code} onChange={e => setCode(e.target.value)} />
        {attendance.length === 0 && <p>No completed attendance yet.</p>}
        {attendance.map(item => <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, padding: '10px 0', borderBottom: '1px solid var(--line)' }}>
          <span><b>{item.title}</b><br /><small>{item.check_in_at ? 'Checked in' : 'Not checked in'} {item.check_out_at ? `· ${item.hours} hours` : ''}</small></span>
          <span>{!item.check_in_at && <button onClick={() => attend(item.event_id, 'check-in')}>Check in</button>} {item.check_in_at && !item.check_out_at && <button onClick={() => attend(item.event_id, 'check-out')}>Check out</button>} {item.check_out_at && <><button className="secondary" onClick={() => exportCertificate(item)}>Certificate</button><select value={feedback[item.event_id]?.rating || ''} onChange={e => setFeedback({ ...feedback, [item.event_id]: { ...feedback[item.event_id], rating: e.target.value } })}><option value="">Rate</option><option value="5">5 stars</option><option value="4">4 stars</option><option value="3">3 stars</option><option value="2">2 stars</option><option value="1">1 star</option></select><button onClick={() => submitFeedback(item.event_id)}>Send feedback</button></>}</span>
        </div>)}
        {message && <p style={{ marginTop: 10 }}>{message}</p>}
      </div>
      <div className="card">
        <table>
          <thead><tr><th>Event</th><th>Role</th><th>Date</th><th>Status</th><th>Decided</th></tr></thead>
          <tbody>
            {apps.map(a => (
              <tr key={a.id}>
                <td>{a.event_title}</td><td>{a.role_name}</td>
                <td>{new Date(a.event_date).toLocaleDateString()}</td>
                <td><span className={`badge ${a.status}`}>{a.status}</span></td>
                <td>{a.decided_at ? new Date(a.decided_at).toLocaleDateString() : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {apps.length === 0 && <p style={{ color: '#999' }}>No applications yet.</p>}
      </div>
    </>
  );
}
