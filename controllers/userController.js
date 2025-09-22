const User = require('../models/User');
const { validationResult } = require('express-validator');
const { ROLES } = require('../config/roles');

class UserController {
  /**
   * Get all users
   */
  async getUsers(req, res) {
    try {
      const {
        role,
        department,
        isActive,
        search,
        page = 1,
        limit = 10
      } = req.query;

      // Build query
      const query = {};

      // If the requester is an admin who is a department head (HOD), scope results to their department
      if (req.user && req.user.role === 'admin') {
        try {
          const Department = require('../models/Department');
          const hodDept = await Department.findOne({ head: req.user._id });
          if (hodDept) {
            // If a department filter wasn't explicitly provided, scope to HOD's department
            if (!department) query.department = hodDept._id;
          }
        } catch (err) {
          // ignore dept lookup errors and continue without scoping
          console.warn('[userController] HOD scoping failed', err.message);
        }
      }

      // Apply filters
      if (role) query.role = role;
      if (department) query.department = department;
      if (isActive !== undefined) query.isActive = isActive === 'true';

      // Search functionality
      if (search) {
        query.$or = [
          { firstName: { $regex: search, $options: 'i' } },
          { lastName: { $regex: search, $options: 'i' } },
          { email: { $regex: search, $options: 'i' } },
          { studentId: { $regex: search, $options: 'i' } },
          { employeeId: { $regex: search, $options: 'i' } }
        ];
      }

      // Calculate pagination
      const skip = (parseInt(page) - 1) * parseInt(limit);

      // Get users (populate department for client convenience)
      const users = await User.find(query)
        .select('-password')
        .populate('department', 'name code')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit));

      // Get total count
      const totalUsers = await User.countDocuments(query);

