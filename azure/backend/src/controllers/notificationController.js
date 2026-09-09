const pool = require('../db/pool');

// The bell polls this every 60s, so it is capped rather than unbounded.
const PAGE_SIZE = 30;

// GET /api/notifications — the caller's own notifications, newest first.
// unread_count is returned alongside the rows so the bell needs one request per
// poll instead of two.
exports.list = async (req, res, next) => {
  try {
    const { rows } = await pool.query(`
      SELECT id, title, message, type, is_read, created_at
        FROM notifications
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT $2`, [req.user.sub, PAGE_SIZE]);

    const { rows: counts } = await pool.query(
      `SELECT COUNT(*)::int AS unread FROM notifications
        WHERE user_id = $1 AND is_read = FALSE`, [req.user.sub]);

    res.json({ unread_count: counts[0].unread, notifications: rows });
  } catch (e) { next(e); }
};

// PUT /api/notifications/:id/read
// user_id in the WHERE clause is the authorisation check: without it any
// authenticated volunteer could mark someone else's notification read.
exports.markRead = async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `UPDATE notifications SET is_read = TRUE
        WHERE id = $1 AND user_id = $2
        RETURNING id, is_read`, [req.params.id, req.user.sub]);
    if (!rows[0]) return res.status(404).json({ error: 'Notification not found' });
    res.json(rows[0]);
  } catch (e) { next(e); }
};

// PUT /api/notifications/read-all
exports.markAllRead = async (req, res, next) => {
  try {
    const { rowCount } = await pool.query(
      `UPDATE notifications SET is_read = TRUE
        WHERE user_id = $1 AND is_read = FALSE`, [req.user.sub]);
    res.json({ updated: rowCount });
  } catch (e) { next(e); }
};
