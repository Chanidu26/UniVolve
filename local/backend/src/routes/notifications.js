// FR-08 in-app notification channel.
const router = require('express').Router();
const { authenticate } = require('../middleware/auth');
const notifications = require('../controllers/notificationController');

router.get('/notifications', authenticate, notifications.list);
// read-all is a single segment, so it never shadows /:id/read below.
router.put('/notifications/read-all', authenticate, notifications.markAllRead);
router.put('/notifications/:id/read', authenticate, notifications.markRead);

module.exports = router;
