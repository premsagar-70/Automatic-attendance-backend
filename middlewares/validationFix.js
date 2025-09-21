const User = require('../models/User');
const Department = require('../models/Department');

/**
 * Middleware to fix user validation issues before processing
 */
const fixUserValidation = async (req, res, next) => {
  try {
    // Only apply to user-related routes
    if (req.path.includes('/users/') && req.method === 'PUT') {
      const { userId } = req.params;
      
      if (userId) {
        const user = await User.findById(userId);
        
        if (user) {
          // Fix department field if it's a string
          if (typeof user.department === 'string') {
            let dept = await Department.findOne({ 
              $or: [
                { name: { $regex: new RegExp(user.department, 'i') } },
                { code: { $regex: new RegExp(user.department, 'i') } }
              ]
            });
            
            if (!dept) {
              // Create a default department if none found
              dept = await Department.findOne({ code: 'DEFAULT' });
              if (!dept) {
                dept = await Department.create({
                  name: 'Default Department',
                  code: 'DEFAULT',
                  description: 'Default department for migrated users',
                  createdBy: req.user?._id || new require('mongoose').Types.ObjectId(),
                  isActive: true
                });
              }
            }
            user.department = dept._id;
            user.departmentName = user.department; // Store original name
          }

          // Fix student-specific fields
          if (user.role === 'student') {
            if (!user.academicYear || !['1', '2', '3', '4'].includes(user.academicYear)) {
              user.academicYear = '1';
            }
            if (!user.semester || !['1', '2'].includes(user.semester)) {
              user.semester = '1';
            }
            if (!user.batch) {
              user.batch = '2024';
            }
          }

          // Save the fixed user
          await user.save();
        }
      }
    }
    
    next();
  } catch (error) {
    console.error('Validation fix error:', error);
    next(); // Continue even if fix fails
  }
};

module.exports = { fixUserValidation };
