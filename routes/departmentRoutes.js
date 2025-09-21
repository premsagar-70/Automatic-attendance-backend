const express = require('express');
const { body } = require('express-validator');
const departmentController = require('../controllers/departmentController');
const { authenticateToken } = require('../middlewares/authMiddleware');
const { requireAdmin, requireFacultyOrAdmin } = require('../middlewares/roleMiddleware');

const router = express.Router();

// Validation middleware
const createDepartmentValidation = [
  body('name')
    .notEmpty()
    .withMessage('Department name is required')
    .isLength({ min: 2, max: 100 })
    .withMessage('Department name must be between 2 and 100 characters'),
  
  body('code')
    .notEmpty()
    .withMessage('Department code is required')
    .isLength({ min: 2, max: 10 })
    .withMessage('Department code must be between 2 and 10 characters')
    .matches(/^[A-Z0-9]+$/)
    .withMessage('Department code must contain only uppercase letters and numbers'),
  
  body('description')
    .optional()
    .isLength({ max: 500 })
    .withMessage('Description cannot exceed 500 characters'),
  
  body('contactInfo.email')
    .optional()
    .isEmail()
    .withMessage('Valid email is required'),
  
  body('contactInfo.phone')
    .optional()
    .matches(/^[\+]?[1-9][\d]{0,15}$/)
    .withMessage('Valid phone number is required'),
  
  body('academicInfo.establishedYear')
    .optional()
    .isInt({ min: 1900, max: new Date().getFullYear() })
    .withMessage('Valid established year is required')
];

const updateDepartmentValidation = [
  body('name')
    .optional()
    .isLength({ min: 2, max: 100 })
    .withMessage('Department name must be between 2 and 100 characters'),
  
  body('code')
    .optional()
    .isLength({ min: 2, max: 10 })
    .withMessage('Department code must be between 2 and 10 characters')
    .matches(/^[A-Z0-9]+$/)
    .withMessage('Department code must contain only uppercase letters and numbers'),
  
  body('description')
    .optional()
    .isLength({ max: 500 })
    .withMessage('Description cannot exceed 500 characters'),
  
  body('contactInfo.email')
    .optional()
    .isEmail()
    .withMessage('Valid email is required'),
  
  body('contactInfo.phone')
    .optional()
    .matches(/^[\+]?[1-9][\d]{0,15}$/)
    .withMessage('Valid phone number is required'),
  
  body('academicInfo.establishedYear')
    .optional()
    .isInt({ min: 1900, max: new Date().getFullYear() })
    .withMessage('Valid established year is required')
];

const setDepartmentHeadValidation = [
  body('facultyId')
    .isMongoId()
    .withMessage('Valid faculty ID is required')
];

// Routes
router.post('/', 
  authenticateToken,
  requireAdmin,
  createDepartmentValidation,
  departmentController.createDepartment
);

router.get('/', 
  authenticateToken,
  requireFacultyOrAdmin,
  departmentController.getDepartments
);

router.get('/stats', 
  authenticateToken,
  requireFacultyOrAdmin,
  departmentController.getDepartmentStats
);

router.get('/:departmentId', 
  authenticateToken,
  requireFacultyOrAdmin,
  departmentController.getDepartmentById
);

router.put('/:departmentId', 
  authenticateToken,
  requireAdmin,
  updateDepartmentValidation,
  departmentController.updateDepartment
);

router.delete('/:departmentId', 
  authenticateToken,
  requireAdmin,
  departmentController.deleteDepartment
);

router.post('/:departmentId/set-head', 
  authenticateToken,
  requireAdmin,
  setDepartmentHeadValidation,
  departmentController.setDepartmentHead
);

router.get('/:departmentId/students', 
  authenticateToken,
  requireFacultyOrAdmin,
  departmentController.getDepartmentStudents
);

router.get('/:departmentId/faculty', 
  authenticateToken,
  requireFacultyOrAdmin,
  departmentController.getDepartmentFaculty
);

module.exports = router;
