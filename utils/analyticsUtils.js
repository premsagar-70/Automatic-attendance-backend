const moment = require('moment');

class AnalyticsUtils {
  /**
   * Calculate attendance statistics for a student
   * @param {Array} attendanceRecords - Array of attendance records
   * @param {Object} options - Calculation options
   * @returns {Object} Attendance statistics
   */
  calculateStudentAttendanceStats(attendanceRecords, options = {}) {
    const {
      startDate = null,
      endDate = null,
      subject = null,
      includeLate = true
    } = options;

    // Filter records based on criteria
    let filteredRecords = attendanceRecords;

    if (startDate) {
      filteredRecords = filteredRecords.filter(record => 
        moment(record.checkInTime).isSameOrAfter(startDate)
      );
    }

    if (endDate) {
      filteredRecords = filteredRecords.filter(record => 
        moment(record.checkInTime).isSameOrBefore(endDate)
      );
    }

    if (subject) {
      filteredRecords = filteredRecords.filter(record => 
        record.session && record.session.subject === subject
      );
    }

    // Calculate statistics
    const totalSessions = filteredRecords.length;
    const presentCount = filteredRecords.filter(record => record.status === 'present').length;
    const absentCount = filteredRecords.filter(record => record.status === 'absent').length;
    const lateCount = filteredRecords.filter(record => record.status === 'late').length;
    const excusedCount = filteredRecords.filter(record => record.status === 'excused').length;

    const attendancePercentage = totalSessions > 0 ? 
      Math.round((presentCount / totalSessions) * 100) : 0;

    const effectiveAttendance = includeLate ? 
      presentCount + lateCount : presentCount;
    const effectivePercentage = totalSessions > 0 ? 
      Math.round((effectiveAttendance / totalSessions) * 100) : 0;

    return {
      totalSessions,
      present: presentCount,
      absent: absentCount,
      late: lateCount,
      excused: excusedCount,
      attendancePercentage,
      effectiveAttendance: effectiveAttendance,
      effectivePercentage,
      summary: {
        excellent: effectivePercentage >= 90,
        good: effectivePercentage >= 80 && effectivePercentage < 90,
        average: effectivePercentage >= 70 && effectivePercentage < 80,
        poor: effectivePercentage < 70
      }
    };
  }

  /**
   * Calculate session attendance statistics
   * @param {Array} attendanceRecords - Array of attendance records for a session
   * @param {Number} totalEnrolled - Total number of enrolled students
   * @returns {Object} Session statistics
   */
  calculateSessionStats(attendanceRecords, totalEnrolled) {
    const totalPresent = attendanceRecords.filter(record => 
      record.status === 'present' || record.status === 'late'
    ).length;

    const totalAbsent = attendanceRecords.filter(record => 
      record.status === 'absent'
    ).length;

    const totalExcused = attendanceRecords.filter(record => 
      record.status === 'excused'
    ).length;

    const attendanceRate = totalEnrolled > 0 ? 
      Math.round((totalPresent / totalEnrolled) * 100) : 0;

    const averageCheckInTime = this.calculateAverageCheckInTime(attendanceRecords);
    const punctualityRate = this.calculatePunctualityRate(attendanceRecords);

    return {
      totalEnrolled,
      totalPresent,
      totalAbsent,
      totalExcused,
      attendanceRate,
      averageCheckInTime,
      punctualityRate,
      summary: {
        highAttendance: attendanceRate >= 90,
        moderateAttendance: attendanceRate >= 70 && attendanceRate < 90,
        lowAttendance: attendanceRate < 70
      }
    };
  }

  /**
   * Generate attendance trends over time
   * @param {Array} attendanceRecords - Array of attendance records
   * @param {String} period - Time period (daily, weekly, monthly)
   * @param {Number} limit - Number of periods to include
   * @returns {Array} Trend data
   */
  generateAttendanceTrends(attendanceRecords, period = 'weekly', limit = 12) {
    const trends = [];
    const now = moment();

    for (let i = limit - 1; i >= 0; i--) {
      let startDate, endDate, label;

      switch (period) {
        case 'daily':
          startDate = now.clone().subtract(i, 'days').startOf('day');
          endDate = now.clone().subtract(i, 'days').endOf('day');
          label = startDate.format('MMM DD');
          break;
        case 'weekly':
          startDate = now.clone().subtract(i, 'weeks').startOf('week');
          endDate = now.clone().subtract(i, 'weeks').endOf('week');
          label = `Week ${startDate.format('MMM DD')}`;
          break;
        case 'monthly':
          startDate = now.clone().subtract(i, 'months').startOf('month');
          endDate = now.clone().subtract(i, 'months').endOf('month');
          label = startDate.format('MMM YYYY');
          break;
        default:
          throw new Error('Invalid period. Use daily, weekly, or monthly');
      }

      const periodRecords = attendanceRecords.filter(record => 
        moment(record.checkInTime).isBetween(startDate, endDate, null, '[]')
      );

      const stats = this.calculateStudentAttendanceStats(periodRecords);
      
      trends.push({
        period: label,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        ...stats
      });
    }

    return trends.reverse(); // Return in chronological order
  }

