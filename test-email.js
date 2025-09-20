require('dotenv').config(); // <-- load .env before using emailService
const emailService = require('./utils/emailService');

async function testEmailService() {
  console.log('🧪 Testing Email Service...\n');
  console.log('NODE_ENV:', process.env.NODE_ENV);
  console.log('SMTP_USER:', process.env.SMTP_USER);
  console.log('Will use Ethereal:', !process.env.SMTP_USER);

  try {
    // Test password reset email
    console.log('1. Testing Password Reset Email...');
    const resetResult = await emailService.sendPasswordResetEmail(
      'test@example.com',
      'test-reset-token-123',
      'http://localhost:3000/auth/reset-password'
    );

    if (resetResult.success) {
      console.log('✅ Password reset email sent successfully!');
      if (resetResult.previewUrl) {
        console.log('📧 Preview URL:', resetResult.previewUrl);
      }
    } else {
      console.log('❌ Password reset email failed:', resetResult.error);
    }

    console.log('\n2. Testing Welcome Email...');
    const welcomeResult = await emailService.sendWelcomeEmail(
      'test@example.com',
      'John Doe'
    );

    if (welcomeResult.success) {
      console.log('✅ Welcome email sent successfully!');
      if (welcomeResult.previewUrl) {
        console.log('📧 Preview URL:', welcomeResult.previewUrl);
      }
    } else {
      console.log('❌ Welcome email failed:', welcomeResult.error);
    }

    console.log('\n🎉 Email service test completed!');
    console.log('\n📝 Note: In development mode, emails are sent to Ethereal Email');
    console.log('   Click the preview URLs above to see the actual email content.');

  } catch (error) {
    console.error('❌ Email service test failed:', error);
  }
}

// Run the test
testEmailService();
