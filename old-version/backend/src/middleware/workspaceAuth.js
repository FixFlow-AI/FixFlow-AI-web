const { assertWorkspaceMembership } = require('../services/workspace/workspaceService');

function workspaceAuth(allowedRoles = null) {
  return async function workspaceAuthMiddleware(req, _res, next) {
    try {
      const workspaceId = req.body?.workspaceId || req.query?.workspaceId || req.params?.workspaceId;
      if (!workspaceId) {
        return next();
      }

      const result = await assertWorkspaceMembership(req.user.userId, workspaceId, allowedRoles);
      req.workspace = {
        workspaceId: result.workspace._id.toString(),
        role: result.member.role,
        summary: result.workspace,
      };
      next();
    } catch (error) {
      next(error);
    }
  };
}

module.exports = {
  workspaceAuth,
};
