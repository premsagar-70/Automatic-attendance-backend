const Timetable = require('../models/Timetable');
const Session = require('../models/Session');
const User = require('../models/User');
const { validationResult } = require('express-validator');

class TimetableController {
  /**
   * Create a new timetable
   */
  async createTimetable(req, res) {
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
        title,
        description,
        academicYear,
        semester,
        department,
        section,
        schedule,
        startDate,
        endDate
      } = req.body;

      const createdBy = req.user._id;

      // Validate faculty assignments
      for (const scheduleItem of schedule) {
        const faculty = await User.findById(scheduleItem.faculty);
        if (!faculty || faculty.role !== 'faculty') {
          return res.status(400).json({
            success: false,
            message: `Invalid faculty assignment for ${scheduleItem.subject}`
          });
        }
      }

      const timetableData = {
        title,
        description,
        academicYear,
        semester,
        department,
        section,
        schedule,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        createdBy
      };

      const timetable = await Timetable.create(timetableData);

      res.status(201).json({
        success: true,
        message: 'Timetable created successfully',
        data: { timetable }
      });
    } catch (error) {
      console.error('Create timetable error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create timetable',
        error: error.message
      });
    }
  }

  /**
   * Get all timetables
   */
  async getTimetables(req, res) {
    try {
      const {
        page = 1,
        limit = 10,
        academicYear,
        semester,
        department,
        section,
        search
      } = req.query;

      const query = { isActive: true };

      // If the requester is an admin who is a department head (HOD), scope results to their department
      if (req.user && req.user.role === 'admin' && !department) {
        try {
          const Department = require('../models/Department');
          const hodDept = await Department.findOne({ head: req.user._id });
          if (hodDept) {
            query.department = hodDept._id;
          }
        } catch (err) {
          console.warn('[timetableController] HOD scoping failed', err.message);
        }
      }

      if (academicYear) query.academicYear = academicYear;
      if (semester) query.semester = semester;
      if (department) query.department = department;
      if (section) query.section = section;
      if (search) {
        query.$or = [
          { title: { $regex: search, $options: 'i' } },
          { description: { $regex: search, $options: 'i' } }
        ];
      }

      const timetables = await Timetable.find(query)
        .populate('createdBy', 'firstName lastName email')
        .populate('schedule.faculty', 'firstName lastName email employeeId')
        .sort({ createdAt: -1 })
        .limit(limit * 1)
        .skip((page - 1) * limit);

      // Resolve department info when department is stored as an ObjectId
      const Department = require('../models/Department');
      const timetablesWithDept = await Promise.all(timetables.map(async (tt) => {
        const obj = tt.toObject();
        try {
          if (obj.department && /^[a-fA-F0-9]{24}$/.test(obj.department)) {
            const dept = await Department.findById(obj.department).select('name code');
            if (dept) obj.department = { _id: dept._id, name: dept.name, code: dept.code };
          }
        } catch (e) {
          // ignore
        }
        return obj;
      }));

      const totalTimetables = await Timetable.countDocuments(query);

      res.json({
        success: true,
        data: {
          timetables: timetablesWithDept,
          pagination: {
            currentPage: parseInt(page),
            totalPages: Math.ceil(totalTimetables / limit),
            totalTimetables,
            hasNext: page < Math.ceil(totalTimetables / limit),
            hasPrev: page > 1
          }
        }
      });
    } catch (error) {
      console.error('Get timetables error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get timetables',
        error: error.message
      });
    }
  }

  /**
   * Get timetable by ID
   */
  async getTimetableById(req, res) {
    try {
      const { timetableId } = req.params;

      const timetable = await Timetable.findById(timetableId)
        .populate('createdBy', 'firstName lastName email')
        .populate('schedule.faculty', 'firstName lastName email employeeId')
        .populate('finalizedBy', 'firstName lastName email');

      if (!timetable) {
        return res.status(404).json({
          success: false,
          message: 'Timetable not found'
        });
      }

      // Resolve department info for the timetable
      try {
        const Department = require('../models/Department');
        const obj = timetable.toObject();
        if (obj.department && /^[a-fA-F0-9]{24}$/.test(obj.department)) {
          const dept = await Department.findById(obj.department).select('name code');
          if (dept) obj.department = { _id: dept._id, name: dept.name, code: dept.code };
        }

        return res.json({ success: true, data: { timetable: obj } });
      } catch (e) {
        return res.json({ success: true, data: { timetable } });
      }
    } catch (error) {
      console.error('Get timetable error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get timetable',
        error: error.message
      });
    }
  }

  /**
   * Update timetable
   */
  async updateTimetable(req, res) {
    try {
      const { timetableId } = req.params;
      const updateData = req.body;

      // Check if timetable exists and is not finalized
      const timetable = await Timetable.findById(timetableId);
      if (!timetable) {
        return res.status(404).json({
          success: false,
          message: 'Timetable not found'
        });
      }

      if (timetable.isFinalized) {
        return res.status(400).json({
          success: false,
          message: 'Cannot update finalized timetable'
        });
      }

      // Validate faculty assignments if schedule is being updated
      if (updateData.schedule) {
        for (const scheduleItem of updateData.schedule) {
          const faculty = await User.findById(scheduleItem.faculty);
          if (!faculty || faculty.role !== 'faculty') {
            return res.status(400).json({
              success: false,
              message: `Invalid faculty assignment for ${scheduleItem.subject}`
            });
          }
        }
      }

      const updatedTimetable = await Timetable.findByIdAndUpdate(
        timetableId,
        updateData,
        { new: true, runValidators: true }
      )
      .populate('createdBy', 'firstName lastName email')
      .populate('schedule.faculty', 'firstName lastName email employeeId');

      res.json({
        success: true,
        message: 'Timetable updated successfully',
        data: { timetable: updatedTimetable }
      });
    } catch (error) {
      console.error('Update timetable error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update timetable',
        error: error.message
      });
    }
  }

  /**
   * Delete timetable
   */
  async deleteTimetable(req, res) {
    try {
      const { timetableId } = req.params;

      const timetable = await Timetable.findById(timetableId);
      if (!timetable) {
        return res.status(404).json({
          success: false,
          message: 'Timetable not found'
        });
      }

      if (timetable.isFinalized) {
        return res.status(400).json({
          success: false,
          message: 'Cannot delete finalized timetable'
        });
      }

      // Soft delete
      timetable.isActive = false;
      await timetable.save();

      res.json({
        success: true,
        message: 'Timetable deleted successfully'
      });
    } catch (error) {
      console.error('Delete timetable error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to delete timetable',
        error: error.message
      });
    }
  }

  /**
   * Generate sessions from timetable
   */
  async generateSessions(req, res) {
    try {
      const { timetableId } = req.params;

      const timetable = await Timetable.findById(timetableId);
      if (!timetable) {
        return res.status(404).json({
          success: false,
          message: 'Timetable not found'
        });
      }

      if (timetable.isFinalized) {
        return res.status(400).json({
          success: false,
          message: 'Cannot generate sessions from finalized timetable'
        });
      }

      // Generate sessions
      const generatedSessions = await Timetable.generateSessions(timetableId);

      res.json({
        success: true,
        message: 'Sessions generated successfully',
        data: {
          sessions: generatedSessions,
          count: generatedSessions.length
        }
      });
    } catch (error) {
      console.error('Generate sessions error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to generate sessions',
        error: error.message
      });
    }
  }

  /**
   * Finalize timetable
   */
  async finalizeTimetable(req, res) {
    try {
      const { timetableId } = req.params;
      const finalizedBy = req.user._id;

      const timetable = await Timetable.findById(timetableId);
      if (!timetable) {
        return res.status(404).json({
          success: false,
          message: 'Timetable not found'
        });
      }

      if (timetable.isFinalized) {
        return res.status(400).json({
          success: false,
          message: 'Timetable is already finalized'
        });
      }

      // Finalize timetable
      await timetable.finalize(finalizedBy);

      res.json({
        success: true,
        message: 'Timetable finalized successfully',
        data: { timetable }
      });
    } catch (error) {
      console.error('Finalize timetable error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to finalize timetable',
        error: error.message
      });
    }
  }

  /**
   * Get timetable statistics
   */
  async getTimetableStats(req, res) {
    try {
      const { academicYear, semester } = req.query;

      const query = { isActive: true };
      if (academicYear) query.academicYear = academicYear;
      if (semester) query.semester = semester;

      const totalTimetables = await Timetable.countDocuments(query);
      const finalizedTimetables = await Timetable.countDocuments({ ...query, isFinalized: true });
      const activeTimetables = totalTimetables - finalizedTimetables;

      // Get session generation stats
      const sessionsGenerated = await Session.countDocuments({
        isAutoGenerated: true,
        ...(academicYear && { academicYear }),
        ...(semester && { semester })
      });

      res.json({
        success: true,
        data: {
          totalTimetables,
          finalizedTimetables,
          activeTimetables,
          sessionsGenerated
        }
      });
    } catch (error) {
      console.error('Get timetable stats error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get timetable statistics',
        error: error.message
      });
    }
  }
}

module.exports = new TimetableController();

