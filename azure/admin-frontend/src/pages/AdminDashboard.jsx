import { useEffect, useState } from 'react';
import api from '../api/client.js';

const cards = [
  ['volunteers', 'Volunteers'], ['events', 'Events'], ['published_events', 'Published events'],
  ['pending_applications', 'Pending applications'], ['completed_attendance', 'Completed check-outs'],
  ['volunteer_hours', 'Volunteer hours'],
];

export default function AdminDashboard() {
  const [stats, setStats] = useState(null);
  useEffect(() => { api.get('/admin/stats').then(r => setStats(r.data)); }, []);
  return (
    <>
      <h2 style={{ marginBottom: 16 }}>Admin Dashboard</h2>
      {!stats && <div className="card">Loading statistics...</div>}
      {stats && <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 16 }}>
        {cards.map(([key, label]) => <div className="card" key={key} style={{ marginBottom: 0 }}>
          <div style={{ color: 'var(--ink-soft)', fontSize: 13 }}>{label}</div>
          <strong style={{ display: 'block', fontSize: 30, color: 'var(--brand-dark)', marginTop: 8 }}>{stats[key]}</strong>
        </div>)}
      </div>}
    </>
  );
}