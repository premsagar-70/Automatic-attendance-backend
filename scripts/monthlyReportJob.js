const mongoose = require('mongoose');
require('dotenv').config();

const connectDB = require('../config/db');
const EmailService = require('../utils/emailService');
const User = require('../models/User');
const Attendance = require('../models/Attendance');

async function sendMonthlyReports(cutoffDate = new Date()) {
  await connectDB();

  // For each active user (students and faculty), compile attendance summary up to cutoffDate
  const users = await User.find({ isActive: true }).select('email firstName lastName role');

  for (const user of users) {
    try {
      let summary = {};
      if (user.role === 'student') {
        // student attendance summary
        const total = await Attendance.countDocuments({ student: user._id, isActive: true, checkInTime: { $lte: cutoffDate } });
        const present = await Attendance.countDocuments({ student: user._id, status: 'present', isActive: true, checkInTime: { $lte: cutoffDate } });
        const absent = total - present;
        summary = { total, present, absent };
      } else if (user.role === 'faculty') {
        // faculty: sessions and attendance handled
        const totalSessions = await Attendance.countDocuments({ 'session.faculty': user._id, isActive: true, checkInTime: { $lte: cutoffDate } });
        summary = { totalSessions };
      }

      // Build a simple HTML email
      const html = `<div><h2>Monthly Attendance Summary</h2><p>Dear ${user.firstName || user.email},</p><p>Summary up to ${cutoffDate.toDateString()}:</p><pre>${JSON.stringify(summary, null, 2)}</pre><p>Regards,<br/>Smart Attendance System</p></div>`;

      await EmailService.transporter.sendMail({
        from: process.env.FROM_EMAIL || 'noreply@smartattendance.com',
        to: user.email,
        subject: `Monthly Attendance Summary - ${cutoffDate.toLocaleDateString()}`,
        html
      });
    } catch (err) {
      console.error('Failed to send monthly report to', user.email, err.message);
    }
  }

  console.log('Monthly reports sent');
  process.exit(0);
}

if (require.main === module) {
  const cutoff = process.argv[2] ? new Date(process.argv[2]) : new Date();
  sendMonthlyReports(cutoff).catch(err => { console.error(err); process.exit(1); });
}

module.exports = sendMonthlyReports;
