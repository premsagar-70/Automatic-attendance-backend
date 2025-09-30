const express = require('express')
const router = express.Router()
const auditController = require('../controllers/auditController')
const { authenticateToken } = require('../middlewares/authMiddleware')
const { requireAdmin } = require('../middlewares/roleMiddleware')

router.get('/', authenticateToken, requireAdmin, auditController.list)

module.exports = router
