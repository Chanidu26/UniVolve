const pool = require('../db/pool');
const { asyncWrap } = require('../middleware/errorHandler');

const STATUSES = ['PRESENT', 'ABSENT', 'EXCUSED'];

// hours_logged is NUMERIC(5,2); reject beyond it rather than letting Postgres
// raise a numeric overflow that surfaces as a 500.
const MAX_HOURS = 999.99;

// Canonical definition of "verified hours". Member 4's analytics must use the
// same predicate or the admin totals and the volunteer dashboard will disagree.
const VERIFIED_HOURS = `status = 'PRESENT' AND verified_at IS NOT NULL`;

const computeHours = (checkIn, checkOut) => {
  if (!checkIn || !checkOut) return null;
  const ms = new Date(checkOut).getTime() - new Date(checkIn).getTime();
  if (!Number.isFinite(ms) || ms <= 0) return 0;
  return Math.round((ms / 3600000) * 100) / 100;
};

const isValidDate = (v) => v == null || v === '' || !Number.isNaN(new Date(v).getTime());

// Scoping the lookup to the event is what stops an organizer from marking
// attendance on another event by passing a foreign application_id.
async function loadApplication(eventId, applicationId) {
  const { rows } = await pool.query(
    `SELECT a.id, a.status, a.volunteer_id, r.event_id
       FROM applications a
       JOIN event_roles r ON r.id = a.event_role_id
      WHERE a.id = $1 AND r.event_id = $2`,
    [applicationId, eventId]);
  return rows[0] || null;
}

async function resolveTarget(req, res) {
  const { application_id } = req.body;
  if (!application_id) {
    res.status(400).json({ error: 'application_id is required' });
    return null;
  }
  const app = await loadApplication(req.params.id, application_id);
  if (!app) {
    res.status(404).json({ error: 'Application not found for this event' });
    return null;
  }
  if (app.status !== 'APPROVED') {
    res.status(409).json({ error: 'Attendance can only be recorded for approved volunteers' });
    return null;
  }
  return app;
}

// POST /api/events/:id/attendance/mark
// Hours rules: a complete check-in/out window recomputes hours and clears
// verification (the numbers changed, so they need confirming again);
// ABSENT/EXCUSED zeroes hours and clears times; otherwise hours are untouched.
exports.mark = asyncWrap(async (req, res, next) => {
  try {
    const { status, check_in_time, check_out_time } = req.body;
    if (!STATUSES.includes(status)) {
      return res.status(400).json({ error: `status must be one of ${STATUSES.join(', ')}` });
    }
    if (!isValidDate(check_in_time) || !isValidDate(check_out_time)) {
      return res.status(400).json({ error: 'check_in_time / check_out_time must be valid timestamps' });
    }

    const app = await resolveTarget(req, res);
    if (!app) return;

    const present = status === 'PRESENT';
    const checkIn = present ? (check_in_time || null) : null;
    const checkOut = present ? (check_out_time || null) : null;
    if (checkIn && checkOut && new Date(checkOut) < new Date(checkIn)) {
      return res.status(400).json({ error: 'check_out_time cannot be before check_in_time' });
    }

    const derived = present ? computeHours(checkIn, checkOut) : null;

    const { rows } = await pool.query(`
      INSERT INTO attendance
        (application_id, event_id, volunteer_id, status, check_in_time, check_out_time, hours_logged)
      VALUES ($1, $2, $3, $4, $5, $6, COALESCE($7::numeric, 0))
      ON CONFLICT (application_id) DO UPDATE SET
        status         = EXCLUDED.status,
        check_in_time  = EXCLUDED.check_in_time,
        check_out_time = EXCLUDED.check_out_time,
        hours_logged   = CASE
                           WHEN $7::numeric IS NOT NULL THEN $7::numeric
                           WHEN EXCLUDED.status <> 'PRESENT' THEN 0
                           ELSE attendance.hours_logged
                         END,
        verified_by    = CASE
                           WHEN $7::numeric IS NOT NULL OR EXCLUDED.status <> 'PRESENT'
                           THEN NULL ELSE attendance.verified_by
                         END,
        verified_at    = CASE
                           WHEN $7::numeric IS NOT NULL OR EXCLUDED.status <> 'PRESENT'
                           THEN NULL ELSE attendance.verified_at
                         END,
        updated_at     = NOW()
      RETURNING *`,
      [app.id, req.params.id, app.volunteer_id, status, checkIn, checkOut, derived]);

    res.json(rows[0]);
  } catch (e) { next(e); }
});

