const { ROLES, hasPermission, hasHigherRole } = require('../config/roles');

// Check if user has required role
const requireRole = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    const userRole = req.user.role;
    
    if (!allowedRoles.includes(userRole)) {
      return res.status(403).json({
        success: false,
        message: 'Insufficient permissions. Required role: ' + allowedRoles.join(' or ')
      });
    }

    next();
  };
};

// Check if user has specific permission
const requirePermission = (permission) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    if (!hasPermission(req.user.role, permission)) {
      return res.status(403).json({
        success: false,
        message: `Permission denied. Required permission: ${permission}`
      });
    }

    next();
  };
};

// Check if user can access resource (same user or higher role)
const requireOwnershipOrHigherRole = (targetRole = ROLES.STUDENT) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    const targetUserId = req.params.userId || req.params.id;
    const isOwnResource = req.user._id.toString() === targetUserId;
    const hasHigherRoleAccess = hasHigherRole(req.user.role, targetRole);

    if (!isOwnResource && !hasHigherRoleAccess) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You can only access your own resources or have insufficient role level.'
      });
    }

    next();
  };
};

// Check if user can manage another user (higher role required)
const requireHigherRole = (targetRole = ROLES.STUDENT) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    if (!hasHigherRole(req.user.role, targetRole)) {
      return res.status(403).json({
        success: false,
        message: `Access denied. Required role level higher than ${targetRole}`
      });
    }

    next();
  };
};

// Admin only access
const requireAdmin = requireRole(ROLES.ADMIN);

// Faculty or Admin access
const requireFacultyOrAdmin = requireRole(ROLES.FACULTY, ROLES.ADMIN);

// Student, Faculty, or Admin access (any authenticated user)
const requireAnyRole = requireRole(ROLES.STUDENT, ROLES.FACULTY, ROLES.ADMIN);

// Check if user can access session (faculty who created it or admin)
const requireSessionAccess = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required'
    });
  }

  // Admin can access any session
  if (req.user.role === ROLES.ADMIN) {
    return next();
  }

  // Faculty can access their own sessions
  if (req.user.role === ROLES.FACULTY) {
    const sessionId = req.params.sessionId || req.params.id;
    if (sessionId) {
      // This will be checked in the controller by querying the session
      req.sessionId = sessionId;
    }
    return next();
  }

  // Students can only view sessions they're enrolled in
  if (req.user.role === ROLES.STUDENT) {
    return next();
  }

  return res.status(403).json({
    success: false,
    message: 'Access denied'
  });
};

// Check if user can manage attendance records
const requireAttendanceAccess = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required'
    });
  }

  // Admin can manage any attendance
  if (req.user.role === ROLES.ADMIN) {
    return next();
  }

  // Faculty can manage attendance for their sessions
  if (req.user.role === ROLES.FACULTY) {
    return next();
  }

  // Students can only view their own attendance
  if (req.user.role === ROLES.STUDENT) {
    const targetUserId = req.params.userId || req.params.studentId;
    if (targetUserId && req.user._id.toString() !== targetUserId) {
      return res.status(403).json({
        success: false,
        message: 'You can only view your own attendance records'
      });
    }
    return next();
  }

  return res.status(403).json({
    success: false,
    message: 'Access denied'
  });
};

// Check if user can access reports
const requireReportAccess = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required'
    });
  }

  // Admin and Faculty can access reports
  if (req.user.role === ROLES.ADMIN || req.user.role === ROLES.FACULTY) {
    return next();
  }

  // Students can only access their own reports
  if (req.user.role === ROLES.STUDENT) {
    const targetUserId = req.params.userId || req.params.studentId;
    if (targetUserId && req.user._id.toString() !== targetUserId) {
      return res.status(403).json({
        success: false,
        message: 'You can only access your own reports'
      });
    }
    return next();
  }

  return res.status(403).json({
    success: false,
    message: 'Access denied'
  });
};

module.exports = {
  requireRole,
  requirePermission,
  requireOwnershipOrHigherRole,
  requireHigherRole,
  requireAdmin,
  requireFacultyOrAdmin,
  requireAnyRole,
  requireSessionAccess,
  requireAttendanceAccess,
  requireReportAccess
};
