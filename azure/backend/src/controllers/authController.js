const multer = require('multer');
const { BlobServiceClient } = require('@azure/storage-blob');
const pool = require('../db/pool');
const { asyncWrap } = require('../middleware/errorHandler');

const PROFILE_COLS = 'id, email, full_name, system_role, bio, skills, portfolio_links, profile_picture_url, created_at';
const toArray = (val) => {
  if (!val) return [];
  if (Array.isArray(val)) return val;
  return val.split(',').map(s => s.trim()).filter(Boolean);
};

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

exports.register = (req, res) => res.status(400).json({ error: 'Registration is handled by Azure AD B2C' });
exports.login = (req, res) => res.status(400).json({ error: 'Login is handled by Azure AD B2C' });

exports.me = asyncWrap(async (req, res) => {
  const { rows } = await pool.query(`SELECT ${PROFILE_COLS} FROM users WHERE id=$1`, [req.user.sub]);
  res.json(rows[0]);
});

exports.viewProfile = asyncWrap(async (req, res) => {
  const { rows } = await pool.query(`SELECT ${PROFILE_COLS} FROM users WHERE id=$1`, [req.params.userId]);
  if (!rows[0]) return res.status(404).json({ error: 'User not found' });
  res.json(rows[0]);
});

exports.updateProfile = asyncWrap(async (req, res) => {
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
});

exports.listVolunteers = asyncWrap(async (req, res) => {
  const { rows } = await pool.query(
    `SELECT id, email, full_name, bio, skills, profile_picture_url
     FROM users WHERE system_role='VOLUNTEER' ORDER BY full_name ASC`);
  res.json(rows);
});
