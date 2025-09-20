const mongoose = require('mongoose');

const attendanceSchema = new mongoose.Schema({
  // Student reference
  student: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Student reference is required']
  },
  
  // Session reference
  session: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Session',
    required: [true, 'Session reference is required']
  },
  
  // Attendance details
  status: {
    type: String,
    enum: ['present', 'absent', 'excused'],
    default: 'present',
    required: true
  },
  
  // Semester and academic year information
  academicYear: {
    type: String,
    required: true
  },
  semester: {
    type: String,
    required: true
  },
  
  // Approval workflow
  isApproved: {
    type: Boolean,
    default: false
  },
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  approvedAt: {
    type: Date
  },
  
  // QR Code submission data
  qrSubmission: {
    submittedAt: Date,
    isPendingApproval: {
      type: Boolean,
      default: true
    }
  },
  
  // Timestamps
  checkInTime: {
    type: Date,
    required: [true, 'Check-in time is required']
  },
  checkOutTime: {
    type: Date,
    default: null
  },
  
  // Location data (for GPS-based attendance)
  location: {
    latitude: {
      type: Number,
      min: -90,
      max: 90
    },
    longitude: {
      type: Number,
      min: -180,
      max: 180
    },
    accuracy: Number, // GPS accuracy in meters
    address: String
  },
  
  // Device information
  deviceInfo: {
    userAgent: String,
    platform: String,
    browser: String,
    ipAddress: String
  },
  
  // QR Code data
  qrCodeData: {
    code: String,
    scannedAt: Date,
    isValid: {
      type: Boolean,
      default: true
    }
  },
  
  // Biometric data (if applicable)
  biometricData: {
    fingerprintId: String,
    faceId: String,
    confidence: Number
  },
  
  // Faculty verification
  verifiedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  verifiedAt: {
    type: Date
  },
  verificationNotes: {
    type: String,
    maxlength: [500, 'Verification notes cannot exceed 500 characters']
  },
  
  // Attendance metadata
  isProxy: {
    type: Boolean,
    default: false
  },
  proxyReason: {
    type: String,
    maxlength: [200, 'Proxy reason cannot exceed 200 characters']
  },
  
  // System fields
  isActive: {
    type: Boolean,
    default: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
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

// Virtual for duration
attendanceSchema.virtual('duration').get(function() {
  if (this.checkInTime && this.checkOutTime) {
    return Math.round((this.checkOutTime - this.checkInTime) / (1000 * 60)); // Duration in minutes
  }
  return null;
});

// Virtual for attendance status with duration
attendanceSchema.virtual('attendanceStatus').get(function() {
  if (this.status === 'present' && this.checkOutTime) {
    const duration = this.duration;
    if (duration < 30) return 'short-attendance';
    if (duration > 240) return 'extended-attendance';
    return 'normal-attendance';
  }
  return this.status;
});

// Compound indexes
attendanceSchema.index({ student: 1, session: 1 }, { unique: true });
attendanceSchema.index({ session: 1, status: 1 });
attendanceSchema.index({ checkInTime: 1 });
attendanceSchema.index({ student: 1, checkInTime: -1 });
attendanceSchema.index({ isActive: 1 });

// Pre-save middleware to update updatedAt
attendanceSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Static method to get attendance statistics
attendanceSchema.statics.getAttendanceStats = async function(studentId, startDate, endDate) {
  const pipeline = [
    {
      $match: {
        student: mongoose.Types.ObjectId(studentId),
        checkInTime: {
          $gte: new Date(startDate),
          $lte: new Date(endDate)
        },
        isActive: true
      }
    },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 }
      }
    }
  ];
  
  return await this.aggregate(pipeline);
};

// Static method to get attendance by session
attendanceSchema.statics.getSessionAttendance = async function(sessionId) {
  return await this.find({ session: sessionId, isActive: true })
    .populate('student', 'firstName lastName studentId email')
    .populate('verifiedBy', 'firstName lastName')
    .sort({ checkInTime: -1 });
};

// Instance method to mark checkout
attendanceSchema.methods.markCheckout = function(checkOutTime = new Date()) {
  this.checkOutTime = checkOutTime;
  this.updatedAt = new Date();
  return this.save();
};

// Instance method to verify attendance
attendanceSchema.methods.verifyAttendance = function(verifiedBy, notes = '') {
  this.verifiedBy = verifiedBy;
  this.verifiedAt = new Date();
  this.verificationNotes = notes;
  this.updatedAt = new Date();
  return this.save();
};

module.exports = mongoose.model('Attendance', attendanceSchema);
