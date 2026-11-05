const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const mongoSanitize = require('express-mongo-sanitize');
const rateLimit = require('express-rate-limit');

const authRoutes = require('./routes/auth.routes');
const productRoutes = require('./routes/product.routes');
const clientRoutes = require('./routes/client.routes');
const saleRoutes = require('./routes/sale.routes');
const debtRoutes = require('./routes/debt.routes');
const paymentRoutes = require('./routes/payment.routes');
const categoryRoutes = require('./routes/category.routes');
const configRoutes = require('./routes/config.routes');
const dashboardRoutes = require('./routes/dashboard.routes');
const inventoryRoutes = require('./routes/inventory.routes');
const pendingSaleRoutes = require('./routes/pendingSale.routes');

const { errorHandler, notFoundHandler } = require('./middlewares/errorHandler');
const mongoose = require('mongoose');

const app = express();

// Security headers
app.use(helmet());

// NoSQL injection prevention
app.use(mongoSanitize());

// CORS configuration (supports frontend dev server and production Render domain)
const allowedOrigins = process.env.FRONTEND_URL
  ? process.env.FRONTEND_URL.split(',').map((o) => o.trim())
  : ['http://localhost:5173', 'http://localhost:5174', 'http://localhost:3000', 'http://localhost:3001'];

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (mobile apps, curl, server-to-server health checks)
      if (!origin) return callback(null, true);
      // In development allow any origin
      if (process.env.NODE_ENV !== 'production') return callback(null, true);
      // Check if origin is explicitly allowed or matches wildcard
      if (allowedOrigins.includes(origin) || allowedOrigins.includes('*')) {
        return callback(null, true);
      }
      // Allow any onrender.com origin
      if (origin.endsWith('.onrender.com')) {
        return callback(null, true);
      }
      return callback(new Error(`CORS no permitido para el origen: ${origin}`));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
  })
);

// General rate limiter
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  message: {
    success: false,
    message: 'Demasiadas solicitudes desde esta IP, por favor intenta en unos minutos',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Stricter rate limiter for auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50,
  message: {
    success: false,
    message: 'Demasiados intentos de autenticación, por favor intenta más tarde',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api/', generalLimiter);
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);

// Body parsers
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true, limit: '20mb' }));

// Logging in development
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

// Health check endpoints (root and /api/health for Render / monitoring)
const healthHandler = (req, res) => {
  const dbStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
  res.json({
    success: true,
    message: 'API Trueno Inventario operativa',
    status: 'online',
    database: dbStatus,
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
  });
};

app.get('/health', healthHandler);
app.get('/api/health', healthHandler);

// API Routes (mounted both with /api and root fallback for resilience)
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/clients', clientRoutes);
app.use('/api/sales', saleRoutes);
app.use('/api/debts', debtRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/config', configRoutes);
app.use('/api/settings', configRoutes); // Alias for frontend SettingsService
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/pending-sales', pendingSaleRoutes);

// Fallback mounts directly on root in case frontend VITE_API_URL is configured without '/api'
app.use('/auth', authRoutes);
app.use('/products', productRoutes);
app.use('/clients', clientRoutes);
app.use('/sales', saleRoutes);
app.use('/debts', debtRoutes);
app.use('/payments', paymentRoutes);
app.use('/categories', categoryRoutes);
app.use('/config', configRoutes);
app.use('/settings', configRoutes);
app.use('/dashboard', dashboardRoutes);
app.use('/inventory', inventoryRoutes);
app.use('/pending-sales', pendingSaleRoutes);

// Error handlers
app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
