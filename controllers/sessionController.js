const Session = require('../models/Session');
const User = require('../models/User');
const QRCodeLog = require('../models/QRCodeLog');
const { validationResult } = require('express-validator');
const qrCodeGenerator = require('../utils/qrCodeGenerator');
const dateUtils = require('../utils/dateUtils');

class SessionController {
  // Create a new session
  async createSession(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, message: 'Validation failed', errors: errors.array() });
      }

      const data = req.body;
      data.createdBy = req.user ? req.user._id : null;

      const session = new Session(data);
      const saved = await session.save();

      res.status(201).json({ success: true, message: 'Session created', data: { session: saved } });
    } catch (error) {
      console.error('Create session error:', error);
      res.status(500).json({ success: false, message: 'Failed to create session', error: error.message });
    }
  }

  // List sessions with filters and pagination
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

      const query = { isActive: true };

      if (facultyId) query.faculty = facultyId;
      if (studentId) query['enrolledStudents.student'] = studentId;
      if (subject) query.subject = subject;
      if (status) query.status = status;

      if (startDate || endDate) {
        query.startTime = {};
        if (startDate) query.startTime.$gte = new Date(startDate);
        if (endDate) query.startTime.$lte = new Date(endDate);
      }

      // If admin and HOD, scope to their department's faculty unless explicit filters provided
      if (req.user && req.user.role === 'admin' && !facultyId && !studentId) {
        const Department = require('../models/Department');
        const hodDept = await Department.findOne({ head: req.user._id });
        if (hodDept) {
          const facultyDocs = await User.find({ role: 'faculty', department: hodDept._id }).select('_id');
          const facultyIds = facultyDocs.map(f => f._id);
          if (facultyIds.length) query.faculty = { $in: facultyIds };
        }
      }

      const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);

      const sessions = await Session.find(query)
        .sort({ startTime: -1 })
        .skip(skip)
        .limit(parseInt(limit, 10))
        .populate('faculty', 'firstName lastName email designation department')
        .populate('enrolledStudents.student', 'firstName lastName studentId email');

      const totalSessions = await Session.countDocuments(query);

      res.json({
        success: true,
        data: {
          sessions,
          pagination: {
            currentPage: parseInt(page, 10),
            totalPages: Math.ceil(totalSessions / parseInt(limit, 10)),
            totalSessions,
            hasNextPage: skip + sessions.length < totalSessions,
            hasPrevPage: parseInt(page, 10) > 1
          }
        }
      });
    } catch (error) {
      console.error('Get sessions error:', error);
      res.status(500).json({ success: false, message: 'Failed to get sessions', error: error.message });
    }
  }

  // Get session by ID
  async getSessionById(req, res) {
    try {
      const { sessionId } = req.params;

      const session = await Session.findById(sessionId)
        .populate('faculty', 'firstName lastName email designation department')
        .populate('enrolledStudents.student', 'firstName lastName studentId email');

      if (!session) return res.status(404).json({ success: false, message: 'Session not found' });

      // Permissions
      if (req.user && req.user.role === 'faculty' && session.faculty && session.faculty._id.toString() !== req.user._id.toString()) {
        return res.status(403).json({ success: false, message: 'You do not have permission to view this session' });
      }

      if (req.user && req.user.role === 'student') {
        const isEnrolled = session.enrolledStudents.some(enrolled => String(enrolled.student._id || enrolled.student) === String(req.user._id));
        if (!isEnrolled) return res.status(403).json({ success: false, message: 'You are not enrolled in this session' });
      }

      res.json({ success: true, data: { session } });
    } catch (error) {
      console.error('Get session error:', error);
      res.status(500).json({ success: false, message: 'Failed to get session', error: error.message });
    }
  }

  // Update session
  async updateSession(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ success: false, message: 'Validation failed', errors: errors.array() });

      const { sessionId } = req.params;
      const updateData = req.body;

      const session = await Session.findById(sessionId);
      if (!session) return res.status(404).json({ success: false, message: 'Session not found' });

      if (req.user && req.user.role === 'faculty' && String(session.faculty) !== String(req.user._id)) {
        return res.status(403).json({ success: false, message: 'You do not have permission to update this session' });
      }

      const updated = await Session.findByIdAndUpdate(sessionId, updateData, { new: true, runValidators: true });
      res.json({ success: true, message: 'Session updated successfully', data: { session: updated } });
    } catch (error) {
      console.error('Update session error:', error);
      res.status(500).json({ success: false, message: 'Failed to update session', error: error.message });
    }
  }

  // Soft delete session
  async deleteSession(req, res) {
    try {
      const { sessionId } = req.params;
      const session = await Session.findById(sessionId);
      if (!session) return res.status(404).json({ success: false, message: 'Session not found' });

      if (req.user && req.user.role === 'faculty' && String(session.faculty) !== String(req.user._id)) {
        return res.status(403).json({ success: false, message: 'You do not have permission to delete this session' });
      }

      session.isActive = false;
      await session.save();

      res.json({ success: true, message: 'Session deleted successfully' });
    } catch (error) {
      console.error('Delete session error:', error);
      res.status(500).json({ success: false, message: 'Failed to delete session', error: error.message });
    }
  }

  // Start session and generate QR
  async startSession(req, res) {
    try {
      const { sessionId } = req.params;
      const session = await Session.findById(sessionId);
      if (!session) return res.status(404).json({ success: false, message: 'Session not found' });

      if (req.user && req.user.role === 'faculty' && String(session.faculty) !== String(req.user._id)) {
        return res.status(403).json({ success: false, message: 'You do not have permission to start this session' });
      }

      if (session.status !== 'scheduled') return res.status(400).json({ success: false, message: 'Session cannot be started in current status' });

      await session.startSession();

      const qrResult = await qrCodeGenerator.generateSessionQR(session, { width: 200, margin: 2 });
      if (qrResult.success) {
        await QRCodeLog.create({
          code: qrResult.data.uniqueCode,
          session: session._id,
          generatedBy: req.user ? req.user._id : null,
          settings: { expiresAt: qrResult.data.expiresAt, isActive: true },
          payload: qrResult.data.payload
        });
      }

      res.json({ success: true, message: 'Session started successfully', data: { session, qrCode: qrResult.success ? qrResult.data : null } });
    } catch (error) {
      console.error('Start session error:', error);
      res.status(500).json({ success: false, message: 'Failed to start session', error: error.message });
    }
  }

  // End session
  async endSession(req, res) {
    try {
      const { sessionId } = req.params;
      const session = await Session.findById(sessionId);
      if (!session) return res.status(404).json({ success: false, message: 'Session not found' });

      if (req.user && req.user.role === 'faculty' && String(session.faculty) !== String(req.user._id)) {
        return res.status(403).json({ success: false, message: 'You do not have permission to end this session' });
      }

      if (session.status !== 'active') return res.status(400).json({ success: false, message: 'Session is not active' });

      await session.endSession();

      const qrCodeLog = await QRCodeLog.findOne({ 'payload.sessionId': session._id });
      if (qrCodeLog && typeof qrCodeLog.deactivate === 'function') {
        await qrCodeLog.deactivate();
      }

      res.json({ success: true, message: 'Session ended successfully', data: { session } });
    } catch (error) {
      console.error('End session error:', error);
      res.status(500).json({ success: false, message: 'Failed to end session', error: error.message });
    }
  }

  // Add student
  async addStudentToSession(req, res) {
    try {
      const { sessionId } = req.params;
      const { studentId } = req.body;

      const session = await Session.findById(sessionId);
      if (!session) return res.status(404).json({ success: false, message: 'Session not found' });

      if (req.user && req.user.role === 'faculty' && String(session.faculty) !== String(req.user._id)) {
        return res.status(403).json({ success: false, message: 'You do not have permission to modify this session' });
      }

      const student = await User.findById(studentId);
      if (!student) return res.status(404).json({ success: false, message: 'Student not found' });

      await session.addStudent(studentId);
      res.json({ success: true, message: 'Student added to session successfully' });
    } catch (error) {
      console.error('Add student to session error:', error);
      res.status(500).json({ success: false, message: 'Failed to add student to session', error: error.message });
    }
  }

  // Remove student
  async removeStudentFromSession(req, res) {
    try {
      const { sessionId } = req.params;
      const { studentId } = req.body;

      const session = await Session.findById(sessionId);
      if (!session) return res.status(404).json({ success: false, message: 'Session not found' });

      if (req.user && req.user.role === 'faculty' && String(session.faculty) !== String(req.user._id)) {
        return res.status(403).json({ success: false, message: 'You do not have permission to modify this session' });
      }

      await session.removeStudent(studentId);
      res.json({ success: true, message: 'Student removed from session successfully' });
    } catch (error) {
      console.error('Remove student from session error:', error);
      res.status(500).json({ success: false, message: 'Failed to remove student from session', error: error.message });
    }
  }

  // Get session attendance
  async getSessionAttendance(req, res) {
    try {
      const { sessionId } = req.params;
      const session = await Session.findById(sessionId);
      if (!session) return res.status(404).json({ success: false, message: 'Session not found' });

      if (req.user && req.user.role === 'faculty' && String(session.faculty) !== String(req.user._id)) {
        return res.status(403).json({ success: false, message: 'You do not have permission to view this session attendance' });
      }

      // If Session model exposes a helper, use it; otherwise return enrolledStudents and currentAttendance
      let attendanceRecords = [];
      if (typeof Session.getSessionAttendance === 'function') {
        attendanceRecords = await Session.getSessionAttendance(sessionId);
      }

      res.json({ success: true, data: { session, attendanceRecords } });
    } catch (error) {
      console.error('Get session attendance error:', error);
      res.status(500).json({ success: false, message: 'Failed to get session attendance', error: error.message });
    }
  }
}

module.exports = new SessionController();
