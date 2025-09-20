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
   * Mark attendance using QR code
   */
  async markAttendanceByQR(req, res) {
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
        location: location || {},
        deviceInfo: deviceInfo || {},
        qrCodeData: {
          code: payload.checksum,
          scannedAt: now,
          isValid: true
        }
      };

      const attendance = await Attendance.create(attendanceData);

      // Update session attendance count
      session.currentAttendance += 1;
      await session.save();

      // Record QR code scan
      const qrCodeLog = await QRCodeLog.findOne({ 'payload.sessionId': session._id });
      if (qrCodeLog) {
        await qrCodeLog.recordScan(studentId, deviceInfo, location);
      }

      res.status(201).json({
        success: true,
        message: 'Attendance marked successfully',
        data: {
          attendance,
          status,
          checkInTime: now
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
}

module.exports = new AttendanceController();