  /**
   * Identify at-risk students based on attendance
   * @param {Array} students - Array of student data with attendance records
   * @param {Object} criteria - Risk assessment criteria
   * @returns {Array} At-risk students
   */
  identifyAtRiskStudents(students, criteria = {}) {
    const {
      minAttendancePercentage = 70,
      minSessions = 5,
      lookbackDays = 30
    } = criteria;

    const cutoffDate = moment().subtract(lookbackDays, 'days');

    return students
      .map(student => {
        const recentRecords = student.attendanceRecords.filter(record => 
          moment(record.checkInTime).isAfter(cutoffDate)
        );

        const stats = this.calculateStudentAttendanceStats(recentRecords);
        
        return {
          ...student,
          attendanceStats: stats,
          isAtRisk: stats.totalSessions >= minSessions && 
                   stats.effectivePercentage < minAttendancePercentage
        };
      })
      .filter(student => student.isAtRisk)
      .sort((a, b) => a.attendanceStats.effectivePercentage - b.attendanceStats.effectivePercentage);
  }

  /**
   * Calculate average check-in time
   * @param {Array} attendanceRecords - Array of attendance records
   * @returns {String} Average check-in time in HH:mm format
   */
  calculateAverageCheckInTime(attendanceRecords) {
    if (attendanceRecords.length === 0) return null;

    const totalMinutes = attendanceRecords.reduce((sum, record) => {
      const checkInTime = moment(record.checkInTime);
      const sessionStart = moment(record.session.startTime);
      const minutesDiff = checkInTime.diff(sessionStart, 'minutes');
      return sum + minutesDiff;
    }, 0);

    const averageMinutes = totalMinutes / attendanceRecords.length;
    const hours = Math.floor(Math.abs(averageMinutes) / 60);
    const minutes = Math.abs(averageMinutes) % 60;
    const sign = averageMinutes < 0 ? '-' : '+';

    return `${sign}${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
  }

  /**
   * Calculate punctuality rate
   * @param {Array} attendanceRecords - Array of attendance records
   * @returns {Number} Punctuality rate percentage
   */
  calculatePunctualityRate(attendanceRecords) {
    if (attendanceRecords.length === 0) return 0;

    const onTimeCount = attendanceRecords.filter(record => {
      const checkInTime = moment(record.checkInTime);
      const sessionStart = moment(record.session.startTime);
      const minutesDiff = checkInTime.diff(sessionStart, 'minutes');
      return minutesDiff <= 5; // Consider on-time if within 5 minutes
    }).length;

    return Math.round((onTimeCount / attendanceRecords.length) * 100);
  }

  /**
   * Generate attendance heatmap data
   * @param {Array} attendanceRecords - Array of attendance records
   * @param {String} groupBy - Group by field (dayOfWeek, hour, subject)
   * @returns {Object} Heatmap data
   */
  generateAttendanceHeatmap(attendanceRecords, groupBy = 'dayOfWeek') {
    const heatmapData = {};

    attendanceRecords.forEach(record => {
      let key;
      const checkInTime = moment(record.checkInTime);

      switch (groupBy) {
        case 'dayOfWeek':
          key = checkInTime.format('dddd');
          break;
        case 'hour':
          key = checkInTime.format('HH:00');
          break;
        case 'subject':
          key = record.session ? record.session.subject : 'Unknown';
          break;
        default:
          key = checkInTime.format('YYYY-MM-DD');
      }

      if (!heatmapData[key]) {
        heatmapData[key] = {
          total: 0,
          present: 0,
          absent: 0,
          late: 0
        };
      }

      heatmapData[key].total++;
      
      if (record.status === 'present' || record.status === 'late') {
        heatmapData[key].present++;
      } else if (record.status === 'absent') {
        heatmapData[key].absent++;
      }

      if (record.status === 'late') {
        heatmapData[key].late++;
      }
    });

    // Calculate percentages
    Object.keys(heatmapData).forEach(key => {
      const data = heatmapData[key];
      data.attendanceRate = data.total > 0 ? 
        Math.round((data.present / data.total) * 100) : 0;
      data.lateRate = data.total > 0 ? 
        Math.round((data.late / data.total) * 100) : 0;
    });

    return heatmapData;
  }

  /**
   * Generate comparative analysis between students
   * @param {Array} students - Array of student data
   * @param {String} metric - Metric to compare (attendancePercentage, punctualityRate)
   * @returns {Object} Comparative analysis
   */
  generateComparativeAnalysis(students, metric = 'attendancePercentage') {
    const values = students.map(student => student.attendanceStats[metric] || 0);
    
    const sorted = values.sort((a, b) => a - b);
    const count = sorted.length;

    if (count === 0) {
      return {
        min: 0,
        max: 0,
        average: 0,
        median: 0,
        percentile25: 0,
        percentile75: 0
      };
    }

    return {
      min: sorted[0],
      max: sorted[count - 1],
      average: Math.round(values.reduce((sum, val) => sum + val, 0) / count),
      median: count % 2 === 0 ? 
        (sorted[count / 2 - 1] + sorted[count / 2]) / 2 : 
        sorted[Math.floor(count / 2)],
      percentile25: sorted[Math.floor(count * 0.25)],
      percentile75: sorted[Math.floor(count * 0.75)]
    };
  }
}

module.exports = new AnalyticsUtils();
