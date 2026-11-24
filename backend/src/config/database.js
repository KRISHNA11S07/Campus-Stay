const mongoose = require('mongoose');

async function connectDatabase(config = {}) {
  const uri = config.MONGODB_URI || config.mongoUri;
  if (!uri) return { connected: false, status: 'disconnected' };
  try {
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000, maxPoolSize: 25 });
    return { connected: true, status: 'connected' };
  } catch {
    throw new Error('MongoDB connection failed.');
  }
}

async function disconnectDatabase() {
  await mongoose.disconnect();
  return { connected: false, status: 'disconnected' };
}

module.exports = {
  connectDatabase, disconnectDatabase,
  get isConnected() { return mongoose.connection.readyState === 1; }
};
