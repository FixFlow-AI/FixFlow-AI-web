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

function errorHandler(err, req, res, _next) {
  res.locals.errorMessage = err?.message || 'Unhandled error';
  const requestId = res.getHeader('X-Request-Id') || req.id || 'N/A';
  const ipAddress = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress;

  const logData = {
    timestamp: new Date().toISOString(),
    requestId,
    method: req.method,
    url: req.originalUrl,
    ipAddress,
  };

  // CORS origin rejections
  if (typeof err?.message === 'string' && err.message.startsWith('Not allowed by CORS')) {
    console.warn(JSON.stringify({
      level: 'WARN',
      event: 'CORS_REJECTION',
      message: err.message,
      ...logData,
    }, null, 2));
    return sendError(res, 403, 'Not allowed by CORS');
  }

  // Zod validation errors
  if (err.name === 'ZodError') {
    const messages = err.issues.map((issue) => ({
      field: issue.path.join('.'),
      message: issue.message,
    }));
    console.warn(JSON.stringify({
      level: 'WARN',
      event: 'VALIDATION_FAILED',
      message: 'Zod validation failed',
      errors: messages,
      ...logData,
    }, null, 2));
    return sendError(res, 400, 'Validation failed', { details: messages });
  }

  // Mongoose duplicate key
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue || {})[0] || 'Field';
    console.warn(JSON.stringify({
      level: 'WARN',
      event: 'DUPLICATE_KEY_ERROR',
      message: `${field} already exists`,
      ...logData,
    }, null, 2));
    return sendError(res, 409, `${field} already exists`);
  }

  // Mongoose validation
  if (err.name === 'ValidationError') {
    const messages = Object.values(err.errors || {}).map((e) => ({
      field: e.path,
      message: e.message,
    }));
    console.warn(JSON.stringify({
      level: 'WARN',
      event: 'VALIDATION_FAILED',
      message: 'Mongoose validation failed',
      errors: messages,
      ...logData,
    }, null, 2));
    return sendError(res, 400, 'Validation failed', { details: messages });
  }

  // Known operational errors
  if (err instanceof AppError) {
    console.warn(JSON.stringify({
      level: 'WARN',
      event: 'OPERATIONAL_ERROR',
      statusCode: err.statusCode,
      message: err.message,
      ...logData,
    }, null, 2));
    return sendError(res, err.statusCode, err.message);
  }

  // Unexpected errors
  console.error(JSON.stringify({
    level: 'ERROR',
    event: 'UNHANDLED_ERROR',
    message: err.message || 'Unhandled error',
    stack: err.stack,
    ...logData,
  }, null, 2));

  const message = env.NODE_ENV === 'production' ? 'Internal server error' : err.message;
  return sendError(res, 500, message);
}

module.exports = { errorHandler };

