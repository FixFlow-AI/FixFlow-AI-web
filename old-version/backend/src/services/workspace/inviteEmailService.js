const { env } = require('../../config/env');
const { isEmailConfigured, sendInviteEmail } = require('../email/emailService');

async function sendWorkspaceInviteEmail({ to, inviterName, workspaceName, role, rawToken }) {
  const joinUrl = new URL(`/join/${rawToken}`, env.FRONTEND_URL).toString();

  if (!isEmailConfigured()) {
    return {
      skipped: true,
      reason: 'SMTP_NOT_CONFIGURED',
      joinUrl,
    };
  }

  try {
    const result = await sendInviteEmail(to, workspaceName, joinUrl, {
      inviterName,
      role,
    });

    return {
      skipped: Boolean(result.skipped),
      reason: result.reason || '',
      joinUrl,
    };
  } catch (error) {
    console.error('Workspace invite email failed:', error);
    return {
      skipped: true,
      reason: 'SMTP_SEND_FAILED',
      joinUrl,
    };
  }
}

module.exports = {
  sendWorkspaceInviteEmail,
};
