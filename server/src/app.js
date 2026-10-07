const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const { requireAuth } = require('./middleware/auth');
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const leadRoutes = require('./routes/leads');
const dashboardRoutes = require('./routes/dashboard');
const ai = require('./services/ai');

const app = express();

// Behind Render/Vercel/nginx the client IP arrives via X-Forwarded-For; needed for rate limiting.
app.set('trust proxy', 1);
app.use(helmet());

// CLIENT_ORIGIN may be a comma-separated list (e.g. production domain + Vercel preview URL).
const allowedOrigins = () =>
  (process.env.CLIENT_ORIGIN || '').split(',').map((o) => o.trim().replace(/\/$/, '')).filter(Boolean);

// Vite auto-increments its port (5173 -> 5174 -> ...) whenever the previous one is still
// taken, so pinning CORS to one exact dev port is fragile. Allow any localhost/127.0.0.1
// port in development; production/Docker still locks to the explicit CLIENT_ORIGIN.
const isLocalhostOrigin = (origin) => /^https?:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin);

app.use(
  cors({
    origin(origin, callback) {
      const allowed =
        !origin ||
        allowedOrigins().includes(origin) ||
        (process.env.NODE_ENV !== 'production' && isLocalhostOrigin(origin));
      if (allowed) return callback(null, true);
      callback(new Error('Not allowed by CORS'));
    },
  })
);
app.use(express.json({ limit: '100kb' }));

const limiterOptions = { standardHeaders: true, legacyHeaders: false };
app.use(
  '/api/auth/login',
  rateLimit({
    ...limiterOptions,
    windowMs: 15 * 60 * 1000,
    limit: 20,
    message: { error: 'Too many login attempts, please try again later' },
  })
);
app.use('/api', rateLimit({ ...limiterOptions, windowMs: 60 * 1000, limit: 300 }));

app.get('/api/health', (req, res) => res.json({ ok: true, aiMode: ai.isLive() ? 'live' : 'mock' }));

app.use('/api/auth', authRoutes);
app.use('/api/users', requireAuth, userRoutes);
app.use('/api/leads', requireAuth, leadRoutes);
app.use('/api/dashboard', requireAuth, dashboardRoutes);

app.use((req, res) => res.status(404).json({ error: 'Not found' }));

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

module.exports = app;