// POST /api/events/:id/attendance/hours
// hours_logged may be given explicitly, otherwise it is derived from the stored
// check-in/check-out window.
exports.verifyHours = asyncWrap(async (req, res, next) => {
  try {
    const { hours_logged } = req.body;
    const app = await resolveTarget(req, res);
    if (!app) return;

    const { rows: existing } = await pool.query(
      'SELECT * FROM attendance WHERE application_id = $1', [app.id]);
    const row = existing[0];

    if (row && row.status !== 'PRESENT') {
      return res.status(409).json({
        error: `Cannot verify hours for a volunteer marked ${row.status}`,
      });
    }

    let hours;
    if (hours_logged !== undefined && hours_logged !== null && hours_logged !== '') {
      hours = Number(hours_logged);
      if (!Number.isFinite(hours) || hours < 0) {
        return res.status(400).json({ error: 'hours_logged must be a non-negative number' });
      }
      if (hours > MAX_HOURS) {
        return res.status(400).json({ error: `hours_logged cannot exceed ${MAX_HOURS}` });
      }
      hours = Math.round(hours * 100) / 100;
    } else {
      hours = computeHours(row?.check_in_time, row?.check_out_time);
      if (hours === null) {
        return res.status(400).json({
          error: 'Provide hours_logged, or record both check-in and check-out times first',
        });
      }
    }

    const { rows } = await pool.query(`
      INSERT INTO attendance
        (application_id, event_id, volunteer_id, status, hours_logged, verified_by, verified_at)
      VALUES ($1, $2, $3, 'PRESENT', $4, $5, NOW())
      ON CONFLICT (application_id) DO UPDATE SET
        status       = 'PRESENT',
        hours_logged = EXCLUDED.hours_logged,
        verified_by  = EXCLUDED.verified_by,
        verified_at  = NOW(),
        updated_at   = NOW()
      RETURNING *`,
      [app.id, req.params.id, app.volunteer_id, hours, req.user.sub]);

    res.json(rows[0]);
  } catch (e) { next(e); }
});

// GET /api/events/:id/attendance — every approved volunteer, LEFT JOINed to
// their attendance row so unmarked volunteers still appear.
exports.sheet = asyncWrap(async (req, res, next) => {
  try {
    const { rows } = await pool.query(`
      SELECT a.id                    AS application_id,
             u.id                    AS volunteer_id,
             u.full_name, u.email, u.profile_picture_url,
             r.role_name,
             att.id                  AS attendance_id,
             att.status, att.check_in_time, att.check_out_time,
             att.hours_logged, att.verified_at,
             v.full_name             AS verified_by_name
        FROM applications a
        JOIN event_roles r ON r.id = a.event_role_id
        JOIN users u       ON u.id = a.volunteer_id
        LEFT JOIN attendance att ON att.application_id = a.id
        LEFT JOIN users v        ON v.id = att.verified_by
       WHERE r.event_id = $1 AND a.status = 'APPROVED'
       ORDER BY r.role_name, u.full_name`, [req.params.id]);

    const verified = rows.filter(r => r.status === 'PRESENT' && r.verified_at);
    res.json({
      summary: {
        approved: rows.length,
        marked: rows.filter(r => r.status).length,
        verified: verified.length,
        total_hours: Number(verified.reduce((s, r) => s + Number(r.hours_logged || 0), 0).toFixed(2)),
      },
      rows,
    });
  } catch (e) { next(e); }
});

// GET /api/users/me/hours — the volunteer's own verified-hours dashboard.
exports.myHours = asyncWrap(async (req, res, next) => {
  try {
    // COUNT(DISTINCT event_id), not COUNT(*): a volunteer can hold two roles in
    // the same event, which is two attendance rows but one event attended.
    const { rows: totals } = await pool.query(`
      SELECT COALESCE(SUM(hours_logged), 0)                          AS total_hours,
             COUNT(DISTINCT event_id)                                AS events_attended,
             (SELECT COUNT(*) FROM attendance
               WHERE volunteer_id = $1 AND status = 'PRESENT' AND verified_at IS NULL)
                                                                      AS pending_verification
        FROM attendance
       WHERE volunteer_id = $1 AND ${VERIFIED_HOURS}`, [req.user.sub]);

    const { rows: history } = await pool.query(`
      SELECT att.id, att.status, att.hours_logged, att.check_in_time, att.check_out_time,
              att.verified_at,
             e.id AS event_id, e.title AS event_title, e.event_date, e.location,
             r.role_name
        FROM attendance att
        JOIN applications a  ON a.id = att.application_id
        JOIN event_roles r   ON r.id = a.event_role_id
        JOIN events e        ON e.id = att.event_id
       WHERE att.volunteer_id = $1
       ORDER BY e.event_date DESC`, [req.user.sub]);

    res.json({
      total_hours: Number(totals[0].total_hours),
      events_attended: Number(totals[0].events_attended),
      pending_verification: Number(totals[0].pending_verification),
      history,
    });
  } catch (e) { next(e); }
});
