const { app, request, registerUser, getAdminToken } = require('./setup');

describe('Auth API', () => {
  // ── Register ──────────────────────────────────────────────────
  describe('POST /api/auth/register', () => {
    it('should register a new user (201)', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({ email: 'newuser@test.com', password: 'Pass123', full_name: 'New User' });
      expect(res.status).toBe(201);
      expect(res.body.user).toHaveProperty('id');
      expect(res.body.user.email).toBe('newuser@test.com');
      expect(res.body).toHaveProperty('token');
      expect(res.body.user).not.toHaveProperty('password_hash');
    });

    it('should reject duplicate email (409)', async () => {
      await request(app)
        .post('/api/auth/register')
        .send({ email: 'dup@test.com', password: 'Pass123', full_name: 'Dup' });
      const res = await request(app)
        .post('/api/auth/register')
        .send({ email: 'dup@test.com', password: 'Pass456', full_name: 'Dup2' });
      expect(res.status).toBe(409);
    });

    it('should reject missing fields (400)', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({ email: 'x@test.com' });
      expect(res.status).toBe(400);
    });
  });

  // ── Login ─────────────────────────────────────────────────────
  describe('POST /api/auth/login', () => {
    it('should login with valid credentials (200)', async () => {
      const reg = await registerUser();
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: reg._email, password: reg._password });
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('token');
      expect(res.body.user).toHaveProperty('id');
    });

    it('should reject wrong password (401)', async () => {
      const reg = await registerUser();
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: reg._email, password: 'WrongPass' });
      expect(res.status).toBe(401);
    });

    it('should reject missing email (400)', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ password: 'whatever' });
      expect(res.status).toBe(400);
    });
  });

  // ── JWT validation ────────────────────────────────────────────
  describe('GET /api/auth/me', () => {
    it('should return user with valid token', async () => {
      const reg = await registerUser();
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${reg.token}`);
      expect(res.status).toBe(200);
      expect(res.body.email).toBe(reg._email);
    });

    it('should return 401 with no token', async () => {
      const res = await request(app).get('/api/auth/me');
      expect(res.status).toBe(401);
    });

    it('should return 401 with invalid token', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer invalidtoken123');
      expect(res.status).toBe(401);
    });
  });

  // ── requireRole ───────────────────────────────────────────────
  describe('Role-based access control', () => {
    it('should deny volunteers access to admin routes (403)', async () => {
      const reg = await registerUser();
      const res = await request(app)
        .post('/api/events')
        .set('Authorization', `Bearer ${reg.token}`)
        .send({ title: 'Hack', event_date: new Date().toISOString() });
      expect(res.status).toBe(403);
    });

    it('should allow admin access to admin routes', async () => {
      const token = await getAdminToken();
      const res = await request(app)
        .get('/api/users')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
    });
  });
});
