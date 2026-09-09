const crypto = require('crypto');
const pool = require('../db/pool');
const { notify, TYPES } = require('../services/notificationService');

// Same predicate as attendanceController's VERIFIED_HOURS. If these two drift,
// a volunteer's profile total and their certificates disagree.
const VERIFIED_HOURS = `att.status = 'PRESENT' AND att.verified_at IS NOT NULL`;

// 64 bits of randomness, uppercased for printing. Never sequential: this code is
// the only thing standing between a stranger and the public verify endpoint.
const newCode = () => `UV-${crypto.randomBytes(8).toString('hex').toUpperCase()}`;

// Issue certificates the volunteer has become eligible for since last time.
//
// Eligibility: the event is CLOSED and the volunteer has verified hours > 0 in
// it. There is no scheduler in this architecture, so issuance is lazy — it runs
// when the volunteer opens their certificates page. Member 1's auto-CLOSE job is
// what makes past events eligible; until it lands, an admin closing the event
// manually has the same effect.
async function issueEligible(userId) {
  const { rows: eligible } = await pool.query(`
    SELECT att.event_id,
           SUM(att.hours_logged) AS total_hours
      FROM attendance att
      JOIN events e ON e.id = att.event_id
     WHERE att.volunteer_id = $1
       AND e.status = 'CLOSED'
       AND ${VERIFIED_HOURS}
     GROUP BY att.event_id
    HAVING SUM(att.hours_logged) > 0`, [userId]);

  let issued = 0;
  for (const row of eligible) {
    // An organizer can correct hours after the certificate was issued, which
    // would otherwise leave a printed certificate contradicting the profile
    // total. The code and issue date stay put; only the number is realigned.
    // On a first-time certificate this simply matches nothing.
    await pool.query(`
      UPDATE certificates SET total_hours = $3
       WHERE user_id = $1 AND event_id = $2 AND total_hours IS DISTINCT FROM $3`,
      [userId, row.event_id, row.total_hours]);

    // ON CONFLICT is what makes re-opening the page a no-op: an already-issued
    // event returns no row, so it is neither re-coded nor re-notified. It also
    // settles the race where two tabs load this at the same moment.
    const { rows } = await pool.query(`
      INSERT INTO certificates (user_id, event_id, certificate_code, total_hours)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (user_id, event_id) DO NOTHING
      RETURNING id`,
      [userId, row.event_id, newCode(), row.total_hours]);

    if (!rows[0]) continue;
    issued++;

    const { rows: ev } = await pool.query('SELECT title FROM events WHERE id = $1', [row.event_id]);
    await notify(
      userId,
      TYPES.CERTIFICATE_ISSUED,
      'Certificate issued 🎓',
      `Your certificate for "${ev[0]?.title || 'an event'}" is ready — ` +
      `${Number(row.total_hours).toFixed(2)} verified hours.`);
  }
  return issued;
}

// GET /api/certificates/mine
exports.mine = async (req, res, next) => {
  try {
    await issueEligible(req.user.sub);

    const { rows } = await pool.query(`
      SELECT c.id, c.certificate_code, c.total_hours, c.issued_at,
             e.id AS event_id, e.title AS event_title, e.event_date, e.location,
             u.full_name AS volunteer_name
        FROM certificates c
        JOIN events e ON e.id = c.event_id
        JOIN users  u ON u.id = c.user_id
       WHERE c.user_id = $1
       ORDER BY c.issued_at DESC`, [req.user.sub]);

    res.json(rows);
  } catch (e) { next(e); }
};

// GET /api/certificates/verify/:code — THE ONLY PUBLIC ROUTE IN THIS API.
//
// Mounted without `authenticate` in routes/certificates.js so an employer can
// check a printed code. It therefore returns the minimum a verifier needs:
// volunteer name, event title, hours, issue date. No email, no user id, no event
// id, no certificate row id. Flagged to Member 6 for a dedicated no-PII test,
// and to Member 1 so the APIM validate-jwt policy exempts this path.
//
// An unknown code answers 200 {valid:false} rather than 404: the lookup itself
// succeeded, and a uniform response shape keeps the client simple.
exports.verify = async (req, res, next) => {
  try {
    const code = String(req.params.code || '').trim().toUpperCase();

    const { rows } = await pool.query(`
      SELECT u.full_name AS volunteer_name,
             e.title     AS event_title,
             e.event_date,
             c.total_hours,
             c.issued_at
        FROM certificates c
        JOIN users  u ON u.id = c.user_id
        JOIN events e ON e.id = c.event_id
       WHERE c.certificate_code = $1`, [code]);

    if (!rows[0]) return res.json({ valid: false });

    const c = rows[0];
    res.json({
      valid: true,
      volunteer_name: c.volunteer_name,
      event_title: c.event_title,
      event_date: c.event_date,
      total_hours: Number(c.total_hours),
      issued_at: c.issued_at,
    });
  } catch (e) { next(e); }
};
