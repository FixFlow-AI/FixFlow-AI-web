const cors = require('cors');
const { env } = require('../config/env');

const allowedOrigins = [
  'http://localhost:3001',
  'http://127.0.0.1:3001',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'https://main.d22glq95zibf1w.amplifyapp.com',
  'https://testing.d22glq95zibf1w.amplifyapp.com',
  env.FRONTEND_URL,
].filter(Boolean);

function normalizeOrigin(origin) {
  try {
    return new URL(origin).origin;
  } catch {
    return origin;
  }
}

function isLoopbackOrigin(origin) {
  try {
    const parsed = new URL(origin);
    const isHttp = parsed.protocol === 'http:' || parsed.protocol === 'https:';
    const isLoopbackHost = ['localhost', '127.0.0.1', '[::1]'].includes(parsed.hostname);
    return isHttp && isLoopbackHost;
  } catch {
    return false;
  }
}

const uniqueAllowedOrigins = new Set(allowedOrigins.map((origin) => normalizeOrigin(origin)));

const corsOptions = {
  origin(origin, callback) {
    // Allow server-to-server requests and the known frontend origins.
    if (!origin) {
      return callback(null, true);
    }

    const normalizedOrigin = normalizeOrigin(origin);
    if (uniqueAllowedOrigins.has(normalizedOrigin)) {
      return callback(null, true);
    }

    // In local development, allow loopback origins (localhost/127.0.0.1) on any port.
    if (env.NODE_ENV === 'development' && isLoopbackOrigin(normalizedOrigin)) {
      return callback(null, true);
    }

    return callback(new Error(`Not allowed by CORS: ${origin}`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  maxAge: 86400,
};

module.exports = { corsMiddleware: cors(corsOptions) };
