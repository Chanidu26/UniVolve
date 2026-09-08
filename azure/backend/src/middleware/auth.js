const jwt = require('jsonwebtoken');
const jwksClient = require('jwks-rsa');
const pool = require('../db/pool');
const { sendWelcomeEmail } = require('../services/emailService');

// Entra External ID token validation
const tenant = process.env.TENANT_NAME;   // e.g. vmsuniversity
const tenantId = process.env.TENANT_ID;  // e.g. xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
const apiClientId = process.env.API_CLIENT_ID;  // backend's own API app registration ID (not either SPA's)

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
    // Both SPAs (admin-frontend, volunteer-frontend) request this API's scope, so
    // tokens from either carry this same audience regardless of which SPA acquired them.
    audience: `api://${apiClientId}`,
    issuer: `https://${tenant}.ciamlogin.com/${tenantId}/v2.0/`,
  }, async (err, decoded) => {
    if (err) return res.status(401).json({ error: 'Invalid or expired token' });
    try {
      // JIT-provision user on first login
      const email = decoded.emails?.[0] || decoded.email || decoded.preferred_username;
      const name = decoded.name || decoded.displayName || email;
      const roles = Array.isArray(decoded.roles) ? decoded.roles : [];
      const systemRole = roles.includes('SUPER_ADMIN') ? 'SUPER_ADMIN' : 'VOLUNTEER';
      const { rows } = await pool.query(`
        INSERT INTO users (email, b2c_object_id, full_name, system_role)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (b2c_object_id) DO UPDATE
          SET email = EXCLUDED.email,
              system_role = EXCLUDED.system_role
        RETURNING id, email, full_name, system_role, (xmax = 0) AS is_new`,
        [email, decoded.sub || decoded.oid, name, systemRole]);
      const u = rows[0];
      req.user = { sub: u.id, email: u.email, system_role: u.system_role };
      if (u.is_new) sendWelcomeEmail(u.email, u.full_name);
      next();
    } catch (e) { next(e); }
  });
};

exports.requireRole = (...roles) => (req, res, next) =>
  roles.includes(req.user.system_role) ? next() : res.status(403).json({ error: 'Forbidden' });
