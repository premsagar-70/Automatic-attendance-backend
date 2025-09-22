const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/smart-attendance', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
    
    // Handle connection events
    mongoose.connection.on('error', (err) => {
      console.error('❌ MongoDB connection error:', err);
    });

    mongoose.connection.on('disconnected', () => {
      console.log('⚠️ MongoDB disconnected');
    });

    // Graceful shutdown handlers: close mongoose connection but don't force exit here.
    // Let the main process decide how to exit so we avoid double-exit races.
    process.on('SIGINT', async () => {
      console.log('SIGINT received - closing MongoDB connection...');
      try {
        await mongoose.connection.close();
        console.log('🔌 MongoDB connection closed through SIGINT');
      } catch (err) {
        console.error('Error while closing MongoDB connection on SIGINT:', err);
      }
      // do not call process.exit here; leave termination to the caller
    });

    process.on('SIGTERM', async () => {
      console.log('SIGTERM received - closing MongoDB connection...');
      try {
        await mongoose.connection.close();
        console.log('🔌 MongoDB connection closed through SIGTERM');
      } catch (err) {
        console.error('Error while closing MongoDB connection on SIGTERM:', err);
      }
      // do not call process.exit here; leave termination to the caller
    });

  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    process.exit(1);
  }
};

module.exports = connectDB;
