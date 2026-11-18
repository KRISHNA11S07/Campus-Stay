const rateLimit = require('express-rate-limit');

function createRateLimitMiddleware(options) {
  const config = {
    windowMs: 900000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
    ...options
  };
  return rateLimit({
    windowMs: config.windowMs || 900000,
    max: config.max || 100,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message: 'Too many requests' }
  });
}

module.exports = { createRateLimitMiddleware };
