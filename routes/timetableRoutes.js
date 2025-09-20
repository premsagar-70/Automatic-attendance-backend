const express = require('express');
const { body } = require('express-validator');
const timetableController = require('../controllers/timetableController');
const { authenticateToken } = require('../middlewares/authMiddleware');
const { requireRole, requireAdmin, requireFacultyOrAdmin } = require('../middlewares/roleMiddleware');

const router = express.Router();

// Validation middleware
const createTimetableValidation = [
  body('title').notEmpty().withMessage('Title is required'),
  body('academicYear').notEmpty().withMessage('Academic year is required'),
  body('semester').notEmpty().withMessage('Semester is required'),
  body('department').notEmpty().withMessage('Department is required'),
  body('section').notEmpty().withMessage('Section is required'),
  body('startDate').isISO8601().withMessage('Valid start date is required'),
  body('endDate').isISO8601().withMessage('Valid end date is required'),
  body('schedule').isArray({ min: 1 }).withMessage('At least one schedule item is required'),
  body('schedule.*.dayOfWeek').isIn(['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'])
    .withMessage('Valid day of week is required'),
  body('schedule.*.startTime').matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
    .withMessage('Valid start time format (HH:MM) is required'),
  body('schedule.*.endTime').matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
    .withMessage('Valid end time format (HH:MM) is required'),
  body('schedule.*.subject').notEmpty().withMessage('Subject is required'),
  body('schedule.*.courseCode').notEmpty().withMessage('Course code is required'),
  body('schedule.*.faculty').isMongoId().withMessage('Valid faculty ID is required'),
  body('schedule.*.location').notEmpty().withMessage('Location is required')
];

const updateTimetableValidation = [
  body('title').optional().notEmpty().withMessage('Title cannot be empty'),
  body('academicYear').optional().notEmpty().withMessage('Academic year cannot be empty'),
  body('semester').optional().notEmpty().withMessage('Semester cannot be empty'),
  body('department').optional().notEmpty().withMessage('Department cannot be empty'),
  body('section').optional().notEmpty().withMessage('Section cannot be empty'),
  body('startDate').optional().isISO8601().withMessage('Valid start date is required'),
  body('endDate').optional().isISO8601().withMessage('Valid end date is required'),
  body('schedule').optional().isArray({ min: 1 }).withMessage('At least one schedule item is required'),
  body('schedule.*.dayOfWeek').optional().isIn(['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'])
    .withMessage('Valid day of week is required'),
  body('schedule.*.startTime').optional().matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
    .withMessage('Valid start time format (HH:MM) is required'),
  body('schedule.*.endTime').optional().matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
    .withMessage('Valid end time format (HH:MM) is required'),
  body('schedule.*.subject').optional().notEmpty().withMessage('Subject cannot be empty'),
  body('schedule.*.courseCode').optional().notEmpty().withMessage('Course code cannot be empty'),
  body('schedule.*.faculty').optional().isMongoId().withMessage('Valid faculty ID is required'),
  body('schedule.*.location').optional().notEmpty().withMessage('Location cannot be empty')
];

// Routes
router.post('/', 
  authenticateToken,
  requireAdmin,
  createTimetableValidation,
  timetableController.createTimetable
);

router.get('/', 
  authenticateToken,
  requireFacultyOrAdmin,
  timetableController.getTimetables
);

router.get('/stats', 
  authenticateToken,
  requireFacultyOrAdmin,
  timetableController.getTimetableStats
);

router.get('/:timetableId', 
  authenticateToken,
  requireFacultyOrAdmin,
  timetableController.getTimetableById
);

router.put('/:timetableId', 
  authenticateToken,
  requireAdmin,
  updateTimetableValidation,
  timetableController.updateTimetable
);

router.delete('/:timetableId', 
  authenticateToken,
  requireAdmin,
  timetableController.deleteTimetable
);

router.post('/:timetableId/generate-sessions', 
  authenticateToken,
  requireAdmin,
  timetableController.generateSessions
);

router.post('/:timetableId/finalize', 
  authenticateToken,
  requireAdmin,
  timetableController.finalizeTimetable
);

module.exports = router;
