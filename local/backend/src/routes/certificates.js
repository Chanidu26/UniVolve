// Volunteer certificates + public verification.
const router = require('express').Router();
const { authenticate } = require('../middleware/auth');
const certificates = require('../controllers/certificateController');

router.get('/certificates/mine', authenticate, certificates.mine);

// Intentionally unauthenticated — see certificateController.verify. Declared
// after /mine so the more specific literal path is matched first, and kept on
// its own line so the missing `authenticate` reads as deliberate, not dropped.
router.get('/certificates/verify/:code', certificates.verify);

module.exports = router;
