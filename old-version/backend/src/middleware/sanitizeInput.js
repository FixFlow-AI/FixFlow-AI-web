const { BadRequestError } = require('../utils/errors');

const DANGEROUS_KEYS = new Set(['__proto__', 'prototype', 'constructor']);
const SQLI_PATTERN = /(\bunion\b\s+\bselect\b|\bdrop\b\s+\btable\b|--|;\s*--|\/\*|\*\/)/i;
const XSS_PATTERN = /<\s*script\b|javascript:|onerror\s*=|onload\s*=/i;

function inspectValue(value, path = '') {
  if (Array.isArray(value)) {
    value.forEach((item, index) => inspectValue(item, `${path}[${index}]`));
    return;
  }

  if (value && typeof value === 'object') {
    Object.keys(value).forEach((key) => {
      if (DANGEROUS_KEYS.has(key) || key.startsWith('$')) {
        throw new BadRequestError('Invalid request payload');
      }
      inspectValue(value[key], path ? `${path}.${key}` : key);
    });
    return;
  }

  if (typeof value === 'string' && value.length <= 2000 && (SQLI_PATTERN.test(value) || XSS_PATTERN.test(value))) {
    throw new BadRequestError('Potentially unsafe input was rejected');
  }
}

function sanitizeInputMiddleware(req, _res, next) {
  try {
    inspectValue(req.body);
    inspectValue(req.query);
    inspectValue(req.params);
    next();
  } catch (error) {
    next(error);
  }
}

module.exports = {
  SQLI_PATTERN,
  XSS_PATTERN,
  sanitizeInputMiddleware,
};
