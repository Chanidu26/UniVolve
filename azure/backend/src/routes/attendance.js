// FR-06 attendance / FR-07 verified hours.
const router = require('express').Router();
const { authenticate } = require('../middleware/auth');
const events = require('../controllers/eventController');
const attendance = require('../controllers/attendanceController');

router.get('/events/:id/attendance', authenticate, events.requireEventOrganizer, attendance.sheet);
router.post('/events/:id/attendance/mark', authenticate, events.requireEventOrganizer, attendance.mark);
router.post('/events/:id/attendance/hours', authenticate, events.requireEventOrganizer, attendance.verifyHours);

// Two path segments after /users, so this never collides with GET /users/:userId.
router.get('/users/me/hours', authenticate, attendance.myHours);

module.exports = router;
