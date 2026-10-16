const jwt = require('jsonwebtoken');

// Our own session token — issued after verifying the Google ID token in authController.googleLogin.
// Not the Google ID token itself: that's short-lived (~1hr) and re-verifying it on every API call would
// require re-running the Google verification flow constantly. We verify Google's token once at login,
// then mint our own long-lived JWT for subsequent requests, same approach as the local/ variant.
const JWT_SECRET = process.env.JWT_SECRET;

exports.sign = (user) =>
  jwt.sign({ sub: user.id, email: user.email, system_role: user.system_role }, JWT_SECRET, { expiresIn: '7d' });

exports.authenticate = (req, res, next) => {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Missing token' });

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) return res.status(401).json({ error: 'Invalid or expired token' });
    req.user = { sub: decoded.sub, email: decoded.email, system_role: decoded.system_role };
    next();
  });
};

exports.requireRole = (...roles) => (req, res, next) =>
  roles.includes(req.user.system_role) ? next() : res.status(403).json({ error: 'Forbidden' });
