const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');

// Import models
const User = require('../models/User');
const Department = require('../models/Department');
const Session = require('../models/Session');
const Attendance = require('../models/Attendance');
const Timetable = require('../models/Timetable');
const AcademicYear = require('../models/AcademicYear');
const QRCodeLog = require('../models/QRCodeLog');

// Load sample data
const sampleDataPath = path.join(__dirname, '../database/sample-data.json');
const sampleData = JSON.parse(fs.readFileSync(sampleDataPath, 'utf8'));

const seedDatabase = async () => {
  try {
    console.log('�� Starting database seeding...');

    // Clear existing data
    await User.deleteMany({});
    await Department.deleteMany({});
    await Session.deleteMany({});
    await Attendance.deleteMany({});
    await Timetable.deleteMany({});
    await AcademicYear.deleteMany({});
    await QRCodeLog.deleteMany({});

    console.log('🗑️  Cleared existing data');

    // Seed departments first
    console.log('🏢 Seeding departments...');
    const departments = [];
    for (const deptData of sampleData.departments) {
      const department = new Department(deptData);
      await department.save();
      departments.push(department);
      console.log(`✅ Created department: ${department.name}`);
    }

    // Create department mapping for users
    const departmentMap = {};
    departments.forEach(dept => {
      departmentMap[dept.code] = dept._id;
    });

    // Seed users
    console.log('👥 Seeding users...');
    const users = [];
    for (const userData of sampleData.users) {
      // Hash password
      const hashedPassword = await bcrypt.hash(userData.password, 12);
      
      // Map department string to ObjectId
      const departmentId = departmentMap[userData.department];
      
      const user = new User({
        ...userData,
        password: hashedPassword,
        department: departmentId
      });
      
      await user.save();
      users.push(user);
      console.log(`✅ Created user: ${user.firstName} ${user.lastName} (${user.role})`);
    }

    // Create user mapping for sessions
    const userMap = {};
    users.forEach(user => {
      if (user.role === 'faculty') {
        userMap[user.email] = user._id;
      } else if (user.role === 'student') {
        userMap[user.studentId] = user._id;
      }
    });

    // Seed academic years
    console.log('�� Seeding academic years...');
    for (const academicYearData of sampleData.academicYears) {
      const academicYear = new AcademicYear(academicYearData);
      await academicYear.save();
      console.log(`✅ Created academic year: ${academicYear.year}`);
    }

    // Seed sessions
    console.log('📚 Seeding sessions...');
    const sessions = [];
    for (const sessionData of sampleData.sessions) {
      const session = new Session({
        ...sessionData,
        faculty: userMap[sessionData.facultyEmail]
      });
      await session.save();
      sessions.push(session);
      console.log(`✅ Created session: ${session.title}`);
    }

    // Create session mapping for attendance
    const sessionMap = {};
    sessions.forEach((session, index) => {
      sessionMap[`session${index + 1}`] = session._id;
    });

    // Seed attendance
    console.log('📊 Seeding attendance...');
    for (const attendanceData of sampleData.attendance) {
      const attendance = new Attendance({
        ...attendanceData,
        student: userMap[attendanceData.studentId],
        session: sessionMap[attendanceData.sessionId],
        approvedBy: userMap[attendanceData.approvedBy]
      });
      await attendance.save();
      console.log(`✅ Created attendance record for student: ${attendanceData.studentId}`);
    }

    // Seed timetables
    console.log('📋 Seeding timetables...');
    for (const timetableData of sampleData.timetables) {
      const timetable = new Timetable(timetableData);
      await timetable.save();
      console.log(`✅ Created timetable: ${timetable.title}`);
    }

    // Seed QR code logs
    console.log('📱 Seeding QR code logs...');
    for (const qrLogData of sampleData.qrCodeLogs) {
      const qrLog = new QRCodeLog(qrLogData);
      await qrLog.save();
      console.log(`✅ Created QR code log`);
    }

    console.log('🎉 Database seeding completed successfully!');
    console.log('\n📊 Summary:');
    console.log(`- Departments: ${departments.length}`);
    console.log(`- Users: ${users.length}`);
    console.log(`- Sessions: ${sessions.length}`);
    console.log(`- Attendance Records: ${sampleData.attendance.length}`);
    console.log(`- Timetables: ${sampleData.timetables.length}`);
    console.log(`- Academic Years: ${sampleData.academicYears.length}`);
    console.log(`- QR Code Logs: ${sampleData.qrCodeLogs.length}`);

    console.log('\n🔑 Test Credentials:');
    console.log('Admin: admin@sreerama.ac.in / Admin@1234');
    console.log('Faculty: temp-teacher@sreerama.ac.in / sreerama');
    console.log('Student: premsagar10000000@gmail.com / sreerama');

  } catch (error) {
    console.error('❌ Error seeding database:', error);
    throw error;
  }
};

// Run seeding if called directly
if (require.main === module) {
  // Connect to MongoDB
  mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/smart-attendance-system', {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => {
    console.log('🔗 Connected to MongoDB');
    return seedDatabase();
  })
  .then(() => {
    console.log('✅ Seeding completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  });
}

module.exports = seedDatabase;