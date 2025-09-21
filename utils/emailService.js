const nodemailer = require('nodemailer');

class EmailService {
    constructor() {
        this.transporter = null;
        this.isInitialized = false;
        this.initializeTransporter();
    }

    async initializeTransporter() {
        if (process.env.NODE_ENV === 'development' && !process.env.SMTP_USER) {
            // Use Ethereal only if you haven't provided a real SMTP config
            await this.setupEthereal();
        } else {
            // Use your real SMTP (Gmail, SendGrid, etc.)
            this.transporter = nodemailer.createTransport({
                service: process.env.SMTP_SERVICE || 'gmail',
                host: process.env.SMTP_HOST || 'smtp.gmail.com',
                port: process.env.SMTP_PORT || 587,
                secure: false,
                auth: {
                    user: process.env.SMTP_USER,
                    pass: process.env.SMTP_PASS
                }
            });
        }
        this.isInitialized = true;
    }


    async setupEthereal() {
        try {
            // Create a test account for development
            const testAccount = await nodemailer.createTestAccount();
            this.transporter = nodemailer.createTransport({
                host: 'smtp.ethereal.email',
                port: 587,
                secure: false,
                auth: {
                    user: testAccount.user,
                    pass: testAccount.pass
                }
            });
            console.log('Ethereal test account created:', testAccount.user);
        } catch (error) {
            console.error('Failed to create Ethereal test account:', error);
        }
    }

    async sendPasswordResetEmail(email, resetToken, resetUrl) {
        try {
            // Wait for transporter to be initialized
            while (!this.isInitialized) {
                await new Promise(resolve => setTimeout(resolve, 100));
            }

            const mailOptions = {
                from: process.env.FROM_EMAIL || 'noreply@smartattendance.com',
                to: email,
                subject: 'Password Reset - Smart Attendance System',
                html: this.getPasswordResetTemplate(resetToken, resetUrl)
            };

            const info = await this.transporter.sendMail(mailOptions);

            if (process.env.NODE_ENV === 'development') {
                console.log('Preview URL: %s', nodemailer.getTestMessageUrl(info));
                return {
                    success: true,
                    previewUrl: nodemailer.getTestMessageUrl(info)
                };
            }

            return { success: true, messageId: info.messageId };
        } catch (error) {
            console.error('Email sending failed:', error);
            return { success: false, error: error.message };
        }
    }