      res.json({
        success: true,
        data: {
          users,
          pagination: {
            currentPage: parseInt(page),
            totalPages: Math.ceil(totalUsers / parseInt(limit)),
            totalUsers,
            hasNextPage: skip + users.length < totalUsers,
            hasPrevPage: parseInt(page) > 1
          }
        }
      });
    } catch (error) {
      console.error('Get users error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get users',
        error: error.message
      });
    }
  }

  /**
   * Get user by ID
   */
  async getUserById(req, res) {
    try {
      const { userId } = req.params;

  const user = await User.findById(userId).select('-password').populate('department', 'name code');

      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      res.json({
        success: true,
        data: {
          user
        }
      });
    } catch (error) {
      console.error('Get user error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get user',
        error: error.message
      });
    }
  }

  /**
   * Update user
   */
  async updateUser(req, res) {
    try {
      // Check for validation errors
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array()
        });
      }

      const { userId } = req.params;
      const updateData = req.body;

      // Find user
      const user = await User.findById(userId);

      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      // Check permissions
      if (req.user.role === 'student' && user._id.toString() !== req.user._id.toString()) {
        return res.status(403).json({
          success: false,
          message: 'You can only update your own profile'
        });
      }

      if (req.user.role === 'faculty' && user.role === 'admin') {
        return res.status(403).json({
          success: false,
          message: 'You do not have permission to update admin users'
        });
      }

      // Remove sensitive fields that shouldn't be updated directly
      delete updateData.password;
      delete updateData.role;
      delete updateData.isActive;

      // Update user
      const updatedUser = await User.findByIdAndUpdate(
        userId,
        updateData,
        { new: true, runValidators: true }
      ).select('-password');

      res.json({
        success: true,
        message: 'User updated successfully',
        data: {
          user: updatedUser
        }
      });
    } catch (error) {
      console.error('Update user error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update user',
        error: error.message
      });
    }
  }

  /**
   * Delete user (soft delete)
   */
  async deleteUser(req, res) {
    try {
      const { userId } = req.params;

      // Find user
      const user = await User.findById(userId);

      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      // Check permissions
      if (req.user.role === 'student') {
        return res.status(403).json({
          success: false,
          message: 'Students cannot delete users'
        });
      }

      if (req.user.role === 'faculty' && user.role === 'admin') {
        return res.status(403).json({
          success: false,
          message: 'You do not have permission to delete admin users'
        });
      }

      // Prevent self-deletion
      if (user._id.toString() === req.user._id.toString()) {
        return res.status(400).json({
          success: false,
          message: 'You cannot delete your own account'
        });
      }

      // Soft delete
      user.isActive = false;
      await user.save();

      res.json({
        success: true,
        message: 'User deleted successfully'
      });
    } catch (error) {
      console.error('Delete user error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to delete user',
        error: error.message
      });
    }
  }

  /**
   * Activate/Deactivate user
   */
  async toggleUserStatus(req, res) {
    try {
      const { userId } = req.params;
      const { isActive } = req.body;

      // Find user
      const user = await User.findById(userId);

      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      // Check permissions
      if (req.user.role === 'student') {
        return res.status(403).json({
          success: false,
          message: 'Students cannot change user status'
        });
      }

      if (req.user.role === 'faculty' && user.role === 'admin') {
        return res.status(403).json({
          success: false,
          message: 'You do not have permission to change admin user status'
        });
      }

      // Prevent self-deactivation
      if (user._id.toString() === req.user._id.toString() && isActive === false) {
        return res.status(400).json({
          success: false,
          message: 'You cannot deactivate your own account'
        });
      }

      // Fix validation issues before saving
      if (user.role === 'student') {
        // Ensure required fields for students
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

      // Fix department field if it's a string
      if (typeof user.department === 'string') {
        // Try to find a department with this name/code
        const Department = require('../models/Department');
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
              createdBy: req.user._id,
              isActive: true
            });
          }
        }
        user.department = dept._id;
        user.departmentName = user.department; // Store original name
      }

      // Update status
      user.isActive = isActive;
      await user.save();

      res.json({
        success: true,
        message: `User ${isActive ? 'activated' : 'deactivated'} successfully`,
        data: {
          user
        }
      });
    } catch (error) {
      console.error('Toggle user status error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to change user status',
        error: error.message
      });
    }
  }

  /**
   * Get user statistics
   */
  async getUserStats(req, res) {
    try {
      const totalUsers = await User.countDocuments({ isActive: true });
      const students = await User.countDocuments({ role: ROLES.STUDENT, isActive: true });
      const faculty = await User.countDocuments({ role: ROLES.FACULTY, isActive: true });
      const admins = await User.countDocuments({ role: ROLES.ADMIN, isActive: true });

      // Get recent registrations (last 30 days)
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const recentRegistrations = await User.countDocuments({
        createdAt: { $gte: thirtyDaysAgo },
        isActive: true
      });

      // Get users by department (aggregate counts)
      const usersByDepartmentAgg = await User.aggregate([
        { $match: { isActive: true, department: { $exists: true, $ne: null } } },
        { $group: { _id: '$department', count: { $sum: 1 } } },
        { $sort: { count: -1 } }
      ]);

      // Batch resolve departments to avoid N+1 queries
      const Department = require('../models/Department');
      const deptIds = usersByDepartmentAgg.map(e => String(e._id)).filter(Boolean);
      let deptMap = {};
      if (deptIds.length > 0) {
        const depts = await Department.find({ _id: { $in: deptIds } }).select('name code');
        deptMap = depts.reduce((acc, d) => { acc[String(d._id)] = { _id: d._id, name: d.name, code: d.code }; return acc; }, {});
      }

      const usersByDepartment = usersByDepartmentAgg.map(entry => ({
        department: deptMap[String(entry._id)] || { _id: entry._id },
        count: entry.count
      }));

      res.json({
        success: true,
        data: {
          totalUsers,
          students,
          faculty,
          admins,
          recentRegistrations,
          usersByDepartment
        }
      });
    } catch (error) {
      console.error('Get user stats error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get user statistics',
        error: error.message
      });
    }
  }

  /**
   * Search users
   */
  async searchUsers(req, res) {
    try {
      const { q, role, limit = 10 } = req.query;

      if (!q || q.length < 2) {
        return res.status(400).json({
          success: false,
          message: 'Search query must be at least 2 characters long'
        });
      }

      // Build search query
      const query = {
        isActive: true,
        $or: [
          { firstName: { $regex: q, $options: 'i' } },
          { lastName: { $regex: q, $options: 'i' } },
          { email: { $regex: q, $options: 'i' } },
          { studentId: { $regex: q, $options: 'i' } },
          { employeeId: { $regex: q, $options: 'i' } }
        ]
      };

      if (role) {
        query.role = role;
      }

      // Search users
      const users = await User.find(query)
        .select('firstName lastName email studentId employeeId role department')
        .limit(parseInt(limit));

      res.json({
        success: true,
        data: {
          users
        }
      });
    } catch (error) {
      console.error('Search users error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to search users',
        error: error.message
      });
    }
  }

  /**
   * Get user dashboard data
   */
  async getUserDashboard(req, res) {
    try {
      const userId = req.user._id;
      const user = await User.findById(userId);

      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      let dashboardData = {
        user: {
          id: user._id,
          name: user.fullName,
          email: user.email,
          role: user.role,
          department: user.department,
          lastLogin: user.lastLogin
        }
      };

      // Add role-specific data
      if (user.role === ROLES.STUDENT) {
        // Get student-specific data
        const Session = require('../models/Session');
        const Attendance = require('../models/Attendance');

        // Get enrolled sessions
        const enrolledSessions = await Session.find({
          'enrolledStudents.student': userId,
          isActive: true
        }).populate('faculty', 'firstName lastName');

        // Get recent attendance
        const recentAttendance = await Attendance.find({
          student: userId,
          isActive: true
        })
        .populate('session', 'title subject startTime')
        .sort({ checkInTime: -1 })
        .limit(5);

        dashboardData.studentData = {
          enrolledSessions: enrolledSessions.length,
          recentAttendance
        };
      } else if (user.role === ROLES.FACULTY) {
        // Get faculty-specific data
        const Session = require('../models/Session');
        const Attendance = require('../models/Attendance');

        // Get created sessions
        const createdSessions = await Session.find({
          faculty: userId,
          isActive: true
        });

        // Get total attendance records
        const totalAttendance = await Attendance.countDocuments({
          'session.faculty': userId,
          isActive: true
        });

        dashboardData.facultyData = {
          createdSessions: createdSessions.length,
          totalAttendance
        };
      } else if (user.role === ROLES.ADMIN) {
        // Get admin-specific data
        const Session = require('../models/Session');
        const Attendance = require('../models/Attendance');

        const totalSessions = await Session.countDocuments({ isActive: true });
        const totalAttendance = await Attendance.countDocuments({ isActive: true });
        const totalUsers = await User.countDocuments({ isActive: true });

        dashboardData.adminData = {
          totalSessions,
          totalAttendance,
          totalUsers
        };
      }

      res.json({
        success: true,
        data: dashboardData
      });
    } catch (error) {
      console.error('Get user dashboard error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get dashboard data',
        error: error.message
      });
    }
  }

  /**
   * Get pending approvals
   */
  async getPendingApprovals(req, res) {
    try {
      const {
        page = 1,
        limit = 10,
        role,
        department
      } = req.query;

      const query = {
        approvalStatus: 'pending',
        isActive: true
      };

      if (role) query.role = role;
      if (department) query.department = department;

      const pendingUsers = await User.find(query)
        .populate('department', 'name code')
        .sort({ createdAt: -1 })
        .limit(limit * 1)
        .skip((page - 1) * limit);

      const totalPending = await User.countDocuments(query);

      res.json({
        success: true,
        data: {
          pendingUsers,
          pagination: {
            currentPage: parseInt(page),
            totalPages: Math.ceil(totalPending / limit),
            totalPending,
            hasNext: page < Math.ceil(totalPending / limit),
            hasPrev: page > 1
          }
        }
      });
    } catch (error) {
      console.error('Get pending approvals error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get pending approvals',
        error: error.message
      });
    }
  }

  /**
   * Approve user
   */
  async approveUser(req, res) {
    try {
      const { userId } = req.params;
      const approvedBy = req.user._id;

      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      if (user.approvalStatus !== 'pending') {
        return res.status(400).json({
          success: false,
          message: 'User is not pending approval'
        });
      }

      user.approvalStatus = 'approved';
      user.approvedBy = approvedBy;
      user.approvedAt = new Date();
      await user.save();

      res.json({
        success: true,
        message: 'User approved successfully',
        data: { user }
      });
    } catch (error) {
      console.error('Approve user error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to approve user',
        error: error.message
      });
    }
  }

  /**
   * Reject user
   */
  async rejectUser(req, res) {
    try {
      const { userId } = req.params;
      const { reason } = req.body;
      const rejectedBy = req.user._id;

      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      if (user.approvalStatus !== 'pending') {
        return res.status(400).json({
          success: false,
          message: 'User is not pending approval'
        });
      }

      user.approvalStatus = 'rejected';
      user.approvedBy = rejectedBy;
      user.approvedAt = new Date();
      user.rejectionReason = reason;
      await user.save();

      res.json({
        success: true,
        message: 'User rejected successfully',
        data: { user }
      });
    } catch (error) {
      console.error('Reject user error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to reject user',
        error: error.message
      });
    }
  }

  /**
   * Bulk approve users
   */
  async bulkApproveUsers(req, res) {
    try {
      const { userIds } = req.body;
      const approvedBy = req.user._id;

      if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'User IDs array is required'
        });
      }

      const result = await User.updateMany(
        {
          _id: { $in: userIds },
          approvalStatus: 'pending'
        },
        {
          $set: {
            approvalStatus: 'approved',
            approvedBy,
            approvedAt: new Date()
          }
        }
      );

      res.json({
        success: true,
        message: `${result.modifiedCount} users approved successfully`,
        data: { modifiedCount: result.modifiedCount }
      });
    } catch (error) {
      console.error('Bulk approve users error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to bulk approve users',
        error: error.message
      });
    }
  }
}

module.exports = new UserController();
