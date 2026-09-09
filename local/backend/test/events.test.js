const { app, request, registerUser, getAdminToken, createEvent } = require('./setup');

describe('Events API', () => {
  let adminToken;
  let volunteerToken;

  beforeAll(async () => {
    adminToken = await getAdminToken();
    const vol = await registerUser();
    volunteerToken = vol.token;
  });

  // ── CRUD ──────────────────────────────────────────────────────
  describe('CRUD', () => {
    it('should create an event as admin (201)', async () => {
      const event = await createEvent(adminToken);
      expect(event).toHaveProperty('id');
      expect(event.title).toMatch(/Test Event/);
    });

    it('should reject event creation by volunteer (403)', async () => {
      const res = await request(app)
        .post('/api/events')
        .set('Authorization', `Bearer ${volunteerToken}`)
        .send({ title: 'Nope', event_date: new Date().toISOString() });
      expect(res.status).toBe(403);
    });

    it('should list events', async () => {
      const res = await request(app)
        .get('/api/events')
        .set('Authorization', `Bearer ${volunteerToken}`);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it('should hide non-PUBLISHED events from volunteers', async () => {
      await createEvent(adminToken, { status: 'DRAFT', title: 'Draft Secret' });
      const res = await request(app)
        .get('/api/events')
        .set('Authorization', `Bearer ${volunteerToken}`);
      const titles = res.body.map(e => e.title);
      expect(titles).not.toContain('Draft Secret');
    });

    it('should update an event as admin', async () => {
      const event = await createEvent(adminToken);
      const res = await request(app)
        .put(`/api/events/${event.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ title: 'Updated Title' });
      expect(res.status).toBe(200);
      expect(res.body.title).toBe('Updated Title');
    });

    it('should delete an event as admin (204)', async () => {
      const event = await createEvent(adminToken);
      const res = await request(app)
        .delete(`/api/events/${event.id}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(204);
    });
  });

  // ── Search & Filters ──────────────────────────────────────────
  describe('Search & Filters', () => {
    let searchEvent;

    beforeAll(async () => {
      searchEvent = await createEvent(adminToken, {
        title: 'UniqueSearchableEvent',
        category: 'Environmental',
        status: 'PUBLISHED',
        event_date: '2027-06-15T10:00:00Z',
      });
    });

    it('should filter by search keyword', async () => {
      const res = await request(app)
        .get('/api/events?search=UniqueSearchable')
        .set('Authorization', `Bearer ${volunteerToken}`);
      expect(res.status).toBe(200);
      const ids = res.body.map(e => e.id);
      expect(ids).toContain(searchEvent.id);
    });

    it('should filter by category', async () => {
      const res = await request(app)
        .get('/api/events?category=Environmental')
        .set('Authorization', `Bearer ${volunteerToken}`);
      expect(res.status).toBe(200);
      res.body.forEach(e => expect(e.category).toBe('Environmental'));
    });

    it('should sort by date descending', async () => {
      const res = await request(app)
        .get('/api/events?sort=date_desc')
        .set('Authorization', `Bearer ${volunteerToken}`);
      expect(res.status).toBe(200);
      if (res.body.length >= 2) {
        const dates = res.body.map(e => new Date(e.event_date).getTime());
        expect(dates[0]).toBeGreaterThanOrEqual(dates[1]);
      }
    });
  });
});
