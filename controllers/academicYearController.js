const AcademicYear = require('../models/AcademicYear');
const { validationResult } = require('express-validator');

class AcademicYearController {
  /**
   * Create a new academic year
   */
  async createAcademicYear(req, res) {
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
        year,
        startDate,
        endDate,
        semesters
      } = req.body;

      const createdBy = req.user._id;

      // Check if academic year already exists
      const existingYear = await AcademicYear.findOne({ year });
      if (existingYear) {
        return res.status(400).json({
          success: false,
          message: 'Academic year already exists'
        });
      }

      // Validate semester data
      if (!semesters || semesters.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'At least one semester is required'
        });
      }

      // Validate semester names (only 1, 2, Summer, Winter)
      const validSemesterNames = ['1', '2', 'Summer', 'Winter'];
      for (const semester of semesters) {
        if (!validSemesterNames.includes(semester.name)) {
          return res.status(400).json({
            success: false,
            message: `Invalid semester name: ${semester.name}. Must be 1, 2, Summer, or Winter`
          });
        }
      }

      const academicYearData = {
        year,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        semesters: semesters.map(sem => ({
          ...sem,
          startDate: new Date(sem.startDate),
          endDate: new Date(sem.endDate)
        })),
        createdBy
      };

      const academicYear = await AcademicYear.create(academicYearData);

      res.status(201).json({
        success: true,
        message: 'Academic year created successfully',
        data: { academicYear }
      });
    } catch (error) {
      console.error('Create academic year error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create academic year',
        error: error.message
      });
    }
  }

  /**
   * Get all academic years
   */
  async getAcademicYears(req, res) {
    try {
      const {
        page = 1,
        limit = 10,
        year,
        isActive,
        isCurrent
      } = req.query;

      const query = { isDeleted: false };

      if (year) query.year = { $regex: year, $options: 'i' };
      if (isActive !== undefined) query.isActive = isActive === 'true';
      if (isCurrent !== undefined) query.isCurrent = isCurrent === 'true';

      const academicYears = await AcademicYear.find(query)
        .populate('createdBy', 'firstName lastName email')
        .populate('semesters.finalizedBy', 'firstName lastName email')
        .sort({ year: -1 })
        .limit(limit * 1)
        .skip((page - 1) * limit);

      const totalAcademicYears = await AcademicYear.countDocuments(query);

      res.json({
        success: true,
        data: {
          academicYears,
          pagination: {
            currentPage: parseInt(page),
            totalPages: Math.ceil(totalAcademicYears / limit),
            totalAcademicYears,
            hasNext: page < Math.ceil(totalAcademicYears / limit),
            hasPrev: page > 1
          }
        }
      });
    } catch (error) {
      console.error('Get academic years error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get academic years',
        error: error.message
      });
    }
  }

  /**
   * Get academic year by ID
   */
  async getAcademicYearById(req, res) {
    try {
      const { academicYearId } = req.params;

      const academicYear = await AcademicYear.findById(academicYearId)
        .populate('createdBy', 'firstName lastName email')
        .populate('semesters.finalizedBy', 'firstName lastName email');

      if (!academicYear) {
        return res.status(404).json({
          success: false,
          message: 'Academic year not found'
        });
      }

      res.json({
        success: true,
        data: { academicYear }
      });
    } catch (error) {
      console.error('Get academic year error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get academic year',
        error: error.message
      });
    }
  }

  /**
   * Update academic year
   */
  async updateAcademicYear(req, res) {
    try {
      const { academicYearId } = req.params;
      const updateData = req.body;

      // Check if academic year exists
      const academicYear = await AcademicYear.findById(academicYearId);
      if (!academicYear) {
        return res.status(404).json({
          success: false,
          message: 'Academic year not found'
        });
      }

      // Validate semester data if provided
      if (updateData.semesters) {
        const validSemesterNames = ['1', '2', 'Summer', 'Winter'];
        for (const semester of updateData.semesters) {
          if (!validSemesterNames.includes(semester.name)) {
            return res.status(400).json({
              success: false,
              message: `Invalid semester name: ${semester.name}. Must be 1, 2, Summer, or Winter`
            });
          }
        }
      }

      // Convert date strings to Date objects
      if (updateData.startDate) updateData.startDate = new Date(updateData.startDate);
      if (updateData.endDate) updateData.endDate = new Date(updateData.endDate);
      if (updateData.semesters) {
        updateData.semesters = updateData.semesters.map(sem => ({
          ...sem,
          startDate: new Date(sem.startDate),
          endDate: new Date(sem.endDate)
        }));
      }

      const updatedAcademicYear = await AcademicYear.findByIdAndUpdate(
        academicYearId,
        updateData,
        { new: true, runValidators: true }
      )
      .populate('createdBy', 'firstName lastName email')
      .populate('semesters.finalizedBy', 'firstName lastName email');

      res.json({
        success: true,
        message: 'Academic year updated successfully',
        data: { academicYear: updatedAcademicYear }
      });
    } catch (error) {
      console.error('Update academic year error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update academic year',
        error: error.message
      });
    }
  }

  /**
   * Delete academic year (soft delete)
   */
  async deleteAcademicYear(req, res) {
    try {
      const { academicYearId } = req.params;

      const academicYear = await AcademicYear.findById(academicYearId);
      if (!academicYear) {
        return res.status(404).json({
          success: false,
          message: 'Academic year not found'
        });
      }

      if (academicYear.isCurrent) {
        return res.status(400).json({
          success: false,
          message: 'Cannot delete current academic year'
        });
      }

      // Soft delete
      academicYear.isDeleted = true;
      await academicYear.save();

      res.json({
        success: true,
        message: 'Academic year deleted successfully'
      });
    } catch (error) {
      console.error('Delete academic year error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to delete academic year',
        error: error.message
      });
    }
  }

  /**
   * Set academic year as current
   */
  async setCurrentAcademicYear(req, res) {
    try {
      const { academicYearId } = req.params;

      const academicYear = await AcademicYear.findById(academicYearId);
      if (!academicYear) {
        return res.status(404).json({
          success: false,
          message: 'Academic year not found'
        });
      }

      await academicYear.setAsCurrent();

      res.json({
        success: true,
        message: 'Academic year set as current successfully',
        data: { academicYear }
      });
    } catch (error) {
      console.error('Set current academic year error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to set current academic year',
        error: error.message
      });
    }
  }

  /**
   * Activate semester
   */
  async activateSemester(req, res) {
    try {
      const { academicYearId } = req.params;
      const { semesterName } = req.body;

      const academicYear = await AcademicYear.findById(academicYearId);
      if (!academicYear) {
        return res.status(404).json({
          success: false,
          message: 'Academic year not found'
        });
      }

      await academicYear.activateSemester(semesterName);

      res.json({
        success: true,
        message: 'Semester activated successfully',
        data: { academicYear }
      });
    } catch (error) {
      console.error('Activate semester error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to activate semester',
        error: error.message
      });
    }
  }

  /**
   * Finalize semester
   */
  async finalizeSemester(req, res) {
    try {
      const { academicYearId } = req.params;
      const { semesterName } = req.body;
      const finalizedBy = req.user._id;

      const academicYear = await AcademicYear.findById(academicYearId);
      if (!academicYear) {
        return res.status(404).json({
          success: false,
          message: 'Academic year not found'
        });
      }

      await academicYear.finalizeSemester(semesterName, finalizedBy);

      res.json({
        success: true,
        message: 'Semester finalized successfully',
        data: { academicYear }
      });
    } catch (error) {
      console.error('Finalize semester error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to finalize semester',
        error: error.message
      });
    }
  }

  /**
   * Finalize a semester and advance students to next semester/year.
   * Body: { semesterName }
   * Query: ?dryRun=true (optional) - preview changes without applying
   */
  async finalizeAndAdvanceSemester(req, res) {
    try {
      const { academicYearId } = req.params;
      const { semesterName } = req.body;
      const dryRun = req.query.dryRun === 'true';

      const academicYear = await AcademicYear.findById(academicYearId);
      if (!academicYear) {
        return res.status(404).json({ success: false, message: 'Academic year not found' });
      }

      // Ensure semester exists in at least one academicYears entry
      let affectedYearEntry = null;
      for (const ay of academicYear.academicYears) {
        const sem = ay.semesters.find(s => s.name === semesterName);
        if (sem) {
          affectedYearEntry = ay;
          break;
        }
      }

      if (!affectedYearEntry) {
        return res.status(400).json({ success: false, message: 'Semester not found in this academic year' });
      }

      // Determine student advancement mapping: for each student in academicYear X and semester S,
      // advance to next semester/year using these rules:
      // - If semester is '1' -> move to '2' within same year
      // - If semester is '2' -> move to next year 'n+1' and semester '1' (unless already year 4)

      const User = require('../models/User');

      // Collect students to advance
      const studentsToAdvance = await User.find({
        role: 'student',
        isActive: true,
        academicYear: affectedYearEntry.year,
        semester: semesterName
      }).select('_id academicYear semester fullName email');

      const advances = [];

      for (const student of studentsToAdvance) {
        const currentYear = parseInt(student.academicYear, 10);
        const currentSem = student.semester;

        let newYear = student.academicYear;
        let newSem = student.semester;
        let action = 'none';

        if (currentSem === '1') {
          newSem = '2';
          action = 'advance-semester';
        } else if (currentSem === '2') {
          if (currentYear < 4) {
            newYear = String(currentYear + 1);
            newSem = '1';
            action = 'advance-year';
          } else {
            // Year 4, semester 2 -> graduation/complete. We'll mark as 'graduated' via a flag.
            newYear = student.academicYear;
            newSem = student.semester;
            action = 'graduate';
          }
        }

        advances.push({ studentId: student._id, name: student.fullName, from: `${student.academicYear}-${student.semester}`, to: `${newYear}-${newSem}`, action });
      }

      if (dryRun) {
        return res.json({ success: true, message: 'Dry run', data: { total: studentsToAdvance.length, advances } });
      }

      // Apply changes in bulk
      const bulkOps = advances.map(a => {
        if (a.action === 'graduate') {
          return {
            updateOne: {
              filter: { _id: a.studentId },
              update: { $set: { isActive: false, graduated: true } }
            }
          };
        }
        const [ny, ns] = a.to.split('-');
        return {
          updateOne: {
            filter: { _id: a.studentId },
            update: { $set: { academicYear: ny, semester: ns } }
          }
        };
      });

      if (bulkOps.length > 0) {
        const result = await User.bulkWrite(bulkOps);
        // Finalize semester in AcademicYear model
        await academicYear.finalizeSemester(affectedYearEntry.year, semesterName, req.user._id);

        // Record audit log
        try {
          const AuditLog = require('../models/AuditLog');
          await AuditLog.create({
            action: 'finalize_and_advance_semester',
            actor: req.user._id,
            targetType: 'AcademicYear',
            targetId: academicYear._id,
            details: { total: advances.length, advancesSummary: advances.map(a => ({ studentId: a.studentId, action: a.action })) }
          });
        } catch (logErr) {
          console.warn('Failed to write audit log', logErr.message);
        }

        return res.json({ success: true, message: 'Semester finalized and students advanced', data: { total: advances.length, advances, writeResult: result } });
      }

      // Nothing to change
      await academicYear.finalizeSemester(affectedYearEntry.year, semesterName, req.user._id);
      return res.json({ success: true, message: 'Semester finalized; no students matched the criteria', data: { total: 0 } });
    } catch (error) {
      console.error('Finalize and advance semester error:', error);
      res.status(500).json({ success: false, message: 'Failed to finalize and advance semester', error: error.message });
    }
  }

  async getAuditLogsForAcademicYear(req, res) {
    try {
      const { academicYearId } = req.params;
      const AuditLog = require('../models/AuditLog');

      const logs = await AuditLog.find({ targetType: 'AcademicYear', targetId: academicYearId })
        .populate('actor', 'firstName lastName email')
        .sort({ createdAt: -1 })
        .limit(100);

      return res.json({ success: true, data: { logs } });
    } catch (error) {
      console.error('Get audit logs error:', error);
      return res.status(500).json({ success: false, message: 'Failed to fetch audit logs', error: error.message });
    }
  }

  /**
   * Get current academic year and semester
   */
  async getCurrentAcademicInfo(req, res) {
    try {
      const currentAcademicYear = await AcademicYear.getCurrentAcademicYear();
      const currentSemester = await AcademicYear.getCurrentSemester();

      res.json({
        success: true,
        data: {
          currentAcademicYear,
          currentSemester
        }
      });
    } catch (error) {
      console.error('Get current academic info error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get current academic info',
        error: error.message
      });
    }
  }

  /**
   * Get academic year statistics
   */
  async getAcademicYearStats(req, res) {
    try {
      const totalAcademicYears = await AcademicYear.countDocuments({ isDeleted: false });
      const activeAcademicYears = await AcademicYear.countDocuments({ isActive: true, isDeleted: false });
      const currentAcademicYear = await AcademicYear.findOne({ isCurrent: true, isDeleted: false });

      res.json({
        success: true,
        data: {
          totalAcademicYears,
          activeAcademicYears,
          currentAcademicYear: currentAcademicYear?.year || null
        }
      });
    } catch (error) {
      console.error('Get academic year stats error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get academic year statistics',
        error: error.message
      });
    }
  }
}

module.exports = new AcademicYearController();
