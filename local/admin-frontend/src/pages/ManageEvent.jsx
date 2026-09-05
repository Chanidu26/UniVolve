import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import api from '../api/client.js';
import UserChip from '../components/UserChip.jsx';

const STATUSES = ['PRESENT', 'ABSENT', 'EXCUSED'];
const emptyRole = { role_name: '', description: '', total_slots: 5 };

// <input type="datetime-local"> speaks local 'YYYY-MM-DDTHH:mm'; the API speaks ISO.
const toLocalInput = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
const fromLocalInput = (v) => (v ? new Date(v).toISOString() : null);
const fmtHours = (h) => Number(h || 0).toFixed(2);

export default function ManageEvent() {
  const { id } = useParams();
  const [tab, setTab] = useState('roles');
  const [roles, setRoles] = useState([]);
  const [apps, setApps] = useState([]);
  const [sheet, setSheet] = useState({ summary: null, rows: [] });
  const [newRole, setNewRole] = useState(emptyRole);
  const [editing, setEditing] = useState(null);   // role being edited inline
  const [draft, setDraft] = useState({});         // application_id -> unsaved row input
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);

  const ok = (text) => setMsg({ type: 'ok', text });
  const fail = (e, fallback) => setMsg({ type: 'err', text: e.response?.data?.error || fallback });

  const loadRoles = useCallback(() => api.get(`/events/${id}/roles`).then(r => setRoles(r.data)), [id]);
  const loadApps = useCallback(() => api.get(`/events/${id}/applications`).then(r => setApps(r.data)), [id]);

  // resyncFor resets just the row we saved; every other row keeps whatever the
  // organizer has typed but not saved yet.
  const loadSheet = useCallback((resyncFor = null) => api.get(`/events/${id}/attendance`).then(r => {
    setSheet(r.data);
    setDraft(prev => Object.fromEntries(r.data.rows.map(row => {
      const fromServer = {
        check_in: toLocalInput(row.check_in_time),
        check_out: toLocalInput(row.check_out_time),
        hours: row.hours_logged == null ? '' : fmtHours(row.hours_logged),
      };
      const keep = row.application_id !== resyncFor && prev[row.application_id];
      return [row.application_id, keep || fromServer];
    })));
  }), [id]);

  const loadAll = useCallback(
    () => Promise.all([loadRoles(), loadApps(), loadSheet()]).catch(e => fail(e, 'Failed to load event')),
    [loadRoles, loadApps, loadSheet]);

  useEffect(() => { loadAll(); }, [loadAll]);

  const setDraftField = (appId, key, value) =>
    setDraft(d => ({ ...d, [appId]: { ...d[appId], [key]: value } }));

  // ── Roles (FR-06) ─────────────────────────────────────────────────────────
  const addRole = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api.post(`/events/${id}/roles`, newRole);
      setNewRole(emptyRole);
      await loadRoles();
      ok('Role added');
    } catch (e) { fail(e, 'Could not add role'); }
    finally { setBusy(false); }
  };

  const saveRole = async () => {
    setBusy(true);
    try {
      await api.put(`/events/${id}/roles/${editing.id}`, {
        role_name: editing.role_name,
        description: editing.description,
        total_slots: editing.total_slots,
      });
      setEditing(null);
      await loadRoles();
      ok('Role updated');
    } catch (e) { fail(e, 'Could not update role'); }
    finally { setBusy(false); }
  };

  const deleteRole = async (role) => {
    if (!confirm(`Delete the role "${role.role_name}"?`)) return;
    setBusy(true);
    try {
      await api.delete(`/events/${id}/roles/${role.id}`);
      await loadRoles();
      ok('Role deleted');
    } catch (e) { fail(e, 'Could not delete role'); }
    finally { setBusy(false); }
  };

  // ── Applications ──────────────────────────────────────────────────────────
  const decide = async (appId, status) => {
    setBusy(true);
    try {
      await api.put(`/events/${id}/applications/${appId}`, { status });
      await loadAll();   // slot counts and the attendance sheet both change
      ok(`Application ${status.toLowerCase()}`);
    } catch (e) { fail(e, 'Could not update application'); }
    finally { setBusy(false); }
  };

  // ── Attendance & hours (FR-06 / FR-07) ────────────────────────────────────
  const mark = async (row, status) => {
    const d = draft[row.application_id] || {};
    setBusy(true);
    try {
      await api.post(`/events/${id}/attendance/mark`, {
        application_id: row.application_id,
        status,
        check_in_time: fromLocalInput(d.check_in),
        check_out_time: fromLocalInput(d.check_out),
      });
      await loadSheet(row.application_id);
      ok(`${row.full_name} marked ${status.toLowerCase()}`);
    } catch (e) { fail(e, 'Could not save attendance'); }
    finally { setBusy(false); }
  };

  const timesDirty = (row) => {
    const d = draft[row.application_id] || {};
    return (d.check_in || '') !== toLocalInput(row.check_in_time)
        || (d.check_out || '') !== toLocalInput(row.check_out_time);
  };

  const verify = async (row) => {
    const d = draft[row.application_id] || {};
    setBusy(true);
    try {
      // The hours endpoint reads the stored window, so flush unsaved times first.
      if (timesDirty(row)) {
        await api.post(`/events/${id}/attendance/mark`, {
          application_id: row.application_id,
          status: 'PRESENT',
          check_in_time: fromLocalInput(d.check_in),
          check_out_time: fromLocalInput(d.check_out),
        });
      }
      await api.post(`/events/${id}/attendance/hours`, {
        application_id: row.application_id,
        hours_logged: d.hours === '' ? undefined : d.hours,
      });
      await loadSheet(row.application_id);
      ok(`Hours verified for ${row.full_name}`);
    } catch (e) { fail(e, 'Could not verify hours'); }
    finally { setBusy(false); }
  };

  const stateBadge = (row) => {
    if (!row.status) return <span className="badge UNMARKED">UNMARKED</span>;
    if (row.status === 'PRESENT' && row.verified_at) return <span className="badge VERIFIED">VERIFIED</span>;
    return <span className={`badge ${row.status}`}>{row.status}</span>;
  };

  return (
    <>
      <h2 style={{ marginBottom: 16 }}>Manage Event</h2>

      <div className="tabs">
        <button className={`tab ${tab === 'roles' ? 'active' : ''}`} onClick={() => setTab('roles')}>
          Roles &amp; Applications
        </button>
        <button className={`tab ${tab === 'attendance' ? 'active' : ''}`} onClick={() => setTab('attendance')}>
          Attendance &amp; Hours
        </button>
      </div>

      {msg && <div className={`msg ${msg.type}`} onClick={() => setMsg(null)}>{msg.text}</div>}

      {tab === 'roles' && (
        <>
          <div className="card">
            <h3 style={{ marginBottom: 12 }}>Volunteer Roles ({roles.length})</h3>
            {roles.length === 0 && <p className="muted">No roles defined yet — add one below.</p>}
            {roles.length > 0 && (
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr><th>Role</th><th>Slots</th><th>Applications</th><th>Action</th></tr>
                  </thead>
                  <tbody>
                    {roles.map(r => editing?.id === r.id ? (
                      <tr key={r.id}>
                        <td>
                          <div className="cell-stack">
                            <input className="cell-input" value={editing.role_name}
                              onChange={e => setEditing({ ...editing, role_name: e.target.value })} />
                            <input className="cell-input" placeholder="Description"
                              value={editing.description || ''}
                              onChange={e => setEditing({ ...editing, description: e.target.value })} />
                          </div>
                        </td>
                        <td>
                          <input className="cell-input" type="number" min={r.filled_slots || 1}
                            style={{ width: 80 }} value={editing.total_slots}
                            onChange={e => setEditing({ ...editing, total_slots: +e.target.value })} />
                        </td>
                        <td>{r.application_count}</td>
                        <td>
                          <div className="row-actions">
                            <button onClick={saveRole} disabled={busy}>Save</button>
                            <button className="ghost" onClick={() => setEditing(null)}>Cancel</button>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      <tr key={r.id}>
                        <td>
                          {r.role_name}
                          {r.description && <div><small className="muted">{r.description}</small></div>}
                        </td>
                        <td>{r.filled_slots}/{r.total_slots}</td>
                        <td>{r.application_count}</td>
                        <td>
                          <div className="row-actions">
                            <button className="secondary" disabled={busy}
                              onClick={() => setEditing({
                                id: r.id, role_name: r.role_name,
                                description: r.description, total_slots: r.total_slots,
                              })}>Edit</button>
                            <button className="danger" disabled={busy}
                              onClick={() => deleteRole(r)}>Delete</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="card">
            <h3 style={{ marginBottom: 12 }}>Add Volunteer Role</h3>
            <form onSubmit={addRole}>
              <label>Role Name</label>
              <input placeholder="e.g. Registration Desk" value={newRole.role_name}
                onChange={e => setNewRole({ ...newRole, role_name: e.target.value })} required />
              <label>Description</label>
              <input placeholder="What will this volunteer do?" value={newRole.description}
                onChange={e => setNewRole({ ...newRole, description: e.target.value })} />
              <label>Total Slots</label>
              <input type="number" min="1" value={newRole.total_slots}
                onChange={e => setNewRole({ ...newRole, total_slots: +e.target.value })} />
              <button type="submit" disabled={busy}>Add Role</button>
            </form>
          </div>

          <div className="card">
            <h3 style={{ marginBottom: 12 }}>Applications ({apps.length})</h3>
            {apps.length === 0 && <p className="muted">No applications yet.</p>}
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Volunteer</th><th>Role</th><th>Applied</th><th>Status</th><th>Action</th>
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
                        <div className="row-actions">
                          {a.status === 'PENDING' && <>
                            <button disabled={busy} onClick={() => decide(a.id, 'APPROVED')}>Approve</button>
                            <button className="danger" disabled={busy} onClick={() => decide(a.id, 'REJECTED')}>Reject</button>
                          </>}
                          {a.status === 'APPROVED' && (
                            <button className="danger" disabled={busy} onClick={() => decide(a.id, 'REJECTED')}>Revoke</button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {tab === 'attendance' && (
        <div className="card">
          <h3 style={{ marginBottom: 4 }}>Attendance &amp; Hours</h3>
          <p className="muted" style={{ marginBottom: 14 }}>
            Only approved volunteers appear here. Record a check-in/check-out window then verify the
            hours — verified hours are what count towards a volunteer&apos;s record.
          </p>

          {sheet.summary && (
            <div className="profile-stats" style={{ marginBottom: 18 }}>
              <div className="stat"><div className="num">{sheet.summary.approved}</div><div className="lbl">Approved</div></div>
              <div className="stat"><div className="num">{sheet.summary.marked}</div><div className="lbl">Marked</div></div>
              <div className="stat"><div className="num">{sheet.summary.verified}</div><div className="lbl">Verified</div></div>
              <div className="stat"><div className="num">{fmtHours(sheet.summary.total_hours)}</div><div className="lbl">Total Hours</div></div>
            </div>
          )}

          {sheet.rows.length === 0 && (
            <p className="muted">
              No approved volunteers yet. Approve applications on the Roles &amp; Applications tab first.
            </p>
          )}

          {sheet.rows.length > 0 && (
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Volunteer</th><th>Role</th><th>Check-in / Check-out</th>
                    <th>Hours</th><th>State</th><th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {sheet.rows.map(row => {
                    const d = draft[row.application_id] || {};
                    return (
                      <tr key={row.application_id}>
                        <td>
                          <UserChip id={row.volunteer_id} name={row.full_name}
                            url={row.profile_picture_url} size={32} />
                        </td>
                        <td>{row.role_name}</td>
                        <td>
                          <div className="cell-stack">
                            <input className="cell-input" type="datetime-local" value={d.check_in || ''}
                              onChange={e => setDraftField(row.application_id, 'check_in', e.target.value)} />
                            <input className="cell-input" type="datetime-local" value={d.check_out || ''}
                              onChange={e => setDraftField(row.application_id, 'check_out', e.target.value)} />
                          </div>
                        </td>
                        <td>
                          <input className="cell-input" type="number" min="0" step="0.25"
                            style={{ width: 90 }} value={d.hours ?? ''}
                            placeholder="auto"
                            onChange={e => setDraftField(row.application_id, 'hours', e.target.value)} />
                        </td>
                        <td>
                          {stateBadge(row)}
                          {row.verified_at && (
                            <div><small className="muted">
                              {fmtHours(row.hours_logged)} h by {row.verified_by_name}
                            </small></div>
                          )}
                        </td>
                        <td>
                          <div className="row-actions">
                            <select className="cell-input" style={{ width: 118 }}
                              value={row.status || ''} disabled={busy}
                              onChange={e => mark(row, e.target.value)}>
                              <option value="" disabled>Mark…</option>
                              {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                            {/* Re-picking the same status fires no onChange. */}
                            <button className="secondary" disabled={busy}
                              onClick={() => mark(row, row.status || 'PRESENT')}>
                              Save times
                            </button>
                            <button disabled={busy || row.status === 'ABSENT' || row.status === 'EXCUSED'}
                              onClick={() => verify(row)}>
                              {row.verified_at ? 'Re-verify' : 'Verify Hours'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </>
  );
}
