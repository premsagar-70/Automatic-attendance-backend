const express = require('express');
const { body, query } = require('express-validator');
const attendanceController = require('../controllers/attendanceController');
const { authenticateToken } = require('../middlewares/authMiddleware');
const { requireAttendanceAccess } = require('../middlewares/roleMiddleware');

const router = express.Router();

// Validation rules
const markAttendanceValidation = [
  body('qrCodeData')
    .notEmpty()
    .withMessage('QR code data is required'),
  
  body('location')
    .optional()
    .isObject()
    .withMessage('Location must be an object'),
  
  body('deviceInfo')
    .optional()
    .isObject()
    .withMessage('Device info must be an object')
];

const markManualAttendanceValidation = [
  body('studentId')
    .isMongoId()
    .withMessage('Valid student ID is required'),
  
  body('sessionId')
    .isMongoId()
    .withMessage('Valid session ID is required'),
  
  body('status')
    .optional()
    .isIn(['present', 'absent', 'excused'])
    .withMessage('Invalid attendance status'),
  
  body('checkInTime')
    .optional()
    .isISO8601()
    .withMessage('Invalid check-in time'),
  
  body('notes')
    .optional()
    .isLength({ max: 500 })
    .withMessage('Notes cannot exceed 500 characters')
];

const updateAttendanceValidation = [
  body('status')
    .optional()
    .isIn(['present', 'absent', 'excused'])
    .withMessage('Invalid attendance status'),
  
  body('notes')
    .optional()
    .isLength({ max: 500 })
    .withMessage('Notes cannot exceed 500 characters')
];

const approveAttendanceValidation = [
  body('status')
    .isIn(['present', 'absent', 'excused'])
    .withMessage('Valid attendance status is required'),
  
  body('notes')
    .optional()
    .isLength({ max: 500 })
    .withMessage('Notes cannot exceed 500 characters')
];

const markCheckoutValidation = [
  body('checkOutTime')
    .optional()
    .isISO8601()
    .withMessage('Invalid check-out time')
];

const getAttendanceValidation = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  
  query('startDate')
    .optional()
    .isISO8601()
    .withMessage('Invalid start date format'),
  
  query('endDate')
    .optional()
    .isISO8601()
    .withMessage('Invalid end date format'),
  
  query('status')
    .optional()
    .isIn(['present', 'absent', 'excused'])
    .withMessage('Invalid status filter')
];

// Routes
router.post('/submit-qr', authenticateToken, markAttendanceValidation, attendanceController.submitAttendanceByQR);
router.post('/mark-manual', authenticateToken, markManualAttendanceValidation, attendanceController.markAttendanceManually);
router.get('/', authenticateToken, requireAttendanceAccess, getAttendanceValidation, attendanceController.getAttendanceRecords);
router.get('/stats', authenticateToken, requireAttendanceAccess, attendanceController.getAttendanceStats);
router.put('/:attendanceId', authenticateToken, updateAttendanceValidation, attendanceController.updateAttendance);
router.delete('/:attendanceId', authenticateToken, attendanceController.deleteAttendance);
router.post('/:attendanceId/checkout', authenticateToken, markCheckoutValidation, attendanceController.markCheckout);

// New approval workflow routes
router.get('/pending/:sessionId', authenticateToken, attendanceController.getPendingAttendance);
router.post('/:attendanceId/approve', authenticateToken, approveAttendanceValidation, attendanceController.approveAttendance);
router.post('/bulk-approve/:sessionId', authenticateToken, attendanceController.bulkApproveAllPresent);
router.put('/:attendanceId/modify', authenticateToken, updateAttendanceValidation, attendanceController.modifyAttendance);

module.exports = router;
