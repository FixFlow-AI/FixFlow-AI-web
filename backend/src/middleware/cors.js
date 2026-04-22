const cors = require('cors');
const { env } = require('../config/env');

const allowedOrigins = [
  'http://localhost:5173',
  'https://main.d22glq95zibf1w.amplifyapp.com',
  'https://testing.d22glq95zibf1w.amplifyapp.com',
  env.FRONTEND_URL,
].filter(Boolean);

const uniqueAllowedOrigins = [...new Set(allowedOrigins)];

const corsOptions = {
  origin(origin, callback) {
    // Allow server-to-server requests and the known frontend origins.
    if (!origin || uniqueAllowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  maxAge: 86400,
};

module.exports = { corsMiddleware: cors(corsOptions) };
