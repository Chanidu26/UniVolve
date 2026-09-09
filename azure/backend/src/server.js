require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const routes = require('./routes');
const pool = require('./db/pool');
const { errorHandler } = require('./middleware/errorHandler');
const { apiLimiter, authLimiter } = require('./middleware/rateLimiter');

const app = express();

// ── Security headers ──
app.use(helmet());
app.use(cors({ origin: (process.env.ALLOWED_ORIGINS || '*').split(',') }));
app.use(express.json({ limit: '1mb' }));

// ── Rate limiting (defence-in-depth behind APIM) ──
app.use('/api/auth', authLimiter);
app.use('/api', apiLimiter);

app.get('/health', (_, res) => res.json({ status: 'ok' }));
app.use('/api', routes);

// ── Structured error handler ──
app.use(errorHandler);

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

module.exports = app;