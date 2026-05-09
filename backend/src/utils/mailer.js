const {
  isEmailConfigured,
  sendMail,
  sendOtpEmail,
} = require('../services/email/emailService');

function isSmtpConfigured() {
  return isEmailConfigured();
}

async function sendPasswordResetOtp({ to, otp }) {
  return sendOtpEmail(to, otp);
}

async function sendTransactionalMail({ to, subject, text, html, from }) {
  return sendMail({ to, subject, text, html, from });
}

module.exports = {
  isSmtpConfigured,
  sendPasswordResetOtp,
  sendTransactionalMail,
};
