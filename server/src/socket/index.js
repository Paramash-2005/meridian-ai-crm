const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const { createRedisClient, EVENTS_CHANNEL } = require('../config/redis');

function initSocket(httpServer) {
  const io = new Server(httpServer, {
    cors: {
      origin: (process.env.CLIENT_ORIGIN || 'http://localhost:5173')
        .split(',')
        .map((o) => o.trim().replace(/\/$/, '')),
    },
  });

  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      socket.user = jwt.verify(token, process.env.JWT_SECRET);
      next();
    } catch {
      next(new Error('Unauthorized'));
    }
  });

  io.on('connection', (socket) => {
    socket.join(`user:${socket.user.sub}`);
    if (socket.user.role === 'admin') socket.join('role:admin');
  });

  const subscriber = createRedisClient();
  subscriber.subscribe(EVENTS_CHANNEL);
  subscriber.on('message', (_channel, raw) => {
    try {
      const { event, payload, rooms } = JSON.parse(raw);
      if (!rooms || rooms.length === 0) {
        io.emit(event, payload);
      } else {
        rooms.forEach((room) => io.to(room).emit(event, payload));
      }
    } catch (err) {
      console.error('Failed to relay socket event:', err.message);
    }
  });

  return io;
}

module.exports = { initSocket };
