const express = require('express');
const { body, query } = require('express-validator');
const sessionController = require('../controllers/sessionController');
const { authenticateToken } = require('../middlewares/authMiddleware');
const { requireSessionAccess, requireFacultyOrAdmin } = require('../middlewares/roleMiddleware');

const router = express.Router();

// Validation rules
const createSessionValidation = [
  body('title')
    .trim()
    .notEmpty()
    .withMessage('Session title is required')
    .isLength({ min: 3, max: 100 })
    .withMessage('Title must be between 3 and 100 characters'),
  
  body('description')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Description cannot exceed 500 characters'),
  
  body('subject')
    .trim()
    .notEmpty()
    .withMessage('Subject is required')
    .isLength({ min: 2, max: 50 })
    .withMessage('Subject must be between 2 and 50 characters'),
  
  body('courseCode')
    .trim()
    .notEmpty()
    .withMessage('Course code is required')
    .isLength({ min: 2, max: 20 })
    .withMessage('Course code must be between 2 and 20 characters'),
  
  body('startTime')
    .isISO8601()
    .withMessage('Valid start time is required'),
  
  body('endTime')
    .isISO8601()
    .withMessage('Valid end time is required'),
  
  body('location')
    .trim()
    .notEmpty()
    .withMessage('Location is required')
    .isLength({ min: 2, max: 100 })
    .withMessage('Location must be between 2 and 100 characters'),
  
  body('roomNumber')
    .optional()
    .trim()
    .isLength({ max: 20 })
    .withMessage('Room number cannot exceed 20 characters'),
  
  body('building')
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage('Building name cannot exceed 50 characters'),
  
  body('sessionType')
    .optional()
    .isIn(['lecture', 'lab', 'tutorial', 'seminar', 'exam', 'other'])
    .withMessage('Invalid session type'),
  
  body('mode')
    .optional()
    .isIn(['offline', 'online', 'hybrid'])
    .withMessage('Invalid session mode'),
  
  body('maxCapacity')
    .optional()
    .isInt({ min: 1, max: 1000 })
    .withMessage('Max capacity must be between 1 and 1000')
];

const updateSessionValidation = [
  body('title')
    .optional()
    .trim()
    .isLength({ min: 3, max: 100 })
    .withMessage('Title must be between 3 and 100 characters'),
  
  body('description')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Description cannot exceed 500 characters'),
  
  body('startTime')
    .optional()
    .isISO8601()
    .withMessage('Valid start time is required'),
  
  body('endTime')
    .optional()
    .isISO8601()
    .withMessage('Valid end time is required'),
  
  body('location')
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Location must be between 2 and 100 characters'),
  
  body('roomNumber')
    .optional()
    .trim()
    .isLength({ max: 20 })
    .withMessage('Room number cannot exceed 20 characters'),
  
  body('building')
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage('Building name cannot exceed 50 characters'),
  
  body('sessionType')
    .optional()
    .isIn(['lecture', 'lab', 'tutorial', 'seminar', 'exam', 'other'])
    .withMessage('Invalid session type'),
  
  body('mode')
    .optional()
    .isIn(['offline', 'online', 'hybrid'])
    .withMessage('Invalid session mode'),
  
  body('maxCapacity')
    .optional()
    .isInt({ min: 1, max: 1000 })
    .withMessage('Max capacity must be between 1 and 1000')
];

const addStudentValidation = [
  body('studentId')
    .isMongoId()
    .withMessage('Valid student ID is required')
];

const getSessionsValidation = [
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
    .isIn(['scheduled', 'active', 'completed', 'cancelled', 'postponed'])
    .withMessage('Invalid status filter'),
  
  query('sessionType')
    .optional()
    .isIn(['lecture', 'lab', 'tutorial', 'seminar', 'exam', 'other'])
    .withMessage('Invalid session type filter'),
  
  query('mode')
    .optional()
    .isIn(['offline', 'online', 'hybrid'])
    .withMessage('Invalid mode filter')
];

// Routes
router.post('/', authenticateToken, requireFacultyOrAdmin, createSessionValidation, sessionController.createSession);
router.get('/', authenticateToken, getSessionsValidation, sessionController.getSessions);
router.get('/:sessionId', authenticateToken, requireSessionAccess, sessionController.getSessionById);
router.put('/:sessionId', authenticateToken, requireFacultyOrAdmin, updateSessionValidation, sessionController.updateSession);
router.delete('/:sessionId', authenticateToken, requireFacultyOrAdmin, sessionController.deleteSession);
router.post('/:sessionId/start', authenticateToken, requireFacultyOrAdmin, sessionController.startSession);
router.post('/:sessionId/end', authenticateToken, requireFacultyOrAdmin, sessionController.endSession);
router.post('/:sessionId/add-student', authenticateToken, requireFacultyOrAdmin, addStudentValidation, sessionController.addStudentToSession);
router.post('/:sessionId/remove-student', authenticateToken, requireFacultyOrAdmin, addStudentValidation, sessionController.removeStudentFromSession);
router.get('/:sessionId/attendance', authenticateToken, requireSessionAccess, sessionController.getSessionAttendance);

module.exports = router;
