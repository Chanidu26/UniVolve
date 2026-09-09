const multer = require('multer');
const { BlobServiceClient } = require('@azure/storage-blob');
const { OAuth2Client } = require('google-auth-library');
const pool = require('../db/pool');
const { sign } = require('../middleware/auth');
const { sendWelcomeEmail } = require('../services/emailService');

const PROFILE_COLS = 'id, email, full_name, system_role, bio, skills, portfolio_links, profile_picture_url, created_at';
const toArray = (val) => {
  if (!val) return [];
  if (Array.isArray(val)) return val;
  return val.split(',').map(s => s.trim()).filter(Boolean);
};

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
// No external IdP role claim anymore, so admin status is a plain email allowlist —
// set SUPER_ADMIN_EMAILS to a comma-separated list of admin Google accounts.
const SUPER_ADMIN_EMAILS = (process.env.SUPER_ADMIN_EMAILS || '')
  .split(',').map(s => s.trim().toLowerCase()).filter(Boolean);

// Azure: store in memory then stream to Blob Storage
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 2 * 1024 * 1024 } }).single('photo');


exports.uploadPhoto = (req, res) => {
  upload(req, res, async (err) => {
    if (err) return res.status(400).json({ error: err.message });
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    try {
      const blobService = BlobServiceClient.fromConnectionString(process.env.STORAGE_CONNECTION_STRING);
      const container = blobService.getContainerClient(process.env.STORAGE_CONTAINER || 'avatars');
      await container.createIfNotExists({ access: 'blob' });
      const ext = req.file.originalname.split('.').pop().toLowerCase();
      const blobName = `avatar_${req.user.sub}_${Date.now()}.${ext}`;
      const blockBlob = container.getBlockBlobClient(blobName);
      await blockBlob.uploadData(req.file.buffer, { blobHTTPHeaders: { blobContentType: req.file.mimetype } });
      const url = blockBlob.url;
      const { rows } = await pool.query(
        `UPDATE users SET profile_picture_url=$1 WHERE id=$2 RETURNING ${PROFILE_COLS}`, [url, req.user.sub]);
      res.json({ url, user: rows[0] });
    } catch (e) { res.status(500).json({ error: 'Upload failed: ' + e.message }); }
  });
};

// Sign in with Google — verifies the Google ID token, then JIT-provisions/updates the local user row
// and mints our own session JWT. There's no separate registration step: a new Google account signing
// in for the first time *is* the registration.
exports.googleLogin = async (req, res) => {
  const { credential } = req.body;
  if (!credential) return res.status(400).json({ error: 'Missing Google credential' });

  let payload;
  try {
    const ticket = await googleClient.verifyIdToken({ idToken: credential, audience: process.env.GOOGLE_CLIENT_ID });
    payload = ticket.getPayload();
  } catch (e) {
    return res.status(401).json({ error: 'Invalid Google credential' });
  }

  const email = payload.email;
  const name = payload.name || email;
  const googleSub = payload.sub;
  const systemRole = SUPER_ADMIN_EMAILS.includes(email.toLowerCase()) ? 'SUPER_ADMIN' : 'VOLUNTEER';

  const { rows } = await pool.query(`
    INSERT INTO users (email, b2c_object_id, full_name, system_role)
    VALUES ($1, $2, $3, $4)
    ON CONFLICT (b2c_object_id) DO UPDATE
      SET email = EXCLUDED.email,
          system_role = EXCLUDED.system_role
    RETURNING ${PROFILE_COLS}, (xmax = 0) AS is_new`,
    [email, googleSub, name, systemRole]);

  const user = rows[0];
  if (user.is_new) sendWelcomeEmail(user.email, user.full_name);
  delete user.is_new;

  res.json({ user, token: sign(user) });
};

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
    `UPDATE users SET full_name=COALESCE($1,full_name), bio=COALESCE($2,bio),
     skills=COALESCE($3,skills), portfolio_links=COALESCE($4,portfolio_links),
     profile_picture_url=COALESCE($5,profile_picture_url)
     WHERE id=$6 RETURNING ${PROFILE_COLS}`,
    [full_name||null, bio||null,
     skills!=null ? toArray(skills) : null,
     portfolio_links!=null ? toArray(portfolio_links) : null,
     profile_picture_url||null, req.user.sub]);
  res.json(rows[0]);
};

exports.listVolunteers = async (req, res) => {
  const { rows } = await pool.query(
    `SELECT id, email, full_name, bio, skills, profile_picture_url
     FROM users WHERE system_role='VOLUNTEER' ORDER BY full_name ASC`);
  res.json(rows);
};
