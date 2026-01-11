const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    if (!process.env.MONGODB_URI) {
      throw new Error('MONGODB_URI is not defined in environment variables');
    }

    const options = {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 30000, // Increased to 30s to prevent timeouts
      socketTimeoutMS: 45000,
    };

    console.log('🔄 Attempting to connect to MongoDB...');
    const conn = await mongoose.connect(process.env.MONGODB_URI, options);

    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
    console.log(`📊 Database: ${conn.connection.name}`);

    // Handle connection events
    mongoose.connection.on('error', (err) => {
      console.error('❌ MongoDB connection error:', err);
    });

    mongoose.connection.on('disconnected', () => {
      console.warn('⚠️  MongoDB disconnected. Attempting to reconnect...');
    });

    mongoose.connection.on('reconnected', () => {
      console.log('✅ MongoDB reconnected');
    });

  } catch (error) {
    console.error(`\n❌ MongoDB Connection Error: ${error.message}\n`);
    console.error('📋 Troubleshooting Steps:');
    console.error('   1. Check if MongoDB is installed and running');
    console.error('   2. For local MongoDB: Start the service or run "mongod"');
    console.error('   3. For MongoDB Atlas: Check your connection string');
    console.error('   4. Verify MONGODB_URI in server/.env file\n');
    console.error('💡 Quick Fixes:');
    console.error('   - Windows: Start MongoDB service from Services');
    console.error('   - Or use MongoDB Atlas (cloud): https://www.mongodb.com/cloud/atlas\n');
    process.exit(1);
  }
};

module.exports = connectDB;

