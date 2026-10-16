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
const { isOriginAllowed } = require('./config/origins');

const app = express();

// Behind Render/Vercel/nginx the client IP arrives via X-Forwarded-For; needed for rate limiting.
app.set('trust proxy', 1);
app.use(helmet());

app.use(
  cors({
    origin(origin, callback) {
      if (isOriginAllowed(origin)) return callback(null, true);
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
