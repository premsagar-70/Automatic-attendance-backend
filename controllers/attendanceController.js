const Attendance = require('../models/Attendance');
const Session = require('../models/Session');
const User = require('../models/User');
const QRCodeLog = require('../models/QRCodeLog');
const { validationResult } = require('express-validator');
const qrCodeGenerator = require('../utils/qrCodeGenerator');
const analyticsUtils = require('../utils/analyticsUtils');
const dateUtils = require('../utils/dateUtils');

class AttendanceController {
  /**
<<<<<<< HEAD
   * Submit attendance using QR code (pending approval)
   */
  async submitAttendanceByQR(req, res) {
=======
   * Mark attendance using QR code
   */
  async markAttendanceByQR(req, res) {
>>>>>>> 27add0b86d08a4b3721bc69cfd374341a1c8389d
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

      const { qrCodeData, location, deviceInfo } = req.body;
      const studentId = req.user._id;

      // Validate QR code data
      const qrValidation = qrCodeGenerator.validateQRData(qrCodeData);
      
      if (!qrValidation.valid) {
        return res.status(400).json({
          success: false,
          message: qrValidation.error
        });
      }

      const { payload } = qrValidation;

      // Check if QR code is for attendance session
      if (payload.type !== 'attendance_session') {
        return res.status(400).json({
          success: false,
          message: 'Invalid QR code type'
        });
      }

      // Find session
      const session = await Session.findById(payload.sessionId);
      
      if (!session) {
        return res.status(404).json({
          success: false,
          message: 'Session not found'
        });
      }

      // Check if session is active
      if (session.status !== 'active') {
        return res.status(400).json({
          success: false,
          message: 'Session is not active'
        });
      }

      // Check if student is enrolled in the session
      const isEnrolled = session.enrolledStudents.some(
        enrolled => enrolled.student.toString() === studentId.toString()
      );

      if (!isEnrolled) {
        return res.status(403).json({
          success: false,
          message: 'You are not enrolled in this session'
        });
      }

      // Check if attendance already exists
      const existingAttendance = await Attendance.findOne({
        student: studentId,
        session: session._id
      });

      if (existingAttendance) {
        return res.status(400).json({
          success: false,
          message: 'Attendance already marked for this session'
        });
      }

      // Check if session is within allowed time
      const now = new Date();
      const sessionStart = new Date(session.startTime);
      const sessionEnd = new Date(session.endTime);
<<<<<<< HEAD

      // Check if session is currently active
      if (now < sessionStart || now > sessionEnd) {
        return res.status(400).json({
          success: false,
          message: 'Session is not currently active'
        });
      }

      // Create attendance record with pending approval
      const attendanceData = {
        student: studentId,
        session: session._id,
        status: 'present', // Default to present, faculty can change
        checkInTime: now,
        academicYear: session.academicYear,
        semester: session.semester,
=======
      const lateEntryCutoff = new Date(sessionStart.getTime() + (session.attendanceSettings.lateEntryCutoff || 15) * 60 * 1000);

      let status = 'present';
      if (now > lateEntryCutoff) {
        status = 'late';
      }

      // Create attendance record
      const attendanceData = {
        student: studentId,
        session: session._id,
        status,
        checkInTime: now,
>>>>>>> 27add0b86d08a4b3721bc69cfd374341a1c8389d
        location: location || {},
        deviceInfo: deviceInfo || {},
        qrCodeData: {
          code: payload.checksum,
          scannedAt: now,
          isValid: true
<<<<<<< HEAD
        },
        qrSubmission: {
          submittedAt: now,
          isPendingApproval: true
        },
        isApproved: false
=======
        }
>>>>>>> 27add0b86d08a4b3721bc69cfd374341a1c8389d
      };

      const attendance = await Attendance.create(attendanceData);

<<<<<<< HEAD
=======
      // Update session attendance count
      session.currentAttendance += 1;
      await session.save();

>>>>>>> 27add0b86d08a4b3721bc69cfd374341a1c8389d
      // Record QR code scan
      const qrCodeLog = await QRCodeLog.findOne({ 'payload.sessionId': session._id });
      if (qrCodeLog) {
        await qrCodeLog.recordScan(studentId, deviceInfo, location);
      }

      res.status(201).json({
        success: true,
<<<<<<< HEAD
        message: 'Attendance submitted successfully. Waiting for faculty approval.',
        data: {
          attendance,
          status: 'pending_approval',
          submittedAt: now
=======
        message: 'Attendance marked successfully',
        data: {
          attendance,
          status,
          checkInTime: now
>>>>>>> 27add0b86d08a4b3721bc69cfd374341a1c8389d
        }
      });
    } catch (error) {
      console.error('Mark attendance error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to mark attendance',
        error: error.message
      });
    }
  }

