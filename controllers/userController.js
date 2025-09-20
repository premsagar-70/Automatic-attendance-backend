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

      // Get users
      const users = await User.find(query)
        .select('-password')
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

      const user = await User.findById(userId).select('-password');

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

      // Get users by department
      const usersByDepartment = await User.aggregate([
        { $match: { isActive: true, department: { $exists: true, $ne: null } } },
        { $group: { _id: '$department', count: { $sum: 1 } } },
        { $sort: { count: -1 } }
      ]);

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
}

module.exports = new UserController();
