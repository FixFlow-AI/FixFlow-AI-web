const cors = require('cors');
const { env } = require('../config/env');

const corsOptions = {
  origin(origin, callback) {
    // Allow server-to-server requests (no origin).
    if (!origin) return callback(null, true);

    // Allow the configured frontend URL.
    const allowed = new Set([env.FRONTEND_URL]);
    if (allowed.has(origin)) return callback(null, true);

    // In dev, allow any localhost/127.0.0.1 origin.
    if (env.NODE_ENV === 'development' && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
      return callback(null, true);
    }

    return callback(new Error(`Not allowed by CORS: ${origin}`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type'],
  maxAge: 86400,
};

module.exports = { corsMiddleware: cors(corsOptions) };
