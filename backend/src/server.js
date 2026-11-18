const { createApp } = require('./app.js');
const dbModule = require('./config/database.js');
const logger = require('./utils/logger.js').createLogger;

async function main() {
  try {
    const app = createApp();
    const server = app.listen(process.env.PORT || 5000, () => {
      logger.info('Campus Stay API server started on port ' + (process.env.PORT || 5000));
    });
    process.on('SIGTERM', () => {
      server.close(() => {
        dbModule.disconnectDatabase();
        logger.info('Graceful shutdown complete.');
        process.exit(0);
      });
    });
    process.on('SIGINT', () => {
      server.close(() => {
        dbModule.disconnectDatabase();
        process.exit(0);
      });
    });
  } catch (err) {
    logger.error('Startup error:', err.message);
    process.exit(1);
  }
}

main();
