// CLIENT_ORIGIN may be a comma-separated list (e.g. production domain + Vercel preview URL).
const allowedOrigins = () =>
  (process.env.CLIENT_ORIGIN || '').split(',').map((o) => o.trim().replace(/\/$/, '')).filter(Boolean);

// Vite auto-increments its port (5173 -> 5174 -> ...) whenever the previous one is still
// taken, so pinning CORS to one exact dev port is fragile. Allow any localhost/127.0.0.1
// port in development; production/Docker still locks to the explicit CLIENT_ORIGIN.
const isLocalhostOrigin = (origin) => /^https?:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin);

// Shared by Express CORS and Socket.io so both layers accept exactly the same origins.
function isOriginAllowed(origin) {
  return (
    !origin ||
    allowedOrigins().includes(origin) ||
    (process.env.NODE_ENV !== 'production' && isLocalhostOrigin(origin))
  );
}

module.exports = { isOriginAllowed };
