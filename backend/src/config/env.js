const { z } = require('zod');
const createLogger = require('../utils/logger.js').createLogger;

const logger = createLogger();

const schema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(5000),
  CLIENT_URL: z.string().url().default('http://localhost:5500'),
  RATE_LIMIT_MAX: z.coerce.number().default(100),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().default(900000),
  MONGODB_URI: z.string().min(1).optional(),
  JWT_ACCESS_SECRET: z.string().min(32).optional(),
  JWT_REFRESH_SECRET: z.string().min(32).optional(),
  CLOUDINARY_CLOUD_NAME: z.string().optional(),
  CLOUDINARY_API_KEY: z.string().optional(),
  CLOUDINARY_API_SECRET: z.string().optional()
});

function validateEnv() {
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    logger.error('Environment validation failed:', JSON.stringify(parsed.error.issues));
    throw new Error(`Invalid environment configuration: ${parsed.error.issues[0].message}`);
  }
  return parsed.data;
}

module.exports = { schema, validateEnv };
