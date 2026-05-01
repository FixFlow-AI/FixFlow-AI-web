const crypto = require('crypto');
const { env } = require('../../config/env');

function getSecret() {
  const secret = env.INTEGRATION_SECRET || (env.NODE_ENV === 'production' ? '' : env.JWT_SECRET);
  if (!secret || secret.length < 16) {
    throw new Error('INTEGRATION_SECRET must be configured for integration secrets.');
  }
  return crypto.createHash('sha256').update(secret).digest();
}

function encryptSecret(value) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', getSecret(), iv);
  const encrypted = Buffer.concat([cipher.update(String(value), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv, tag, encrypted].map((part) => part.toString('base64url')).join('.');
}

function decryptSecret(payload) {
  const [ivRaw, tagRaw, encryptedRaw] = String(payload || '').split('.');
  if (!ivRaw || !tagRaw || !encryptedRaw) {
    throw new Error('Invalid encrypted secret payload.');
  }

  const decipher = crypto.createDecipheriv('aes-256-gcm', getSecret(), Buffer.from(ivRaw, 'base64url'));
  decipher.setAuthTag(Buffer.from(tagRaw, 'base64url'));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encryptedRaw, 'base64url')),
    decipher.final(),
  ]);
  return decrypted.toString('utf8');
}

function signState(payload) {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto.createHmac('sha256', getSecret()).update(body).digest('base64url');
  return `${body}.${signature}`;
}

function verifyState(state) {
  const [body, signature] = String(state || '').split('.');
  if (!body || !signature) {
    throw new Error('Invalid integration state.');
  }

  const expected = crypto.createHmac('sha256', getSecret()).update(body).digest('base64url');
  const left = Buffer.from(signature);
  const right = Buffer.from(expected);
  if (left.length !== right.length || !crypto.timingSafeEqual(left, right)) {
    throw new Error('Invalid integration state signature.');
  }

  return JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
}

module.exports = {
  encryptSecret,
  decryptSecret,
  signState,
  verifyState,
};
