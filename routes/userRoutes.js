const express = require('express');
const { body, query } = require('express-validator');
const userController = require('../controllers/userController');
const { authenticateToken } = require('../middlewares/authMiddleware');
const { requireAdmin, requireFacultyOrAdmin, requireOwnershipOrHigherRole } = require('../middlewares/roleMiddleware');

const router = express.Router();

// Validation rules
const updateUserValidation = [
  body('firstName')
    .optional()
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('First name must be between 2 and 50 characters'),
  
  body('lastName')
    .optional()
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Last name must be between 2 and 50 characters'),
  
  body('email')
    .optional()
    .isEmail()
    .withMessage('Please provide a valid email')
    .normalizeEmail(),
  
  body('phone')
    .optional()
    .isMobilePhone()
    .withMessage('Please provide a valid phone number'),
  
  body('department')
    .optional()
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Department must be between 2 and 50 characters'),
  
  body('semester')
    .optional()
    .isInt({ min: 1, max: 12 })
    .withMessage('Semester must be between 1 and 12'),
  
  body('batch')
    .optional()
    .trim()
    .isLength({ min: 2, max: 20 })
    .withMessage('Batch must be between 2 and 20 characters'),
  
  body('designation')
    .optional()
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Designation must be between 2 and 50 characters'),
  
  body('subjects')
    .optional()
    .isArray()
    .withMessage('Subjects must be an array'),
  
  body('address.street')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Street address cannot exceed 100 characters'),
  
  body('address.city')
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage('City cannot exceed 50 characters'),
  
  body('address.state')
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage('State cannot exceed 50 characters'),
  
  body('address.zipCode')
    .optional()
    .trim()
    .isLength({ max: 20 })
    .withMessage('Zip code cannot exceed 20 characters'),
  
  body('address.country')
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage('Country cannot exceed 50 characters'),
  
  body('dateOfBirth')
    .optional()
    .isISO8601()
    .withMessage('Please provide a valid date of birth')
];

const toggleUserStatusValidation = [
  body('isActive')
    .isBoolean()
    .withMessage('isActive must be a boolean value')
];

const getUsersValidation = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  
  query('role')
    .optional()
    .isIn(['student', 'faculty', 'admin'])
    .withMessage('Invalid role filter'),
  
  query('department')
    .optional()
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Department must be between 2 and 50 characters'),
  
  query('isActive')
    .optional()
    .isBoolean()
    .withMessage('isActive must be a boolean value'),
  
  query('search')
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Search query must be between 2 and 100 characters')
];

const searchUsersValidation = [
  query('q')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Search query must be between 2 and 100 characters'),
  
  query('role')
    .optional()
    .isIn(['student', 'faculty', 'admin'])
    .withMessage('Invalid role filter'),
  
  query('limit')
    .optional()
    .isInt({ min: 1, max: 50 })
    .withMessage('Limit must be between 1 and 50')
];

// Routes
router.get('/', authenticateToken, requireAdmin, getUsersValidation, userController.getUsers);
router.get('/search', authenticateToken, searchUsersValidation, userController.searchUsers);
router.get('/stats', authenticateToken, requireAdmin, userController.getUserStats);
router.get('/dashboard', authenticateToken, userController.getUserDashboard);
router.get('/:userId', authenticateToken, requireOwnershipOrHigherRole, userController.getUserById);
router.put('/:userId', authenticateToken, requireOwnershipOrHigherRole, updateUserValidation, userController.updateUser);
router.delete('/:userId', authenticateToken, requireAdmin, userController.deleteUser);
router.put('/:userId/toggle-status', authenticateToken, requireAdmin, toggleUserStatusValidation, userController.toggleUserStatus);

// Approval routes
router.get('/pending-approvals', authenticateToken, requireAdmin, userController.getPendingApprovals);
router.post('/:userId/approve', authenticateToken, requireAdmin, userController.approveUser);
router.post('/:userId/reject', authenticateToken, requireAdmin, userController.rejectUser);
router.post('/bulk-approve', authenticateToken, requireAdmin, userController.bulkApproveUsers);

module.exports = router;
