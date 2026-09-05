const router = require('express').Router();
const { authenticate, requireRole } = require('../middleware/auth');
const auth = require('../controllers/authController');
const events = require('../controllers/eventController');
const roles = require('../controllers/roleController');
const apps = require('../controllers/applicationController');

// Auth
router.post('/auth/register', auth.register);
router.post('/auth/login', auth.login);
router.get('/auth/me', authenticate, auth.me);
router.put('/auth/me', authenticate, auth.updateProfile);
router.post('/auth/upload-photo', authenticate, auth.uploadPhoto);

// Users
router.get('/users', authenticate, requireRole('SUPER_ADMIN'), auth.listVolunteers);
router.get('/users/:userId', authenticate, auth.viewProfile);

// Events
router.get('/events', authenticate, events.list);
router.post('/events', authenticate, requireRole('SUPER_ADMIN'), events.create);
router.put('/events/:id', authenticate, requireRole('SUPER_ADMIN'), events.update);
router.delete('/events/:id', authenticate, requireRole('SUPER_ADMIN'), events.remove);

// Event roles
router.post('/events/:id/roles', authenticate, events.requireEventOrganizer, roles.create);
router.put('/events/:id/roles/:roleId', authenticate, events.requireEventOrganizer, roles.update);
router.delete('/events/:id/roles/:roleId', authenticate, events.requireEventOrganizer, roles.remove);

// Applications
router.post('/applications', authenticate, apps.apply);
router.get('/applications/mine', authenticate, apps.mine);
router.get('/events/:id/applications', authenticate, events.requireEventOrganizer, apps.listForEvent);
router.put('/events/:id/applications/:appId', authenticate, events.requireEventOrganizer, apps.decide);

// Attendance & verified hours
router.use('/', require('./attendance'));

module.exports = router;
