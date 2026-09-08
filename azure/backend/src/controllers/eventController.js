const multer = require('multer');
const { BlobServiceClient } = require('@azure/storage-blob');
const pool = require('../db/pool');
const { sendOrganizerAssignedEmail } = require('../services/emailService');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 4 * 1024 * 1024 } }).single('photo');

exports.uploadPhoto = (req, res) => {
  upload(req, res, async (err) => {
    if (err) return res.status(400).json({ error: err.message });
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    try {
      const blobService = BlobServiceClient.fromConnectionString(process.env.STORAGE_CONNECTION_STRING);
      const container = blobService.getContainerClient(process.env.STORAGE_CONTAINER || 'avatars');
      await container.createIfNotExists({ access: 'blob' });
      const ext = req.file.originalname.split('.').pop().toLowerCase();
      const blobName = `event_${req.params.id}_${Date.now()}.${ext}`;
      const blockBlob = container.getBlockBlobClient(blobName);
      await blockBlob.uploadData(req.file.buffer, { blobHTTPHeaders: { blobContentType: req.file.mimetype } });
      const { rows } = await pool.query(
        `UPDATE events SET image_url=$1 WHERE id=$2 RETURNING *`, [blockBlob.url, req.params.id]);
      if (!rows[0]) return res.status(404).json({ error: 'Event not found' });
      res.json(rows[0]);
    } catch (e) { res.status(500).json({ error: 'Upload failed: ' + e.message }); }
  });
};

exports.list = async (req, res) => {
  const admin = req.user.system_role === 'SUPER_ADMIN';
  const { rows } = await pool.query(`
    SELECT e.*, u.full_name AS organizer_name, u.profile_picture_url AS organizer_picture,
      COALESCE(json_agg(json_build_object(
        'id', r.id, 'role_name', r.role_name, 'description', r.description,
        'total_slots', r.total_slots, 'filled_slots', r.filled_slots
      )) FILTER (WHERE r.id IS NOT NULL), '[]') AS roles
    FROM events e
    LEFT JOIN users u ON u.id = e.organizer_id
    LEFT JOIN event_roles r ON r.event_id = e.id
    ${admin ? '' : "WHERE e.status = 'PUBLISHED'"}
    GROUP BY e.id, u.full_name, u.profile_picture_url
    ORDER BY e.event_date ASC`);
  res.json(rows);
};

exports.create = async (req, res) => {
  const { title, description, event_date, location, status } = req.body;
  const { rows } = await pool.query(
    `INSERT INTO events (title, description, event_date, location, status, created_by)
     VALUES ($1,$2,$3,$4,COALESCE($5,'DRAFT'),$6) RETURNING *`,
    [title, description, event_date, location, status, req.user.sub]);
  res.status(201).json(rows[0]);
};

exports.update = async (req, res) => {
  const { title, description, event_date, location, status, organizer_id } = req.body;
  const { rows: before } = await pool.query('SELECT organizer_id FROM events WHERE id=$1', [req.params.id]);
  if (!before[0]) return res.status(404).json({ error: 'Event not found' });
  const { rows } = await pool.query(
    `UPDATE events SET title=COALESCE($1,title), description=COALESCE($2,description),
     event_date=COALESCE($3,event_date), location=COALESCE($4,location),
     status=COALESCE($5,status), organizer_id=COALESCE($6,organizer_id)
     WHERE id=$7 RETURNING *`,
    [title, description, event_date, location, status, organizer_id, req.params.id]);
  const event = rows[0];
  if (organizer_id && organizer_id !== before[0].organizer_id) {
    const { rows: organizer } = await pool.query('SELECT email FROM users WHERE id=$1', [organizer_id]);
    if (organizer[0]) sendOrganizerAssignedEmail(organizer[0].email, event.title, event.event_date);
  }
  res.json(event);
};

exports.remove = async (req, res) => {
  await pool.query('DELETE FROM events WHERE id=$1', [req.params.id]);
  res.status(204).end();
};

exports.requireEventOrganizer = async (req, res, next) => {
  if (req.user.system_role === 'SUPER_ADMIN') return next();
  const { rows } = await pool.query('SELECT organizer_id FROM events WHERE id=$1', [req.params.id]);
  if (!rows[0]) return res.status(404).json({ error: 'Event not found' });
  if (rows[0].organizer_id !== req.user.sub) return res.status(403).json({ error: 'Not organizer of this event' });
  next();
};
