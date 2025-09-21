const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { ROLES } = require('../config/roles');

const userSchema = new mongoose.Schema({
  // Basic Information
  firstName: {
    type: String,
    required: [true, 'First name is required'],
    trim: true,
    maxlength: [50, 'First name cannot exceed 50 characters']
  },
  lastName: {
    type: String,
    required: [true, 'Last name is required'],
    trim: true,
    maxlength: [50, 'Last name cannot exceed 50 characters']
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [6, 'Password must be at least 6 characters'],
    select: false // Don't include password in queries by default
  },
  
  // Role and Access
  role: {
    type: String,
    enum: Object.values(ROLES),
    default: ROLES.STUDENT,
    required: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
  
  // Student-specific fields
  studentId: {
    type: String,
    unique: true,
    sparse: true, // Allows null values but ensures uniqueness when present
    trim: true
  },
  department: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Department',
    required: [function() { return this.role === 'student' || this.role === 'faculty'; }, 'Department is required for students and faculty']
  },
  academicYear: {
    type: String,
    required: [function() { return this.role === 'student'; }, 'Academic year is required for students'],
    enum: ['1', '2', '3', '4']
  },
  semester: {
    type: String,
    required: [function() { return this.role === 'student'; }, 'Semester is required for students'],
    enum: ['1', '2']
  },
  batch: {
    type: String,
    trim: true,
    required: [function() { return this.role === 'student'; }, 'Batch is required for students']
  },
  
  // Faculty-specific fields
  employeeId: {
    type: String,
    unique: true,
    sparse: true,
    trim: true
  },
  designation: {
    type: String,
    trim: true
  },
  subjects: [{
    type: String,
    trim: true
  }],
  
  // Contact Information
  phone: {
    type: String,
    trim: true,
    match: [/^[\+]?[1-9][\d]{0,15}$/, 'Please enter a valid phone number']
  },
  address: {
    street: String,
    city: String,
    state: String,
    zipCode: String,
    country: String
  },
  
  // Profile
  profilePicture: {
    type: String,
    default: null
  },
  dateOfBirth: {
    type: Date
  },
  
  // Approval status
  approvalStatus: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending'
  },
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  approvedAt: {
    type: Date,
    default: null
  },
  rejectionReason: {
    type: String,
    trim: true
  },
  
  // System fields
  lastLogin: {
    type: Date
  },
  loginAttempts: {
    type: Number,
    default: 0
  },
  lockUntil: {
    type: Date
  },
  
  // Timestamps
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual for full name
userSchema.virtual('fullName').get(function() {
  return `${this.firstName} ${this.lastName}`;
});

// Virtual for account lock status
userSchema.virtual('isLocked').get(function() {
  return !!(this.lockUntil && this.lockUntil > Date.now());
});

// Indexes
userSchema.index({ email: 1 });
userSchema.index({ studentId: 1 });
userSchema.index({ employeeId: 1 });
userSchema.index({ role: 1 });
userSchema.index({ department: 1 });
userSchema.index({ isActive: 1 });

// Pre-save middleware to hash password
userSchema.pre('save', async function(next) {
  // Only hash the password if it has been modified (or is new)
  if (!this.isModified('password')) return next();
  
  try {
    // Hash password with cost of 12
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Pre-save middleware to update updatedAt
userSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Instance method to check password
userSchema.methods.comparePassword = async function(candidatePassword) {
  if (!this.password) return false;
  return await bcrypt.compare(candidatePassword, this.password);
};

// Instance method to increment login attempts
userSchema.methods.incLoginAttempts = function() {
  // If we have a previous lock that has expired, restart at 1
  if (this.lockUntil && this.lockUntil < Date.now()) {
    return this.updateOne({
      $unset: { lockUntil: 1 },
      $set: { loginAttempts: 1 }
    });
  }
  
  const updates = { $inc: { loginAttempts: 1 } };
  
  // Lock account after 5 failed attempts for 2 hours
  if (this.loginAttempts + 1 >= 5 && !this.isLocked) {
    updates.$set = { lockUntil: Date.now() + 2 * 60 * 60 * 1000 }; // 2 hours
  }
  
  return this.updateOne(updates);
};

// Instance method to reset login attempts
userSchema.methods.resetLoginAttempts = function() {
  return this.updateOne({
    $unset: { loginAttempts: 1, lockUntil: 1 }
  });
};

// Static method to find by email or student/employee ID
userSchema.statics.findByLogin = function(login) {
  return this.findOne({
    $or: [
      { email: login },
      { studentId: login },
      { employeeId: login }
    ]
  });
};

// Password reset fields
userSchema.add({
  resetPasswordToken: {
    type: String,
    index: true,
    default: null
  },
  resetPasswordExpires: {
    type: Date,
    default: null
  }
});

// Instance method to generate password reset token
userSchema.methods.generatePasswordReset = function(expiryMinutes = 15) {
  const rawToken = crypto.randomBytes(32).toString('hex');
  const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex');

  this.resetPasswordToken = hashedToken;
  this.resetPasswordExpires = new Date(Date.now() + expiryMinutes * 60 * 1000);

  return rawToken; // return raw token to send to user via email or response (for testing)
};

// Static method to verify reset token and get user
userSchema.statics.findByValidResetToken = function(rawToken) {
  const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex');
  return this.findOne({
    resetPasswordToken: hashedToken,
    resetPasswordExpires: { $gt: new Date() }
  }).select('+password');
};

module.exports = mongoose.model('User', userSchema);
