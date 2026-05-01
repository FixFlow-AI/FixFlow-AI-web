require('dotenv').config();

const express = require('express');
const helmet = require('helmet');
const { env } = require('./config/env');
const { connectDB } = require('./db/mongoose');
const { corsMiddleware } = require('./middleware/cors');
const { apiLimiter } = require('./middleware/rateLimit');
const { errorHandler } = require('./middleware/errorHandler');
const authRoutes = require('./routes/auth');
const briefScoreRoutes = require('./routes/briefScore');
const generateRoutes = require('./routes/generate');
const proposalRoutes = require('./routes/proposals');
const proposalChatRoutes = require('./routes/proposalChat');
const portalRoutes = require('./routes/portals');
const publicPortalRoutes = require('./routes/publicPortal');
const analyticsRoutes = require('./routes/analytics');
const etaRoutes = require('./routes/eta');
const agencyBrainRoutes = require('./routes/agencyBrain');
const workspaceRoutes = require('./routes/workspaces');
const proposalCommentsRoutes = require('./routes/proposalComments');
const proposalPresenceRoutes = require('./routes/proposalPresence');
const tripRoutes = require('./routes/trips');
const proposalPlanningRoutes = require('./routes/proposalPlanning');
const notificationRoutes = require('./routes/notifications');
const freelancerRoutes = require('./routes/freelancer');

const app = express();

// Security headers
app.use(helmet());

// CORS
app.use(corsMiddleware);

// Body parsing
app.use(express.json({ limit: '10mb' }));

// Global rate limit
app.use('/api', apiLimiter);

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/brief', briefScoreRoutes);
app.use('/api/generate', generateRoutes);
app.use('/api/proposals', proposalRoutes);
app.use('/api/proposals', portalRoutes);
app.use('/api/proposals', proposalCommentsRoutes);
app.use('/api/proposals', proposalPresenceRoutes);
app.use('/api/proposals', proposalPlanningRoutes);
app.use('/api/proposal', proposalChatRoutes);
app.use('/api/portal', publicPortalRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/eta', etaRoutes);
app.use('/api/agency-brain', agencyBrainRoutes);
app.use('/api/workspaces', workspaceRoutes);
app.use('/api/trips', tripRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/freelancer', freelancerRoutes);

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
