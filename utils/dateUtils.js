const moment = require('moment');

class DateUtils {
  constructor() {
    this.defaultFormat = 'YYYY-MM-DD';
    this.defaultDateTimeFormat = 'YYYY-MM-DD HH:mm:ss';
    this.displayFormat = 'MMM DD, YYYY';
    this.displayDateTimeFormat = 'MMM DD, YYYY HH:mm';
  }

  /**
   * Format date to default format
   * @param {Date|String|moment} date - Date to format
   * @returns {String} Formatted date
   */
  formatDate(date) {
    return moment(date).format(this.defaultFormat);
  }

  /**
   * Format date to display format
   * @param {Date|String|moment} date - Date to format
   * @returns {String} Formatted date
   */
  formatDisplayDate(date) {
    return moment(date).format(this.displayFormat);
  }

  /**
   * Format date and time to default format
   * @param {Date|String|moment} date - Date to format
   * @returns {String} Formatted date and time
   */
  formatDateTime(date) {
    return moment(date).format(this.defaultDateTimeFormat);
  }

  /**
   * Format date and time to display format
   * @param {Date|String|moment} date - Date to format
   * @returns {String} Formatted date and time
   */
  formatDisplayDateTime(date) {
    return moment(date).format(this.displayDateTimeFormat);
  }

  /**
   * Get start of day
   * @param {Date|String|moment} date - Date
   * @returns {Date} Start of day
   */
  getStartOfDay(date) {
    return moment(date).startOf('day').toDate();
  }

  /**
   * Get end of day
   * @param {Date|String|moment} date - Date
   * @returns {Date} End of day
   */
  getEndOfDay(date) {
    return moment(date).endOf('day').toDate();
  }

  /**
   * Get start of week
   * @param {Date|String|moment} date - Date
   * @returns {Date} Start of week
   */
  getStartOfWeek(date) {
    return moment(date).startOf('week').toDate();
  }

  /**
   * Get end of week
   * @param {Date|String|moment} date - Date
   * @returns {Date} End of week
   */
  getEndOfWeek(date) {
    return moment(date).endOf('week').toDate();
  }

  /**
   * Get start of month
   * @param {Date|String|moment} date - Date
   * @returns {Date} Start of month
   */
  getStartOfMonth(date) {
    return moment(date).startOf('month').toDate();
  }

  /**
   * Get end of month
   * @param {Date|String|moment} date - Date
   * @returns {Date} End of month
   */
  getEndOfMonth(date) {
    return moment(date).endOf('month').toDate();
  }

  /**
   * Get date range for a period
   * @param {String} period - Period (today, yesterday, thisWeek, lastWeek, thisMonth, lastMonth, thisYear, lastYear)
   * @returns {Object} Date range with start and end dates
   */
  getDateRange(period) {
    const now = moment();
    
    switch (period) {
      case 'today':
        return {
          start: this.getStartOfDay(now),
          end: this.getEndOfDay(now)
        };
      
      case 'yesterday':
        const yesterday = now.clone().subtract(1, 'day');
        return {
          start: this.getStartOfDay(yesterday),
          end: this.getEndOfDay(yesterday)
        };
      
      case 'thisWeek':
        return {
          start: this.getStartOfWeek(now),
          end: this.getEndOfWeek(now)
        };
      
      case 'lastWeek':
        const lastWeek = now.clone().subtract(1, 'week');
        return {
          start: this.getStartOfWeek(lastWeek),
          end: this.getEndOfWeek(lastWeek)
        };
      
      case 'thisMonth':
        return {
          start: this.getStartOfMonth(now),
          end: this.getEndOfMonth(now)
        };
      
      case 'lastMonth':
        const lastMonth = now.clone().subtract(1, 'month');
        return {
          start: this.getStartOfMonth(lastMonth),
          end: this.getEndOfMonth(lastMonth)
        };
      
      case 'thisYear':
        return {
          start: now.clone().startOf('year').toDate(),
          end: now.clone().endOf('year').toDate()
        };
      
      case 'lastYear':
        const lastYear = now.clone().subtract(1, 'year');
        return {
          start: lastYear.clone().startOf('year').toDate(),
          end: lastYear.clone().endOf('year').toDate()
        };
      
      default:
        throw new Error(`Invalid period: ${period}`);
    }
  }

  /**
   * Get custom date range
   * @param {Date|String|moment} startDate - Start date
   * @param {Date|String|moment} endDate - End date
   * @returns {Object} Date range with start and end dates
   */
  getCustomDateRange(startDate, endDate) {
    return {
      start: this.getStartOfDay(startDate),
      end: this.getEndOfDay(endDate)
    };
  }

  /**
   * Check if date is within range
   * @param {Date|String|moment} date - Date to check
   * @param {Date|String|moment} startDate - Start date
   * @param {Date|String|moment} endDate - End date
   * @returns {Boolean} True if date is within range
   */
  isDateInRange(date, startDate, endDate) {
    const checkDate = moment(date);
    return checkDate.isBetween(moment(startDate), moment(endDate), null, '[]');
  }

  /**
   * Get relative time string
   * @param {Date|String|moment} date - Date
   * @returns {String} Relative time string
   */
  getRelativeTime(date) {
    return moment(date).fromNow();
  }

  /**
   * Get time difference in minutes
   * @param {Date|String|moment} startDate - Start date
   * @param {Date|String|moment} endDate - End date
   * @returns {Number} Difference in minutes
   */
  getTimeDifferenceInMinutes(startDate, endDate) {
    return moment(endDate).diff(moment(startDate), 'minutes');
  }

