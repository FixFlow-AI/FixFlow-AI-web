const test = require('node:test');
const assert = require('node:assert/strict');

process.env.MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/fixflowai-test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-12345';
process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'test-refresh-secret-12345';
process.env.FRONTEND_URL = process.env.FRONTEND_URL || 'https://main.d22glq95zibf1w.amplifyapp.com';

const { buildFrontendUrl, isAllowedFrontendOrigin, normalizeOrigin } = require('../utils/frontendOrigin');

test('isAllowedFrontendOrigin accepts hosted and local frontend origins', () => {
  assert.equal(isAllowedFrontendOrigin('https://testing.d22glq95zibf1w.amplifyapp.com'), true);
  assert.equal(isAllowedFrontendOrigin('http://localhost:3001', { allowLoopback: true }), true);
  assert.equal(isAllowedFrontendOrigin('https://example.com'), false);
});

test('buildFrontendUrl uses the configured frontend base URL by default', () => {
  const url = buildFrontendUrl('/login', { mode: 'team' });

  assert.equal(url, 'https://main.d22glq95zibf1w.amplifyapp.com/login?mode=team');
});

test('normalizeOrigin strips paths from allowed origins', () => {
  assert.equal(
    normalizeOrigin('https://testing.d22glq95zibf1w.amplifyapp.com/login?mode=team'),
    'https://testing.d22glq95zibf1w.amplifyapp.com'
  );
});
