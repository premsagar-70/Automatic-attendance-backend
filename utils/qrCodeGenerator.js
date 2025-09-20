const QRCode = require('qrcode');
const crypto = require('crypto');

class QRCodeGenerator {
  constructor() {
    this.defaultOptions = {
      width: 200,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      },
      errorCorrectionLevel: 'M'
    };
  }

  /**
   * Generate QR code for attendance session
   * @param {Object} sessionData - Session information
   * @param {Object} options - QR code generation options
   * @returns {Promise<Object>} QR code data and metadata
   */
  async generateSessionQR(sessionData, options = {}) {
    try {
      const qrOptions = { ...this.defaultOptions, ...options };
      
      // Create payload with session data
      const payload = {
        sessionId: sessionData._id || sessionData.sessionId,
        title: sessionData.title,
        subject: sessionData.subject,
        courseCode: sessionData.courseCode,
        startTime: sessionData.startTime,
        endTime: sessionData.endTime,
        location: sessionData.location,
        timestamp: new Date().toISOString(),
        type: 'attendance_session',
        version: '1.0'
      };

      // Generate checksum for data integrity
      const checksum = this.generateChecksum(payload);
      payload.checksum = checksum;

      // Convert payload to string
      const qrData = JSON.stringify(payload);

      // Generate QR code
      const qrCodeDataURL = await QRCode.toDataURL(qrData, qrOptions);
      
      // Generate unique code for tracking
      const uniqueCode = this.generateUniqueCode(sessionData._id);

      return {
        success: true,
        data: {
          qrCodeDataURL,
          uniqueCode,
          payload,
          expiresAt: new Date(Date.now() + (sessionData.duration || 30) * 60 * 1000), // 30 minutes default
          generatedAt: new Date()
        }
      };
    } catch (error) {
      console.error('QR Code generation error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Generate QR code for user verification
   * @param {Object} userData - User information
   * @param {Object} options - QR code generation options
   * @returns {Promise<Object>} QR code data and metadata
   */
  async generateUserQR(userData, options = {}) {
    try {
      const qrOptions = { ...this.defaultOptions, ...options };
      
      const payload = {
        userId: userData._id || userData.userId,
        studentId: userData.studentId,
        employeeId: userData.employeeId,
        name: userData.fullName || `${userData.firstName} ${userData.lastName}`,
        role: userData.role,
        timestamp: new Date().toISOString(),
        type: 'user_verification',
        version: '1.0'
      };

      const checksum = this.generateChecksum(payload);
      payload.checksum = checksum;

      const qrData = JSON.stringify(payload);
      const qrCodeDataURL = await QRCode.toDataURL(qrData, qrOptions);
      const uniqueCode = this.generateUniqueCode(userData._id);

      return {
        success: true,
        data: {
          qrCodeDataURL,
          uniqueCode,
          payload,
          generatedAt: new Date()
        }
      };
    } catch (error) {
      console.error('User QR Code generation error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Generate QR code for bulk operations
   * @param {Array} items - Array of items to generate QR codes for
   * @param {String} type - Type of QR code (session, user, etc.)
   * @param {Object} options - QR code generation options
   * @returns {Promise<Array>} Array of QR code data
   */
  async generateBulkQR(items, type = 'session', options = {}) {
    try {
      const results = [];
      
      for (const item of items) {
        let qrResult;
        
        switch (type) {
          case 'session':
            qrResult = await this.generateSessionQR(item, options);
            break;
          case 'user':
            qrResult = await this.generateUserQR(item, options);
            break;
          default:
            throw new Error(`Unsupported QR code type: ${type}`);
        }
        
        if (qrResult.success) {
          results.push({
            itemId: item._id,
            ...qrResult.data
          });
        } else {
          results.push({
            itemId: item._id,
            error: qrResult.error
          });
        }
      }

      return {
        success: true,
        data: results,
        total: items.length,
        successful: results.filter(r => !r.error).length,
        failed: results.filter(r => r.error).length
      };
    } catch (error) {
      console.error('Bulk QR Code generation error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Validate QR code data
   * @param {String} qrData - QR code data string
   * @returns {Object} Validation result
   */
  validateQRData(qrData) {
    try {
      const payload = JSON.parse(qrData);
      
      // Check required fields
      const requiredFields = ['type', 'timestamp', 'checksum'];
      const missingFields = requiredFields.filter(field => !payload[field]);
      
      if (missingFields.length > 0) {
        return {
          valid: false,
          error: `Missing required fields: ${missingFields.join(', ')}`
        };
      }

      // Validate checksum
      const { checksum, ...dataWithoutChecksum } = payload;
      const calculatedChecksum = this.generateChecksum(dataWithoutChecksum);
      
      if (checksum !== calculatedChecksum) {
        return {
          valid: false,
          error: 'Invalid checksum - data may be corrupted'
        };
      }

      // Check if QR code is expired (if applicable)
      if (payload.expiresAt) {
        const now = new Date();
        const expiresAt = new Date(payload.expiresAt);
        
        if (now > expiresAt) {
          return {
            valid: false,
            error: 'QR code has expired'
          };
        }
      }

      return {
        valid: true,
        payload
      };
    } catch (error) {
      return {
        valid: false,
        error: 'Invalid QR code format'
      };
    }
  }

  /**
   * Generate checksum for data integrity
   * @param {Object} data - Data to generate checksum for
   * @returns {String} MD5 checksum
   */
  generateChecksum(data) {
    const dataString = JSON.stringify(data, Object.keys(data).sort());
    return crypto.createHash('md5').update(dataString).digest('hex');
  }

  /**
   * Generate unique code for tracking
   * @param {String} id - Base ID for the code
   * @returns {String} Unique code
   */
  generateUniqueCode(id) {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substr(2, 9);
    return `QR_${id}_${timestamp}_${random}`.toUpperCase();
  }

  /**
   * Generate QR code with custom data
   * @param {Object} customData - Custom data to encode
   * @param {Object} options - QR code generation options
   * @returns {Promise<Object>} QR code data
   */
  async generateCustomQR(customData, options = {}) {
    try {
      const qrOptions = { ...this.defaultOptions, ...options };
      
      // Add metadata
      const payload = {
        ...customData,
        timestamp: new Date().toISOString(),
        version: '1.0'
      };

      const checksum = this.generateChecksum(payload);
      payload.checksum = checksum;

      const qrData = JSON.stringify(payload);
      const qrCodeDataURL = await QRCode.toDataURL(qrData, qrOptions);

      return {
        success: true,
        data: {
          qrCodeDataURL,
          payload,
          generatedAt: new Date()
        }
      };
    } catch (error) {
      console.error('Custom QR Code generation error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Generate QR code as buffer (for file operations)
   * @param {Object} data - Data to encode
   * @param {Object} options - QR code generation options
   * @returns {Promise<Buffer>} QR code buffer
   */
  async generateQRBuffer(data, options = {}) {
    try {
      const qrOptions = { ...this.defaultOptions, ...options };
      const qrData = JSON.stringify(data);
      
      return await QRCode.toBuffer(qrData, qrOptions);
    } catch (error) {
      console.error('QR Buffer generation error:', error);
      throw error;
    }
  }
}

module.exports = new QRCodeGenerator();
