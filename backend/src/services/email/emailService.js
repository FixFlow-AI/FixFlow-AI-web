const nodemailer = require('nodemailer');
const { env } = require('../../config/env');

let transporter;

function buildFromAddress() {
  if (env.SMTP_FROM) {
    return env.SMTP_FROM;
  }

  return `${env.EMAIL_FROM_NAME} <${env.EMAIL_FROM_ADDRESS}>`;
}

function isEmailConfigured() {
  return Boolean(env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASS && buildFromAddress());
}

function getTransporter() {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_SECURE,
      auth: {
        user: env.SMTP_USER,
        pass: env.SMTP_PASS,
      },
    });
  }

  return transporter;
}

async function sendMail({ to, subject, text, html, from = buildFromAddress() }) {
  if (!isEmailConfigured()) {
    console.warn(`Email skipped for ${to}: SMTP_NOT_CONFIGURED`);
    return { skipped: true, reason: 'SMTP_NOT_CONFIGURED' };
  }

  const result = await getTransporter().sendMail({
    from,
    to,
    subject,
    text,
    html,
  });

  return {
    skipped: false,
    messageId: result.messageId || '',
  };
}

async function sendOtpEmail(to, otp) {
  return sendMail({
    to,
    subject: 'FixFlowAI Password Reset OTP',
    text: `Your FixFlowAI OTP is ${otp}. It will expire in 10 minutes.`,
    html: `
      <div style="font-family: Arial, sans-serif; color: #0f172a;">
        <h2 style="margin-bottom: 8px;">Password Reset OTP</h2>
        <p style="margin: 0 0 16px 0;">Use the OTP below to reset your password:</p>
        <div style="font-size: 28px; letter-spacing: 8px; font-weight: 700; margin-bottom: 16px;">
          ${otp}
        </div>
        <p style="margin: 0; color: #334155;">This code expires in 10 minutes.</p>
      </div>
    `,
  });
}

async function sendOutcomeEmail(to, proposalTitle, outcome, summaryHtml) {
  return sendMail({
    to,
    subject: `FixFlowAI outcome update for ${proposalTitle}`,
    text: `${proposalTitle}\n\n${String(outcome || '').trim()}`,
    html: summaryHtml,
  });
}

async function sendInviteEmail(to, workspaceName, inviteUrl, { inviterName = 'A teammate', role = 'member' } = {}) {
  return sendMail({
    to,
    subject: `${inviterName} invited you to ${workspaceName} on FixFlowAI`,
    text: `${inviterName} invited you to join ${workspaceName} as a ${role}.\n\nJoin here: ${inviteUrl}`,
    html: `
      <div style="font-family: Arial, sans-serif; color: #0f172a;">
        <h2 style="margin-bottom: 12px;">You're invited to FixFlowAI</h2>
        <p style="margin-bottom: 12px;"><strong>${inviterName}</strong> invited you to join <strong>${workspaceName}</strong> as a <strong>${role}</strong>.</p>
        <p style="margin-bottom: 20px;"><a href="${inviteUrl}">Accept your workspace invitation</a></p>
        <p style="color: #475569;">This invitation expires in 72 hours.</p>
      </div>
    `,
  });
}

async function sendFollowUpAlert(to, proposalTitle, daysSinceLastView) {
  return sendMail({
    to,
    subject: `Follow up on ${proposalTitle}`,
    text: `${proposalTitle} was last viewed ${daysSinceLastView} days ago. Open FixFlowAI to follow up.`,
    html: `<div style="font-family: Arial, sans-serif; color: #0f172a;">${proposalTitle} was last viewed ${daysSinceLastView} days ago. Open FixFlowAI to follow up.</div>`,
  });
}

async function sendWeeklyIntelligenceDigest(to, digestData = {}) {
  return sendMail({
    to,
    subject: 'Your FixFlowAI weekly intelligence digest',
    text: digestData.text || 'Open FixFlowAI to review this week’s proposal intelligence.',
    html: digestData.html || '<div style="font-family: Arial, sans-serif; color: #0f172a;">Open FixFlowAI to review this week’s proposal intelligence.</div>',
  });
}

function __resetEmailTransportForTests() {
  transporter = null;
}

module.exports = {
  __resetEmailTransportForTests,
  buildFromAddress,
  isEmailConfigured,
  sendFollowUpAlert,
  sendInviteEmail,
  sendMail,
  sendOutcomeEmail,
  sendOtpEmail,
  sendWeeklyIntelligenceDigest,
};
