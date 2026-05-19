const cors = require('cors');
const { env } = require('../config/env');
const { getAllowedFrontendOrigins, isLoopbackOrigin, normalizeOrigin } = require('../utils/frontendOrigin');

const corsOptions = {
  origin(origin, callback) {
    // Allow server-to-server requests and the known frontend origins.
    if (!origin) {
      return callback(null, true);
    }

    const normalizedOrigin = normalizeOrigin(origin);
    if (getAllowedFrontendOrigins().has(normalizedOrigin)) {
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
  allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token', 'X-Request-Id'],
  exposedHeaders: ['Content-Disposition', 'X-Request-Id'],
  maxAge: 86400,
};

module.exports = { corsMiddleware: cors(corsOptions) };