  /**
   * Mark attendance manually (for faculty)
   */
  async markAttendanceManually(req, res) {
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
        studentId,
        sessionId,
        status,
        checkInTime,
        notes
      } = req.body;

      // Find session
      const session = await Session.findById(sessionId);
      
      if (!session) {
        return res.status(404).json({
          success: false,
          message: 'Session not found'
        });
      }

      // Check if faculty has access to this session
      if (req.user.role !== 'admin' && session.faculty.toString() !== req.user._id.toString()) {
        return res.status(403).json({
          success: false,
          message: 'You do not have permission to mark attendance for this session'
        });
      }

      // Find student
      const student = await User.findById(studentId);
      
      if (!student) {
        return res.status(404).json({
          success: false,
          message: 'Student not found'
        });
      }

      // Check if attendance already exists
      const existingAttendance = await Attendance.findOne({
        student: studentId,
        session: sessionId
      });

      if (existingAttendance) {
        return res.status(400).json({
          success: false,
          message: 'Attendance already marked for this student'
        });
      }

      // Create attendance record
      const attendanceData = {
        student: studentId,
        session: sessionId,
        status: status || 'present',
        checkInTime: checkInTime || new Date(),
        verifiedBy: req.user._id,
        verifiedAt: new Date(),
        verificationNotes: notes
      };

      const attendance = await Attendance.create(attendanceData);

      // Update session attendance count if present
      if (status === 'present' || status === 'late') {
        session.currentAttendance += 1;
        await session.save();
      }

