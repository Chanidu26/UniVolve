const pool = require('../db/pool');

exports.checkAttendance = async (req, res) => {
  const { event_id, code, action } = req.body;
  if (!event_id || !code || !['check-in', 'check-out'].includes(action)) {
    return res.status(400).json({ error: 'event_id, code, and action are required' });
  }

  const { rows: applications } = await pool.query(`
    SELECT a.id AS application_id, e.attendance_code
    FROM applications a
    JOIN event_roles r ON r.id = a.event_role_id
    JOIN events e ON e.id = r.event_id
    WHERE e.id=$1 AND a.volunteer_id=$2 AND a.status='APPROVED'`, [event_id, req.user.sub]);
  const application = applications[0];
  if (!application || application.attendance_code !== code) {
    return res.status(403).json({ error: 'Invalid attendance code or approved application required' });
  }

  const column = action === 'check-in' ? 'check_in_at' : 'check_out_at';
  const { rows } = await pool.query(`
    INSERT INTO attendance (application_id, ${column}) VALUES ($1, NOW())
    ON CONFLICT (application_id) DO UPDATE SET ${column}=COALESCE(attendance.${column}, NOW())
    RETURNING id, application_id, check_in_at, check_out_at`, [application.application_id]);
  res.json(rows[0]);
};

exports.mineAttendance = async (req, res) => {
  const { rows } = await pool.query(`
    SELECT ap.id, a.check_in_at, a.check_out_at, e.id AS event_id, e.title, e.event_date,
      e.location, r.role_name,
      CASE WHEN a.check_in_at IS NOT NULL AND a.check_out_at IS NOT NULL
        THEN ROUND(EXTRACT(EPOCH FROM (a.check_out_at - a.check_in_at)) / 3600.0, 2)
        ELSE 0 END AS hours
    FROM applications ap
    LEFT JOIN attendance a ON a.application_id=ap.id
    JOIN event_roles r ON r.id=ap.event_role_id
    JOIN events e ON e.id=r.event_id
    WHERE ap.volunteer_id=$1 AND ap.status='APPROVED' ORDER BY e.event_date DESC`, [req.user.sub]);
  res.json(rows);
};

exports.feedback = async (req, res) => {
  const { rating, comment } = req.body;
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return res.status(400).json({ error: 'rating must be an integer from 1 to 5' });
  }
  const { rows: attended } = await pool.query(`
    SELECT 1 FROM attendance a
    JOIN applications ap ON ap.id=a.application_id
    JOIN event_roles r ON r.id=ap.event_role_id
    WHERE r.event_id=$1 AND ap.volunteer_id=$2 AND a.check_out_at IS NOT NULL`,
  [req.params.eventId, req.user.sub]);
  if (!attended[0]) return res.status(403).json({ error: 'Check out before leaving feedback' });
  const { rows } = await pool.query(`
    INSERT INTO event_feedback (event_id, volunteer_id, rating, comment)
    VALUES ($1,$2,$3,$4)
    ON CONFLICT (event_id, volunteer_id) DO UPDATE SET rating=EXCLUDED.rating, comment=EXCLUDED.comment
    RETURNING *`, [req.params.eventId, req.user.sub, rating, comment || null]);
  res.status(201).json(rows[0]);
};

exports.endorseSkill = async (req, res) => {
  const { skill } = req.body;
  if (!skill || !skill.trim()) return res.status(400).json({ error: 'skill is required' });
  const { rows } = await pool.query(`
    INSERT INTO skill_endorsements (volunteer_id, organizer_id, event_id, skill)
    VALUES ($1,$2,$3,$4) ON CONFLICT DO NOTHING RETURNING *`,
  [req.params.userId, req.user.sub, req.params.eventId, skill.trim()]);
  res.status(201).json(rows[0] || { message: 'Skill already endorsed' });
};

exports.profileStats = async (req, res) => {
  const { rows } = await pool.query(`
    SELECT u.id, u.full_name, u.email, u.bio, u.skills, u.portfolio_links, u.profile_picture_url,
      COUNT(DISTINCT CASE WHEN ap.status='APPROVED' AND a.check_out_at IS NOT NULL THEN e.id END)::int AS completed_events,
      COALESCE(ROUND(SUM(CASE WHEN a.check_in_at IS NOT NULL AND a.check_out_at IS NOT NULL
        THEN EXTRACT(EPOCH FROM (a.check_out_at-a.check_in_at))/3600.0 ELSE 0 END)::numeric, 2), 0) AS volunteer_hours,
      COALESCE((SELECT json_agg(se ORDER BY se.created_at DESC) FROM skill_endorsements se WHERE se.volunteer_id=u.id), '[]') AS endorsements
    FROM users u
    LEFT JOIN applications ap ON ap.volunteer_id=u.id
    LEFT JOIN attendance a ON a.application_id=ap.id
    LEFT JOIN event_roles r ON r.id=ap.event_role_id
    LEFT JOIN events e ON e.id=r.event_id
    WHERE u.id=$1 GROUP BY u.id`, [req.params.userId]);
  if (!rows[0]) return res.status(404).json({ error: 'User not found' });
  res.json(rows[0]);
};

exports.adminStats = async (req, res) => {
  const { rows } = await pool.query(`
    SELECT
      (SELECT COUNT(*)::int FROM users WHERE system_role='VOLUNTEER') AS volunteers,
      (SELECT COUNT(*)::int FROM events) AS events,
      (SELECT COUNT(*)::int FROM events WHERE status='PUBLISHED') AS published_events,
      (SELECT COUNT(*)::int FROM applications WHERE status='PENDING') AS pending_applications,
      (SELECT COUNT(*)::int FROM attendance WHERE check_out_at IS NOT NULL) AS completed_attendance,
      (SELECT COALESCE(ROUND(SUM(EXTRACT(EPOCH FROM (check_out_at-check_in_at))/3600.0)::numeric, 2), 0) FROM attendance WHERE check_in_at IS NOT NULL AND check_out_at IS NOT NULL) AS volunteer_hours`);
  res.json(rows[0]);
};

exports.listRecommendations = async (req, res) => {
  const { rows } = await pool.query(`
    SELECT r.id, r.text, r.created_at, u.id AS recommender_id, u.full_name AS recommender_name,
      u.profile_picture_url AS recommender_picture
    FROM recommendations r JOIN users u ON u.id=r.recommender_user_id
    WHERE r.recommended_user_id=$1 ORDER BY r.created_at DESC`, [req.params.userId]);
  res.json(rows);
};

exports.createRecommendation = async (req, res) => {
  const text = String(req.body.text || '').trim();
  if (req.params.userId === req.user.sub) return res.status(400).json({ error: 'You cannot recommend yourself' });
  if (text.length < 10 || text.length > 1000) return res.status(400).json({ error: 'Recommendation must be 10 to 1000 characters' });
  try {
    const { rows } = await pool.query(`
      INSERT INTO recommendations (recommended_user_id, recommender_user_id, text)
      VALUES ($1,$2,$3) RETURNING *`, [req.params.userId, req.user.sub, text]);
    res.status(201).json(rows[0]);
  } catch (e) {
    if (e.code === '23505') return res.status(409).json({ error: 'You have already recommended this user' });
    if (e.code === '23503') return res.status(404).json({ error: 'User not found' });
    throw e;
  }
};