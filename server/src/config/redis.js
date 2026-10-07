const IORedis = require('ioredis');

const REDIS_URL = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
const EVENTS_CHANNEL = 'crm:events';

function createRedisClient(options = {}) {
  return new IORedis(REDIS_URL, { maxRetriesPerRequest: null, ...options });
}

module.exports = { createRedisClient, REDIS_URL, EVENTS_CHANNEL };
