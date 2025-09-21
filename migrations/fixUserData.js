const mongoose = require('mongoose');
const User = require('../models/User');
const Department = require('../models/Department');
require('dotenv').config();

// Connect to MongoDB
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('MongoDB connected successfully');
  } catch (error) {
    console.error('MongoDB connection error:', error);
    process.exit(1);
  }
};

// Migration function to fix existing user data
const migrateUserData = async () => {
  try {
    console.log('Starting user data migration...');

    // Create departments based on common department names
    const departmentMappings = {
      'CSE': { name: 'Computer Science Engineering', code: 'CSE' },
      'AI&DS': { name: 'Artificial Intelligence and Data Science', code: 'AI&DS' },
      'IT': { name: 'Information Technology', code: 'IT' },
      'ECE': { name: 'Electronics and Communication Engineering', code: 'ECE' },
      'EEE': { name: 'Electrical and Electronics Engineering', code: 'EEE' },
      'ME': { name: 'Mechanical Engineering', code: 'ME' },
      'CE': { name: 'Civil Engineering', code: 'CE' },
      'AE': { name: 'Aerospace Engineering', code: 'AE' },
      'DEFAULT': { name: 'Default Department', code: 'DEFAULT' }
    };

    // Create or find departments
    const departments = {};
    for (const [key, deptData] of Object.entries(departmentMappings)) {
      let dept = await Department.findOne({ code: deptData.code });
      if (!dept) {
        console.log(`Creating department: ${deptData.name}`);
        dept = await Department.create({
          ...deptData,
          createdBy: new mongoose.Types.ObjectId(),
          isActive: true
        });
      }
      departments[key] = dept._id;
      console.log(`Department ${deptData.name}: ${dept._id}`);
    }

    // Find all users with invalid department data
    const usersWithStringDepartment = await User.find({
      $or: [
        { department: { $type: 'string' } },
        { department: { $exists: false } }
      ]
    });

    console.log(`Found ${usersWithStringDepartment.length} users with invalid department data`);

    // Update users with string department to use appropriate department
    for (const user of usersWithStringDepartment) {
      console.log(`Migrating user: ${user.email}`);
      
      let departmentId = departments.DEFAULT;
      
      // Try to map string department to actual department
      if (typeof user.department === 'string') {
        const deptKey = user.department.toUpperCase();
        if (departments[deptKey]) {
          departmentId = departments[deptKey];
          console.log(`Mapped ${user.department} to ${deptKey} department`);
        } else {
          console.log(`Unknown department ${user.department}, using default`);
        }
      }
      
      const updateData = {
        department: departmentId,
        departmentName: typeof user.department === 'string' ? user.department : user.departmentName
      };

      // Set default academic year and semester for students
      if (user.role === 'student') {
        updateData.academicYear = '1';
        updateData.semester = '1';
        
        // Set default batch if not present
        if (!user.batch) {
          updateData.batch = '2024';
        }
      }

      // Fix invalid semester values
      if (user.semester && !['1', '2'].includes(user.semester)) {
        updateData.semester = '1';
      }

      await User.findByIdAndUpdate(user._id, updateData);
      console.log(`Updated user: ${user.email}`);
    }

    // Find users with invalid semester values
    const usersWithInvalidSemester = await User.find({
      role: 'student',
      semester: { $nin: ['1', '2'] }
    });

    console.log(`Found ${usersWithInvalidSemester.length} users with invalid semester data`);

    for (const user of usersWithInvalidSemester) {
      await User.findByIdAndUpdate(user._id, { semester: '1' });
      console.log(`Fixed semester for user: ${user.email}`);
    }

    // Find students without academic year
    const studentsWithoutAcademicYear = await User.find({
      role: 'student',
      academicYear: { $exists: false }
    });

    console.log(`Found ${studentsWithoutAcademicYear.length} students without academic year`);

    for (const user of studentsWithoutAcademicYear) {
      await User.findByIdAndUpdate(user._id, { academicYear: '1' });
      console.log(`Set academic year for student: ${user.email}`);
    }

    console.log('User data migration completed successfully!');
    
    // Print summary
    const totalUsers = await User.countDocuments();
    const students = await User.countDocuments({ role: 'student' });
    const faculty = await User.countDocuments({ role: 'faculty' });
    const admins = await User.countDocuments({ role: 'admin' });
    
    console.log('\nMigration Summary:');
    console.log(`Total users: ${totalUsers}`);
    console.log(`Students: ${students}`);
    console.log(`Faculty: ${faculty}`);
    console.log(`Admins: ${admins}`);
    
  } catch (error) {
    console.error('Migration error:', error);
  } finally {
    await mongoose.connection.close();
    console.log('Database connection closed');
  }
};

// Run migration if this file is executed directly
if (require.main === module) {
  connectDB().then(() => {
    migrateUserData();
  });
}

module.exports = { migrateUserData };
