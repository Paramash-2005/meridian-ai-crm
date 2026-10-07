const { createRedisClient, EVENTS_CHANNEL } = require('../config/redis');

const publisher = createRedisClient();

// Every real-time event goes through Redis pub/sub, even when published from the
// same process as the Socket.io server — one code path whether the publisher is
// the API process or the background worker.
function publishEvent(event, payload, rooms = null) {
  publisher.publish(EVENTS_CHANNEL, JSON.stringify({ event, payload, rooms }));
}

module.exports = { publishEvent };
