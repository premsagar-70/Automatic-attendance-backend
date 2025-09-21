const express = require('express');
const { body } = require('express-validator');
const academicYearController = require('../controllers/academicYearController');
const { authenticateToken } = require('../middlewares/authMiddleware');
const { requireAdmin } = require('../middlewares/roleMiddleware');

const router = express.Router();

// Validation middleware
const createAcademicYearValidation = [
  body('year')
    .matches(/^\d{4}-\d{4}$/)
    .withMessage('Academic year must be in format YYYY-YYYY'),
  
  body('startDate')
    .isISO8601()
    .withMessage('Valid start date is required'),
  
  body('endDate')
    .isISO8601()
    .withMessage('Valid end date is required'),
  
  body('semesters')
    .isArray({ min: 1 })
    .withMessage('At least one semester is required'),
  
  body('semesters.*.name')
    .isIn(['1', '2', 'Summer', 'Winter'])
    .withMessage('Semester name must be 1, 2, Summer, or Winter'),
  
  body('semesters.*.startDate')
    .isISO8601()
    .withMessage('Valid semester start date is required'),
  
  body('semesters.*.endDate')
    .isISO8601()
    .withMessage('Valid semester end date is required')
];

const updateAcademicYearValidation = [
  body('year')
    .optional()
    .matches(/^\d{4}-\d{4}$/)
    .withMessage('Academic year must be in format YYYY-YYYY'),
  
  body('startDate')
    .optional()
    .isISO8601()
    .withMessage('Valid start date is required'),
  
  body('endDate')
    .optional()
    .isISO8601()
    .withMessage('Valid end date is required'),
  
  body('semesters')
    .optional()
    .isArray({ min: 1 })
    .withMessage('At least one semester is required'),
  
  body('semesters.*.name')
    .optional()
    .isIn(['1', '2', 'Summer', 'Winter'])
    .withMessage('Semester name must be 1, 2, Summer, or Winter'),
  
  body('semesters.*.startDate')
    .optional()
    .isISO8601()
    .withMessage('Valid semester start date is required'),
  
  body('semesters.*.endDate')
    .optional()
    .isISO8601()
    .withMessage('Valid semester end date is required')
];

const activateSemesterValidation = [
  body('semesterName')
    .isIn(['1', '2', 'Summer', 'Winter'])
    .withMessage('Valid semester name is required')
];

const finalizeSemesterValidation = [
  body('semesterName')
    .isIn(['1', '2', 'Summer', 'Winter'])
    .withMessage('Valid semester name is required')
];

// Routes
router.post('/', 
  authenticateToken,
  requireAdmin,
  createAcademicYearValidation,
  academicYearController.createAcademicYear
);

router.get('/', 
  authenticateToken,
  academicYearController.getAcademicYears
);

router.get('/current', 
  authenticateToken,
  academicYearController.getCurrentAcademicInfo
);

router.get('/stats', 
  authenticateToken,
  academicYearController.getAcademicYearStats
);

router.get('/:academicYearId', 
  authenticateToken,
  academicYearController.getAcademicYearById
);

router.put('/:academicYearId', 
  authenticateToken,
  requireAdmin,
  updateAcademicYearValidation,
  academicYearController.updateAcademicYear
);

router.delete('/:academicYearId', 
  authenticateToken,
  requireAdmin,
  academicYearController.deleteAcademicYear
);

router.post('/:academicYearId/set-current', 
  authenticateToken,
  requireAdmin,
  academicYearController.setCurrentAcademicYear
);

router.post('/:academicYearId/activate-semester', 
  authenticateToken,
  requireAdmin,
  activateSemesterValidation,
  academicYearController.activateSemester
);

router.post('/:academicYearId/finalize-semester', 
  authenticateToken,
  requireAdmin,
  finalizeSemesterValidation,
  academicYearController.finalizeSemester
);

module.exports = router;
