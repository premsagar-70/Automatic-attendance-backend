const mongoose = require('mongoose');

const academicYearSchema = new mongoose.Schema({
  // Academic year information (e.g., 2024-2025)
  year: {
    type: String,
    required: [true, 'Academic year is required'],
    unique: true,
    trim: true,
    match: [/^\d{4}-\d{4}$/, 'Academic year must be in format YYYY-YYYY']
  },
  
  // Year details
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
    default: false
  },
  isCurrent: {
    type: Boolean,
    default: false
  },
  
  // Academic Years (1st, 2nd, 3rd, 4th year) with their semesters
  academicYears: [{
    year: {
      type: String,
      required: true,
      enum: ['1', '2', '3', '4']
    },
    semesters: [{
      name: {
        type: String,
        required: true,
        enum: ['1', '2']
      },
      startDate: {
        type: Date,
        required: true
      },
      endDate: {
        type: Date,
        required: true
      },
      isActive: {
        type: Boolean,
        default: true
      },
      isCurrent: {
        type: Boolean,
        default: false
      },
      isFinalized: {
        type: Boolean,
        default: false
      },
      finalizedAt: {
        type: Date,
        default: null
      },
      finalizedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null
      }
    }]
  }],
  
  // System fields
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  isDeleted: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

// Indexes
academicYearSchema.index({ year: 1 });
academicYearSchema.index({ isActive: 1 });
academicYearSchema.index({ isCurrent: 1 });
academicYearSchema.index({ 'academicYears.year': 1 });
academicYearSchema.index({ 'academicYears.semesters.isCurrent': 1 });

// Virtual for current academic year and semester
academicYearSchema.virtual('currentAcademicYear').get(function() {
  const currentYear = this.academicYears.find(ay => 
    ay.semesters.some(sem => sem.isCurrent)
  );
  return currentYear || null;
});

academicYearSchema.virtual('currentSemester').get(function() {
  for (const academicYear of this.academicYears) {
    const currentSem = academicYear.semesters.find(sem => sem.isCurrent);
    if (currentSem) {
      return {
        academicYear: academicYear.year,
        semester: currentSem.name,
        startDate: currentSem.startDate,
        endDate: currentSem.endDate
      };
    }
  }
  return null;
});

// Static method to get current academic year
academicYearSchema.statics.getCurrentAcademicYear = async function() {
  return await this.findOne({ isCurrent: true, isActive: true });
};

// Static method to get current semester
academicYearSchema.statics.getCurrentSemester = async function() {
  const currentYear = await this.getCurrentAcademicYear();
  if (!currentYear) return null;
  return currentYear.currentSemester;
};

// Instance method to set as current academic year
academicYearSchema.methods.setAsCurrent = async function() {
  // Remove current status from other academic years
  await this.constructor.updateMany(
    { _id: { $ne: this._id } },
    { isCurrent: false }
  );
  
  // Set this as current
  this.isCurrent = true;
  this.isActive = true;
  return await this.save();
};

// Instance method to activate semester
academicYearSchema.methods.activateSemester = async function(academicYear, semesterName) {
  // Deactivate all other semesters
  this.academicYears.forEach(ay => {
    ay.semesters.forEach(sem => {
      sem.isCurrent = false;
    });
  });
  
  // Activate the specified semester
  const yearData = this.academicYears.find(ay => ay.year === academicYear);
  if (!yearData) {
    throw new Error('Academic year not found');
  }
  
  const semester = yearData.semesters.find(sem => sem.name === semesterName);
  if (!semester) {
    throw new Error('Semester not found');
  }
  
  semester.isCurrent = true;
  semester.isActive = true;
  
  return await this.save();
};

// Instance method to finalize semester
academicYearSchema.methods.finalizeSemester = async function(academicYear, semesterName, finalizedBy) {
  const yearData = this.academicYears.find(ay => ay.year === academicYear);
  if (!yearData) {
    throw new Error('Academic year not found');
  }
  
  const semester = yearData.semesters.find(sem => sem.name === semesterName);
  if (!semester) {
    throw new Error('Semester not found');
  }
  
  if (semester.isFinalized) {
    throw new Error('Semester is already finalized');
  }
  
  semester.isFinalized = true;
  semester.finalizedAt = new Date();
  semester.finalizedBy = finalizedBy;
  
  return await this.save();
};

// Pre-save middleware to validate dates
academicYearSchema.pre('save', function(next) {
  if (this.startDate >= this.endDate) {
    return next(new Error('Start date must be before end date'));
  }
  
  // Validate academic years and semesters
  for (const academicYear of this.academicYears) {
    for (const semester of academicYear.semesters) {
      if (semester.startDate >= semester.endDate) {
        return next(new Error(`Semester ${academicYear.year}-${semester.name} start date must be before end date`));
      }
      
      if (semester.startDate < this.startDate || semester.endDate > this.endDate) {
        return next(new Error(`Semester ${academicYear.year}-${semester.name} dates must be within academic year range`));
      }
    }
  }
  
  next();
});

module.exports = mongoose.model('AcademicYear', academicYearSchema);