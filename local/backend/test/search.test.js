const { app, request, registerUser, getAdminToken, createEvent } = require('./setup');

describe('Search & Filter Security', () => {
  let adminToken, volunteerToken;

  beforeAll(async () => {
    adminToken = await getAdminToken();
    const vol = await registerUser();
    volunteerToken = vol.token;

    // Seed a few events for search tests
    await createEvent(adminToken, { title: 'Beach Cleanup Drive', category: 'Environmental', status: 'PUBLISHED' });
    await createEvent(adminToken, { title: 'Blood Donation Camp', category: 'Health', status: 'PUBLISHED' });
    await createEvent(adminToken, { title: 'Tutoring Session', category: 'Education', status: 'PUBLISHED' });
  });

  describe('SQL injection prevention', () => {
    it('should not error on SQL injection attempt in search', async () => {
      const res = await request(app)
        .get("/api/events?search='; DROP TABLE events; --")
        .set('Authorization', `Bearer ${volunteerToken}`);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it('should not error on SQL injection in category', async () => {
      const res = await request(app)
        .get("/api/events?category=' OR '1'='1")
        .set('Authorization', `Bearer ${volunteerToken}`);
      expect(res.status).toBe(200);
      expect(res.body.length).toBe(0); // No match
    });
  });

  describe('Filter correctness', () => {
    it('should filter by category correctly', async () => {
      const res = await request(app)
        .get('/api/events?category=Health')
        .set('Authorization', `Bearer ${volunteerToken}`);
      expect(res.status).toBe(200);
      res.body.forEach(e => expect(e.category).toBe('Health'));
    });

    it('should filter by date range', async () => {
      const res = await request(app)
        .get('/api/events?startDate=2020-01-01&endDate=2099-12-31')
        .set('Authorization', `Bearer ${volunteerToken}`);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });
  });
});