      res.status(201).json({
        success: true,
        message: 'Attendance marked successfully',
        data: {
          attendance
        }
      });
    } catch (error) {
      console.error('Manual attendance error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to mark attendance',
        error: error.message
      });
    }
  }

  /**
   * Get attendance records
   */
  async getAttendanceRecords(req, res) {
    try {
      const {
        studentId,
        sessionId,
        startDate,
        endDate,
        status,
        page = 1,
        limit = 10
      } = req.query;

      // Build query
      const query = { isActive: true };

      // Apply filters based on user role
      if (req.user.role === 'student') {
        query.student = req.user._id;
      } else if (req.user.role === 'faculty') {
        // Faculty can see attendance for their sessions
        if (sessionId) {
          const session = await Session.findById(sessionId);
          if (session && session.faculty.toString() !== req.user._id.toString()) {
            return res.status(403).json({
              success: false,
              message: 'You do not have permission to view this attendance data'
            });
          }
        }
      }

      if (studentId) query.student = studentId;
      if (sessionId) query.session = sessionId;
      if (status) query.status = status;

      if (startDate || endDate) {
        query.checkInTime = {};
        if (startDate) query.checkInTime.$gte = new Date(startDate);
        if (endDate) query.checkInTime.$lte = new Date(endDate);
      }

      // Calculate pagination
      const skip = (parseInt(page) - 1) * parseInt(limit);

      // Get attendance records
      const attendanceRecords = await Attendance.find(query)
        .populate('student', 'firstName lastName studentId email')
        .populate('session', 'title subject courseCode startTime endTime location')
        .populate('verifiedBy', 'firstName lastName')
        .sort({ checkInTime: -1 })
        .skip(skip)
        .limit(parseInt(limit));

      // Get total count
      const totalRecords = await Attendance.countDocuments(query);

      res.json({
        success: true,
        data: {
          attendanceRecords,
          pagination: {
            currentPage: parseInt(page),
            totalPages: Math.ceil(totalRecords / parseInt(limit)),
            totalRecords,
            hasNextPage: skip + attendanceRecords.length < totalRecords,
            hasPrevPage: parseInt(page) > 1
          }
        }
      });
    } catch (error) {
      console.error('Get attendance records error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get attendance records',
        error: error.message
      });
    }
  }

  /**
   * Get attendance statistics
   */
  async getAttendanceStats(req, res) {
    try {
      const {
        studentId,
        startDate,
        endDate,
        subject
      } = req.query;

      const targetStudentId = studentId || req.user._id;

      // Check permissions
      if (req.user.role === 'student' && targetStudentId !== req.user._id.toString()) {
        return res.status(403).json({
          success: false,
          message: 'You can only view your own attendance statistics'
        });
      }

      // Get attendance records
      const attendanceRecords = await Attendance.find({
        student: targetStudentId,
        isActive: true
      }).populate('session', 'subject startTime');

      // Calculate statistics
      const stats = analyticsUtils.calculateStudentAttendanceStats(attendanceRecords, {
        startDate,
        endDate,
        subject
      });

      // Get trends
      const trends = analyticsUtils.generateAttendanceTrends(attendanceRecords, 'weekly', 12);

      res.json({
        success: true,
        data: {
          stats,
          trends
        }
      });
    } catch (error) {
      console.error('Get attendance stats error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get attendance statistics',
        error: error.message
      });
    }
  }

  /**
   * Update attendance record
   */
  async updateAttendance(req, res) {
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

      const { attendanceId } = req.params;
      const { status, notes } = req.body;

      // Find attendance record
      const attendance = await Attendance.findById(attendanceId)
        .populate('session', 'faculty');

      if (!attendance) {
        return res.status(404).json({
          success: false,
          message: 'Attendance record not found'
        });
      }

      // Check permissions
      if (req.user.role === 'student') {
        return res.status(403).json({
          success: false,
          message: 'Students cannot update attendance records'
        });
      }

      if (req.user.role === 'faculty' && 
          attendance.session.faculty.toString() !== req.user._id.toString()) {
        return res.status(403).json({
          success: false,
          message: 'You do not have permission to update this attendance record'
        });
      }

      // Update attendance
      attendance.status = status || attendance.status;
      attendance.verificationNotes = notes || attendance.verificationNotes;
      attendance.verifiedBy = req.user._id;
      attendance.verifiedAt = new Date();

      await attendance.save();

      res.json({
        success: true,
        message: 'Attendance updated successfully',
        data: {
          attendance
        }
      });
    } catch (error) {
      console.error('Update attendance error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update attendance',
        error: error.message
      });
    }
  }

  /**
   * Delete attendance record
   */
  async deleteAttendance(req, res) {
    try {
      const { attendanceId } = req.params;

      // Find attendance record
      const attendance = await Attendance.findById(attendanceId)
        .populate('session', 'faculty');

      if (!attendance) {
        return res.status(404).json({
          success: false,
          message: 'Attendance record not found'
        });
      }

      // Check permissions
      if (req.user.role === 'student') {
        return res.status(403).json({
          success: false,
          message: 'Students cannot delete attendance records'
        });
      }

      if (req.user.role === 'faculty' && 
          attendance.session.faculty.toString() !== req.user._id.toString()) {
        return res.status(403).json({
          success: false,
          message: 'You do not have permission to delete this attendance record'
        });
      }

      // Soft delete
      attendance.isActive = false;
      await attendance.save();

      res.json({
        success: true,
        message: 'Attendance record deleted successfully'
      });
    } catch (error) {
      console.error('Delete attendance error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to delete attendance record',
        error: error.message
      });
    }
  }

  /**
   * Mark checkout
   */
  async markCheckout(req, res) {
    try {
      const { attendanceId } = req.params;
      const { checkOutTime } = req.body;

      // Find attendance record
      const attendance = await Attendance.findById(attendanceId);

      if (!attendance) {
        return res.status(404).json({
          success: false,
          message: 'Attendance record not found'
        });
      }

      // Check permissions
      if (req.user.role === 'student' && 
          attendance.student.toString() !== req.user._id.toString()) {
        return res.status(403).json({
          success: false,
          message: 'You can only checkout your own attendance'
        });
      }

      // Mark checkout
      await attendance.markCheckout(checkOutTime);

      res.json({
        success: true,
        message: 'Checkout marked successfully',
        data: {
          attendance
        }
      });
    } catch (error) {
      console.error('Mark checkout error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to mark checkout',
        error: error.message
      });
    }
  }
