const express = require('express');
const User = require('../models/User');
const { authMiddleware } = require('../middleware/auth');
const { authProfileUpdateSchema } = require('../models/schemas');
const { buildAuthProfile } = require('../services/auth/profileService');
const { normalizeNotificationPreferences } = require('../services/notifications/notificationPreferences');
const { UnauthorizedError } = require('../utils/errors');

const router = express.Router();

router.get('/me', authMiddleware, async (req, res, next) => {
  try {
    const user = await User.findById(req.user.userId);
    if (!user) {
      throw new UnauthorizedError('User not found');
    }

    res.json(await buildAuthProfile(user));
  } catch (error) {
    next(error);
  }
});

router.patch('/me', authMiddleware, async (req, res, next) => {
  try {
    const payload = authProfileUpdateSchema.parse(req.body);
    const user = await User.findById(req.user.userId);
    if (!user) {
      throw new UnauthorizedError('User not found');
    }

    if (payload.name) user.name = payload.name;
    if (typeof payload.avatar === 'string') user.avatar = payload.avatar;
    if (typeof payload.timezone === 'string') user.timezone = payload.timezone;
    if (typeof payload.theme === 'string') user.theme = payload.theme;
    if (payload.notificationPreferences) {
      user.notificationPreferences = normalizeNotificationPreferences(payload.notificationPreferences);
    }

    await user.save();
    res.json(await buildAuthProfile(user));
  } catch (error) {
    next(error);
  }
});

module.exports = router;
