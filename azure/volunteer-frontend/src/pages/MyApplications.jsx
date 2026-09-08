import { useEffect, useState } from 'react';
import api from '../api/client.js';

export default function MyApplications() {
  const [apps, setApps] = useState([]);
  useEffect(() => { api.get('/applications/mine').then(r => setApps(r.data.filter(a => a.status !== 'INVITED'))); }, []);
  return (
    <>
      <h2>My Applications</h2>
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
      </div>
    </>
  );
}
