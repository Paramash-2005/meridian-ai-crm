const Queue = require('bull');
const { REDIS_URL } = require('../config/redis');

const aiQueue = new Queue('ai-scoring', REDIS_URL, {
  defaultJobOptions: {
    attempts: 2,
    backoff: { type: 'exponential', delay: 2000 },
    removeOnComplete: 100,
    removeOnFail: 50,
  },
});

module.exports = { aiQueue };
