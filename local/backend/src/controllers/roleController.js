const pool = require('../db/pool');

// Backs the Volunteer Roles table in ManageEvent.jsx.
exports.list = async (req, res, next) => {
  try {
    const { rows } = await pool.query(`
      SELECT r.id, r.role_name, r.description, r.total_slots, r.filled_slots, r.created_at,
             (SELECT COUNT(*) FROM applications a WHERE a.event_role_id = r.id)::int
               AS application_count
        FROM event_roles r
       WHERE r.event_id = $1
       ORDER BY r.created_at`, [req.params.id]);
    res.json(rows);
  } catch (e) { next(e); }
};

exports.create = async (req, res, next) => {
  try {
    const { role_name, description, total_slots } = req.body;
    if (!role_name || !String(role_name).trim()) {
      return res.status(400).json({ error: 'role_name is required' });
    }
    const slots = Number(total_slots);
    if (!Number.isInteger(slots) || slots < 1) {
      return res.status(400).json({ error: 'total_slots must be a positive whole number' });
    }
    const { rows } = await pool.query(
      `INSERT INTO event_roles (event_id, role_name, description, total_slots)
       VALUES ($1,$2,$3,$4) RETURNING *`,
      [req.params.id, role_name.trim(), description, slots]);
    res.status(201).json(rows[0]);
  } catch (e) {
    if (e.code === '23505') {
      return res.status(409).json({ error: 'A role with that name already exists for this event' });
    }
    next(e);
  }
};

exports.update = async (req, res, next) => {
  try {
    const { role_name, description, total_slots } = req.body;
    let slots = null;
    if (total_slots !== undefined && total_slots !== null && total_slots !== '') {
      slots = Number(total_slots);
      if (!Number.isInteger(slots) || slots < 1) {
        return res.status(400).json({ error: 'total_slots must be a positive whole number' });
      }
      // Without this the table CHECK (filled_slots <= total_slots) fails as a 500.
      const { rows: cur } = await pool.query(
        'SELECT filled_slots FROM event_roles WHERE id=$1', [req.params.roleId]);
      if (!cur[0]) return res.status(404).json({ error: 'Role not found' });
      if (slots < cur[0].filled_slots) {
        return res.status(409).json({
          error: `Cannot reduce slots to ${slots} — ${cur[0].filled_slots} volunteer(s) are already approved for this role`,
        });
      }
    }

    const { rows } = await pool.query(
      `UPDATE event_roles SET role_name=COALESCE($1,role_name),
       description=COALESCE($2,description), total_slots=COALESCE($3,total_slots)
       WHERE id=$4 RETURNING *`,
      [role_name ? role_name.trim() : null, description, slots, req.params.roleId]);
    if (!rows[0]) return res.status(404).json({ error: 'Role not found' });
    res.json(rows[0]);
  } catch (e) {
    if (e.code === '23505') {
      return res.status(409).json({ error: 'A role with that name already exists for this event' });
    }
    next(e);
  }
};

exports.remove = async (req, res, next) => {
  try {
    // applications cascade off event_roles, so deleting a role with applicants
    // would silently destroy their applications. Refuse instead.
    const { rows } = await pool.query(
      `SELECT (SELECT COUNT(*) FROM applications a WHERE a.event_role_id = r.id)::int AS application_count
         FROM event_roles r WHERE r.id = $1`, [req.params.roleId]);
    if (!rows[0]) return res.status(404).json({ error: 'Role not found' });
    if (rows[0].application_count > 0) {
      return res.status(409).json({
        error: `Cannot delete a role with ${rows[0].application_count} application(s). Reject them first.`,
      });
    }
    await pool.query('DELETE FROM event_roles WHERE id=$1', [req.params.roleId]);
    res.status(204).end();
  } catch (e) { next(e); }
};
