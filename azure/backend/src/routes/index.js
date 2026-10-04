const router = require('express').Router();
const { authenticate, requireRole } = require('../middleware/auth');
const auth = require('../controllers/authController');
const events = require('../controllers/eventController');
const roles = require('../controllers/roleController');
const apps = require('../controllers/applicationController');
const features = require('../controllers/featureController');


// Auth
router.post('/auth/google', auth.googleLogin);
router.get('/auth/me', authenticate, auth.me);
router.put('/auth/me', authenticate, auth.updateProfile);
router.post('/auth/upload-photo', authenticate, auth.uploadPhoto);

// Users
router.get('/users', authenticate, auth.listVolunteers);
router.get('/users/:userId', authenticate, auth.viewProfile);
router.get('/users/:userId/stats', authenticate, features.profileStats);
router.get('/users/:userId/recommendations', authenticate, features.listRecommendations);
router.post('/users/:userId/recommendations', authenticate, features.createRecommendation);

// Attendance, feedback, and volunteer profile enhancements
router.post('/attendance', authenticate, features.checkAttendance);
router.get('/attendance/mine', authenticate, features.mineAttendance);
router.post('/events/:eventId/feedback', authenticate, features.feedback);
router.post('/events/:eventId/users/:userId/endorsements', authenticate, events.requireEventOrganizer, features.endorseSkill);
router.get('/admin/stats', authenticate, requireRole('SUPER_ADMIN'), features.adminStats);

// Events
router.get('/events', authenticate, events.list);
router.post('/events', authenticate, requireRole('SUPER_ADMIN'), events.create);
router.put('/events/:id', authenticate, requireRole('SUPER_ADMIN'), events.update);
router.delete('/events/:id', authenticate, requireRole('SUPER_ADMIN'), events.remove);
router.post('/events/:id/photo', authenticate, requireRole('SUPER_ADMIN'), events.uploadPhoto);

// Event roles
router.post('/events/:id/roles', authenticate, events.requireEventOrganizer, roles.create);
router.put('/events/:id/roles/:roleId', authenticate, events.requireEventOrganizer, roles.update);
router.delete('/events/:id/roles/:roleId', authenticate, events.requireEventOrganizer, roles.remove);

// Applications
router.post('/applications', authenticate, apps.apply);
router.get('/applications/mine', authenticate, apps.mine);
router.put('/applications/:appId/respond', authenticate, apps.respond);
router.get('/events/:id/applications', authenticate, events.requireEventOrganizer, apps.listForEvent);
router.put('/events/:id/applications/:appId', authenticate, events.requireEventOrganizer, apps.decide);
router.post('/events/:id/roles/:roleId/invite', authenticate, events.requireEventOrganizer, apps.invite);

module.exports = router;
