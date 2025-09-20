/* eslint-disable no-console */
const path = require('path')
const fs = require('fs')
const bcrypt = require('bcryptjs')
const mongoose = require('mongoose')
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') })

const connectDB = require('../config/db')
const User = require('../models/User')
const Session = require('../models/Session')
const Attendance = require('../models/Attendance')
const QRCodeLog = require('../models/QRCodeLog')

async function loadJSON() {
  const dataPath = path.resolve(__dirname, '..', '..', 'database', 'sample-data.json')
  const raw = fs.readFileSync(dataPath, 'utf-8')
  return JSON.parse(raw)
}

async function seed() {
  await connectDB()

  try {
    const data = await loadJSON()

    // Clear existing collections
    await Attendance.deleteMany({})
    await QRCodeLog.deleteMany({})
    await Session.deleteMany({})
    await User.deleteMany({})

    // Insert users with hashed passwords
    const userIdByExternal = new Map() // studentId/employeeId/email -> _id
    const usersToInsert = []

    for (const u of data.users) {
      const passwordHash = await bcrypt.hash(u.password || 'password123', 10)
      const userDoc = {
        firstName: u.firstName,
        lastName: u.lastName,
        email: u.email,
        password: passwordHash,
        role: u.role,
        studentId: u.studentId || undefined,
        employeeId: u.employeeId || undefined,
        designation: u.designation || undefined,
        subjects: u.subjects || [],
        department: u.department || undefined,
        semester: u.semester || undefined,
        batch: u.batch || undefined,
        phone: u.phone || undefined,
        isActive: u.isActive !== false,
      }
      usersToInsert.push(userDoc)
    }

    const insertedUsers = await User.insertMany(usersToInsert)
    const defaultFaculty = insertedUsers.find((u) => u.role === 'faculty')

    // Build lookup maps
    for (const u of insertedUsers) {
      if (u.studentId) userIdByExternal.set(u.studentId, u._id)
      if (u.employeeId) userIdByExternal.set(u.employeeId, u._id)
      userIdByExternal.set(u.email, u._id)
    }

    // Insert sessions
    const sessionsToInsert = []
    for (const s of data.sessions) {
      let facultyId = s.facultyEmail ? userIdByExternal.get(s.facultyEmail) : undefined
      if (!facultyId && defaultFaculty) facultyId = defaultFaculty._id
      const enrolled = (s.enrolledStudents || []).map((sid) => ({
        student: userIdByExternal.get(sid),
        enrolledAt: new Date(),
      })).filter(Boolean)

      sessionsToInsert.push({
        title: s.title,
        description: s.description,
        subject: s.subject,
        courseCode: s.courseCode,
        faculty: facultyId,
        startTime: new Date(s.startTime),
        endTime: new Date(s.endTime),
        location: s.location,
        roomNumber: s.roomNumber,
        building: s.building,
        sessionType: s.sessionType,
        mode: s.mode,
        maxCapacity: s.maxCapacity,
        status: s.status || 'scheduled',
        enrolledStudents: enrolled,
        attendanceSettings: s.attendanceSettings || {},
      })
    }

    const insertedSessions = await Session.insertMany(sessionsToInsert)

    // Map for fake session ids from sample data (session1/session2) if present
    const sessionByIndex = new Map()
    insertedSessions.forEach((sess, idx) => {
      sessionByIndex.set(`session${idx + 1}`, sess._id)
    })

    // Insert attendance
    const attendanceToInsert = []
    for (const a of data.attendance) {
      const student = userIdByExternal.get(a.studentId)
      const sessionId = sessionByIndex.get(a.sessionId) || a.sessionId
      const rec = {
        student,
        session: sessionId,
        status: a.status,
        checkInTime: a.checkInTime ? new Date(a.checkInTime) : new Date(),
        checkOutTime: a.checkOutTime ? new Date(a.checkOutTime) : undefined,
        location: a.location || undefined,
        deviceInfo: a.deviceInfo || undefined,
        qrCodeData: a.qrCodeData || undefined,
        verifiedBy: a.verifiedBy ? userIdByExternal.get(a.verifiedBy) : undefined,
        verifiedAt: a.verifiedAt ? new Date(a.verifiedAt) : undefined,
        verificationNotes: a.verificationNotes || undefined,

        semester: String(a.semester || '1'),
        academicYear: a.academicYear || '2025-2026',
      }
      attendanceToInsert.push(rec)
    }
    if (attendanceToInsert.length) {
      await Attendance.insertMany(attendanceToInsert)
    }

    // Insert QR code logs
    const qrLogsToInsert = []
    for (const q of data.qrCodeLogs || []) {
      qrLogsToInsert.push({
        code: q.code,
        session: sessionByIndex.get(q.sessionId) || q.sessionId,
        generatedBy: q.generatedBy ? userIdByExternal.get(q.generatedBy) : undefined,
        generatedAt: q.generatedAt ? new Date(q.generatedAt) : new Date(),
        settings: q.settings || {},
        usage: q.usage || {},
        scans: (q.scans || []).map((scan) => ({
          scannedBy: scan.scannedBy ? userIdByExternal.get(scan.scannedBy) : undefined,
          scannedAt: scan.scannedAt ? new Date(scan.scannedAt) : new Date(),
          deviceInfo: scan.deviceInfo || undefined,
          location: scan.location || undefined,
          isValid: scan.isValid !== false,
          reason: scan.reason || undefined,
        })),
        status: q.status || 'active',
        isActive: q.isActive !== false,
      })
    }
    if (qrLogsToInsert.length) {
      await QRCodeLog.insertMany(qrLogsToInsert)
    }
    console.log('✅ Database seeded successfully')
  } catch (err) {
    console.error('❌ Seeding failed:', err)
    process.exitCode = 1
  } finally {
    await mongoose.connection.close()
  }
}

seed()


