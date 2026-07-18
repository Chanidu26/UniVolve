const jwt = require('jsonwebtoken');
const SECRET = process.env.JWT_SECRET || 'local-dev-secret';

exports.sign = (user) =>
  jwt.sign({ sub: user.id, email: user.email, system_role: user.system_role }, SECRET, { expiresIn: '8h' });

exports.authenticate = (req, res, next) => {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Missing token' });
  try {
    req.user = jwt.verify(token, SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
};

exports.requireRole = (...roles) => (req, res, next) =>
  roles.includes(req.user.system_role) ? next() : res.status(403).json({ error: 'Forbidden' });
