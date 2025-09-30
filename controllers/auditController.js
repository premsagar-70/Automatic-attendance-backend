const AuditLog = require('../models/AuditLog')

exports.list = async (req, res, next) => {
  try {
    const { page = 1, limit = 50 } = req.query
    const logs = await AuditLog.find()
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .populate('actor', 'firstName lastName email')
    res.json({ success: true, data: { logs } })
  } catch (err) { next(err) }
}
