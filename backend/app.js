const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const rateLimit = require('express-rate-limit');

require('express-async-errors');

const config = require('./config/config');
const logger = require('./config/logger');
const connectDB = require('./config/database');

const errorHandler = require('./middleware/errorHandler');
const notFound = require('./middleware/notFound');

const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const itemRoutes = require('./routes/items');
const orderRoutes = require('./routes/orders');
const paymentRoutes = require('./routes/payments');
const escrowRoutes = require('./routes/escrow');
const chatRoutes = require('./routes/chat');
const reviewRoutes = require('./routes/reviews');
const adminRoutes = require('./routes/admin');
const uploadRoutes = require('./routes/upload');
const notificationRoutes = require('./routes/notifications');

// Import services
const orderLifecycleService = require('./services/orderLifecycleService');
const notificationService = require('./services/notificationService');

const app = express();

connectDB();

// Start background services
orderLifecycleService.startProcessing();
notificationService.startProcessing();

app.set('trust proxy', 1);

app.use(helmet({
  crossOriginEmbedderPolicy: false,
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
}));

app.use(cors({
  origin: config.NODE_ENV === 'production' 
    ? config.CLIENT_URL 
    : ['http://localhost:3000', 'http://localhost:3001'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
}));

app.use(compression());

app.use(morgan('combined', {
  stream: {
    write: (message) => logger.http(message.trim())
  }
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

const limiter = rateLimit({
  windowMs: config.RATE_LIMIT_WINDOW_MS,
  max: config.RATE_LIMIT_MAX_REQUESTS,
  message: {
    error: 'Too many requests from this IP, please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api/', limiter);

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    environment: config.NODE_ENV,
    version: process.env.npm_package_version || '1.0.0'
  });
});

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/items', itemRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/escrow', escrowRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/notifications', notificationRoutes);

// Serve static files (for uploaded images)
app.use('/uploads', express.static('uploads'));

// 404 handler
app.use(notFound);

app.use(errorHandler);

process.on('SIGTERM', () => {
  logger.info('SIGTERM received. Shutting down gracefully...');
  
  // Stop background services
  orderLifecycleService.stopProcessing();
  notificationService.stopProcessing();
  
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT received. Shutting down gracefully...');
  
  // Stop background services
  orderLifecycleService.stopProcessing();
  notificationService.stopProcessing();
  
  process.exit(0);
});

module.exports = app;
