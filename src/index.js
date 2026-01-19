require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const mongoose = require('mongoose');

// Routes
const authRoutes = require('./routes/auth');
const gmailRoutes = require('./routes/gmail');
const accountRoutes = require('./routes/accounts');
const policyRoutes = require('./routes/policy-analysis');

// Middleware
const errorHandler = require('./middleware/errorHandler');
const asyncHandler = require('./middleware/asyncHandler');

const app = express();

// 보안 미들웨어
app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  credentials: true
}));

// 데이터 파싱
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// 데이터베이스 연결
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/acc_db')
  .then(() => console.log('✓ MongoDB 연결됨'))
  .catch(err => {
    console.error('✗ MongoDB 연결 실패:', err.message);
    process.exit(1);
  });

// 헬스 체크
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/gmail', gmailRoutes);
app.use('/api/accounts', accountRoutes);
app.use('/api/policy-analysis', policyRoutes);

// 404 핸들러
app.use((req, res) => {
  res.status(404).json({ 
    error: 'Not Found',
    path: req.originalUrl 
  });
});

// 에러 핸들러
app.use(errorHandler);

const PORT = process.env.PORT || 5000;
const server = app.listen(PORT, () => {
  console.log(`🚀 ACC 백엔드 서버 실행 중: http://localhost:${PORT}`);
  console.log(`환경: ${process.env.NODE_ENV || 'development'}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM 신호 받음. 서버 종료 중...');
  server.close(() => {
    console.log('서버가 종료되었습니다.');
    mongoose.connection.close();
    process.exit(0);
  });
});

module.exports = app;