  /**
   * Get time difference in hours
   * @param {Date|String|moment} startDate - Start date
   * @param {Date|String|moment} endDate - End date
   * @returns {Number} Difference in hours
   */
  getTimeDifferenceInHours(startDate, endDate) {
    return moment(endDate).diff(moment(startDate), 'hours');
  }

  /**
   * Get time difference in days
   * @param {Date|String|moment} startDate - Start date
   * @param {Date|String|moment} endDate - End date
   * @returns {Number} Difference in days
   */
  getTimeDifferenceInDays(startDate, endDate) {
    return moment(endDate).diff(moment(startDate), 'days');
  }

  /**
   * Add time to date
   * @param {Date|String|moment} date - Base date
   * @param {Number} amount - Amount to add
   * @param {String} unit - Unit (minutes, hours, days, weeks, months, years)
   * @returns {Date} New date
   */
  addTime(date, amount, unit) {
    return moment(date).add(amount, unit).toDate();
  }

  /**
   * Subtract time from date
   * @param {Date|String|moment} date - Base date
   * @param {Number} amount - Amount to subtract
   * @param {String} unit - Unit (minutes, hours, days, weeks, months, years)
   * @returns {Date} New date
   */
  subtractTime(date, amount, unit) {
    return moment(date).subtract(amount, unit).toDate();
  }

  /**
   * Get business days between two dates
   * @param {Date|String|moment} startDate - Start date
   * @param {Date|String|moment} endDate - End date
   * @returns {Number} Number of business days
   */
  getBusinessDays(startDate, endDate) {
    const start = moment(startDate);
    const end = moment(endDate);
    let count = 0;
    
    while (start.isSameOrBefore(end)) {
      if (start.day() !== 0 && start.day() !== 6) { // Not Sunday (0) or Saturday (6)
        count++;
      }
      start.add(1, 'day');
    }
    
    return count;
  }

  /**
   * Check if date is weekend
   * @param {Date|String|moment} date - Date to check
   * @returns {Boolean} True if weekend
   */
  isWeekend(date) {
    const day = moment(date).day();
    return day === 0 || day === 6; // Sunday or Saturday
  }

  /**
   * Check if date is weekday
   * @param {Date|String|moment} date - Date to check
   * @returns {Boolean} True if weekday
   */
  isWeekday(date) {
    return !this.isWeekend(date);
  }

  /**
   * Get next business day
   * @param {Date|String|moment} date - Base date
   * @returns {Date} Next business day
   */
  getNextBusinessDay(date) {
    let nextDay = moment(date).add(1, 'day');
    while (this.isWeekend(nextDay)) {
      nextDay.add(1, 'day');
    }
    return nextDay.toDate();
  }

  /**
   * Get previous business day
   * @param {Date|String|moment} date - Base date
   * @returns {Date} Previous business day
   */
  getPreviousBusinessDay(date) {
    let prevDay = moment(date).subtract(1, 'day');
    while (this.isWeekend(prevDay)) {
      prevDay.subtract(1, 'day');
    }
    return prevDay.toDate();
  }

  /**
   * Get academic year from date
   * @param {Date|String|moment} date - Date
   * @returns {String} Academic year (e.g., "2023-24")
   */
  getAcademicYear(date) {
    const year = moment(date).year();
    const month = moment(date).month();
    
    // Academic year starts in August (month 7)
    if (month >= 7) {
      return `${year}-${(year + 1).toString().slice(-2)}`;
    } else {
      return `${year - 1}-${year.toString().slice(-2)}`;
    }
  }

  /**
   * Get semester from date
   * @param {Date|String|moment} date - Date
   * @returns {String} Semester (Fall, Spring, Summer)
   */
  getSemester(date) {
    const month = moment(date).month();
    
    if (month >= 7 && month <= 11) {
      return 'Fall';
    } else if (month >= 0 && month <= 4) {
      return 'Spring';
    } else {
      return 'Summer';
    }
  }

  /**
   * Parse date string with multiple formats
   * @param {String} dateString - Date string
   * @param {Array} formats - Array of formats to try
   * @returns {Date} Parsed date
   */
  parseDate(dateString, formats = [
    'YYYY-MM-DD',
    'MM/DD/YYYY',
    'DD/MM/YYYY',
    'MM-DD-YYYY',
    'DD-MM-YYYY',
    'YYYY/MM/DD'
  ]) {
    const parsed = moment(dateString, formats, true);
    
    if (!parsed.isValid()) {
      throw new Error(`Unable to parse date: ${dateString}`);
    }
    
    return parsed.toDate();
  }

  /**
   * Get timezone offset in minutes
   * @param {Date|String|moment} date - Date
   * @returns {Number} Timezone offset in minutes
   */
  getTimezoneOffset(date) {
    return moment(date).utcOffset();
  }

  /**
   * Convert to UTC
   * @param {Date|String|moment} date - Date
   * @returns {Date} UTC date
   */
  toUTC(date) {
    return moment(date).utc().toDate();
  }

  /**
   * Convert from UTC
   * @param {Date|String|moment} date - UTC date
   * @param {String} timezone - Target timezone
   * @returns {Date} Local date
   */
  fromUTC(date, timezone = 'local') {
    return moment(date).tz(timezone).toDate();
  }
}

module.exports = new DateUtils();
