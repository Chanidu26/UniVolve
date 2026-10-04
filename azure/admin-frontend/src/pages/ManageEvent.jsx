import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import api from '../api/client.js';
import UserChip from '../components/UserChip.jsx';
import VolunteerPickerModal from '../components/VolunteerPickerModal.jsx';
import { QRCodeSVG } from 'qrcode.react';

export default function ManageEvent() {
  const { id } = useParams();
  const [apps, setApps] = useState([]);
  const [roles, setRoles] = useState([]);
  const [role, setRole] = useState({ role_name: '', description: '', total_slots: 5 });
  const [inviteRoleId, setInviteRoleId] = useState(null);
  const [event, setEvent] = useState(null);

  const load = () => {
    api.get(`/events/${id}/applications`).then(r => setApps(r.data));
    api.get('/events').then(r => { const current = r.data.find(e => e.id === id); setEvent(current); setRoles(current?.roles || []); });
  };
  useEffect(() => { load(); }, [id]);

  const addRole = async e => {
    e.preventDefault();
    await api.post(`/events/${id}/roles`, role);
    setRole({ role_name: '', description: '', total_slots: 5 });
    load();
  };

  const decide = async (appId, status) => {
    await api.put(`/events/${id}/applications/${appId}`, { status });
    load();
  };

  const invite = async (volunteer) => {
    try {
      await api.post(`/events/${id}/roles/${inviteRoleId}/invite`, { volunteer_id: volunteer.id });
      setInviteRoleId(null);
      load();
    } catch (e) { alert(e.response?.data?.error || 'Invite failed'); }
  };

  const endorse = async (volunteerId, skill) => {
    try { await api.post(`/events/${id}/users/${volunteerId}/endorsements`, { skill }); }
    catch (e) { alert(e.response?.data?.error || 'Endorsement failed'); }
  };

  return (
    <>
      {inviteRoleId && (
        <VolunteerPickerModal
          title="Invite Volunteer"
          actionLabel="Invite"
          onPick={invite}
          onClose={() => setInviteRoleId(null)}
        />
      )}

      <h2 style={{ marginBottom: 16 }}>Manage Event</h2>

      {event?.attendance_code && <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
        <QRCodeSVG value={`${window.location.origin}/attendance/${event.id}?code=${event.attendance_code}`} size={150} />
        <div><h3>Attendance QR code</h3><p style={{ color: 'var(--ink-soft)', marginTop: 8 }}>Volunteers scan or enter this event code to check in and out.</p><code>{event.attendance_code}</code></div>
      </div>}

      {roles.length > 0 && (
        <div className="card">
          <h3 style={{ marginBottom: 12 }}>Volunteer Roles</h3>
          {roles.map(r => (
            <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '10px 0', borderBottom: '1px solid var(--line)' }}>
              <div>
                <b>{r.role_name}</b>
                <span style={{ marginLeft: 8, fontSize: 12.5, color: 'var(--ink-soft)' }}>{r.filled_slots}/{r.total_slots} filled</span>
              </div>
              <button className="secondary" onClick={() => setInviteRoleId(r.id)}
                disabled={r.filled_slots >= r.total_slots}>Invite Volunteer</button>
            </div>
          ))}
        </div>
      )}

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
                      {a.skills.map(s => <button key={s} className="skill-tag" style={{ border: 0, cursor: 'pointer' }} onClick={() => endorse(a.volunteer_id, s)} title={`Endorse ${s}`}>
                        {s} +
                      </button>)}
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
