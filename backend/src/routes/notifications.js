const express = require('express');
const { authMiddleware } = require('../middleware/auth');
const {
  listNotificationsForUser,
  markNotificationRead,
  markAllNotificationsRead,
} = require('../services/notifications/notificationService');

const router = express.Router();

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

module.exports = router;
