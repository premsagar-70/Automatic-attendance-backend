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

// Manual trigger for monthly reports (admin only) - used for testing / manual runs
const sendMonthlyReports = require('../scripts/monthlyReportJob');
router.post('/send-monthly-reports', async (req, res) => {
	try {
		const cutoff = req.body.cutoff ? new Date(req.body.cutoff) : new Date();
		// Run asynchronously but respond immediately
		sendMonthlyReports(cutoff).catch(err => console.error('Monthly report job failed', err));
		res.json({ success: true, message: 'Monthly report job started' });
	} catch (error) {
		console.error('Failed to start monthly reports', error);
		res.status(500).json({ success: false, message: 'Failed to start monthly reports' });
	}
});

module.exports = router;
