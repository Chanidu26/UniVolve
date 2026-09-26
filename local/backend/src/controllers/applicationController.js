const pool = require('../db/pool');
const { sendStatusEmail, sendInvitationEmail } = require('../services/emailService');

// Volunteer applies (hasAvailableSlot + isDuplicate enforced)
exports.apply = async (req, res) => {
  const { event_role_id } = req.body;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: cap } = await client.query(
      `SELECT total_slots, filled_slots FROM event_roles WHERE id=$1 FOR UPDATE`, [event_role_id]);
    if (!cap[0]) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Role not found' }); }
    if (cap[0].filled_slots >= cap[0].total_slots) {
      await client.query('ROLLBACK'); return res.status(409).json({ error: 'Role is full' });
    }
    const { rows } = await client.query(
      `INSERT INTO applications (event_role_id, volunteer_id) VALUES ($1,$2) RETURNING *`,
      [event_role_id, req.user.sub]);
    await client.query('COMMIT');
    res.status(201).json(rows[0]);
  } catch (e) {
    await client.query('ROLLBACK');
    if (e.code === '23505') return res.status(409).json({ error: 'Already applied to this role' });
    throw e;
  } finally { client.release(); }
};

// Organizer/admin: invite a specific volunteer to a role
exports.invite = async (req, res) => {
  const { volunteer_id } = req.body;
  if (!volunteer_id) return res.status(400).json({ error: 'volunteer_id required' });
  try {
    const { rows } = await pool.query(
      `INSERT INTO applications (event_role_id, volunteer_id, status, origin)
       VALUES ($1,$2,'INVITED','INVITE')
       RETURNING *, (SELECT title FROM events e JOIN event_roles r ON r.event_id=e.id WHERE r.id=applications.event_role_id) AS event_title,
         (SELECT role_name FROM event_roles WHERE id=applications.event_role_id) AS role_name,
         (SELECT email FROM users WHERE id=applications.volunteer_id) AS volunteer_email`,
      [req.params.roleId, volunteer_id]);
    const a = rows[0];
    sendInvitationEmail(a.volunteer_email, a.event_title, a.role_name);
    res.status(201).json(a);
  } catch (e) {
    if (e.code === '23505') return res.status(409).json({ error: 'Volunteer already invited or applied to this role' });
    throw e;
  }
};

// Volunteer: accept or decline an invitation
exports.respond = async (req, res) => {
  const { response } = req.body; // ACCEPTED | DECLINED
  if (!['ACCEPTED', 'DECLINED'].includes(response)) return res.status(400).json({ error: 'Invalid response' });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: cur } = await client.query(
      `SELECT a.*, r.total_slots, r.filled_slots FROM applications a
       JOIN event_roles r ON r.id = a.event_role_id
       WHERE a.id=$1 FOR UPDATE`, [req.params.appId]);
    const app = cur[0];
    if (!app) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Invitation not found' }); }
    if (app.volunteer_id !== req.user.sub) { await client.query('ROLLBACK'); return res.status(403).json({ error: 'Not your invitation' }); }
    if (app.status !== 'INVITED') { await client.query('ROLLBACK'); return res.status(409).json({ error: 'Invitation already responded to' }); }

    if (response === 'ACCEPTED') {
      if (app.filled_slots >= app.total_slots) {
        await client.query('ROLLBACK'); return res.status(409).json({ error: 'Role is full' });
      }
      await client.query('UPDATE event_roles SET filled_slots = filled_slots + 1 WHERE id=$1', [app.event_role_id]);
    }
    const newStatus = response === 'ACCEPTED' ? 'APPROVED' : 'REJECTED';
    const { rows } = await client.query(
      `UPDATE applications SET status=$1, decided_at=NOW() WHERE id=$2 RETURNING *`,
      [newStatus, req.params.appId]);
    await client.query('COMMIT');
    res.json(rows[0]);
  } catch (e) { await client.query('ROLLBACK'); throw e; } finally { client.release(); }
};

// Volunteer dashboard (viewMyApplications)
exports.mine = async (req, res) => {
  const { rows } = await pool.query(`
    SELECT a.id, a.status, a.applied_at, a.decided_at, r.role_name,
           e.title AS event_title, e.event_date, e.location
    FROM applications a
    JOIN event_roles r ON r.id = a.event_role_id
    JOIN events e ON e.id = r.event_id
    WHERE a.volunteer_id=$1 ORDER BY a.applied_at DESC`, [req.user.sub]);
  res.json(rows);
};

// Organizer: list applications (includes volunteer profile info)
exports.listForEvent = async (req, res) => {
  const { rows } = await pool.query(`
    SELECT a.id, a.status, a.applied_at, a.decided_at, r.role_name,
           u.id AS volunteer_id, u.full_name, u.email, u.skills, u.bio, u.profile_picture_url
    FROM applications a
    JOIN event_roles r ON r.id = a.event_role_id
    JOIN users u ON u.id = a.volunteer_id
    WHERE r.event_id=$1 ORDER BY a.applied_at`, [req.params.id]);
  res.json(rows);
};

// approve()/reject() — updates filled_slots (reserveSlot/releaseSlot) + decided_at, sends email
exports.decide = async (req, res) => {
  const { status } = req.body; // APPROVED | REJECTED
  if (!['APPROVED', 'REJECTED'].includes(status)) return res.status(400).json({ error: 'Invalid status' });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: cur } = await client.query(
      `SELECT a.*, r.total_slots, r.filled_slots FROM applications a
       JOIN event_roles r ON r.id = a.event_role_id
       WHERE a.id=$1 FOR UPDATE`, [req.params.appId]);
    if (!cur[0]) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Application not found' }); }
    const app = cur[0];

    if (status === 'APPROVED' && app.status !== 'APPROVED') {
      if (app.filled_slots >= app.total_slots) {
        await client.query('ROLLBACK'); return res.status(409).json({ error: 'Role is full' });
      }
      await client.query('UPDATE event_roles SET filled_slots = filled_slots + 1 WHERE id=$1', [app.event_role_id]); // reserveSlot()
    }
    if (status === 'REJECTED' && app.status === 'APPROVED') {
      await client.query('UPDATE event_roles SET filled_slots = filled_slots - 1 WHERE id=$1', [app.event_role_id]); // releaseSlot()
    }

    const { rows } = await client.query(`
      UPDATE applications SET status=$1, decided_at=NOW() WHERE id=$2
      RETURNING *, (SELECT email FROM users WHERE id=applications.volunteer_id) AS volunteer_email,
        (SELECT role_name FROM event_roles WHERE id=applications.event_role_id) AS role_name,
        (SELECT title FROM events e JOIN event_roles r ON r.event_id=e.id WHERE r.id=applications.event_role_id) AS event_title`,
      [status, req.params.appId]);
    await client.query('COMMIT');
    const a = rows[0];
    sendStatusEmail(a.volunteer_email, a.event_title, a.role_name, status); // FR-08
    res.json(a);
  } catch (e) { await client.query('ROLLBACK'); throw e; } finally { client.release(); }
};
