const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const { z } = require('zod');
const validateEnv = require('./config/env.js').validateEnv;
const rateLimitMiddleware = require('./middleware/rate-limit.middleware.js');
const errorMiddleware = require('./middleware/error.middleware.js');
const notFoundMiddleware = require('./middleware/not-found.middleware.js');

function createApp() {
  const configured = validateEnv();
  const app = express();

  app.use(helmet());
  app.use(cors({
    origin: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true
  }));
  app.use(express.json({ limit: '100kb' }));
  app.use('/api/v1', rateLimitMiddleware, async (req, res, next) => {
    const config = {};
    if (configured && typeof configured === 'object' && !('validationError' in configured)) {
      config.mongoUri = configured.MONGODB_URI;
    }
    const dbStatus = await import('./config/database.js').then(m => m.isConnected || m.isConnected);
    res.json({ success: false, message: 'An unexpected initialization error occurred.' });
  });

  // Health endpoint (implement immediately)
  app.get('/api/v1/health', (req, res) => {
    res.status(200).json({
      success: true,
      message: 'Campus Stay API is available.',
      data: {
        name: 'CampusStay API',
        version: '1.0.0',
        environment: process.env.NODE_ENV || 'development',
        database: false,
        timestamp: new Date().toISOString()
      }
    });
  });

  app.use('/api/v1/*', notFoundMiddleware);
  app.use(errorMiddleware);

  return app;
}

module.exports = { createApp };
