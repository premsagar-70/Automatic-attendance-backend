const mongoose = require('mongoose');

const sessionSchema = new mongoose.Schema({
  // Session basic information
  title: {
    type: String,
    required: [true, 'Session title is required'],
    trim: true,
    maxlength: [100, 'Session title cannot exceed 100 characters']
  },
  description: {
    type: String,
    trim: true,
    maxlength: [500, 'Description cannot exceed 500 characters']
  },

  // Subject and course information
  subject: {
    type: String,
    required: [true, 'Subject is required'],
    trim: true
  },
  courseCode: {
    type: String,
    required: [true, 'Course code is required'],
    trim: true,
    uppercase: true
  },

  // Faculty information
  faculty: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Faculty reference is required']
  },

  // Academic year and semester
  academicYear: {
    type: String,
    required: [true, 'Academic year is required'],
    trim: true,
    enum: ['1', '2', '3', '4']
  },
  semester: {
    type: String,
    required: [true, 'Semester is required'],
    trim: true,
    enum: ['1', '2']
  },

  // Session timing
  startTime: {
    type: Date,
    required: [true, 'Start time is required']
  },
  endTime: {
    type: Date,
    required: [true, 'End time is required']
  },
  actualStartTime: {
    type: Date,
    default: null
  },
  actualEndTime: {
    type: Date,
    default: null
  },

  // Location information
  location: {
    type: String,
    required: [true, 'Location is required'],
    trim: true
  },
  roomNumber: {
    type: String,
    trim: true
  },
  building: {
    type: String,
    trim: true
  },

  // Session type and mode
  sessionType: {
    type: String,
    enum: ['lecture', 'lab', 'tutorial', 'seminar', 'exam', 'other'],
    default: 'lecture'
  },
  mode: {
    type: String,
    enum: ['offline', 'online', 'hybrid'],
    default: 'offline'
  },

  // Online session details
  onlineDetails: {
    meetingLink: String,
    meetingId: String,
    meetingPassword: String,
    platform: {
      type: String,
      enum: ['zoom', 'teams', 'google-meet', 'other']
    }
  },

  // QR Code information
  qrCode: {
    code: {
      type: String,
      unique: true,
      sparse: true
    },
    generatedAt: {
      type: Date
    },
    expiresAt: {
      type: Date
    },
    isActive: {
      type: Boolean,
      default: false
    }
  },

  // Attendance settings
  attendanceSettings: {
    allowLateEntry: {
      type: Boolean,
      default: true
    },
    lateEntryCutoff: {
      type: Number,
      default: 15 // minutes
    },
    requireCheckout: {
      type: Boolean,
      default: false
    },
    allowProxyAttendance: {
      type: Boolean,
      default: false
    },
    requireLocationVerification: {
      type: Boolean,
      default: false
    },
    allowedLocationRadius: {
      type: Number,
      default: 100 // meters
    }
  },

  // Enrolled students
  enrolledStudents: [{
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    enrolledAt: {
      type: Date,
      default: Date.now
    }
  }],

  // Session status
  status: {
    type: String,
    enum: ['scheduled', 'active', 'completed', 'cancelled', 'postponed'],
    default: 'scheduled'
  },

  // Session metadata
  maxCapacity: {
    type: Number,
    default: 50
  },
  currentAttendance: {
    type: Number,
    default: 0
  },

  // Recurring session information
  isRecurring: {
    type: Boolean,
    default: false
  },
  recurringPattern: {
    frequency: {
      type: String,
      enum: ['daily', 'weekly', 'monthly']
    },
    daysOfWeek: [{
      type: String,
      enum: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
    }],
    endDate: Date
  },
  parentSession: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Session'
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

// Virtual for session duration
sessionSchema.virtual('duration').get(function () {
  if (this.startTime && this.endTime) {
    return Math.round((this.endTime - this.startTime) / (1000 * 60)); // Duration in minutes
  }
  return null;
});

// Virtual for actual duration
sessionSchema.virtual('actualDuration').get(function () {
  if (this.actualStartTime && this.actualEndTime) {
    return Math.round((this.actualEndTime - this.actualStartTime) / (1000 * 60));
  }
  return null;
});

// Virtual for attendance percentage
sessionSchema.virtual('attendancePercentage').get(function () {
  if (Array.isArray(this.enrolledStudents) && this.enrolledStudents.length > 0) {
    return Math.round((this.currentAttendance / this.enrolledStudents.length) * 100);
  }
  return 0;
});

// Virtual for session status based on time
sessionSchema.virtual('timeBasedStatus').get(function () {
  const now = new Date();
  if (now < this.startTime) return 'upcoming';
  if (now >= this.startTime && now <= this.endTime) return 'ongoing';
  if (now > this.endTime) return 'completed';
  return 'unknown';
});

// Indexes
sessionSchema.index({ faculty: 1, startTime: -1 });
sessionSchema.index({ subject: 1, courseCode: 1 });
sessionSchema.index({ startTime: 1, endTime: 1 });
sessionSchema.index({ status: 1 });
sessionSchema.index({ 'qrCode.code': 1 });
sessionSchema.index({ isActive: 1 });

// Pre-save middleware to update updatedAt
sessionSchema.pre('save', function (next) {
  this.updatedAt = Date.now();
  next();
});

// Pre-save middleware to validate timing
sessionSchema.pre('save', function (next) {
  if (this.startTime && this.endTime && this.startTime >= this.endTime) {
    return next(new Error('End time must be after start time'));
  }
  next();
});

// Static method to get active sessions
sessionSchema.statics.getActiveSessions = function () {
  const now = new Date();
  return this.find({
    status: 'active',
    startTime: { $lte: now },
    endTime: { $gte: now },
    isActive: true
  });
};

// Static method to get sessions by faculty
sessionSchema.statics.getFacultySessions = function (facultyId, startDate, endDate) {
  return this.find({
    faculty: facultyId,
    startTime: {
      $gte: new Date(startDate),
      $lte: new Date(endDate)
    },
    isActive: true
  }).populate('enrolledStudents.student', 'firstName lastName studentId');
};

// Static method to get student sessions
sessionSchema.statics.getStudentSessions = function (studentId, startDate, endDate) {
  return this.find({
    'enrolledStudents.student': studentId,
    startTime: {
      $gte: new Date(startDate),
      $lte: new Date(endDate)
    },
    isActive: true
  }).populate('faculty', 'firstName lastName email');
};

// Instance method to start session
sessionSchema.methods.startSession = function () {
  this.status = 'active';
  this.actualStartTime = new Date();
  this.qrCode.isActive = true;
  return this.save();
};

// Instance method to end session
sessionSchema.methods.endSession = function () {
  this.status = 'completed';
  this.actualEndTime = new Date();
  this.qrCode.isActive = false;
  return this.save();
};

// Instance method to add student
sessionSchema.methods.addStudent = function (studentId) {
  const existingStudent = this.enrolledStudents.find(
    enrolled => enrolled.student.toString() === studentId.toString()
  );

  if (!existingStudent) {
    this.enrolledStudents.push({ student: studentId });
    return this.save();
  }

  return Promise.resolve(this);
};

// Instance method to remove student
sessionSchema.methods.removeStudent = function (studentId) {
  this.enrolledStudents = this.enrolledStudents.filter(
    enrolled => enrolled.student.toString() !== studentId.toString()
  );
  return this.save();
};

module.exports = mongoose.model('Session', sessionSchema);
