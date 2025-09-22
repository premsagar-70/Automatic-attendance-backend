const Attendance = require('../models/Attendance');
const Session = require('../models/Session');
const User = require('../models/User');
const analyticsUtils = require('../utils/analyticsUtils');
const dateUtils = require('../utils/dateUtils');

class ReportController {
  constructor() {
    // Bind handler methods so `this` references the controller instance when used as Express handlers
    this.getAttendanceSummary = this.getAttendanceSummary.bind(this);
    this.getDetailedAttendanceReport = this.getDetailedAttendanceReport.bind(this);
    this.getAttendanceAnalytics = this.getAttendanceAnalytics.bind(this);
    this.getAtRiskStudentsReport = this.getAtRiskStudentsReport.bind(this);
    this.getSessionPerformanceReport = this.getSessionPerformanceReport.bind(this);
    this.exportAttendanceData = this.exportAttendanceData.bind(this);
  }
  /**
   * Get attendance summary report
   */
  async getAttendanceSummary(req, res) {
    try {
      const {
        startDate,
        endDate,
        studentId,
        sessionId,
        subject,
        groupBy = 'student'
      } = req.query;

      // Build base query
      const baseQuery = { isActive: true };

      // If requester is an admin who is a department head, scope reports to their department unless department is explicitly provided
      if (req.user && req.user.role === 'admin' && !req.query.department) {
        try {
          const Department = require('../models/Department');
          const hodDept = await Department.findOne({ head: req.user._id });
          if (hodDept) {
            baseQuery['student.department'] = hodDept._id;
          }
        } catch (err) {
          console.warn('[reportController] HOD scoping failed', err.message);
        }
      }

      if (startDate || endDate) {
        baseQuery.checkInTime = {};
        if (startDate) baseQuery.checkInTime.$gte = new Date(startDate);
        if (endDate) baseQuery.checkInTime.$lte = new Date(endDate);
      }

      if (studentId) baseQuery.student = studentId;
      if (sessionId) baseQuery.session = sessionId;

      // Get attendance records
      let attendanceRecords = await Attendance.find(baseQuery)
        .populate('student', 'firstName lastName studentId email department')
        .populate('session', 'title subject courseCode startTime faculty');

      // Filter by subject if specified
      if (subject) {
        attendanceRecords = attendanceRecords.filter(record => 
          record.session && String(record.session.subject) === String(subject)
        );
      }

      // Generate report based on groupBy
      let reportData = {};

      switch (groupBy) {
        case 'student':
          reportData = this.generateStudentReport(attendanceRecords);
          break;
        case 'session':
          reportData = this.generateSessionReport(attendanceRecords);
          break;
        case 'subject':
          reportData = this.generateSubjectReport(attendanceRecords);
          break;
        case 'department':
          reportData = this.generateDepartmentReport(attendanceRecords);
          break;
        default:
          return res.status(400).json({
            success: false,
            message: 'Invalid groupBy parameter'
          });
      }

      res.json({
        success: true,
        data: {
          reportData,
          summary: {
            totalRecords: attendanceRecords.length,
            dateRange: {
              startDate: startDate || 'All time',
              endDate: endDate || 'All time'
            },
            groupBy
          }
        }
      });
    } catch (error) {
      console.error('Get attendance summary error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to generate attendance summary',
        error: error.message
      });
    }
  }

  /**
   * Get detailed attendance report
   */
  async getDetailedAttendanceReport(req, res) {
    try {
      const {
        studentId,
        sessionId,
        startDate,
        endDate,
        page = 1,
        limit = 50
      } = req.query;

      // Build query
      const query = { isActive: true };

      if (studentId) query.student = studentId;
      if (sessionId) query.session = sessionId;

      if (startDate || endDate) {
        query.checkInTime = {};
        if (startDate) query.checkInTime.$gte = new Date(startDate);
        if (endDate) query.checkInTime.$lte = new Date(endDate);
      }

      // Calculate pagination
      const skip = (parseInt(page) - 1) * parseInt(limit);

      // Get attendance records
      const attendanceRecords = await Attendance.find(query)
        .populate('student', 'firstName lastName studentId email department')
        .populate('session', 'title subject courseCode startTime endTime location faculty')
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
      console.error('Get detailed attendance report error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to generate detailed attendance report',
        error: error.message
      });
    }
  }

  /**
   * Get attendance analytics
   */
  async getAttendanceAnalytics(req, res) {
    try {
      const {
        studentId,
        startDate,
        endDate,
        period = 'weekly'
      } = req.query;

      const targetStudentId = studentId || req.user._id;

      // Check permissions
      if (req.user.role === 'student' && targetStudentId !== req.user._id.toString()) {
        return res.status(403).json({
          success: false,
          message: 'You can only view your own attendance analytics'
        });
      }

      // Get attendance records
      const query = { student: targetStudentId, isActive: true };

      if (startDate || endDate) {
        query.checkInTime = {};
        if (startDate) query.checkInTime.$gte = new Date(startDate);
        if (endDate) query.checkInTime.$lte = new Date(endDate);
      }

      const attendanceRecords = await Attendance.find(query)
        .populate('session', 'subject startTime');

      // Calculate analytics
      const stats = analyticsUtils.calculateStudentAttendanceStats(attendanceRecords, {
        startDate,
        endDate
      });

      const trends = analyticsUtils.generateAttendanceTrends(attendanceRecords, period, 12);
      const heatmap = analyticsUtils.generateAttendanceHeatmap(attendanceRecords, 'dayOfWeek');

      res.json({
        success: true,
        data: {
          stats,
          trends,
          heatmap
        }
      });
    } catch (error) {
      console.error('Get attendance analytics error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to generate attendance analytics',
        error: error.message
      });
    }
  }

  /**
   * Get at-risk students report
   */
  async getAtRiskStudentsReport(req, res) {
    try {
      const {
        minAttendancePercentage = 70,
        minSessions = 5,
        lookbackDays = 30,
        department
      } = req.query;

      // Get students with attendance records
      const students = await User.find({
        role: 'student',
        isActive: true,
        ...(department && { department })
      });

      // Get attendance records for each student
      const studentsWithAttendance = await Promise.all(
        students.map(async (student) => {
          const attendanceRecords = await Attendance.find({
            student: student._id,
            isActive: true,
            checkInTime: {
              $gte: new Date(Date.now() - lookbackDays * 24 * 60 * 60 * 1000)
            }
          }).populate('session', 'subject startTime');

          return {
            ...student.toObject(),
            attendanceRecords
          };
        })
      );

      // Identify at-risk students
      const atRiskStudents = analyticsUtils.identifyAtRiskStudents(studentsWithAttendance, {
        minAttendancePercentage: parseInt(minAttendancePercentage),
        minSessions: parseInt(minSessions),
        lookbackDays: parseInt(lookbackDays)
      });

      res.json({
        success: true,
        data: {
          atRiskStudents,
          criteria: {
            minAttendancePercentage: parseInt(minAttendancePercentage),
            minSessions: parseInt(minSessions),
            lookbackDays: parseInt(lookbackDays)
          },
          totalAtRisk: atRiskStudents.length,
          totalStudents: studentsWithAttendance.length
        }
      });
    } catch (error) {
      console.error('Get at-risk students report error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to generate at-risk students report',
        error: error.message
      });
    }
  }

  /**
   * Get session performance report
   */
  async getSessionPerformanceReport(req, res) {
    try {
      const {
        sessionId,
        facultyId,
        startDate,
        endDate,
        subject
      } = req.query;

      // Build session query
      const sessionQuery = { isActive: true };

      if (sessionId) sessionQuery._id = sessionId;
      if (facultyId) sessionQuery.faculty = facultyId;
      if (subject) sessionQuery.subject = subject;

      if (startDate || endDate) {
        sessionQuery.startTime = {};
        if (startDate) sessionQuery.startTime.$gte = new Date(startDate);
        if (endDate) sessionQuery.startTime.$lte = new Date(endDate);
      }

      // Get sessions
      const sessions = await Session.find(sessionQuery)
        .populate('faculty', 'firstName lastName email');

      // Get performance data for each session
      const sessionPerformance = await Promise.all(
        sessions.map(async (session) => {
          const attendanceRecords = await Attendance.find({
            session: session._id,
            isActive: true
          });

          const stats = analyticsUtils.calculateSessionStats(
            attendanceRecords,
            session.enrolledStudents.length
          );

          return {
            session: {
              id: session._id,
              title: session.title,
              subject: session.subject,
              courseCode: session.courseCode,
              startTime: session.startTime,
              endTime: session.endTime,
              location: session.location,
              faculty: session.faculty
            },
            performance: stats
          };
        })
      );

      res.json({
        success: true,
        data: {
          sessionPerformance,
          summary: {
            totalSessions: sessions.length,
            averageAttendanceRate: sessionPerformance.reduce(
              (sum, sp) => sum + sp.performance.attendanceRate, 0
            ) / sessionPerformance.length || 0
          }
        }
      });
    } catch (error) {
      console.error('Get session performance report error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to generate session performance report',
        error: error.message
      });
    }
  }

  /**
   * Export attendance data
   */
  async exportAttendanceData(req, res) {
    try {
      const {
        format = 'json',
        startDate,
        endDate,
        studentId,
        sessionId,
        subject
      } = req.query;

      // Build query
      const query = { isActive: true };

      if (studentId) query.student = studentId;
      if (sessionId) query.session = sessionId;

      if (startDate || endDate) {
        query.checkInTime = {};
        if (startDate) query.checkInTime.$gte = new Date(startDate);
        if (endDate) query.checkInTime.$lte = new Date(endDate);
      }

      // Get attendance records
      const attendanceRecords = await Attendance.find(query)
        .populate('student', 'firstName lastName studentId email department')
        .populate('session', 'title subject courseCode startTime endTime location')
        .populate('verifiedBy', 'firstName lastName')
        .sort({ checkInTime: -1 });

      // Filter by subject if specified
      let filteredRecords = attendanceRecords;
      if (subject) {
        filteredRecords = attendanceRecords.filter(record => 
          record.session && record.session.subject === subject
        );
      }

      // Format data for export
      const exportData = filteredRecords.map(record => ({
        studentName: record.student ? `${record.student.firstName} ${record.student.lastName}` : 'N/A',
        studentId: record.student ? record.student.studentId : 'N/A',
        studentEmail: record.student ? record.student.email : 'N/A',
        department: record.student ? (typeof record.student.department === 'object' ? (record.student.department.name || record.student.department.code || String(record.student.department._id)) : (record.student.department || 'N/A')) : 'N/A',
        sessionTitle: record.session ? record.session.title : 'N/A',
        subject: record.session ? (typeof record.session.subject === 'object' ? String(record.session.subject) : (record.session.subject || 'N/A')) : 'N/A',
        courseCode: record.session ? record.session.courseCode : 'N/A',
        sessionDate: record.session ? record.session.startTime : 'N/A',
        checkInTime: record.checkInTime,
        checkOutTime: record.checkOutTime || 'N/A',
        status: record.status,
        verifiedBy: record.verifiedBy ? `${record.verifiedBy.firstName} ${record.verifiedBy.lastName}` : 'N/A',
        verificationNotes: record.verificationNotes || 'N/A'
      }));

      if (format === 'csv') {
        // Convert to CSV format
        const csv = this.convertToCSV(exportData);
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename=attendance_data.csv');
        res.send(csv);
      } else {
        // Return JSON format
        res.json({
          success: true,
          data: {
            records: exportData,
            totalRecords: exportData.length,
            exportedAt: new Date().toISOString()
          }
        });
      }
    } catch (error) {
      console.error('Export attendance data error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to export attendance data',
        error: error.message
      });
    }
  }

  // Helper methods
  generateStudentReport(attendanceRecords) {
    const studentMap = new Map();

    attendanceRecords.forEach(record => {
      const studentId = record.student._id.toString();
      
      if (!studentMap.has(studentId)) {
        studentMap.set(studentId, {
          student: record.student,
          totalSessions: 0,
          present: 0,
          absent: 0,
          late: 0,
          excused: 0
        });
      }

      const studentData = studentMap.get(studentId);
      studentData.totalSessions++;
      
      switch (record.status) {
        case 'present':
          studentData.present++;
          break;
        case 'absent':
          studentData.absent++;
          break;
        case 'late':
          studentData.late++;
          break;
        case 'excused':
          studentData.excused++;
          break;
      }
    });

    // Calculate percentages
    const report = Array.from(studentMap.values()).map(data => ({
      ...data,
      attendancePercentage: data.totalSessions > 0 ? 
        Math.round(((data.present + data.late) / data.totalSessions) * 100) : 0
    }));

    return report.sort((a, b) => a.attendancePercentage - b.attendancePercentage);
  }

  generateSessionReport(attendanceRecords) {
    const sessionMap = new Map();

    attendanceRecords.forEach(record => {
      const sessionId = record.session._id.toString();
      
      if (!sessionMap.has(sessionId)) {
        sessionMap.set(sessionId, {
          session: record.session,
          totalStudents: 0,
          present: 0,
          absent: 0,
          late: 0,
          excused: 0
        });
      }

      const sessionData = sessionMap.get(sessionId);
      sessionData.totalStudents++;
      
      switch (record.status) {
        case 'present':
          sessionData.present++;
          break;
        case 'absent':
          sessionData.absent++;
          break;
        case 'late':
          sessionData.late++;
          break;
        case 'excused':
          sessionData.excused++;
          break;
      }
    });

    // Calculate percentages
    const report = Array.from(sessionMap.values()).map(data => ({
      ...data,
      attendanceRate: data.totalStudents > 0 ? 
        Math.round(((data.present + data.late) / data.totalStudents) * 100) : 0
    }));

    return report.sort((a, b) => a.attendanceRate - b.attendanceRate);
  }

  generateSubjectReport(attendanceRecords) {
    const subjectMap = new Map();

    attendanceRecords.forEach(record => {
      const subject = record.session.subject;
      
      if (!subjectMap.has(subject)) {
        subjectMap.set(subject, {
          subject,
          totalSessions: 0,
          totalStudents: 0,
          present: 0,
          absent: 0,
          late: 0,
          excused: 0
        });
      }

      const subjectData = subjectMap.get(subject);
      subjectData.totalSessions++;
      subjectData.totalStudents++;
      
      switch (record.status) {
        case 'present':
          subjectData.present++;
          break;
        case 'absent':
          subjectData.absent++;
          break;
        case 'late':
          subjectData.late++;
          break;
        case 'excused':
          subjectData.excused++;
          break;
      }
    });

    // Calculate percentages
    const report = Array.from(subjectMap.values()).map(data => ({
      ...data,
      attendanceRate: data.totalStudents > 0 ? 
        Math.round(((data.present + data.late) / data.totalStudents) * 100) : 0
    }));

    return report.sort((a, b) => a.attendanceRate - b.attendanceRate);
  }

  generateDepartmentReport(attendanceRecords) {
    const departmentMap = new Map();

    attendanceRecords.forEach(record => {
      const department = record.student.department;
      
      if (!department) return;

      if (!departmentMap.has(department)) {
        departmentMap.set(department, {
          department,
          totalStudents: 0,
          totalSessions: 0,
          present: 0,
          absent: 0,
          late: 0,
          excused: 0
        });
      }

      const deptData = departmentMap.get(department);
      deptData.totalStudents++;
      deptData.totalSessions++;
      
      switch (record.status) {
        case 'present':
          deptData.present++;
          break;
        case 'absent':
          deptData.absent++;
          break;
        case 'late':
          deptData.late++;
          break;
        case 'excused':
          deptData.excused++;
          break;
      }
    });

    // Calculate percentages
    const report = Array.from(departmentMap.values()).map(data => ({
      ...data,
      attendanceRate: data.totalSessions > 0 ? 
        Math.round(((data.present + data.late) / data.totalSessions) * 100) : 0
    }));

    return report.sort((a, b) => a.attendanceRate - b.attendanceRate);
  }

  convertToCSV(data) {
    if (data.length === 0) return '';

    const headers = Object.keys(data[0]);
    const csvContent = [
      headers.join(','),
      ...data.map(row => 
        headers.map(header => {
          const value = row[header];
          return typeof value === 'string' && value.includes(',') ? 
            `"${value}"` : value;
        }).join(',')
      )
    ].join('\n');

    return csvContent;
  }
}

module.exports = new ReportController();
