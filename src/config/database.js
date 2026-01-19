const mongoose = require('mongoose');

const mongooseConfig = {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverSelectionTimeoutMS: 5000
};

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(
      process.env.MONGODB_URI || 'mongodb://localhost:27017/acc_db',
      mongooseConfig
    );
    console.log(`✓ MongoDB 연결됨: ${conn.connection.host}`);
    return conn;
  } catch (error) {
    console.error('✗ MongoDB 연결 실패:', error.message);
    process.exit(1);
  }
};

module.exports = {
  connectDB,
  mongooseConfig
};
