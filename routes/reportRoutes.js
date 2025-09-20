const express = require('express');
const { query } = require('express-validator');
const reportController = require('../controllers/reportController');
const { authenticateToken } = require('../middlewares/authMiddleware');
const { requireReportAccess } = require('../middlewares/roleMiddleware');

const router = express.Router();

// Validation rules
const getAttendanceSummaryValidation = [
  query('startDate')
    .optional()
    .isISO8601()
    .withMessage('Invalid start date format'),
  
  query('endDate')
    .optional()
    .isISO8601()
    .withMessage('Invalid end date format'),
  
  query('studentId')
    .optional()
    .isMongoId()
    .withMessage('Invalid student ID'),
  
  query('sessionId')
    .optional()
    .isMongoId()
    .withMessage('Invalid session ID'),
  
  query('subject')
    .optional()
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Subject must be between 2 and 50 characters'),
  
  query('groupBy')
    .optional()
    .isIn(['student', 'session', 'subject', 'department'])
    .withMessage('Invalid groupBy parameter')
];

const getDetailedReportValidation = [
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
  
  query('studentId')
    .optional()
    .isMongoId()
    .withMessage('Invalid student ID'),
  
  query('sessionId')
    .optional()
    .isMongoId()
    .withMessage('Invalid session ID'),
  
  query('subject')
    .optional()
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Subject must be between 2 and 50 characters')
];

const getAnalyticsValidation = [
  query('studentId')
    .optional()
    .isMongoId()
    .withMessage('Invalid student ID'),
  
  query('startDate')
    .optional()
    .isISO8601()
    .withMessage('Invalid start date format'),
  
  query('endDate')
    .optional()
    .isISO8601()
    .withMessage('Invalid end date format'),
  
  query('period')
    .optional()
    .isIn(['daily', 'weekly', 'monthly'])
    .withMessage('Invalid period parameter')
];

const getAtRiskStudentsValidation = [
  query('minAttendancePercentage')
    .optional()
    .isInt({ min: 0, max: 100 })
    .withMessage('Min attendance percentage must be between 0 and 100'),
  
  query('minSessions')
    .optional()
    .isInt({ min: 1, max: 1000 })
    .withMessage('Min sessions must be between 1 and 1000'),
  
  query('lookbackDays')
    .optional()
    .isInt({ min: 1, max: 365 })
    .withMessage('Lookback days must be between 1 and 365'),
  
  query('department')
    .optional()
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Department must be between 2 and 50 characters')
];

const getSessionPerformanceValidation = [
  query('sessionId')
    .optional()
    .isMongoId()
    .withMessage('Invalid session ID'),
  
  query('facultyId')
    .optional()
    .isMongoId()
    .withMessage('Invalid faculty ID'),
  
  query('startDate')
    .optional()
    .isISO8601()
    .withMessage('Invalid start date format'),
  
  query('endDate')
    .optional()
    .isISO8601()
    .withMessage('Invalid end date format'),
  
  query('subject')
    .optional()
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Subject must be between 2 and 50 characters')
];

const exportDataValidation = [
  query('format')
    .optional()
    .isIn(['json', 'csv'])
    .withMessage('Format must be json or csv'),
  
  query('startDate')
    .optional()
    .isISO8601()
    .withMessage('Invalid start date format'),
  
  query('endDate')
    .optional()
    .isISO8601()
    .withMessage('Invalid end date format'),
  
  query('studentId')
    .optional()
    .isMongoId()
    .withMessage('Invalid student ID'),
  
  query('sessionId')
    .optional()
    .isMongoId()
    .withMessage('Invalid session ID'),
  
  query('subject')
    .optional()
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Subject must be between 2 and 50 characters')
];

// Routes
router.get('/attendance-summary', authenticateToken, requireReportAccess, getAttendanceSummaryValidation, reportController.getAttendanceSummary);
router.get('/detailed-attendance', authenticateToken, requireReportAccess, getDetailedReportValidation, reportController.getDetailedAttendanceReport);
router.get('/analytics', authenticateToken, requireReportAccess, getAnalyticsValidation, reportController.getAttendanceAnalytics);
router.get('/at-risk-students', authenticateToken, requireReportAccess, getAtRiskStudentsValidation, reportController.getAtRiskStudentsReport);
router.get('/session-performance', authenticateToken, requireReportAccess, getSessionPerformanceValidation, reportController.getSessionPerformanceReport);
router.get('/export', authenticateToken, requireReportAccess, exportDataValidation, reportController.exportAttendanceData);

module.exports = router;
