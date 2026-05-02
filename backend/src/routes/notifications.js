const express = require('express');
const { authMiddleware } = require('../middleware/auth');
const { verifyAccessToken } = require('../utils/jwt');
const User = require('../models/User');
const { UnauthorizedError } = require('../utils/errors');
const { registerNotificationStream, writeSse } = require('../services/notifications/notificationStream');
const {
  listNotificationsForUser,
  markNotificationRead,
  markAllNotificationsRead,
} = require('../services/notifications/notificationService');

const router = express.Router();

async function authForSseStream(req, _res, next) {
  const header = req.headers.authorization;
  if (header && header.startsWith('Bearer ')) {
    return authMiddleware(req, _res, next);
  }

  const token = req.query?.token ? String(req.query.token) : '';
  if (!token) {
    return next(new UnauthorizedError('Missing token'));
  }

  try {
    const decoded = verifyAccessToken(token);
    const user = await User.findById(decoded.userId).lean();
    if (!user) {
      return next(new UnauthorizedError('User not found'));
    }

    req.user = {
      userId: user._id.toString(),
      email: user.email,
      name: user.name,
      avatar: user.avatar || '',
      plan: user.plan,
      teamPlanPreference: user.teamPlanPreference,
      defaultEntryMode: user.defaultEntryMode,
      currentWorkspaceId: user.currentWorkspaceId ? user.currentWorkspaceId.toString() : null,
    };
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return next(new UnauthorizedError('Token expired'));
    }
    return next(new UnauthorizedError('Invalid token'));
  }
}

router.get('/', authMiddleware, async (req, res, next) => {
  try {
    const scope = ['all', 'personal', 'workspace'].includes(req.query.scope) ? req.query.scope : 'all';
    const limit = Number.parseInt(req.query.limit, 10) || 25;
    const result = await listNotificationsForUser(req.user.userId, { scope, limit });
    res.json(result);
  } catch (error) {
    next(error);
  }
});

router.post('/:id/read', authMiddleware, async (req, res, next) => {
  try {
    const notification = await markNotificationRead({
      userId: req.user.userId,
      notificationId: req.params.id,
    });
    res.json({ notification });
  } catch (error) {
    next(error);
  }
});

router.post('/read-all', authMiddleware, async (req, res, next) => {
  try {
    await markAllNotificationsRead({ userId: req.user.userId });
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

router.get('/stream', authForSseStream, async (req, res, next) => {
  try {
    res.status(200);
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders?.();

    registerNotificationStream({ userId: req.user.userId, res });

    writeSse(res, {
      event: 'connected',
      data: { ok: true, userId: req.user.userId, ts: new Date().toISOString() },
    });

    const heartbeat = setInterval(() => {
      try {
        res.write(`: ping ${Date.now()}\n\n`);
      } catch {
        // connection cleanup is handled by close listener
      }
    }, 20_000);
    heartbeat.unref?.();

    res.on('close', () => clearInterval(heartbeat));
  } catch (error) {
    next(error);
  }
});

module.exports = router;
