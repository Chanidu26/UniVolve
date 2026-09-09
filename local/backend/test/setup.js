const path = require('path');
const fs = require('fs');

// ── Set test env vars BEFORE any app code loads ────────────────────
process.env.NODE_ENV = 'test';
process.env.DB_HOST = process.env.DB_HOST || 'localhost';
process.env.DB_PORT = process.env.DB_PORT || '5433';
process.env.DB_USER = process.env.DB_USER || 'vms';
process.env.DB_PASSWORD = process.env.DB_PASSWORD || 'vms_password';
process.env.DB_NAME = process.env.DB_NAME || 'vmsdb_test';
process.env.JWT_SECRET = 'test-secret';
process.env.UPLOAD_DIR = path.join(__dirname, '..', 'test-uploads');
process.env.SMTP_HOST = 'localhost';
process.env.SMTP_PORT = '1025';

const { Pool } = require('pg');
const pool = new Pool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

/**
 * Apply the schema (init.sql + migrations) to the test database.
 */
async function applySchema() {
  const initSql = fs.readFileSync(
    path.join(__dirname, '..', '..', 'db', 'init.sql'), 'utf8');
  const migrationDir = path.join(__dirname, '..', '..', 'db', 'migrations');

  await pool.query(initSql);

  if (fs.existsSync(migrationDir)) {
    const files = fs.readdirSync(migrationDir)
      .filter(f => f.endsWith('.sql'))
      .sort();
    for (const file of files) {
      const sql = fs.readFileSync(path.join(migrationDir, file), 'utf8');
      await pool.query(sql);
    }
  }
}

/**
 * Drop all tables in the public schema.
 */
async function dropAll() {
  await pool.query(`
    DO $$ DECLARE r RECORD;
    BEGIN
      FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') LOOP
        EXECUTE 'DROP TABLE IF EXISTS public.' || quote_ident(r.tablename) || ' CASCADE';
      END LOOP;
    END $$;
  `);
}

// ── Jest lifecycle ─────────────────────────────────────────────────
beforeAll(async () => {
  await dropAll();
  await applySchema();
});

afterAll(async () => {
  await dropAll();
  await pool.end();
  // Clean up test uploads dir
  const uploadDir = process.env.UPLOAD_DIR;
  if (fs.existsSync(uploadDir)) {
    fs.rmSync(uploadDir, { recursive: true, force: true });
  }
});

// ── Test helpers ───────────────────────────────────────────────────
const request = require('supertest');
const app = require('../src/server');

async function registerUser(overrides = {}) {
  const data = {
    email: `test_${Date.now()}_${Math.random().toString(36).slice(2)}@test.com`,
    password: 'TestPass123',
    full_name: 'Test User',
    ...overrides,
  };
  const res = await request(app).post('/api/auth/register').send(data);
  return { ...res.body, _email: data.email, _password: data.password };
}

async function loginUser(email, password) {
  const res = await request(app).post('/api/auth/login').send({ email, password });
  return res.body;
}

async function getAdminToken() {
  const res = await request(app).post('/api/auth/login').send({
    email: 'admin@university.lk',
    password: 'Admin@123',
  });
  return res.body.token;
}

async function createEvent(token, overrides = {}) {
  const data = {
    title: `Test Event ${Date.now()}`,
    description: 'A test event',
    event_date: new Date(Date.now() + 7 * 86400000).toISOString(),
    location: 'Test Hall',
    status: 'PUBLISHED',
    category: 'Education',
    ...overrides,
  };
  const res = await request(app)
    .post('/api/events')
    .set('Authorization', `Bearer ${token}`)
    .send(data);
  return res.body;
}

async function createRole(token, eventId, overrides = {}) {
  const data = {
    role_name: `Role ${Date.now()}`,
    description: 'Test role',
    total_slots: 5,
    ...overrides,
  };
  const res = await request(app)
    .post(`/api/events/${eventId}/roles`)
    .set('Authorization', `Bearer ${token}`)
    .send(data);
  return res.body;
}

module.exports = {
  pool,
  app,
  request,
  registerUser,
  loginUser,
  getAdminToken,
  createEvent,
  createRole,
};
