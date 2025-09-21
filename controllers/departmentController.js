const Department = require('../models/Department');
const User = require('../models/User');
const { validationResult } = require('express-validator');

class DepartmentController {
  /**
   * Create a new department
   */
  async createDepartment(req, res) {
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

      const {
        name,
        code,
        description,
        contactInfo,
        academicInfo
      } = req.body;

      const createdBy = req.user._id;

      // Check if department already exists
      const existingDepartment = await Department.findOne({
        $or: [{ name }, { code }]
      });

      if (existingDepartment) {
        return res.status(400).json({
          success: false,
          message: 'Department with this name or code already exists'
        });
      }

      const departmentData = {
        name,
        code,
        description,
        contactInfo,
        academicInfo,
        createdBy
      };

      const department = await Department.create(departmentData);

      res.status(201).json({
        success: true,
        message: 'Department created successfully',
        data: { department }
      });
    } catch (error) {
      console.error('Create department error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create department',
        error: error.message
      });
    }
  }

  /**
   * Get all departments
   */
  async getDepartments(req, res) {
    try {
      const {
        page = 1,
        limit = 10,
        search,
        isActive
      } = req.query;

      const query = { isDeleted: false };

      if (search) {
        query.$or = [
          { name: { $regex: search, $options: 'i' } },
          { code: { $regex: search, $options: 'i' } },
          { description: { $regex: search, $options: 'i' } }
        ];
      }

      if (isActive !== undefined) {
        query.isActive = isActive === 'true';
      }

      const departments = await Department.find(query)
        .populate('createdBy', 'firstName lastName email')
        .populate('head', 'firstName lastName email')
        .sort({ name: 1 })
        .limit(limit * 1)
        .skip((page - 1) * limit);

      const totalDepartments = await Department.countDocuments(query);

      res.json({
        success: true,
        data: {
          departments,
          pagination: {
            currentPage: parseInt(page),
            totalPages: Math.ceil(totalDepartments / limit),
            totalDepartments,
            hasNext: page < Math.ceil(totalDepartments / limit),
            hasPrev: page > 1
          }
        }
      });
    } catch (error) {
      console.error('Get departments error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get departments',
        error: error.message
      });
    }
  }

  /**
   * Get department by ID
   */
  async getDepartmentById(req, res) {
    try {
      const { departmentId } = req.params;

      const department = await Department.findById(departmentId)
        .populate('createdBy', 'firstName lastName email')
        .populate('head', 'firstName lastName email');

      if (!department) {
        return res.status(404).json({
          success: false,
          message: 'Department not found'
        });
      }

      res.json({
        success: true,
        data: { department }
      });
    } catch (error) {
      console.error('Get department error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get department',
        error: error.message
      });
    }
  }

  /**
   * Update department
   */
  async updateDepartment(req, res) {
    try {
      const { departmentId } = req.params;
      const updateData = req.body;

      const department = await Department.findById(departmentId);
      if (!department) {
        return res.status(404).json({
          success: false,
          message: 'Department not found'
        });
      }

      // Check if name or code already exists (excluding current department)
      if (updateData.name || updateData.code) {
        const existingDepartment = await Department.findOne({
          _id: { $ne: departmentId },
          $or: [
            ...(updateData.name ? [{ name: updateData.name }] : []),
            ...(updateData.code ? [{ code: updateData.code }] : [])
          ]
        });

        if (existingDepartment) {
          return res.status(400).json({
            success: false,
            message: 'Department with this name or code already exists'
          });
        }
      }

      const updatedDepartment = await Department.findByIdAndUpdate(
        departmentId,
        updateData,
        { new: true, runValidators: true }
      )
      .populate('createdBy', 'firstName lastName email')
      .populate('head', 'firstName lastName email');

      res.json({
        success: true,
        message: 'Department updated successfully',
        data: { department: updatedDepartment }
      });
    } catch (error) {
      console.error('Update department error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update department',
        error: error.message
      });
    }
  }

  /**
   * Delete department (soft delete)
   */
  async deleteDepartment(req, res) {
    try {
      const { departmentId } = req.params;

      const department = await Department.findById(departmentId);
      if (!department) {
        return res.status(404).json({
          success: false,
          message: 'Department not found'
        });
      }

      // Check if department has students or faculty
      const studentCount = await User.countDocuments({
        role: 'student',
        department: departmentId,
        isActive: true
      });

      const facultyCount = await User.countDocuments({
        role: 'faculty',
        department: departmentId,
        isActive: true
      });

      if (studentCount > 0 || facultyCount > 0) {
        return res.status(400).json({
          success: false,
          message: 'Cannot delete department with active students or faculty'
        });
      }

      // Soft delete
      department.isDeleted = true;
      await department.save();

      res.json({
        success: true,
        message: 'Department deleted successfully'
      });
    } catch (error) {
      console.error('Delete department error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to delete department',
        error: error.message
      });
    }
  }

  /**
   * Set department head
   */
  async setDepartmentHead(req, res) {
    try {
      const { departmentId } = req.params;
      const { facultyId } = req.body;

      const department = await Department.findById(departmentId);
      if (!department) {
        return res.status(404).json({
          success: false,
          message: 'Department not found'
        });
      }

      const faculty = await User.findById(facultyId);
      if (!faculty || faculty.role !== 'faculty') {
        return res.status(400).json({
          success: false,
          message: 'Invalid faculty member'
        });
      }

      // Check if faculty belongs to this department
      if (faculty.department.toString() !== departmentId) {
        return res.status(400).json({
          success: false,
          message: 'Faculty member does not belong to this department'
        });
      }

      department.head = facultyId;
      await department.save();

      res.json({
        success: true,
        message: 'Department head set successfully',
        data: { department }
      });
    } catch (error) {
      console.error('Set department head error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to set department head',
        error: error.message
      });
    }
  }

  /**
   * Get department statistics
   */
  async getDepartmentStats(req, res) {
    try {
      const stats = await Department.getDepartmentStats();

      res.json({
        success: true,
        data: { stats }
      });
    } catch (error) {
      console.error('Get department stats error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get department statistics',
        error: error.message
      });
    }
  }

  /**
   * Get department students
   */
  async getDepartmentStudents(req, res) {
    try {
      const { departmentId } = req.params;
      const {
        page = 1,
        limit = 10,
        academicYear,
        semester,
        approvalStatus
      } = req.query;

      const query = {
        role: 'student',
        department: departmentId,
        isActive: true
      };

      if (academicYear) query.academicYear = academicYear;
      if (semester) query.semester = semester;
      if (approvalStatus) query.approvalStatus = approvalStatus;

      const students = await User.find(query)
        .populate('department', 'name code')
        .sort({ createdAt: -1 })
        .limit(limit * 1)
        .skip((page - 1) * limit);

      const totalStudents = await User.countDocuments(query);

      res.json({
        success: true,
        data: {
          students,
          pagination: {
            currentPage: parseInt(page),
            totalPages: Math.ceil(totalStudents / limit),
            totalStudents,
            hasNext: page < Math.ceil(totalStudents / limit),
            hasPrev: page > 1
          }
        }
      });
    } catch (error) {
      console.error('Get department students error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get department students',
        error: error.message
      });
    }
  }

  /**
   * Get department faculty
   */
  async getDepartmentFaculty(req, res) {
    try {
      const { departmentId } = req.params;
      const {
        page = 1,
        limit = 10,
        search
      } = req.query;

      const query = {
        role: 'faculty',
        department: departmentId,
        isActive: true
      };

      if (search) {
        query.$or = [
          { firstName: { $regex: search, $options: 'i' } },
          { lastName: { $regex: search, $options: 'i' } },
          { email: { $regex: search, $options: 'i' } },
          { employeeId: { $regex: search, $options: 'i' } }
        ];
      }

      const faculty = await User.find(query)
        .populate('department', 'name code')
        .sort({ firstName: 1 })
        .limit(limit * 1)
        .skip((page - 1) * limit);

      const totalFaculty = await User.countDocuments(query);

      res.json({
        success: true,
        data: {
          faculty,
          pagination: {
            currentPage: parseInt(page),
            totalPages: Math.ceil(totalFaculty / limit),
            totalFaculty,
            hasNext: page < Math.ceil(totalFaculty / limit),
            hasPrev: page > 1
          }
        }
      });
    } catch (error) {
      console.error('Get department faculty error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get department faculty',
        error: error.message
      });
    }
  }
}

module.exports = new DepartmentController();
