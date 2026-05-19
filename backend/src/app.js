require('dotenv').config();

const express = require('express');
const { env } = require('./config/env');
const { cookieMiddleware } = require('./utils/cookies');
const { requestIdMiddleware } = require('./middleware/requestId');
const { securityHeadersMiddleware } = require('./middleware/securityHeaders');
const { corsMiddleware } = require('./middleware/cors');
const { originGuardMiddleware } = require('./middleware/originGuard');
const { csrfProtectionMiddleware } = require('./middleware/csrfProtection');
const { sanitizeInputMiddleware } = require('./middleware/sanitizeInput');
const { apiLimiter } = require('./middleware/rateLimit');
const { auditLoggerMiddleware } = require('./middleware/auditLogger');
const { suspiciousActivityMiddleware } = require('./middleware/suspiciousActivity');
const { errorHandler } = require('./middleware/errorHandler');
const authRoutes = require('./routes/auth');
const auditRoutes = require('./routes/audit');
const adminRoutes = require('./routes/admin');
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
const slackIntegrationRoutes = require('./routes/slackIntegration');
const escrowLifecycleRoutes = require('./routes/escrowLifecycle');
const { billingRouter, billingWebhookRouter } = require('./routes/billing');
const userRoutes = require('./routes/users');
const { publicDealRoomRouter, proposalDealRoomRouter } = require('./routes/dealRoom');
const { initRateLimitNotifier } = require('./services/rateLimit/rateLimitNotifier');

function createApp() {
  const app = express();
  initRateLimitNotifier();

  app.set('trust proxy', env.NODE_ENV === 'production' ? 1 : false);

  app.use(requestIdMiddleware);
  app.use(securityHeadersMiddleware());
  app.use(corsMiddleware);
  app.use(cookieMiddleware);
  app.use(originGuardMiddleware);

  // Stripe webhooks need the raw body before JSON parsing.
  app.use('/api/billing', billingWebhookRouter);

  app.use(express.json({ limit: env.REQUEST_BODY_LIMIT || '1mb' }));
  app.use(csrfProtectionMiddleware);
  app.use(sanitizeInputMiddleware);
  app.use(auditLoggerMiddleware);
  app.use(suspiciousActivityMiddleware);
  app.use('/api', apiLimiter);

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  app.use('/api/auth', authRoutes);
  app.use('/api/audit', auditRoutes);
  app.use('/api/admin', adminRoutes);
  app.use('/api/brief', briefScoreRoutes);
  app.use('/api/generate', generateRoutes);
  app.use('/api/proposals', proposalRoutes);
  app.use('/api/proposals', portalRoutes);
  app.use('/api/proposals', proposalCommentsRoutes);
  app.use('/api/proposals', proposalPresenceRoutes);
  app.use('/api/proposals', proposalPlanningRoutes);
  app.use('/api/proposals', proposalDealRoomRouter);
  app.use('/api/proposal', proposalChatRoutes);
  app.use('/api/portal', publicPortalRoutes);
  app.use('/api/portal', publicDealRoomRouter);
  app.use('/api/analytics', analyticsRoutes);
  app.use('/api/eta', etaRoutes);
  app.use('/api/agency-brain', agencyBrainRoutes);
  app.use('/api/workspaces', workspaceRoutes);
  app.use('/api/trips', tripRoutes);
  app.use('/api/notifications', notificationRoutes);
  app.use('/api/freelancer', freelancerRoutes);
  app.use('/api/integrations/slack', slackIntegrationRoutes);
  app.use('/api/escrows', escrowLifecycleRoutes);
  app.use('/api/billing', billingRouter);
  app.use('/api/users', userRoutes);

  app.use((_req, res) => {
    res.status(404).json({ success: false, message: 'Route not found', requestId: res.getHeader('X-Request-Id') });
  });

  app.use(errorHandler);

  return app;
}

module.exports = { createApp };
