const jwt = require('jsonwebtoken');
const jwksClient = require('jwks-rsa');
const pool = require('../db/pool');

// Azure AD B2C token validation
const tenant = process.env.B2C_TENANT_NAME;          // e.g. vmsuniversity
const policy = process.env.B2C_POLICY;               // e.g. B2C_1_signupsignin
const clientId = process.env.B2C_CLIENT_ID;

const client = jwksClient({
  jwksUri: `https://${tenant}.b2clogin.com/${tenant}.onmicrosoft.com/${policy}/discovery/v2.0/keys`,
  cache: true,
});

const getKey = (header, cb) =>
  client.getSigningKey(header.kid, (err, key) => cb(err, key?.getPublicKey()));

exports.authenticate = (req, res, next) => {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Missing token' });

  jwt.verify(token, getKey, {
    audience: clientId,
    issuer: `https://${tenant}.b2clogin.com/${process.env.B2C_TENANT_ID}/v2.0/`,
  }, async (err, decoded) => {
    if (err) return res.status(401).json({ error: 'Invalid or expired token' });
    try {
      // JIT-provision the user row on first login (B2C owns identity, DB owns app data)
      const email = decoded.emails?.[0] || decoded.email;
      const name = decoded.name || email;
      const { rows } = await pool.query(`
        INSERT INTO users (email, b2c_object_id, full_name)
        VALUES ($1, $2, $3)
        ON CONFLICT (b2c_object_id) DO UPDATE SET email = EXCLUDED.email
        RETURNING id, email, full_name, system_role`, [email, decoded.sub || decoded.oid, name]);
      const u = rows[0];
      req.user = { sub: u.id, email: u.email, system_role: u.system_role };
      next();
    } catch (e) { next(e); }
  });
};

exports.requireRole = (...roles) => (req, res, next) =>
  roles.includes(req.user.system_role) ? next() : res.status(403).json({ error: 'Forbidden' });
