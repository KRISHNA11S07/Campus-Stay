const mongoose = require(mongoose);
const logger = require(../utils/logger.js).create();

let isConnected = false;

function connectDatabase(config) {
  if (!config || !config.mongoUri) {
    isConnected = false;
    return { connected: false, status: disconnected, message: MONGODB_URI not configured };
  }
  if (isConnected) {
    return { connected: true, status: connected, mongo: config.mongoUri };
  }
  mongoose.set(strictQuery, true);
  const conn = mongoose.connect(config.mongoUri, {
    serverSelectionTimeoutMS: 10000,
    bufferMaxEntries: 0,
    maxPoolSize: 25,
    minPoolSize: 5
  });
  conn.then(function (c) {
    isConnected = true;
    logger.info(MongoDB connection established.);
    return c;
  }).catch(function (err) {
    isConnected = false;
    logger.error(MongoDB connection failed:. { config: config.mongoUri });
  });
  return { connected: null, status: connecting, message: Connecting to MongoDB... };
}

function disconnectDatabase() {
  if (!isConnected) return { status: disconnected };
  return mongoose.disconnect().then(function () {
    isConnected = false;
    return { connected: false, status: disconnected, message: Disconnected from MongoDB.;
}

module.exports = { connectDatabase, disconnectDatabase, isConnected };
