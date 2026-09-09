const { app, request, registerUser, getAdminToken, createEvent, createRole } = require('./setup');

describe('Attendance API', () => {
  let adminToken, volunteer, event, role, applicationId;

  beforeAll(async () => {
    adminToken = await getAdminToken();
    volunteer = await registerUser();
    event = await createEvent(adminToken);
    role = await createRole(adminToken, event.id);
    // Apply and approve the volunteer
    const appRes = await request(app)
      .post('/api/applications')
      .set('Authorization', `Bearer ${volunteer.token}`)
      .send({ event_role_id: role.id });
    applicationId = appRes.body.id;
    await request(app)
      .put(`/api/events/${event.id}/applications/${applicationId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'APPROVED' });
  });

  describe('Mark attendance', () => {
    it('should mark a volunteer as PRESENT', async () => {
      const res = await request(app)
        .post(`/api/events/${event.id}/attendance/mark`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ application_id: applicationId, status: 'PRESENT' });
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('PRESENT');
    });

    it('should mark a volunteer as ABSENT', async () => {
      const res = await request(app)
        .post(`/api/events/${event.id}/attendance/mark`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ application_id: applicationId, status: 'ABSENT' });
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ABSENT');
    });

    it('should reject non-APPROVED application (409)', async () => {
      const vol2 = await registerUser();
      const appRes = await request(app)
        .post('/api/applications')
        .set('Authorization', `Bearer ${vol2.token}`)
        .send({ event_role_id: role.id });
      // This application is PENDING, not APPROVED
      const res = await request(app)
        .post(`/api/events/${event.id}/attendance/mark`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ application_id: appRes.body.id, status: 'PRESENT' });
      expect(res.status).toBe(409);
    });
  });

  describe('Verify hours', () => {
    it('should verify hours with explicit value', async () => {
      // First mark as PRESENT
      await request(app)
        .post(`/api/events/${event.id}/attendance/mark`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ application_id: applicationId, status: 'PRESENT' });
      // Verify hours
      const res = await request(app)
        .post(`/api/events/${event.id}/attendance/hours`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ application_id: applicationId, hours_logged: 4.5 });
      expect(res.status).toBe(200);
      expect(Number(res.body.hours_logged)).toBe(4.5);
      expect(res.body.verified_at).toBeTruthy();
    });
  });

  describe('My hours', () => {
    it('should return volunteer\'s verified hours', async () => {
      const res = await request(app)
        .get('/api/users/me/hours')
        .set('Authorization', `Bearer ${volunteer.token}`);
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('total_hours');
      expect(res.body).toHaveProperty('events_attended');
      expect(res.body).toHaveProperty('history');
    });
  });

  describe('Attendance sheet', () => {
    it('should return the attendance sheet for an event', async () => {
      const res = await request(app)
        .get(`/api/events/${event.id}/attendance`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('summary');
      expect(res.body).toHaveProperty('rows');
      expect(res.body.summary).toHaveProperty('approved');
    });
  });
});
