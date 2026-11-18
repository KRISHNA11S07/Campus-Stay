const logger = require('../utils/logger.js').createLogger;

function createErrorMiddleware(options) {
  return function errorMiddleware(err, req, res, next) {
    const status = err.status || 500;
    const message = err.message || 'An unexpected error occurred';
    if (status >= 500) {
      logger.error('Internal error:', err.message);
    } else {
      logger.warn('Client error:', status, message);
    }
    res.status(status).json({
      success: false,
      message: options && options.production ? 'An internal error occurred' : message
    });
  };
}

module.exports = { createErrorMiddleware };
