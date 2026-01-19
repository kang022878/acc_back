// 에러 핸들러 미들웨어
const errorHandler = (err, req, res, next) => {
  const status = err.status || 500;
  const message = err.message || 'Internal Server Error';
  
  console.error(`[${new Date().toISOString()}] Error:`, {
    status,
    message,
    url: req.originalUrl,
    method: req.method
  });

  res.status(status).json({
    error: {
      status,
      message,
      ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    }
  });
};

module.exports = errorHandler;
