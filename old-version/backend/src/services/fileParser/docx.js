const mammoth = require('mammoth');
const { sanitizeText } = require('./pdf');

async function parseDOCX(buffer) {
  const result = await mammoth.extractRawText({ buffer });
  return sanitizeText(result.value);
}

module.exports = { parseDOCX };
