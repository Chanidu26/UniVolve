// FR-08 in-app channel. Deliberately mirrors emailService's contract: it never
// throws, so a failed notification can never roll back the approval, hours
// verification or certificate issuance that triggered it.
const pool = require('../db/pool');

// Kept in one place so the bell, the controllers and Member 6's tests agree on
// the vocabulary. `type` is only used for the icon in NotificationBell.
exports.TYPES = {
  APPLICATION_APPROVED: 'APPLICATION_APPROVED',
  APPLICATION_REJECTED: 'APPLICATION_REJECTED',
  HOURS_VERIFIED: 'HOURS_VERIFIED',
  CERTIFICATE_ISSUED: 'CERTIFICATE_ISSUED',
};

exports.notify = async (userId, type, title, message) => {
  try {
    if (!userId) return null;
    const { rows } = await pool.query(
      `INSERT INTO notifications (user_id, type, title, message)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [userId, type, title, message]);
    return rows[0];
  } catch (e) {
    console.error('Notification insert failed (non-fatal):', e.message);
    return null;
  }
};
