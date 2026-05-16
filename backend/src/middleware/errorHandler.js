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

  // Unexpected errors
  console.error('Unhandled error:', err);
  const message = env.NODE_ENV === 'production' ? 'Internal server error' : err.message;
  return res.status(500).json({ error: message });
}

module.exports = { errorHandler };
