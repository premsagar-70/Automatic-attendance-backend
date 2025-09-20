const mongoose = require('mongoose');

const timetableSchema = new mongoose.Schema({
  // Basic information
  title: {
    type: String,
    required: [true, 'Timetable title is required']
  },
  description: {
    type: String,
    maxlength: [500, 'Description cannot exceed 500 characters']
  },
  
  // Academic information
  academicYear: {
    type: String,
    required: [true, 'Academic year is required']
  },
  semester: {
    type: String,
    required: [true, 'Semester is required']
  },
  department: {
    type: String,
    required: [true, 'Department is required']
  },
  section: {
    type: String,
    required: [true, 'Section is required']
  },
  
  // Schedule details
  schedule: [{
    dayOfWeek: {
      type: String,
      enum: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'],
      required: true
    },
    startTime: {
      type: String,
      required: true,
      validate: {
        validator: function(v) {
          return /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(v);
        },
        message: 'Invalid time format. Use HH:MM format.'
      }
    },
    endTime: {
      type: String,
      required: true,
      validate: {
        validator: function(v) {
          return /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(v);
        },
        message: 'Invalid time format. Use HH:MM format.'
      }
    },
    subject: {
      type: String,
      required: [true, 'Subject is required']
    },
    courseCode: {
      type: String,
      required: [true, 'Course code is required']
    },
    faculty: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Faculty assignment is required']
    },
    location: {
      type: String,
      required: [true, 'Location is required']
    },
    roomNumber: String,
    building: String,
    
    // Session generation settings
    autoGenerateSessions: {
      type: Boolean,
      default: true
    },
    sessionDuration: {
      type: Number,
      default: 60, // in minutes
      min: 30,
      max: 180
    },
    attendanceRequired: {
      type: Boolean,
      default: true
    }
  }],
  
  // Date range
  startDate: {
    type: Date,
    required: [true, 'Start date is required']
  },
  endDate: {
    type: Date,
    required: [true, 'End date is required']
  },
  
  // Status
  isActive: {
    type: Boolean,
    default: true
  },
  isFinalized: {
    type: Boolean,
    default: false
  },
  finalizedAt: {
    type: Date
  },
  finalizedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  
  // System fields
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
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

// Virtual for total sessions that will be generated
timetableSchema.virtual('totalSessions').get(function() {
  if (!this.startDate || !this.endDate) return 0;
  
  const start = new Date(this.startDate);
  const end = new Date(this.endDate);
  const daysDiff = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
  const weeks = Math.ceil(daysDiff / 7);
  
  return this.schedule.length * weeks;
});

// Pre-save middleware
timetableSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Static method to generate sessions from timetable
timetableSchema.statics.generateSessions = async function(timetableId) {
  const timetable = await this.findById(timetableId).populate('schedule.faculty');
  if (!timetable) {
    throw new Error('Timetable not found');
  }
  
  const Session = require('./Session');
  const generatedSessions = [];
  
  const startDate = new Date(timetable.startDate);
  const endDate = new Date(timetable.endDate);
  
  // Generate sessions for each week
  for (let currentDate = new Date(startDate); currentDate <= endDate; currentDate.setDate(currentDate.getDate() + 7)) {
    for (const scheduleItem of timetable.schedule) {
      if (!scheduleItem.autoGenerateSessions) continue;
      
      const dayOfWeek = this.getDayOfWeekNumber(scheduleItem.dayOfWeek);
      const sessionDate = this.getNextWeekday(currentDate, dayOfWeek);
      
      if (sessionDate > endDate) continue;
      
      const startTime = new Date(sessionDate);
      const [hours, minutes] = scheduleItem.startTime.split(':');
      startTime.setHours(parseInt(hours), parseInt(minutes), 0, 0);
      
      const endTime = new Date(startTime);
      endTime.setMinutes(endTime.getMinutes() + scheduleItem.sessionDuration);
      
      const sessionData = {
        title: `${scheduleItem.subject} - ${scheduleItem.courseCode}`,
        description: `Auto-generated session from timetable`,
        subject: scheduleItem.subject,
        courseCode: scheduleItem.courseCode,
        faculty: scheduleItem.faculty._id,
        startTime: startTime,
        endTime: endTime,
        location: scheduleItem.location,
        roomNumber: scheduleItem.roomNumber,
        building: scheduleItem.building,
        type: 'regular',
        mode: 'offline',
        academicYear: timetable.academicYear,
        semester: timetable.semester,
        department: timetable.department,
        section: timetable.section,
        isAutoGenerated: true,
        timetableId: timetableId,
        status: 'scheduled'
      };
      
      try {
        const session = await Session.create(sessionData);
        generatedSessions.push(session);
      } catch (error) {
        console.error(`Failed to create session for ${scheduleItem.subject}:`, error);
      }
    }
  }
  
  return generatedSessions;
};

// Helper method to get day of week number
timetableSchema.statics.getDayOfWeekNumber = function(dayName) {
  const days = {
    'sunday': 0,
    'monday': 1,
    'tuesday': 2,
    'wednesday': 3,
    'thursday': 4,
    'friday': 5,
    'saturday': 6
  };
  return days[dayName.toLowerCase()];
};

// Helper method to get next occurrence of a weekday
timetableSchema.statics.getNextWeekday = function(startDate, dayOfWeek) {
  const date = new Date(startDate);
  const currentDay = date.getDay();
  const daysUntilTarget = (dayOfWeek - currentDay + 7) % 7;
  date.setDate(date.getDate() + daysUntilTarget);
  return date;
};

// Instance method to finalize timetable
timetableSchema.methods.finalize = function(finalizedBy) {
  this.isFinalized = true;
  this.finalizedAt = new Date();
  this.finalizedBy = finalizedBy;
  return this.save();
};

// Indexes
timetableSchema.index({ academicYear: 1, semester: 1, department: 1, section: 1 });
timetableSchema.index({ isActive: 1 });
timetableSchema.index({ createdBy: 1 });

module.exports = mongoose.model('Timetable', timetableSchema);
