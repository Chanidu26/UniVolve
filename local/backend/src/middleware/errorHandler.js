/**
 * Structured error-handling middleware & async wrapper.
 * Express 4 does not catch rejected promises from async route handlers;
 * asyncWrap ensures they reach this error handler instead of hanging.
 */

// Wrap an async route/middleware so rejected promises call next(err)
const asyncWrap = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

// Central error handler — replaces the bare 500 catch-all
const errorHandler = (err, req, res, _next) => {
  // Multer file-size / type errors
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({ error: 'File too large (max 2 MB)' });
  }

  // Joi / express-validator style errors attached by validate()
  if (err.isJoi || err.type === 'validation') {
    return res.status(400).json({
      error: 'Validation failed',
      details: err.details || err.message,
    });
  }

  // Postgres constraint violations the controllers didn't catch
  if (err.code === '23505') {
    return res.status(409).json({ error: 'Duplicate entry' });
  }
  if (err.code === '23503') {
    return res.status(400).json({ error: 'Referenced record does not exist' });
  }
  if (err.code === '23514') {
    return res.status(400).json({ error: 'Check constraint violated' });
  }

  // Log full stack in development, suppress in production
  const isDev = process.env.NODE_ENV !== 'production';
  if (isDev) {
    console.error('[ErrorHandler]', err);
  } else {
    console.error('[ErrorHandler]', err.message);
  }

  const status = err.status || err.statusCode || 500;
  res.status(status).json({
    error: status === 500 ? 'Internal server error' : err.message,
    ...(isDev && { stack: err.stack }),
  });
};

module.exports = { asyncWrap, errorHandler };
