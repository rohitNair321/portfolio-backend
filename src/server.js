// server.js - Enhanced with comprehensive architecture
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { xss } = require('express-xss-sanitizer');
const cookieParser = require('cookie-parser');
const swaggerUi = require('swagger-ui-express');
const path = require('path');

// Import configurations
const logger = require('./config/logger');
const swaggerDocs = require('./config/swagger');
const { testConnection } = require('./config/database');
const { HTTP_STATUS } = require('./config/constants');

// Import middleware
const requestLogger = require('./middleware/requestLogger');
const { apiLimiter } = require('./middleware/rateLimiter');
const {
  errorConverter,
  errorHandler,
  notFound,
} = require('./middleware/errorHandler');

// Import routes
const apiV1Routes = require('./api/v1');

// Legacy routes (for backward compatibility)
const oldAuthRoutes = require('./routes/authRoutes');
const oldProfileRoutes = require('./routes/profileRoutes');
const oldContactRoutes = require('./routes/contactRoutes');
const oldChatRoutes = require('./routes/chatRoutes');

const app = express();
const PORT = process.env.PORT || 3000;

// ============================================
// SECURITY MIDDLEWARE
// ============================================
app.use(helmet()); // Set security headers
app.set('trust proxy', 1); // Trust first proxy (for Render, etc.)

// ============================================
// CORS CONFIGURATION
// ============================================
const allowedOrigins = [
  'http://localhost:4200',
  'http://localhost:3000',
  'https://rohitnair321.github.io',
  'https://rohit-nair296.onrender.com',
  'https://portfolio-backend-bpmw.onrender.com',
  'https://www.mintpixel.in',
];

const corsOptions = {
  origin: function (origin, callback) {
    // Allow server-to-server, Postman, curl (no origin)
    if (!origin) return callback(null, true);

    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    logger.warn('CORS blocked request from origin:', origin);
    return callback(new Error('Not allowed by CORS'));
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
};

app.use(cors(corsOptions));

// ============================================
// BODY PARSING & SANITIZATION
// ============================================
app.use(express.json({ limit: '10kb' })); // Limit body size to prevent DoS
app.use(express.urlencoded({ extended: true, limit: '10kb' }));
app.use(cookieParser());
app.use(xss()); // Sanitize input to prevent XSS attacks

// ============================================
// LOGGING
// ============================================
if (process.env.NODE_ENV !== 'test') {
  app.use(requestLogger); // Log all requests
}

// ============================================
// API DOCUMENTATION (Swagger)
// ============================================
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocs, {
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: 'Portfolio API Documentation',
}));

logger.info('📚 API Documentation available at /api-docs');

// ============================================
// HEALTH CHECK ENDPOINTS
// ============================================
app.get('/health', (req, res) => {
  res.status(HTTP_STATUS.OK).json({
    success: true,
    statusCode: HTTP_STATUS.OK,
    message: 'Server is running',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

app.get('/api/health/db', async (req, res) => {
  try {
    const isConnected = await testConnection();

    if (!isConnected) {
      return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        statusCode: HTTP_STATUS.INTERNAL_SERVER_ERROR,
        message: 'Database connection failed',
        timestamp: new Date().toISOString(),
      });
    }

    res.status(HTTP_STATUS.OK).json({
      success: true,
      statusCode: HTTP_STATUS.OK,
      message: 'Database connected',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Database health check failed:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      statusCode: HTTP_STATUS.INTERNAL_SERVER_ERROR,
      message: 'Database health check failed',
      timestamp: new Date().toISOString(),
    });
  }
});

// ============================================
// API ROUTES - VERSION 1 (New Architecture)
// ============================================
app.use('/api/v1', apiLimiter, apiV1Routes);

// ============================================
// LEGACY ROUTES (Backward Compatibility)
// ============================================
// Keep old routes working for existing frontend
app.use('/api/auth', oldAuthRoutes);
app.use('/api/profile', oldProfileRoutes);
app.use('/api/contact', oldContactRoutes);
app.use('/api/ai', oldChatRoutes);
app.use('/api/chat', oldChatRoutes);

logger.info('🔄 Legacy routes mounted for backward compatibility');

// ============================================
// ERROR HANDLING
// ============================================
// 404 - Not Found (must be after all routes)
app.use(notFound);

// Error converter
app.use(errorConverter);

// Global error handler
app.use(errorHandler);

// ============================================
// GRACEFUL SHUTDOWN
// ============================================
process.on('SIGTERM', () => {
  logger.info('SIGTERM signal received: closing HTTP server');
  server.close(() => {
    logger.info('HTTP server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  logger.info('SIGINT signal received: closing HTTP server');
  server.close(() => {
    logger.info('HTTP server closed');
    process.exit(0);
  });
});

// ============================================
// START SERVER
// ============================================
const server = app.listen(PORT, '0.0.0.0', async () => {
  logger.info('='.repeat(50));
  logger.info(`✅ Server started successfully`);
  logger.info(`🚀 Environment: ${process.env.NODE_ENV || 'development'}`);
  logger.info(`📍 Port: ${PORT}`);
  logger.info(`🌐 Host: 0.0.0.0`);
  logger.info(`📚 API Docs: http://localhost:${PORT}/api-docs`);
  logger.info(`🏥 Health Check: http://localhost:${PORT}/health`);
  logger.info(`🔧 API v1: http://localhost:${PORT}/api/v1`);
  logger.info('='.repeat(50));

  // Test database connection on startup
  await testConnection();
});

// Handle unhandled rejections
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  // Close server & exit process
  server.close(() => process.exit(1));
});

module.exports = app;
