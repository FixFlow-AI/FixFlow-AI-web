const { parsePDF, sanitizeText } = require('./pdf');
const { parseDOCX } = require('./docx');

const SUPPORTED_TYPES = {
  'application/pdf': parsePDF,
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': parseDOCX,
  'text/plain': async (buffer) => sanitizeText(buffer.toString('utf-8')),
};

async function parseFile(buffer, mimeType) {
  const parser = SUPPORTED_TYPES[mimeType];

  if (!parser) {
    throw new Error(`Unsupported file type: ${mimeType}`);
  }

  return parser(buffer);
}

module.exports = { parseFile, SUPPORTED_TYPES };
