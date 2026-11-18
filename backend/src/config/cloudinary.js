const validateEnv = require('./env.js').validateEnv;
const logger = require('../utils/logger.js').createLogger;

function getConfiguredEnvironment() {
  try {
    return validateEnv();
  } catch (err) {
    return { validationError: err.message };
  }
}

function isCloudinaryConfigured() {
  const cfg = getConfiguredEnvironment();
  return Boolean(cfg.CLOUDINARY_CLOUD_NAME && cfg.CLOUDINARY_API_KEY && cfg.CLOUDINARY_API_SECRET);
}

module.exports = { getConfiguredEnvironment, isCloudinaryConfigured };
