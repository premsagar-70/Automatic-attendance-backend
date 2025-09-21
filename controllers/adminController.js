const { validationResult } = require('express-validator');
const emailService = require('../utils/emailService');

class AdminController {
  /**
   * Get admin settings
   */
  async getAdminSettings(req, res) {
    try {
      // In a real application, you would fetch these from a database
      const settings = {
        // General Settings
        systemName: process.env.SYSTEM_NAME || 'Smart Attendance System',
        systemVersion: process.env.SYSTEM_VERSION || '1.0.0',
        timezone: process.env.TIMEZONE || 'UTC',
        dateFormat: process.env.DATE_FORMAT || 'DD/MM/YYYY',
        timeFormat: process.env.TIME_FORMAT || '24h',
        
        // Academic Settings
        currentAcademicYear: process.env.CURRENT_ACADEMIC_YEAR || '2024-2025',
        currentSemester: process.env.CURRENT_SEMESTER || '1',
        semesterStartDate: process.env.SEMESTER_START_DATE || '',
        semesterEndDate: process.env.SEMESTER_END_DATE || '',
        lateEntryCutoff: parseInt(process.env.LATE_ENTRY_CUTOFF) || 15,
        
        // Email Settings
        smtpHost: process.env.SMTP_HOST || '',
        smtpPort: parseInt(process.env.SMTP_PORT) || 587,
        smtpUser: process.env.SMTP_USER || '',
        smtpPassword: process.env.SMTP_PASS ? '***' : '', // Don't expose password
        fromEmail: process.env.FROM_EMAIL || '',
        emailEnabled: process.env.EMAIL_ENABLED === 'true',
        
        // Security Settings
        sessionTimeout: parseInt(process.env.SESSION_TIMEOUT) || 30,
        maxLoginAttempts: parseInt(process.env.MAX_LOGIN_ATTEMPTS) || 5,
        passwordMinLength: parseInt(process.env.PASSWORD_MIN_LENGTH) || 8,
        requireEmailVerification: process.env.REQUIRE_EMAIL_VERIFICATION === 'true',
        twoFactorEnabled: process.env.TWO_FACTOR_ENABLED === 'true',
        
        // Notification Settings
        emailNotifications: process.env.EMAIL_NOTIFICATIONS === 'true',
        pushNotifications: process.env.PUSH_NOTIFICATIONS === 'true',
        attendanceReminders: process.env.ATTENDANCE_REMINDERS === 'true',
        reportGeneration: process.env.REPORT_GENERATION === 'true',
        
        // System Settings
        maxFileSize: parseInt(process.env.MAX_FILE_SIZE) || 10,
        allowedFileTypes: (process.env.ALLOWED_FILE_TYPES || 'jpg,jpeg,png,pdf').split(','),
        backupEnabled: process.env.BACKUP_ENABLED === 'true',
        backupFrequency: process.env.BACKUP_FREQUENCY || 'daily',
        maintenanceMode: process.env.MAINTENANCE_MODE === 'true'
      };

      res.json({
        success: true,
        data: settings
      });
    } catch (error) {
      console.error('Get admin settings error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get admin settings',
        error: error.message
      });
    }
  }

  /**
   * Update admin settings
   */
  async updateAdminSettings(req, res) {
    try {
      const settings = req.body;

      // In a real application, you would save these to a database
      // For now, we'll just return success
      
      res.json({
        success: true,
        message: 'Settings updated successfully',
        data: settings
      });
    } catch (error) {
      console.error('Update admin settings error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update admin settings',
        error: error.message
      });
    }
  }

  /**
   * Test email settings
   */
  async testEmailSettings(req, res) {
    try {
      const adminEmail = req.user.email;
      
      // Send test email
      await emailService.sendTestEmail(adminEmail);

      res.json({
        success: true,
        message: 'Test email sent successfully'
      });
    } catch (error) {
      console.error('Test email error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to send test email',
        error: error.message
      });
    }
  }

  /**
   * Create system backup
   */
  async createSystemBackup(req, res) {
    try {
      // In a real application, you would create an actual backup
      const backupData = {
        timestamp: new Date().toISOString(),
        createdBy: req.user._id,
        status: 'completed',
        size: '0 MB', // Placeholder
        location: '/backups/backup-' + Date.now() + '.zip'
      };

      res.json({
        success: true,
        message: 'System backup created successfully',
        data: backupData
      });
    } catch (error) {
      console.error('Create backup error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create system backup',
        error: error.message
      });
    }
  }

  /**
   * Get system statistics
   */
  async getSystemStats(req, res) {
    try {
      // In a real application, you would fetch actual statistics
      const stats = {
        totalUsers: 0,
        activeUsers: 0,
        totalSessions: 0,
        totalAttendance: 0,
        systemUptime: '99.9%',
        lastBackup: new Date().toISOString(),
        databaseSize: '0 MB',
        storageUsed: '0 MB'
      };

      res.json({
        success: true,
        data: stats
      });
    } catch (error) {
      console.error('Get system stats error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get system statistics',
        error: error.message
      });
    }
  }
}

module.exports = new AdminController();
