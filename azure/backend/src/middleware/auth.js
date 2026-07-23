const jwt = require('jsonwebtoken');
const jwksClient = require('jwks-rsa');
const pool = require('../db/pool');

// Entra External ID token validation
const tenant = process.env.TENANT_NAME;   // e.g. vmsuniversity
const tenantId = process.env.TENANT_ID;  // e.g. xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
const clientId = process.env.CLIENT_ID;  // SPA app registration client ID

const client = jwksClient({
  jwksUri: `https://${tenant}.ciamlogin.com/${tenant}.onmicrosoft.com/discovery/v2.0/keys`,
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
    issuer: `https://${tenant}.ciamlogin.com/${tenantId}/v2.0/`,
  }, async (err, decoded) => {
    if (err) return res.status(401).json({ error: 'Invalid or expired token' });
    try {
      // JIT-provision user on first login
      const email = decoded.emails?.[0] || decoded.email || decoded.preferred_username;
      const name = decoded.name || decoded.displayName || email;
      const { rows } = await pool.query(`
        INSERT INTO users (email, b2c_object_id, full_name)
        VALUES ($1, $2, $3)
        ON CONFLICT (b2c_object_id) DO UPDATE SET email = EXCLUDED.email
        RETURNING id, email, full_name, system_role`,
        [email, decoded.sub || decoded.oid, name]);
      const u = rows[0];
      req.user = { sub: u.id, email: u.email, system_role: u.system_role };
      next();
    } catch (e) { next(e); }
  });
};

exports.requireRole = (...roles) => (req, res, next) =>
  roles.includes(req.user.system_role) ? next() : res.status(403).json({ error: 'Forbidden' });
