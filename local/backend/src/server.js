require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const helmet = require('helmet');
const routes = require('./routes');
const { errorHandler } = require('./middleware/errorHandler');
const { apiLimiter, authLimiter } = require('./middleware/rateLimiter');

const app = express();

// ── Security headers ──
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '1mb' }));

// ── Rate limiting ──
app.use('/api/auth', authLimiter);
app.use('/api', apiLimiter);

// Serve uploaded photos statically
const uploadDir = process.env.UPLOAD_DIR || '/app/uploads';
app.use('/uploads', express.static(uploadDir));

app.get('/health', (_, res) => res.json({ status: 'ok' }));
app.use('/api', routes);

// ── Structured error handler (replaces bare 500) ──
app.use(errorHandler);

// ── Only listen when run directly (not imported by tests) ──
if (require.main === module) {
  const port = process.env.PORT || 4000;
  app.listen(port, () => console.log(`VMS backend listening on :${port}`));
}

module.exports = app;