<<<<<<< HEAD

  /**
   * Get pending attendance submissions for faculty approval
   */
  async getPendingAttendance(req, res) {
    try {
      const { sessionId } = req.params;
      const facultyId = req.user._id;

      // Verify faculty has access to this session
      const session = await Session.findById(sessionId);
      if (!session || session.faculty.toString() !== facultyId.toString()) {
        return res.status(403).json({
          success: false,
          message: 'Access denied to this session'
        });
      }

      const pendingAttendance = await Attendance.find({
        session: sessionId,
        'qrSubmission.isPendingApproval': true,
        isApproved: false
      })
      .populate('student', 'firstName lastName studentId email')
      .sort({ 'qrSubmission.submittedAt': 1 });

      res.json({
        success: true,
        data: {
          pendingAttendance,
          count: pendingAttendance.length
        }
      });
    } catch (error) {
      console.error('Get pending attendance error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get pending attendance',
        error: error.message
      });
    }
  }

  /**
   * Approve individual attendance submission
   */
  async approveAttendance(req, res) {
    try {
      const { attendanceId } = req.params;
      const { status, notes } = req.body;
      const facultyId = req.user._id;

      // Validate status
      if (!['present', 'absent', 'excused'].includes(status)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid status. Must be present, absent, or excused'
        });
      }

      const attendance = await Attendance.findById(attendanceId)
        .populate('session', 'faculty title');

      if (!attendance) {
        return res.status(404).json({
          success: false,
          message: 'Attendance record not found'
        });
      }

      // Verify faculty has access to this session
      if (attendance.session.faculty.toString() !== facultyId.toString()) {
        return res.status(403).json({
          success: false,
          message: 'Access denied to this attendance record'
        });
      }

      // Update attendance
      attendance.status = status;
      attendance.isApproved = true;
      attendance.approvedBy = facultyId;
      attendance.approvedAt = new Date();
      attendance.qrSubmission.isPendingApproval = false;
      if (notes) {
        attendance.verificationNotes = notes;
      }

      await attendance.save();

      res.json({
        success: true,
        message: 'Attendance approved successfully',
        data: { attendance }
      });
    } catch (error) {
      console.error('Approve attendance error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to approve attendance',
        error: error.message
      });
    }
  }

  /**
   * Bulk approve all students as present
   */
  async bulkApproveAllPresent(req, res) {
    try {
      const { sessionId } = req.params;
      const facultyId = req.user._id;

      // Verify faculty has access to this session
      const session = await Session.findById(sessionId);
      if (!session || session.faculty.toString() !== facultyId.toString()) {
        return res.status(403).json({
          success: false,
          message: 'Access denied to this session'
        });
      }

      // Get all enrolled students
      const enrolledStudentIds = session.enrolledStudents.map(es => es.student);

      // Get existing attendance records
      const existingAttendance = await Attendance.find({
        session: sessionId,
        student: { $in: enrolledStudentIds }
      });

      const existingStudentIds = existingAttendance.map(a => a.student.toString());

      // Create attendance records for students who haven't submitted
      const newAttendanceRecords = [];
      for (const studentId of enrolledStudentIds) {
        if (!existingStudentIds.includes(studentId.toString())) {
          newAttendanceRecords.push({
            student: studentId,
            session: sessionId,
            status: 'present',
            checkInTime: new Date(),
            academicYear: session.academicYear,
            semester: session.semester,
            isApproved: true,
            approvedBy: facultyId,
            approvedAt: new Date(),
            qrSubmission: {
              submittedAt: new Date(),
              isPendingApproval: false
            }
          });
        }
      }

      // Update existing pending records to approved
      await Attendance.updateMany(
        {
          session: sessionId,
          'qrSubmission.isPendingApproval': true,
          isApproved: false
        },
        {
          $set: {
            status: 'present',
            isApproved: true,
            approvedBy: facultyId,
            approvedAt: new Date(),
            'qrSubmission.isPendingApproval': false
          }
        }
      );

      // Create new attendance records
      if (newAttendanceRecords.length > 0) {
        await Attendance.insertMany(newAttendanceRecords);
      }

      // Update session attendance count
      session.currentAttendance = enrolledStudentIds.length;
      await session.save();

      res.json({
        success: true,
        message: 'All students approved as present successfully',
        data: {
          totalStudents: enrolledStudentIds.length,
          newRecords: newAttendanceRecords.length,
          updatedRecords: existingAttendance.length
        }
      });
    } catch (error) {
      console.error('Bulk approve error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to bulk approve attendance',
        error: error.message
      });
    }
  }

  /**
   * Modify attendance record
   */
  async modifyAttendance(req, res) {
    try {
      const { attendanceId } = req.params;
      const { status, notes } = req.body;
      const facultyId = req.user._id;

      // Validate status
      if (!['present', 'absent', 'excused'].includes(status)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid status. Must be present, absent, or excused'
        });
      }

      const attendance = await Attendance.findById(attendanceId)
        .populate('session', 'faculty title');

      if (!attendance) {
        return res.status(404).json({
          success: false,
          message: 'Attendance record not found'
        });
      }

      // Verify faculty has access to this session
      if (attendance.session.faculty.toString() !== facultyId.toString()) {
        return res.status(403).json({
          success: false,
          message: 'Access denied to this attendance record'
        });
      }

      // Update attendance
      attendance.status = status;
      attendance.verifiedBy = facultyId;
      attendance.verifiedAt = new Date();
      if (notes) {
        attendance.verificationNotes = notes;
      }

      await attendance.save();

      res.json({
        success: true,
        message: 'Attendance modified successfully',
        data: { attendance }
      });
    } catch (error) {
      console.error('Modify attendance error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to modify attendance',
        error: error.message
      });
    }
  }
=======
>>>>>>> 27add0b86d08a4b3721bc69cfd374341a1c8389d
}

module.exports = new AttendanceController();
