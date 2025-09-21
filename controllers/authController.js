const User = require('../models/User');
const { generateToken, generateRefreshToken, verifyRefreshToken } = require('../middlewares/authMiddleware');
const { validationResult } = require('express-validator');
const emailService = require('../utils/emailService');

class AuthController {
  /**
   * Register a new user
   */
  async register(req, res) {
    try {
      // Check for validation errors
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array()
        });
      }

      const {
        firstName,
        lastName,
        email,
        password,
        role,
        studentId,
        employeeId,
        department,
        semester,
        batch,
        designation,
        subjects,
        phone
      } = req.body;

      // Check if user already exists
      const existingUser = await User.findOne({
        $or: [
          { email },
          ...(studentId ? [{ studentId }] : []),
          ...(employeeId ? [{ employeeId }] : [])
        ]
      });

      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: 'User already exists with this email or ID'
        });
      }

      // Create user data
      const userData = {
        firstName,
        lastName,
        email,
        password,
        role: role || 'student',
        phone
      };

      // Add role-specific fields
      if (role === 'student') {
        userData.studentId = studentId;
        userData.department = department;
        userData.academicYear = academicYear;
        userData.semester = semester;
        userData.batch = batch;
        userData.approvalStatus = 'pending'; // Students need approval
      } else if (role === 'faculty') {
        userData.employeeId = employeeId;
        userData.designation = designation;
        userData.subjects = subjects || [];
        userData.approvalStatus = 'approved'; // Faculty auto-approved
      } else if (role === 'admin') {
        userData.approvalStatus = 'approved'; // Admin auto-approved
      }

      // Create user
      const user = await User.create(userData);

      // Send welcome email
      try {
        await emailService.sendWelcomeEmail(email, firstName);
        console.log('Welcome email sent successfully');
      } catch (emailError) {
        console.error('Failed to send welcome email:', emailError);
        // Don't fail registration if email fails
      }

      // Generate tokens
      const token = generateToken(user._id);
      const refreshToken = generateRefreshToken(user._id);

      // Remove password from response
      const userResponse = user.toObject();
      delete userResponse.password;

      const message = role === 'student' 
        ? 'Registration successful! Your account is pending approval from the admin.'
        : 'User registered successfully';

      res.status(201).json({
        success: true,
        message,
        data: {
          user: userResponse,
          token,
          refreshToken
        }
      });
    } catch (error) {
      console.error('Registration error:', error);
      res.status(500).json({
        success: false,
        message: 'Registration failed',
        error: error.message
      });
    }
  }

  /**
   * Login user
   */
  async login(req, res) {
    try {
      // Check for validation errors
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array()
        });
      }

      const { login, password } = req.body;

      // Find user by email, studentId, or employeeId
      const user = await User.findByLogin(login).select('+password');

      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'Invalid credentials'
        });
      }

      // Check if account is locked
      if (user.isLocked) {
        return res.status(401).json({
          success: false,
          message: 'Account is temporarily locked due to multiple failed login attempts'
        });
      }

      // Check if account is active
      if (!user.isActive) {
        return res.status(401).json({
          success: false,
          message: 'Account is deactivated'
        });
      }

      // Check password
      const isPasswordValid = await user.comparePassword(password);

      if (!isPasswordValid) {
        // Increment login attempts
        await user.incLoginAttempts();
        
        return res.status(401).json({
          success: false,
          message: 'Invalid credentials'
        });
      }

      // Reset login attempts on successful login
      if (user.loginAttempts > 0) {
        await user.resetLoginAttempts();
      }

      // Update last login
      user.lastLogin = new Date();
      await user.save();

      // Generate tokens
      const token = generateToken(user._id);
      const refreshToken = generateRefreshToken(user._id);

      // Remove password from response
      const userResponse = user.toObject();
      delete userResponse.password;

      res.json({
        success: true,
        message: 'Login successful',
        data: {
          user: userResponse,
          token,
          refreshToken
        }
      });
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({
        success: false,
        message: 'Login failed',
        error: error.message
      });
    }
  }

  /**
   * Refresh access token
   */
  async refreshToken(req, res) {
    try {
      const { refreshToken } = req.body;

      if (!refreshToken) {
        return res.status(400).json({
          success: false,
          message: 'Refresh token is required'
        });
      }

      // Verify refresh token
      const decoded = verifyRefreshToken(refreshToken);
      
      // Get user
      const user = await User.findById(decoded.userId);
      
      if (!user || !user.isActive) {
        return res.status(401).json({
          success: false,
          message: 'Invalid refresh token'
        });
      }

      // Generate new tokens
      const newToken = generateToken(user._id);
      const newRefreshToken = generateRefreshToken(user._id);

      res.json({
        success: true,
        message: 'Token refreshed successfully',
        data: {
          token: newToken,
          refreshToken: newRefreshToken
        }
      });
    } catch (error) {
      console.error('Token refresh error:', error);
      res.status(401).json({
        success: false,
        message: 'Invalid refresh token'
      });
    }
  }

  /**
   * Logout user
   */
  async logout(req, res) {
    try {
      // In a real application, you might want to blacklist the token
      // For now, we'll just return a success message
      res.json({
        success: true,
        message: 'Logout successful'
      });
    } catch (error) {
      console.error('Logout error:', error);
      res.status(500).json({
        success: false,
        message: 'Logout failed',
        error: error.message
      });
    }
  }

  /**
   * Get current user profile
   */
  async getProfile(req, res) {
    try {
      const user = await User.findById(req.user._id);
      
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      res.json({
        success: true,
        data: {
          user
        }
      });
    } catch (error) {
      console.error('Get profile error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get profile',
        error: error.message
      });
    }
  }

  /**
   * Update user profile
   */
  async updateProfile(req, res) {
    try {
      // Check for validation errors
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array()
        });
      }

      const {
        firstName,
        lastName,
        phone,
        address,
        dateOfBirth
      } = req.body;

      const updateData = {};
      
      if (firstName) updateData.firstName = firstName;
      if (lastName) updateData.lastName = lastName;
      if (phone) updateData.phone = phone;
      if (address) updateData.address = address;
      if (dateOfBirth) updateData.dateOfBirth = dateOfBirth;

      const user = await User.findByIdAndUpdate(
        req.user._id,
        updateData,
        { new: true, runValidators: true }
      );

      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      res.json({
        success: true,
        message: 'Profile updated successfully',
        data: {
          user
        }
      });
    } catch (error) {
      console.error('Update profile error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update profile',
        error: error.message
      });
    }
  }

  /**
   * Change password
   */
  async changePassword(req, res) {
    try {
      // Check for validation errors
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array()
        });
      }

      const { currentPassword, newPassword } = req.body;

      // Get user with password
      const user = await User.findById(req.user._id).select('+password');

      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      // Check current password
      const isCurrentPasswordValid = await user.comparePassword(currentPassword);

      if (!isCurrentPasswordValid) {
        return res.status(400).json({
          success: false,
          message: 'Current password is incorrect'
        });
      }

      // Update password
      user.password = newPassword;
      await user.save();

      res.json({
        success: true,
        message: 'Password changed successfully'
      });
    } catch (error) {
      console.error('Change password error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to change password',
        error: error.message
      });
    }
  }

  /**
   * Forgot password
   */
  async forgotPassword(req, res) {
    try {
      // Check for validation errors
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array()
        });
      }

      const { email } = req.body;

      const user = await User.findOne({ email });

      if (user) {
        const rawToken = user.generatePasswordReset(15); // 15 minutes expiry
        await user.save();

        const CLIENT_URL = process.env.NODE_ENV === 'production' ? process.env.CLIENT_URL_PROD : process.env.CLIENT_URL_DEV;

        // Send password reset email
        const emailResult = await emailService.sendPasswordResetEmail(
          email, 
          rawToken, 
          CLIENT_URL + '/auth/reset-password'
        );

        if (emailResult.success) {
          console.log('Password reset email sent successfully');
          if (process.env.NODE_ENV === 'development' && emailResult.previewUrl) {
            console.log('Email preview URL:', emailResult.previewUrl);
          }
        } else {
          console.error('Failed to send password reset email:', emailResult.error);
        }

        return res.json({
          success: true,
          message: 'If the email exists, a password reset link has been sent',
          ...(process.env.NODE_ENV === 'development' && emailResult.previewUrl && {
            data: {
              previewUrl: emailResult.previewUrl,
              resetToken: rawToken,
              expiresAt: user.resetPasswordExpires
            }
          })
        });
      }

      // Always respond success to prevent user enumeration
      res.json({
        success: true,
        message: 'If the email exists, a password reset link has been sent'
      });
    } catch (error) {
      console.error('Forgot password error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to process forgot password request',
        error: error.message
      });
    }
  }

  /**
   * Reset password
   */
  async resetPassword(req, res) {
    try {
      // Check for validation errors
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array()
        });
      }

      const { token, newPassword } = req.body;

      // Verify token and fetch user
      const user = await User.findByValidResetToken(token);
      if (!user) {
        return res.status(400).json({
          success: false,
          message: 'Invalid or expired reset token'
        });
      }

      // Update password and clear reset fields
      user.password = newPassword;
      user.resetPasswordToken = null;
      user.resetPasswordExpires = null;
      await user.save();

      res.json({
        success: true,
        message: 'Password reset successfully'
      });
    } catch (error) {
      console.error('Reset password error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to reset password',
        error: error.message
      });
    }
  }
}

module.exports = new AuthController();
