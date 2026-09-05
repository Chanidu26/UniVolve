const multer = require('multer');
const path = require('path');
const { BlobServiceClient } = require('@azure/storage-blob');
const pool = require('../db/pool');

// ─── Banner upload (Azure: memory → Blob Storage) ──────────────────
const bannerUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];
    cb(null, allowed.includes(path.extname(file.originalname).toLowerCase()));
  },
}).single('banner');

// ─── Helpers ───────────────────────────────────────────────────────
const toArray = (val) => {
  if (!val) return [];
  if (Array.isArray(val)) return val;
  return val.split(',').map(s => s.trim()).filter(Boolean);
};

// ─── LIST (with search, filter, sort — parameterized) ──────────────
exports.list = async (req, res) => {
  const admin = req.user.system_role === 'SUPER_ADMIN';
  const { search, category, status, startDate, endDate, sort } = req.query;

  const conditions = [];
  const params = [];
  let idx = 1;

  // Non-admin users can only see PUBLISHED events
  if (!admin) {
    conditions.push(`e.status = $${idx++}`);
    params.push('PUBLISHED');
  } else if (status) {
    conditions.push(`e.status = $${idx++}`);
    params.push(status);
  }

  // Category filter
  if (category) {
    conditions.push(`e.category = $${idx++}`);
    params.push(category);
  }

  // Date range
  if (startDate) {
    conditions.push(`e.event_date >= $${idx++}`);
    params.push(startDate);
  }
  if (endDate) {
    conditions.push(`e.event_date <= $${idx++}`);
    params.push(endDate);
  }

  // Full-text search on title + description, ILIKE on location
  if (search) {
    conditions.push(
      `(to_tsvector('english', COALESCE(e.title,'') || ' ' || COALESCE(e.description,'')) @@ plainto_tsquery('english', $${idx})
        OR e.location ILIKE '%' || $${idx} || '%')`
    );
    params.push(search);
    idx++;
  }

  const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';
  const orderDir = sort === 'date_desc' ? 'DESC' : 'ASC';

  const { rows } = await pool.query(`
    SELECT e.*, u.full_name AS organizer_name, u.profile_picture_url AS organizer_picture,
      COALESCE(json_agg(json_build_object(
        'id', r.id, 'role_name', r.role_name, 'description', r.description,
        'total_slots', r.total_slots, 'filled_slots', r.filled_slots
      )) FILTER (WHERE r.id IS NOT NULL), '[]') AS roles
    FROM events e
    LEFT JOIN users u ON u.id = e.organizer_id
    LEFT JOIN event_roles r ON r.event_id = e.id
    ${where}
    GROUP BY e.id, u.full_name, u.profile_picture_url
    ORDER BY e.event_date ${orderDir}`, params);
  res.json(rows);
};

// ─── CREATE ────────────────────────────────────────────────────────
exports.create = async (req, res) => {
  const { title, description, event_date, location, status, category, tags, banner_image_url } = req.body;
  const { rows } = await pool.query(
    `INSERT INTO events (title, description, event_date, location, status, created_by, category, tags, banner_image_url)
     VALUES ($1,$2,$3,$4,COALESCE($5,'DRAFT'),$6,$7,$8,$9) RETURNING *`,
    [title, description, event_date, location, status, req.user.sub,
     category || null, tags ? toArray(tags) : [], banner_image_url || null]);
  res.status(201).json(rows[0]);
};

// ─── UPDATE ────────────────────────────────────────────────────────
exports.update = async (req, res) => {
  const { title, description, event_date, location, status, organizer_id, category, tags, banner_image_url } = req.body;
  const { rows } = await pool.query(
    `UPDATE events SET title=COALESCE($1,title), description=COALESCE($2,description),
     event_date=COALESCE($3,event_date), location=COALESCE($4,location),
     status=COALESCE($5,status), organizer_id=COALESCE($6,organizer_id),
     category=COALESCE($7,category), tags=COALESCE($8,tags),
     banner_image_url=COALESCE($9,banner_image_url)
     WHERE id=$10 RETURNING *`,
    [title, description, event_date, location, status, organizer_id,
     category || null, tags != null ? toArray(tags) : null, banner_image_url || null,
     req.params.id]);
  if (!rows[0]) return res.status(404).json({ error: 'Event not found' });
  res.json(rows[0]);
};

// ─── DELETE ────────────────────────────────────────────────────────
exports.remove = async (req, res) => {
  await pool.query('DELETE FROM events WHERE id=$1', [req.params.id]);
  res.status(204).end();
};

// ─── UPLOAD BANNER (Azure — Blob Storage) ──────────────────────────
exports.uploadBanner = (req, res) => {
  bannerUpload(req, res, async (err) => {
    if (err) return res.status(400).json({ error: err.message });
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    try {
      const blobService = BlobServiceClient.fromConnectionString(process.env.STORAGE_CONNECTION_STRING);
      const container = blobService.getContainerClient(process.env.STORAGE_BANNER_CONTAINER || 'banners');
      await container.createIfNotExists({ access: 'blob' });
      const ext = req.file.originalname.split('.').pop().toLowerCase();
      const blobName = `banner_${req.params.id}_${Date.now()}.${ext}`;
      const blockBlob = container.getBlockBlobClient(blobName);
      await blockBlob.uploadData(req.file.buffer, { blobHTTPHeaders: { blobContentType: req.file.mimetype } });
      const url = blockBlob.url;
      const { rows } = await pool.query(
        `UPDATE events SET banner_image_url=$1 WHERE id=$2 RETURNING *`,
        [url, req.params.id]);
      if (!rows[0]) return res.status(404).json({ error: 'Event not found' });
      res.json({ url, event: rows[0] });
    } catch (e) { res.status(500).json({ error: 'Upload failed: ' + e.message }); }
  });
};

// ─── MIDDLEWARE: require organizer or SUPER_ADMIN ──────────────────
exports.requireEventOrganizer = async (req, res, next) => {
  if (req.user.system_role === 'SUPER_ADMIN') return next();
  const { rows } = await pool.query('SELECT organizer_id FROM events WHERE id=$1', [req.params.id]);
  if (!rows[0]) return res.status(404).json({ error: 'Event not found' });
  if (rows[0].organizer_id !== req.user.sub) return res.status(403).json({ error: 'Not organizer of this event' });
  next();
};
