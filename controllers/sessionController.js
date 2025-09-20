const Session = require('../models/Session');
const User = require('../models/User');
const QRCodeLog = require('../models/QRCodeLog');
const { validationResult } = require('express-validator');
const qrCodeGenerator = require('../utils/qrCodeGenerator');
const dateUtils = require('../utils/dateUtils');

class SessionController {
  /**
   * Create a new session
   */
  async createSession(req, res) {
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
        subject,
        courseCode,
        startTime,
        endTime,
        location,
        roomNumber,
        building,
        sessionType,
        mode,
        onlineDetails,
        attendanceSettings,
        enrolledStudents,
        maxCapacity
      } = req.body;

      // Create session data
      const sessionData = {
        title,
        description,
        subject,
        courseCode,
        faculty: req.user._id,
        startTime: new Date(startTime),
        endTime: new Date(endTime),
        location,
        roomNumber,
        building,
        sessionType: sessionType || 'lecture',
        mode: mode || 'offline',
        onlineDetails: onlineDetails || {},
        attendanceSettings: attendanceSettings || {},
        enrolledStudents: enrolledStudents || [],
        maxCapacity: maxCapacity || 50,
        createdBy: req.user._id
      };

      // Create session
      const session = await Session.create(sessionData);

      res.status(201).json({
        success: true,
        message: 'Session created successfully',
        data: {
          session
        }
      });
    } catch (error) {
      console.error('Create session error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create session',
        error: error.message
      });
    }
  }

  /**
   * Get sessions
   */
  async getSessions(req, res) {
    try {
      const {
        facultyId,
        studentId,
        subject,
        status,
        startDate,
        endDate,
        page = 1,
        limit = 10
      } = req.query;

      // Build query
      const query = { isActive: true };

      // Apply filters based on user role
      if (req.user.role === 'faculty') {
        query.faculty = req.user._id;
      } else if (req.user.role === 'student') {
        query['enrolledStudents.student'] = req.user._id;
      }

      if (facultyId) query.faculty = facultyId;
      if (studentId) query['enrolledStudents.student'] = studentId;
      if (subject) query.subject = subject;
      if (status) query.status = status;

      if (startDate || endDate) {
        query.startTime = {};
        if (startDate) query.startTime.$gte = new Date(startDate);
        if (endDate) query.startTime.$lte = new Date(endDate);
      }

      // Calculate pagination
      const skip = (parseInt(page) - 1) * parseInt(limit);

      // Get sessions
      const sessions = await Session.find(query)
        .populate('faculty', 'firstName lastName email designation')
        .populate('enrolledStudents.student', 'firstName lastName studentId email')
        .sort({ startTime: -1 })
        .skip(skip)
        .limit(parseInt(limit));

      // Get total count
      const totalSessions = await Session.countDocuments(query);

      res.json({
        success: true,
        data: {
          sessions,
          pagination: {
            currentPage: parseInt(page),
            totalPages: Math.ceil(totalSessions / parseInt(limit)),
            totalSessions,
            hasNextPage: skip + sessions.length < totalSessions,
            hasPrevPage: parseInt(page) > 1
          }
        }
      });
    } catch (error) {
      console.error('Get sessions error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get sessions',
        error: error.message
      });
    }
  }

  /**
   * Get session by ID
   */
  async getSessionById(req, res) {
    try {
      const { sessionId } = req.params;

      const session = await Session.findById(sessionId)
        .populate('faculty', 'firstName lastName email designation')
        .populate('enrolledStudents.student', 'firstName lastName studentId email');

      if (!session) {
        return res.status(404).json({
          success: false,
          message: 'Session not found'
        });
      }

      // Check permissions
      if (req.user.role === 'faculty' && session.faculty._id.toString() !== req.user._id.toString()) {
        return res.status(403).json({
          success: false,
          message: 'You do not have permission to view this session'
        });
      }

      if (req.user.role === 'student') {
        const isEnrolled = session.enrolledStudents.some(
          enrolled => enrolled.student._id.toString() === req.user._id.toString()
        );
        
        if (!isEnrolled) {
          return res.status(403).json({
            success: false,
            message: 'You are not enrolled in this session'
          });
        }
      }

      res.json({
        success: true,
        data: {
          session
        }
      });
    } catch (error) {
      console.error('Get session error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get session',
        error: error.message
      });
    }
  }

  /**
   * Update session
   */
  async updateSession(req, res) {
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

      const { sessionId } = req.params;
      const updateData = req.body;

      // Find session
      const session = await Session.findById(sessionId);

      if (!session) {
        return res.status(404).json({
          success: false,
          message: 'Session not found'
        });
      }

      // Check permissions
      if (req.user.role === 'faculty' && session.faculty.toString() !== req.user._id.toString()) {
        return res.status(403).json({
          success: false,
          message: 'You do not have permission to update this session'
        });
      }

      // Update session
      const updatedSession = await Session.findByIdAndUpdate(
        sessionId,
        updateData,
        { new: true, runValidators: true }
      );

      res.json({
        success: true,
        message: 'Session updated successfully',
        data: {
          session: updatedSession
        }
      });
    } catch (error) {
      console.error('Update session error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update session',
        error: error.message
      });
    }
  }

  /**
   * Delete session
   */
  async deleteSession(req, res) {
    try {
      const { sessionId } = req.params;

      // Find session
      const session = await Session.findById(sessionId);

      if (!session) {
        return res.status(404).json({
          success: false,
          message: 'Session not found'
        });
      }

      // Check permissions
      if (req.user.role === 'faculty' && session.faculty.toString() !== req.user._id.toString()) {
        return res.status(403).json({
          success: false,
          message: 'You do not have permission to delete this session'
        });
      }

      // Soft delete
      session.isActive = false;
      await session.save();

      res.json({
        success: true,
        message: 'Session deleted successfully'
      });
    } catch (error) {
      console.error('Delete session error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to delete session',
        error: error.message
      });
    }
  }

  /**
   * Start session
   */
  async startSession(req, res) {
    try {
      const { sessionId } = req.params;

      // Find session
      const session = await Session.findById(sessionId);

      if (!session) {
        return res.status(404).json({
          success: false,
          message: 'Session not found'
        });
      }

      // Check permissions
      if (req.user.role === 'faculty' && session.faculty.toString() !== req.user._id.toString()) {
        return res.status(403).json({
          success: false,
          message: 'You do not have permission to start this session'
        });
      }

      // Check if session can be started
      if (session.status !== 'scheduled') {
        return res.status(400).json({
          success: false,
          message: 'Session cannot be started in current status'
        });
      }

      // Start session
      await session.startSession();

      // Generate QR code for attendance
      const qrResult = await qrCodeGenerator.generateSessionQR(session, {
        width: 200,
        margin: 2
      });

      if (qrResult.success) {
        // Save QR code log
        await QRCodeLog.create({
          code: qrResult.data.uniqueCode,
          session: session._id,
          generatedBy: req.user._id,
          settings: {
            expiresAt: qrResult.data.expiresAt,
            isActive: true
          },
          payload: qrResult.data.payload
        });
      }

      res.json({
        success: true,
        message: 'Session started successfully',
        data: {
          session,
          qrCode: qrResult.success ? qrResult.data : null
        }
      });
    } catch (error) {
      console.error('Start session error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to start session',
        error: error.message
      });
    }
  }

  /**
   * End session
   */
  async endSession(req, res) {
    try {
      const { sessionId } = req.params;

      // Find session
      const session = await Session.findById(sessionId);

      if (!session) {
        return res.status(404).json({
          success: false,
          message: 'Session not found'
        });
      }

      // Check permissions
      if (req.user.role === 'faculty' && session.faculty.toString() !== req.user._id.toString()) {
        return res.status(403).json({
          success: false,
          message: 'You do not have permission to end this session'
        });
      }

      // Check if session can be ended
      if (session.status !== 'active') {
        return res.status(400).json({
          success: false,
          message: 'Session is not active'
        });
      }

      // End session
      await session.endSession();

      // Deactivate QR code
      const qrCodeLog = await QRCodeLog.findOne({ 'payload.sessionId': session._id });
      if (qrCodeLog) {
        await qrCodeLog.deactivate();
      }

      res.json({
        success: true,
        message: 'Session ended successfully',
        data: {
          session
        }
      });
    } catch (error) {
      console.error('End session error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to end session',
        error: error.message
      });
    }
  }

  /**
   * Add student to session
   */
  async addStudentToSession(req, res) {
    try {
      const { sessionId } = req.params;
      const { studentId } = req.body;

      // Find session
      const session = await Session.findById(sessionId);

      if (!session) {
        return res.status(404).json({
          success: false,
          message: 'Session not found'
        });
      }

      // Check permissions
      if (req.user.role === 'faculty' && session.faculty.toString() !== req.user._id.toString()) {
        return res.status(403).json({
          success: false,
          message: 'You do not have permission to modify this session'
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

      // Add student to session
      await session.addStudent(studentId);

      res.json({
        success: true,
        message: 'Student added to session successfully'
      });
    } catch (error) {
      console.error('Add student to session error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to add student to session',
        error: error.message
      });
    }
  }

  /**
   * Remove student from session
   */
  async removeStudentFromSession(req, res) {
    try {
      const { sessionId } = req.params;
      const { studentId } = req.body;

      // Find session
      const session = await Session.findById(sessionId);

      if (!session) {
        return res.status(404).json({
          success: false,
          message: 'Session not found'
        });
      }

      // Check permissions
      if (req.user.role === 'faculty' && session.faculty.toString() !== req.user._id.toString()) {
        return res.status(403).json({
          success: false,
          message: 'You do not have permission to modify this session'
        });
      }

      // Remove student from session
      await session.removeStudent(studentId);

      res.json({
        success: true,
        message: 'Student removed from session successfully'
      });
    } catch (error) {
      console.error('Remove student from session error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to remove student from session',
        error: error.message
      });
    }
  }

  /**
   * Get session attendance
   */
  async getSessionAttendance(req, res) {
    try {
      const { sessionId } = req.params;

      // Find session
      const session = await Session.findById(sessionId);

      if (!session) {
        return res.status(404).json({
          success: false,
          message: 'Session not found'
        });
      }

      // Check permissions
      if (req.user.role === 'faculty' && session.faculty.toString() !== req.user._id.toString()) {
        return res.status(403).json({
          success: false,
          message: 'You do not have permission to view this session attendance'
        });
      }

      // Get attendance records
      const attendanceRecords = await Session.getSessionAttendance(sessionId);

      res.json({
        success: true,
        data: {
          session,
          attendanceRecords
        }
      });
    } catch (error) {
      console.error('Get session attendance error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get session attendance',
        error: error.message
      });
    }
  }
}

module.exports = new SessionController();
