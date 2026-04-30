const nodemailer = require('nodemailer');
const { env } = require('../config/env');

let transporter;

function isSmtpConfigured() {
  return Boolean(env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASS && env.SMTP_FROM);
}

function getTransporter() {
  if (!isSmtpConfigured()) {
    throw new Error('SMTP is not fully configured');
  }

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

async function sendPasswordResetOtp({ to, otp }) {
  await sendTransactionalMail({
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

async function sendTransactionalMail({ to, subject, text, html, from = env.SMTP_FROM }) {
  const client = getTransporter();

  await client.sendMail({
    from,
    to,
    subject,
    text,
    html,
  });
}

module.exports = {
  isSmtpConfigured,
  sendPasswordResetOtp,
  sendTransactionalMail,
};
