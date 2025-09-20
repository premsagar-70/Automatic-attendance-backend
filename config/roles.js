const ROLES = {
  ADMIN: 'admin',
  FACULTY: 'faculty',
  STUDENT: 'student'
};

const PERMISSIONS = {
  // Admin permissions
  ADMIN: [
    'create_user',
    'read_user',
    'update_user',
    'delete_user',
    'create_session',
    'read_session',
    'update_session',
    'delete_session',
    'read_attendance',
    'update_attendance',
    'delete_attendance',
    'read_reports',
    'export_data',
    'manage_system'
  ],
  
  // Faculty permissions
  FACULTY: [
    'read_user',
    'update_user',
    'create_session',
    'read_session',
    'update_session',
    'read_attendance',
    'update_attendance',
    'read_reports',
    'export_data'
  ],
  
  // Student permissions
  STUDENT: [
    'read_user',
    'update_user',
    'read_session',
    'create_attendance',
    'read_attendance',
    'read_reports'
  ]
};

const ROLE_HIERARCHY = {
  [ROLES.ADMIN]: 3,
  [ROLES.FACULTY]: 2,
  [ROLES.STUDENT]: 1
};

const hasPermission = (userRole, permission) => {
  const rolePermissions = PERMISSIONS[userRole.toUpperCase()];
  return rolePermissions && rolePermissions.includes(permission);
};

const hasHigherRole = (userRole, targetRole) => {
  const userLevel = ROLE_HIERARCHY[userRole.toUpperCase()];
  const targetLevel = ROLE_HIERARCHY[targetRole.toUpperCase()];
  return userLevel >= targetLevel;
};

module.exports = {
  ROLES,
  PERMISSIONS,
  ROLE_HIERARCHY,
  hasPermission,
  hasHigherRole
};
