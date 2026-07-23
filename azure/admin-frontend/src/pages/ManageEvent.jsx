import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import api from '../api/client.js';
import UserChip from '../components/UserChip.jsx';

export default function ManageEvent() {
  const { id } = useParams();
  const [apps, setApps] = useState([]);
  const [role, setRole] = useState({ role_name: '', description: '', total_slots: 5 });
  const load = () => api.get(`/events/${id}/applications`).then(r => setApps(r.data));
  useEffect(() => { load(); }, [id]);

  const addRole = async e => {
    e.preventDefault();
    await api.post(`/events/${id}/roles`, role);
    setRole({ role_name: '', description: '', total_slots: 5 });
    alert('Role added');
  };

  const decide = async (appId, status) => {
    await api.put(`/events/${id}/applications/${appId}`, { status });
    load();
  };

  return (
    <>
      <h2 style={{ marginBottom: 16 }}>Manage Event</h2>

      <div className="card">
        <h3 style={{ marginBottom: 12 }}>Add Volunteer Role</h3>
        <form onSubmit={addRole}>
          <label>Role Name</label>
          <input placeholder="e.g. Registration Desk" value={role.role_name}
            onChange={e => setRole({ ...role, role_name: e.target.value })} required />
          <label>Description</label>
          <input placeholder="What will this volunteer do?" value={role.description}
            onChange={e => setRole({ ...role, description: e.target.value })} />
          <label>Total Slots</label>
          <input type="number" min="1" value={role.total_slots}
            onChange={e => setRole({ ...role, total_slots: +e.target.value })} />
          <button type="submit">Add Role</button>
        </form>
      </div>

      <div className="card">
        <h3 style={{ marginBottom: 12 }}>Applications ({apps.length})</h3>
        {apps.length === 0 && <p style={{ color: '#999' }}>No applications yet.</p>}
        <table>
          <thead>
            <tr>
              <th>Volunteer</th>
              <th>Role</th>
              <th>Applied</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {apps.map(a => (
              <tr key={a.id}>
                <td>
                  <UserChip id={a.volunteer_id} name={a.full_name} url={a.profile_picture_url} size={32} />
                  {a.skills?.length > 0 && (
                    <div style={{ marginTop: 4 }}>
                      {a.skills.map(s => <span key={s} className="skill-tag">{s}</span>)}
                    </div>
                  )}
                </td>
                <td>{a.role_name}</td>
                <td style={{ fontSize: 12, color: '#666' }}>{new Date(a.applied_at).toLocaleDateString()}</td>
                <td><span className={`badge ${a.status}`}>{a.status}</span></td>
                <td>
                  {a.status === 'PENDING' && <>
                    <button style={{ marginRight: 6 }} onClick={() => decide(a.id, 'APPROVED')}>Approve</button>
                    <button className="danger" onClick={() => decide(a.id, 'REJECTED')}>Reject</button>
                  </>}
                  {a.status === 'APPROVED' && (
                    <button className="danger" onClick={() => decide(a.id, 'REJECTED')}>Revoke</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
