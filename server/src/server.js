require('dotenv').config();
const http = require('http');
const { connectDB } = require('./config/db');
const { initSocket } = require('./socket');
const ai = require('./services/ai');
const app = require('./app');

async function main() {
  await connectDB();

  // Single-process mode for hosts without background workers (e.g. Render free tier).
  // Locally and in docker-compose the worker runs as its own process instead.
  if (process.env.EMBED_WORKER === 'true') require('./worker');

  const httpServer = http.createServer(app);
  initSocket(httpServer);

  const port = process.env.PORT || 4000;
  const shutdown = (signal) => {
    console.log(`${signal} received, shutting down`);
    httpServer.close(() => process.exit(0));
    setTimeout(() => process.exit(1), 10000).unref();
  };
  ['SIGTERM', 'SIGINT'].forEach((sig) => process.on(sig, () => shutdown(sig)));

  httpServer.listen(port, () => {
    console.log(`Meridian CRM API listening on http://localhost:${port} (AI mode: ${ai.isLive() ? 'live OpenAI' : 'mock'})`);
  });
}

main().catch((err) => {
  console.error('Server failed to start:', err);
  process.exit(1);
});
