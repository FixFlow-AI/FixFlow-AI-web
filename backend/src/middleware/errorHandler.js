const { AppError } = require('../utils/errors');
const { env } = require('../config/env');

function sendError(res, statusCode, message, extra = {}) {
  return res.status(statusCode).json({
    success: false,
    message,
    error: message,
    requestId: res.getHeader('X-Request-Id'),
    ...extra,
  });
}

function errorHandler(err, _req, res, _next) {
  res.locals.errorMessage = err?.message || 'Unhandled error';

  // CORS origin rejections
  if (typeof err?.message === 'string' && err.message.startsWith('Not allowed by CORS')) {
    if (env.NODE_ENV !== 'production') {
      console.warn(`CORS rejection: ${err.message}`);
    }
    return sendError(res, 403, 'Not allowed by CORS');
  }

  // Zod validation errors
  if (err.name === 'ZodError') {
    const messages = err.issues.map((issue) => ({
      field: issue.path.join('.'),
      message: issue.message,
    }));
    return sendError(res, 400, 'Validation failed', { details: messages });
  }

  // Mongoose duplicate key
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue)[0];
    return sendError(res, 409, `${field} already exists`);
  }

  // Mongoose validation
  if (err.name === 'ValidationError') {
    const messages = Object.values(err.errors).map((e) => ({
      field: e.path,
      message: e.message,
    }));
    return sendError(res, 400, 'Validation failed', { details: messages });
  }

  // Known operational errors
  if (err instanceof AppError) {
    return sendError(res, err.statusCode, err.message);
  }

  // Unexpected errors
  console.error('Unhandled error:', err);
  const message = env.NODE_ENV === 'production' ? 'Internal server error' : err.message;
  return sendError(res, 500, message);
}

module.exports = { errorHandler };
