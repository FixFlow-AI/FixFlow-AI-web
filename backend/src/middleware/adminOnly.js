const User = require('../models/User');
const { ForbiddenError, UnauthorizedError } = require('../utils/errors');

async function adminOnlyMiddleware(req, _res, next) {
  try {
    if (!req.user?.userId) {
      throw new UnauthorizedError('Authentication required');
    }

    const user = await User.findById(req.user.userId).lean();
    if (!user?.isAdmin) {
      throw new ForbiddenError('Admin access required');
    }

    req.user.isAdmin = true;
    next();
  } catch (error) {
    next(error);
  }
}

module.exports = { adminOnlyMiddleware };
