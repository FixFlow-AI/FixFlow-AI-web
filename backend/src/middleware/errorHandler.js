const { AppError } = require('../utils/errors');
const { env } = require('../config/env');

function errorHandler(err, _req, res, _next) {
  // CORS origin rejections
  if (typeof err?.message === 'string' && err.message.startsWith('Not allowed by CORS')) {
    if (env.NODE_ENV !== 'production') {
      console.warn(`CORS rejection: ${err.message}`);
    }
    return res.status(403).json({ error: 'Not allowed by CORS' });
  }

  // Zod validation errors
  if (err.name === 'ZodError') {
    const messages = err.issues.map((issue) => ({
      field: issue.path.join('.'),
      message: issue.message,
    }));
    return res.status(400).json({ error: 'Validation failed', details: messages });
  }

  // Mongoose duplicate key
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue)[0];
    return res.status(409).json({ error: `${field} already exists` });
  }

  // Mongoose validation
  if (err.name === 'ValidationError') {
    const messages = Object.values(err.errors).map((e) => ({
      field: e.path,
      message: e.message,
    }));
    return res.status(400).json({ error: 'Validation failed', details: messages });
  }

  // Known operational errors
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({ error: err.message });
  }

  // Unexpected errors
  console.error('Unhandled error:', err);
  const message = env.NODE_ENV === 'production' ? 'Internal server error' : err.message;
  return res.status(500).json({ error: message });
}

module.exports = { errorHandler };