    getPasswordResetTemplate(resetToken, resetUrl) {
        const fullResetUrl = resetUrl ? `${resetUrl}?token=${resetToken}` : `${process.env.CLIENT_URL || 'http://localhost:3000'}/auth/reset-password?token=${resetToken}`;

        return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Password Reset</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
          }
          .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 30px;
            text-align: center;
            border-radius: 10px 10px 0 0;
          }
          .content {
            background: #f9f9f9;
            padding: 30px;
            border-radius: 0 0 10px 10px;
          }
          .button {
            display: inline-block;
            background: #667eea;
            color: white;
            padding: 12px 30px;
            text-decoration: none;
            border-radius: 5px;
            margin: 20px 0;
          }
          .button:hover {
            background: #5a6fd8;
          }
          .footer {
            text-align: center;
            margin-top: 30px;
            color: #666;
            font-size: 14px;
          }
          .warning {
            background: #fff3cd;
            border: 1px solid #ffeaa7;
            color: #856404;
            padding: 15px;
            border-radius: 5px;
            margin: 20px 0;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>🔐 Password Reset Request</h1>
          <p>Smart Attendance System</p>
        </div>
        
        <div class="content">
          <h2>Hello!</h2>
          <p>We received a request to reset your password for your Smart Attendance System account.</p>
          
          <p>Click the button below to reset your password:</p>
          
          <div style="text-align: center;">
            <a href="${fullResetUrl}" class="button">Reset Password</a>
          </div>
          
          <div class="warning">
            <strong>⚠️ Important:</strong>
            <ul>
              <li>This link will expire in 15 minutes</li>
              <li>If you didn't request this reset, please ignore this email</li>
              <li>For security, don't share this link with anyone</li>
            </ul>
          </div>
          
          <p>If the button doesn't work, you can copy and paste this link into your browser:</p>
          <p style="word-break: break-all; background: #eee; padding: 10px; border-radius: 5px;">
            ${fullResetUrl}
          </p>
        </div>
        
        <div class="footer">
          <p>This email was sent from Smart Attendance System</p>
          <p>If you have any questions, please contact support</p>
        </div>
      </body>
      </html>
    `;
    }

    async sendWelcomeEmail(email, firstName, temporaryPassword = null) {
        try {
            // Wait for transporter to be initialized
            while (!this.isInitialized) {
                await new Promise(resolve => setTimeout(resolve, 100));
            }

            const mailOptions = {
                from: process.env.FROM_EMAIL || 'noreply@smartattendance.com',
                to: email,
                subject: 'Welcome to Smart Attendance System',
                html: this.getWelcomeTemplate(firstName, temporaryPassword)
            };

            const info = await this.transporter.sendMail(mailOptions);

            if (process.env.NODE_ENV === 'development') {
                console.log('Welcome email preview URL: %s', nodemailer.getTestMessageUrl(info));
                return {
                    success: true,
                    previewUrl: nodemailer.getTestMessageUrl(info)
                };
            }

            return { success: true, messageId: info.messageId };
        } catch (error) {
            console.error('Welcome email sending failed:', error);
            return { success: false, error: error.message };
        }
    }

    getWelcomeTemplate(firstName, temporaryPassword) {
        return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Welcome to Smart Attendance System</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
          }
          .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 30px;
            text-align: center;
            border-radius: 10px 10px 0 0;
          }
          .content {
            background: #f9f9f9;
            padding: 30px;
            border-radius: 0 0 10px 10px;
          }
          .button {
            display: inline-block;
            background: #667eea;
            color: white;
            padding: 12px 30px;
            text-decoration: none;
            border-radius: 5px;
            margin: 20px 0;
          }
          .credentials {
            background: #e8f4fd;
            border: 1px solid #bee5eb;
            padding: 15px;
            border-radius: 5px;
            margin: 20px 0;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>🎉 Welcome to Smart Attendance System!</h1>
          <p>Your account has been created successfully</p>
        </div>
        
        <div class="content">
          <h2>Hello ${firstName}!</h2>
          <p>Welcome to the Smart Attendance System. Your account has been created and you can now access all the features.</p>
          
          ${temporaryPassword ? `
          <div class="credentials">
            <h3>Your Login Credentials:</h3>
            <p><strong>Email:</strong> ${email}</p>
            <p><strong>Temporary Password:</strong> ${temporaryPassword}</p>
            <p><em>Please change your password after your first login for security.</em></p>
          </div>
          ` : ''}
          
          <div style="text-align: center;">
            <a href="${process.env.CLIENT_URL || 'http://localhost:3000'}/auth/login" class="button">Login to Your Account</a>
          </div>
          
          <h3>What you can do:</h3>
          <ul>
            <li>📊 View your attendance records</li>
            <li>📅 Manage your sessions (if faculty/admin)</li>
            <li>📈 Generate reports and analytics</li>
            <li>🔔 Get notifications about important updates</li>
          </ul>
        </div>
      </body>
      </html>
    `;
    }

    /**
     * Send test email
     */
    async sendTestEmail(email) {
        try {
            while (!this.isInitialized) {
                await new Promise(resolve => setTimeout(resolve, 100));
            }

            const mailOptions = {
                from: this.fromEmail,
                to: email,
                subject: 'Test Email - Smart Attendance System',
                html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2 style="color: #4F46E5;">Test Email Successful! 🎉</h2>
                    <p>This is a test email from the Smart Attendance System.</p>
                    <p>If you received this email, your email configuration is working correctly.</p>
                    <p><strong>Timestamp:</strong> ${new Date().toLocaleString()}</p>
                </div>
                `
            };

            const result = await this.transporter.sendMail(mailOptions);
            
            if (process.env.NODE_ENV === 'development') {
                console.log('Test email preview URL:', result.previewUrl);
            }

            return result;
        } catch (error) {
            console.error('Test email sending failed:', error);
            throw error;
        }
    }
}

module.exports = new EmailService();
