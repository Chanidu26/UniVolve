require('dotenv').config();
const express = require('express');
const cors = require('cors');
const routes = require('./routes');
const pool = require('./db/pool');

const app = express();
const allowedOrigins = (process.env.ALLOWED_ORIGINS || '*')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(cors({
  origin: (requestOrigin, callback) => {
    if (!requestOrigin || allowedOrigins.includes('*') || allowedOrigins.includes(requestOrigin)) {
      return callback(null, true);
    }
    return callback(new Error('Origin not allowed by CORS'));
  },
}));
app.use(express.json());
app.get('/health', (_, res) => res.json({ status: 'ok' }));
app.use('/api', routes);

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

const port = process.env.PORT || 4000;

// Initialize schema before listening
(async () => {
  try {
    await pool.initializeSchema();
    app.listen(port, () => console.log(`✅ VMS backend (Azure) running on :${port}`));
  } catch (e) {
    console.error('❌ Failed to start server:', e.message);
    process.exit(1);
  }
})();