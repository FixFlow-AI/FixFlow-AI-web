const helmet = require('helmet');
const { env } = require('../config/env');
const { getAllowedFrontendOrigins } = require('../utils/frontendOrigin');

function securityHeadersMiddleware() {
  const connectSrc = [
    "'self'",
    ...getAllowedFrontendOrigins(),
    'https://api.github.com',
    'https://github.com',
    'https://accounts.google.com',
    'https://oauth2.googleapis.com',
    'https://www.googleapis.com',
    'https://api.stripe.com',
    'https://*.stripe.com',
  ];

  return helmet({
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'blob:', 'https:'],
        fontSrc: ["'self'", 'data:'],
        connectSrc,
        frameSrc: ["'self'", 'https://*.stripe.com'],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
        frameAncestors: ["'none'"],
        upgradeInsecureRequests: env.NODE_ENV === 'production' ? [] : null,
      },
    },
    crossOriginEmbedderPolicy: false,
    crossOriginOpenerPolicy: { policy: 'same-origin' },
    crossOriginResourcePolicy: { policy: 'same-site' },
    hsts: env.NODE_ENV === 'production'
      ? { maxAge: 15552000, includeSubDomains: true, preload: false }
      : false,
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    xFrameOptions: { action: 'deny' },
  });
}

module.exports = { securityHeadersMiddleware };
