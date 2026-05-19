const test = require('node:test');
const assert = require('node:assert/strict');

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-at-least-16';
process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'test-refresh-secret-at-least-16';

const { maskSensitive } = require('../services/audit/auditService');
const { createCsrfToken, verifyCsrfToken } = require('../services/auth/sessionService');
const { assertFileSignature } = require('../services/fileParser');
const { parseCookies, serializeCookie } = require('../utils/cookies');
const { assertAllowedUrl } = require('../utils/safeFetch');

test('audit masking redacts secrets, tokens, OTPs, and card-like values', () => {
  const masked = maskSensitive({
    password: 'Password123!',
    nested: {
      accessToken: 'jwt',
      note: 'card 4242 4242 4242 4242',
    },
    ok: 'visible',
  });

  assert.equal(masked.password, '[REDACTED]');
  assert.equal(masked.nested.accessToken, '[REDACTED]');
  assert.equal(masked.nested.note, 'card [REDACTED_CARD]');
  assert.equal(masked.ok, 'visible');
});

test('csrf tokens verify and tampered tokens fail', () => {
  const token = createCsrfToken('session-1');
  assert.equal(verifyCsrfToken(token), true);
  assert.equal(verifyCsrfToken(`${token}tampered`), false);
});

test('refresh cookie serialization uses secure server-side attributes', () => {
  const cookie = serializeCookie('ff_refresh', 'opaque', {
    httpOnly: true,
    secure: true,
    sameSite: 'Lax',
    path: '/api/auth',
    maxAge: 3600,
  });

  assert.match(cookie, /HttpOnly/);
  assert.match(cookie, /Secure/);
  assert.match(cookie, /SameSite=Lax/);
  assert.equal(parseCookies(cookie).ff_refresh, 'opaque');
});

test('file signature checks reject mismatched PDF and DOCX payloads', () => {
  assert.doesNotThrow(() => assertFileSignature(Buffer.from('%PDF-1.7'), 'application/pdf'));
  assert.doesNotThrow(() =>
    assertFileSignature(Buffer.from('504b0304', 'hex'), 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')
  );
  assert.throws(() => assertFileSignature(Buffer.from('not a pdf'), 'application/pdf'));
  assert.throws(() =>
    assertFileSignature(Buffer.from('not docx'), 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')
  );
});

test('safe fetch allowlist rejects untrusted outbound hosts', () => {
  assert.doesNotThrow(() => assertAllowedUrl('https://api.github.com/user'));
  assert.throws(() => assertAllowedUrl('https://metadata.google.internal/latest'));
});
