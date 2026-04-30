const { env } = require('../../config/env');
const { isSmtpConfigured, sendTransactionalMail } = require('../../utils/mailer');

async function sendWorkspaceInviteEmail({ to, inviterName, workspaceName, role, rawToken }) {
  if (!isSmtpConfigured()) {
    return {
      skipped: true,
      reason: 'SMTP_NOT_CONFIGURED',
      joinUrl: new URL(`/join/${rawToken}`, env.FRONTEND_URL).toString(),
    };
  }

  const joinUrl = new URL(`/join/${rawToken}`, env.FRONTEND_URL).toString();

  await sendTransactionalMail({
    to,
    subject: `${inviterName} invited you to ${workspaceName} on FixFlowAI`,
    text: `${inviterName} invited you to join ${workspaceName} as a ${role}.\n\nJoin here: ${joinUrl}`,
    html: `
      <div style="font-family: Arial, sans-serif; color: #0f172a;">
        <h2 style="margin-bottom: 12px;">You're invited to FixFlowAI</h2>
        <p style="margin-bottom: 12px;"><strong>${inviterName}</strong> invited you to join <strong>${workspaceName}</strong> as a <strong>${role}</strong>.</p>
        <p style="margin-bottom: 20px;"><a href="${joinUrl}">Accept your workspace invitation</a></p>
        <p style="color: #475569;">This invitation expires in 72 hours.</p>
      </div>
    `,
  });

  return {
    skipped: false,
    joinUrl,
  };
}

module.exports = {
  sendWorkspaceInviteEmail,
};
