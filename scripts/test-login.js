const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');

const testLogin = async () => {
  try {
    console.log('🔗 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/smart-attendance-system', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('✅ Connected to MongoDB');

    // Test credentials
    const testCredentials = [
      { login: 'admin@sreerama.ac.in', password: 'Admin@1234' },
      { login: 'temp-teacher@sreerama.ac.in', password: 'sreerama' },
      { login: 'premsagar10000000@gmail.com', password: 'sreerama' }
    ];

    for (const cred of testCredentials) {
      console.log(`\n🔍 Testing login for: ${cred.login}`);
      
      // Find user
      const user = await User.findByLogin(cred.login).select('+password');
      
      if (!user) {
        console.log('❌ User not found');
        continue;
      }
      
      console.log(`✅ User found: ${user.firstName} ${user.lastName} (${user.role})`);
      console.log(`📧 Email: ${user.email}`);
      console.log(`🆔 Student/Employee ID: ${user.studentId || user.employeeId}`);
      console.log(`🔒 Is Active: ${user.isActive}`);
      console.log(`🔐 Is Locked: ${user.isLocked}`);
      console.log(`✅ Approval Status: ${user.approvalStatus}`);
      
      // Test password
      const isPasswordValid = await user.comparePassword(cred.password);
      console.log(`🔑 Password valid: ${isPasswordValid}`);
      
      if (isPasswordValid) {
        console.log('🎉 Login should work!');
      } else {
        console.log('❌ Password mismatch');
        
        // Check if password is hashed
        console.log(`🔍 Password field: ${user.password ? 'exists' : 'missing'}`);
        console.log(`🔍 Password length: ${user.password ? user.password.length : 0}`);
        console.log(`🔍 Password starts with $2b$: ${user.password ? user.password.startsWith('$2b$') : false}`);
      }
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  }
};

// Run test if called directly
if (require.main === module) {
  testLogin();
}

module.exports = testLogin;
