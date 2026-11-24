const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const validateEnv = require('./config/env.js').validateEnv;
const { createRateLimitMiddleware } = require('./middleware/rate-limit.middleware.js');
const { createErrorMiddleware } = require('./middleware/error.middleware.js');
const { createNotFoundMiddleware } = require('./middleware/not-found.middleware.js');

function createApp() {
  const configured = validateEnv();
  const app = express();

  app.use(helmet());
  app.use(cors({
    origin: [new URL(configured.CLIENT_URL).origin],
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true
  }));
  app.use(express.json({ limit: '100kb' }));
  app.use('/api/v1', createRateLimitMiddleware({windowMs: configured.RATE_LIMIT_WINDOW_MS, max: configured.RATE_LIMIT_MAX}));

  // Health endpoint (implement immediately)
  app.get('/api/v1/health', (req, res) => {
    res.status(200).json({
      success: true,
      message: 'Campus Stay API is available.',
      data: {
        name: 'CampusStay API',
        version: '1.0.0',
        environment: process.env.NODE_ENV || 'development',
        database: require('./config/database.js').isConnected,
        timestamp: new Date().toISOString()
      }
    });
  });

  app.use('/api/v1', createNotFoundMiddleware());
  app.use(createErrorMiddleware({production: configured.NODE_ENV === 'production'}));

  return app;
}

module.exports = { createApp };
