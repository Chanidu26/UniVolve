const pool = require('../db/pool');

const PROFILE_COLS = 'id, email, full_name, system_role, bio, skills, portfolio_links, profile_picture_url, created_at';

const toArray = (val) => {
  if (!val) return [];
  if (Array.isArray(val)) return val;
  return val.split(',').map(s => s.trim()).filter(Boolean);
};

exports.register = (req, res) => res.status(400).json({ error: 'Registration is handled by Azure AD B2C' });
exports.login = (req, res) => res.status(400).json({ error: 'Login is handled by Azure AD B2C' });

exports.me = async (req, res) => {
  const { rows } = await pool.query(`SELECT ${PROFILE_COLS} FROM users WHERE id=$1`, [req.user.sub]);
  res.json(rows[0]);
};

exports.viewProfile = async (req, res) => {
  const { rows } = await pool.query(`SELECT ${PROFILE_COLS} FROM users WHERE id=$1`, [req.params.userId]);
  if (!rows[0]) return res.status(404).json({ error: 'User not found' });
  res.json(rows[0]);
};

exports.updateProfile = async (req, res) => {
  const { full_name, bio, skills, portfolio_links, profile_picture_url } = req.body;
  const { rows } = await pool.query(
    `UPDATE users SET
       full_name = COALESCE($1, full_name),
       bio = COALESCE($2, bio),
       skills = COALESCE($3, skills),
       portfolio_links = COALESCE($4, portfolio_links),
       profile_picture_url = COALESCE($5, profile_picture_url)
     WHERE id=$6 RETURNING ${PROFILE_COLS}`,
    [full_name || null, bio || null,
     skills != null ? toArray(skills) : null,
     portfolio_links != null ? toArray(portfolio_links) : null,
     profile_picture_url || null,
     req.user.sub]);
  res.json(rows[0]);
};

exports.listVolunteers = async (req, res) => {
  const { rows } = await pool.query(
    `SELECT id, email, full_name, bio, skills, profile_picture_url
     FROM users WHERE system_role = 'VOLUNTEER' ORDER BY full_name ASC`);
  res.json(rows);
};
