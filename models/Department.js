const mongoose = require('mongoose');

const departmentSchema = new mongoose.Schema({
  // Department basic information
  name: {
    type: String,
    required: [true, 'Department name is required'],
    unique: true,
    trim: true,
    maxlength: [100, 'Department name cannot exceed 100 characters']
  },
  
  code: {
    type: String,
    required: [true, 'Department code is required'],
    unique: true,
    trim: true,
    uppercase: true,
    maxlength: [10, 'Department code cannot exceed 10 characters']
  },
  
  description: {
    type: String,
    trim: true,
    maxlength: [500, 'Description cannot exceed 500 characters']
  },
  
  // Department head
  head: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  
  // Contact information
  contactInfo: {
    email: {
      type: String,
      trim: true,
      lowercase: true
    },
    phone: {
      type: String,
      trim: true
    },
    office: {
      type: String,
      trim: true
    }
  },
  
  // Academic information
  academicInfo: {
    establishedYear: {
      type: Number,
      min: [1900, 'Established year must be after 1900'],
      max: [new Date().getFullYear(), 'Established year cannot be in the future']
    },
    accreditation: {
      type: String,
      trim: true
    },
    programs: [{
      type: String,
      trim: true
    }]
  },
  
  // Statistics
  stats: {
    totalStudents: {
      type: Number,
      default: 0
    },
    totalFaculty: {
      type: Number,
      default: 0
    },
    totalSessions: {
      type: Number,
      default: 0
    }
  },
  
  // Status
  isActive: {
    type: Boolean,
    default: true
  },
  
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
departmentSchema.index({ name: 1 });
departmentSchema.index({ code: 1 });
departmentSchema.index({ isActive: 1 });
departmentSchema.index({ 'academicInfo.programs': 1 });

// Virtual for department head name
departmentSchema.virtual('headName').get(function() {
  return this.head ? `${this.head.firstName} ${this.head.lastName}` : 'Not assigned';
});

// Instance method to update statistics
departmentSchema.methods.updateStats = async function() {
  const User = mongoose.model('User');
  const Session = mongoose.model('Session');
  
  // Count students in this department
  const totalStudents = await User.countDocuments({
    role: 'student',
    'studentInfo.department': this._id,
    isActive: true
  });
  
  // Count faculty in this department
  const totalFaculty = await User.countDocuments({
    role: 'faculty',
    'facultyInfo.department': this._id,
    isActive: true
  });
  
  // Count sessions for this department
  const totalSessions = await Session.countDocuments({
    'faculty.facultyInfo.department': this._id,
    isActive: true
  });
  
  this.stats = {
    totalStudents,
    totalFaculty,
    totalSessions
  };
  
  return await this.save();
};

// Static method to get department statistics
departmentSchema.statics.getDepartmentStats = async function() {
  const departments = await this.find({ isActive: true, isDeleted: false });
  
  const stats = await Promise.all(
    departments.map(async (dept) => {
      await dept.updateStats();
      return {
        department: dept.name,
        code: dept.code,
        stats: dept.stats
      };
    })
  );
  
  return stats;
};

// Pre-save middleware
departmentSchema.pre('save', function(next) {
  // Ensure code is uppercase
  if (this.code) {
    this.code = this.code.toUpperCase();
  }
  
  next();
});

module.exports = mongoose.model('Department', departmentSchema);
