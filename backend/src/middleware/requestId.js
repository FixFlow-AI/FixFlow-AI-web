const crypto = require('crypto');

function requestIdMiddleware(req, res, next) {
  const incoming = req.headers['x-request-id'];
  const requestId = typeof incoming === 'string' && incoming.trim()
    ? incoming.trim().slice(0, 128)
    : crypto.randomUUID();

  req.id = requestId;
  res.setHeader('X-Request-Id', requestId);
  next();
}

module.exports = { requestIdMiddleware };
