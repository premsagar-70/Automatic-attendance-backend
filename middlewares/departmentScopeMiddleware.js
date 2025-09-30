// Middleware to enforce HOD scoping: if the user is HOD and not super-admin, inject department filter
const departmentScopeMiddleware = (req, res, next) => {
  try {
    const user = req.user
    if (!user) return next()
    // assume user.role and user.department exist
    if (user.role === 'hod' && !user.isSuperAdmin) {
      // attach a scopedQuery object to request for controllers to use
      req.scopedQuery = req.scopedQuery || {}
      req.scopedQuery.department = user.department
    }
    next()
  } catch (err) {
    next(err)
  }
}

module.exports = departmentScopeMiddleware
