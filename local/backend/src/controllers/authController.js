const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const pool = require('../db/pool');
const { sign } = require('../middleware/auth');
const { asyncWrap } = require('../middleware/errorHandler');

const PROFILE_COLS = 'id, email, full_name, system_role, bio, skills, portfolio_links, profile_picture_url, created_at';

const toArray = (val) => {
  if (!val) return [];
  if (Array.isArray(val)) return val;
  return val.split(',').map(s => s.trim()).filter(Boolean);
};

// --- Multer: store uploads in /app/uploads, 2MB limit, images only ---
const uploadDir = process.env.UPLOAD_DIR || '/app/uploads';
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `avatar_${req.user.sub}_${Date.now()}${ext}`);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['.jpg','.jpeg','.png','.webp','.gif'];
    cb(null, allowed.includes(path.extname(file.originalname).toLowerCase()));
  },
}).single('photo');

exports.uploadPhoto = (req, res) => {
  upload(req, res, async (err) => {
    if (err) return res.status(400).json({ error: err.message });
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const url = `/uploads/${req.file.filename}`;
    const { rows } = await pool.query(
      `UPDATE users SET profile_picture_url=$1 WHERE id=$2 RETURNING ${PROFILE_COLS}`,
      [url, req.user.sub]);
    res.json({ url, user: rows[0] });
  });
};

exports.register = asyncWrap(async (req, res) => {
  const { email, password, full_name, bio, skills, portfolio_links, profile_picture_url } = req.body;
  if (!email || !password || !full_name) return res.status(400).json({ error: 'email, password, full_name required' });
  const hash = await bcrypt.hash(password, 10);
  try {
    const { rows } = await pool.query(
      `INSERT INTO users (email, password_hash, full_name, bio, skills, portfolio_links, profile_picture_url)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING ${PROFILE_COLS}`,
      [email, hash, full_name, bio || null, toArray(skills), toArray(portfolio_links), profile_picture_url || null]);
    res.status(201).json({ user: rows[0], token: sign(rows[0]) });
  } catch (e) {
    if (e.code === '23505') return res.status(409).json({ error: 'Email already registered' });
    throw e;
  }
});

exports.login = asyncWrap(async (req, res) => {
  const { email, password } = req.body;
  const { rows } = await pool.query('SELECT * FROM users WHERE email=$1', [email]);
  const user = rows[0];
  if (!user || !(await bcrypt.compare(password || '', user.password_hash || ''))) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  delete user.password_hash;
  res.json({ user, token: sign(user) });
});

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
});

exports.listVolunteers = asyncWrap(async (req, res) => {
  const { rows } = await pool.query(
    `SELECT id, email, full_name, bio, skills, profile_picture_url
     FROM users WHERE system_role = 'VOLUNTEER' ORDER BY full_name ASC`);
  res.json(rows);
});
