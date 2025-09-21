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
const sampleDataPath = path.join(__dirname, '../../database/sample-data.json');
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

    // Create a temporary admin user for department creation
    console.log('👤 Creating temporary admin for department creation...');
    const tempAdmin = new User({
      firstName: 'Temp',
      lastName: 'Admin',
      email: 'temp-admin@sreerama.ac.in',
      password: await bcrypt.hash('temp123', 12),
      role: 'admin',
      employeeId: 'TEMP-ADMIN',
      designation: 'System',
      isActive: true,
      approvalStatus: 'approved'
    });
    await tempAdmin.save();
    console.log('✅ Created temporary admin');

    // Seed departments first
    console.log('🏢 Seeding departments...');
    const departments = [];
    for (const deptData of sampleData.departments) {
      const department = new Department({
        ...deptData,
        createdBy: tempAdmin._id
      });
      await department.save();
      departments.push(department);
      console.log(`✅ Created department: ${department.name}`);
    }

    // Create department mapping for users
    const departmentMap = {};
    departments.forEach(dept => {
      departmentMap[dept.code] = dept._id;
    });

    // Seed users with proper department references
    console.log('👥 Seeding users...');
    const users = [];
    for (const userData of sampleData.users) {
      // Map department string to ObjectId
      const departmentId = departmentMap[userData.department];
      
      const user = new User({
        ...userData,
        password: userData.password, // Let the pre-save middleware hash it
        department: departmentId
      });
      
      await user.save();
      users.push(user);
      console.log(`✅ Created user: ${user.firstName} ${user.lastName} (${user.role})`);
    }

    // Update departments with real admin as creator
    console.log('🔄 Updating departments with real admin...');
    const realAdmin = users.find(user => user.role === 'admin');
    if (realAdmin) {
      for (const department of departments) {
        department.createdBy = realAdmin._id;
        await department.save();
      }
      console.log('✅ Updated departments with real admin');
    }

    // Remove temporary admin
    await User.findByIdAndDelete(tempAdmin._id);
    console.log('🗑️  Removed temporary admin');

    // Create user mapping for sessions
    const userMap = {};
    users.forEach(user => {
      if (user.role === 'faculty') {
        userMap[user.email] = user._id;
        userMap[user.employeeId] = user._id; // Also map by employee ID
      } else if (user.role === 'student') {
        userMap[user.studentId] = user._id;
      }
    });
    
    console.log('User mapping:', userMap);

    // Seed academic years
    console.log('�� Seeding academic years...');
    for (const academicYearData of sampleData.academicYears) {
      const academicYear = new AcademicYear({
        ...academicYearData,
        createdBy: realAdmin._id
      });
      await academicYear.save();
      console.log(`✅ Created academic year: ${academicYear.year}`);
    }

    // Seed sessions
    console.log('📚 Seeding sessions...');
    const sessions = [];
    for (const sessionData of sampleData.sessions) {
      // Map enrolled students from IDs to ObjectIds
      const enrolledStudents = sessionData.enrolledStudents.map(studentId => userMap[studentId]).filter(Boolean);
      
      const session = new Session({
        ...sessionData,
        faculty: userMap[sessionData.facultyEmail],
        enrolledStudents: enrolledStudents
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
        approvedBy: attendanceData.approvedBy ? userMap[attendanceData.approvedBy] : undefined
      });
      await attendance.save();
      console.log(`✅ Created attendance record for student: ${attendanceData.studentId}`);
    }

    // Seed timetables
    console.log('📋 Seeding timetables...');
    for (const timetableData of sampleData.timetables) {
      // Map faculty IDs in schedule to ObjectIds
      const scheduleWithFacultyIds = timetableData.schedule.map(scheduleItem => {
        const facultyId = userMap[scheduleItem.faculty];
        console.log(`Mapping faculty ${scheduleItem.faculty} to ${facultyId}`);
        return {
          ...scheduleItem,
          faculty: facultyId
        };
      });
      
      const timetable = new Timetable({
        ...timetableData,
        schedule: scheduleWithFacultyIds,
        createdBy: realAdmin._id
      });
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
  mongoose.connect(process.env.MONGODB_URI || 'mongodb+srv://premsagar10000000_db_user:0RyV170nxOlXx3wj@cluster0.dqzrkou.mongodb.net/smart-attendance', {
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