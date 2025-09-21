const axios = require('axios');

const testAPI = async () => {
  const baseURL = 'https://automatic-attendance-backend.onrender.com/api';
  
  console.log('🌐 Testing API endpoints...');
  
  try {
    // Test health endpoint
    console.log('\n1. Testing health endpoint...');
    const healthResponse = await axios.get(`${baseURL}/health`, { timeout: 5000 });
    console.log('✅ Health endpoint:', healthResponse.status, healthResponse.data);
  } catch (error) {
    console.log('❌ Health endpoint failed:', error.message);
  }

  try {
    // Test login endpoint
    console.log('\n2. Testing login endpoint...');
    const loginResponse = await axios.post(`${baseURL}/auth/login`, {
      login: 'admin@sreerama.ac.in',
      password: 'Admin@1234'
    }, { timeout: 10000 });
    console.log('✅ Login successful:', loginResponse.status, loginResponse.data);
  } catch (error) {
    console.log('❌ Login failed:', error.response?.status, error.response?.data || error.message);
  }

  try {
    // Test register endpoint
    console.log('\n3. Testing register endpoint...');
    const registerResponse = await axios.post(`${baseURL}/auth/register`, {
      firstName: 'Test',
      lastName: 'User',
      email: 'test@example.com',
      password: 'test123',
      role: 'student',
      studentId: 'TEST-001',
      department: 'CSE',
      academicYear: '1',
      semester: '1',
      batch: '2024',
      phone: '+1234567890'
    }, { timeout: 10000 });
    console.log('✅ Register successful:', registerResponse.status, registerResponse.data);
  } catch (error) {
    console.log('❌ Register failed:', error.response?.status, error.response?.data || error.message);
  }
};

// Run test if called directly
if (require.main === module) {
  testAPI();
}

module.exports = testAPI;
