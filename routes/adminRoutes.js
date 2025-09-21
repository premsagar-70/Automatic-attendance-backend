const express = require('express');
const adminController = require('../controllers/adminController');
const { authenticateToken } = require('../middlewares/authMiddleware');
const { requireAdmin } = require('../middlewares/roleMiddleware');

const router = express.Router();

// All admin routes require authentication and admin role
router.use(authenticateToken);
router.use(requireAdmin);

// Admin settings routes
router.get('/settings', adminController.getAdminSettings);
router.put('/settings', adminController.updateAdminSettings);
router.post('/test-email', adminController.testEmailSettings);
router.post('/backup', adminController.createSystemBackup);
router.get('/stats', adminController.getSystemStats);

module.exports = router;
