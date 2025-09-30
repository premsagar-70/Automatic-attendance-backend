const express = require('express')
const router = express.Router()
const { authenticateToken } = require('../middlewares/authMiddleware')
const { requireAdmin, requireFacultyOrAdmin } = require('../middlewares/roleMiddleware')
const subjectController = require('../controllers/subjectController')

router.get('/', authenticateToken, requireFacultyOrAdmin, subjectController.list)
router.post('/', authenticateToken, requireAdmin, subjectController.create)
router.put('/:id', authenticateToken, requireAdmin, subjectController.update)
router.delete('/:id', authenticateToken, requireAdmin, subjectController.remove)

module.exports = router
