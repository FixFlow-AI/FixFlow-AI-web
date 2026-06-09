require('dotenv').config();

const express = require('express');
const helmet = require('helmet');
const { env } = require('./config/env');
const { connectDB } = require('./db/dynamodb');
const { corsMiddleware } = require('./middleware/cors');
const { apiLimiter } = require('./middleware/rateLimit');
const { errorHandler } = require('./middleware/errorHandler');
const waitlistRoutes = require('./routes/waitlist');
const contactRoutes = require('./routes/contact');

const app = express();

// Security headers
app.use(helmet());

// CORS
app.use(corsMiddleware);

// Body parsing
app.use(express.json({ limit: '1mb' }));

// Global rate limit
app.use('/api', apiLimiter);

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Routes
app.use('/api/waitlist', waitlistRoutes);
app.use('/api/contact', contactRoutes);

// 404 handler
app.use((_req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Global error handler
app.use(errorHandler);

async function start() {
  await connectDB();
  app.listen(env.PORT, () => {
    console.log(`🚀 Server running on port ${env.PORT} [${env.NODE_ENV}]`);
  });
}

start();

module.exports = app;
