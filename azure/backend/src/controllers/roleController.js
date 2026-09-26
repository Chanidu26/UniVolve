const pool = require('../db/pool');
const { sendNewOpportunityEmail } = require('../services/emailService');

exports.create = async (req, res) => {
  const { role_name, description, total_slots } = req.body;
  const { rows } = await pool.query(
    `INSERT INTO event_roles (event_id, role_name, description, total_slots)
     VALUES ($1,$2,$3,$4) RETURNING *`,
    [req.params.id, role_name, description, total_slots]);
  const role = rows[0];

  const { rows: event } = await pool.query('SELECT title, event_date FROM events WHERE id=$1', [req.params.id]);
  const { rows: volunteers } = await pool.query(`SELECT email FROM users WHERE system_role='VOLUNTEER'`);
  volunteers.forEach(v => sendNewOpportunityEmail(v.email, event[0].title, role.role_name, event[0].event_date));

  res.status(201).json(role);
};

exports.update = async (req, res) => {
  const { role_name, description, total_slots } = req.body;
  const { rows } = await pool.query(
    `UPDATE event_roles SET role_name=COALESCE($1,role_name),
     description=COALESCE($2,description), total_slots=COALESCE($3,total_slots)
     WHERE id=$4 RETURNING *`, [role_name, description, total_slots, req.params.roleId]);
  res.json(rows[0]);
};

exports.remove = async (req, res) => {
  await pool.query('DELETE FROM event_roles WHERE id=$1', [req.params.roleId]);
  res.status(204).end();
};
