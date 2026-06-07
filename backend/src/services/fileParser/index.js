const { parsePDF, sanitizeText } = require('./pdf');
const { parseDOCX } = require('./docx');

const SUPPORTED_TYPES = {
  'application/pdf': parsePDF,
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': parseDOCX,
  'text/plain': async (buffer) => sanitizeText(buffer.toString('utf-8')),
};

function assertFileSignature(buffer, mimeType) {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
    throw new Error('Uploaded file is empty.');
  }

  if (mimeType === 'application/pdf' && buffer.slice(0, 5).toString('utf8') !== '%PDF-') {
    throw new Error('Uploaded file content does not match PDF type.');
  }

  if (
    mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' &&
    buffer.slice(0, 4).toString('hex') !== '504b0304'
  ) {
    throw new Error('Uploaded file content does not match DOCX type.');
  }

  if (mimeType === 'image/png' && buffer.slice(0, 4).toString('hex') !== '89504e47') {
    throw new Error('Uploaded file content does not match PNG type.');
  }

  if (mimeType === 'image/jpeg' && buffer.slice(0, 3).toString('hex') !== 'ffd8ff') {
    throw new Error('Uploaded file content does not match JPEG type.');
  }

  if (
    mimeType === 'image/webp' &&
    (buffer.slice(0, 4).toString('utf8') !== 'RIFF' || buffer.slice(8, 12).toString('utf8') !== 'WEBP')
  ) {
    throw new Error('Uploaded file content does not match WEBP type.');
  }
}

async function parseFile(buffer, mimeType) {
  const parser = SUPPORTED_TYPES[mimeType];

  if (!parser) {
    throw new Error(`Unsupported file type: ${mimeType}`);
  }

  assertFileSignature(buffer, mimeType);
  return parser(buffer);
}

module.exports = { assertFileSignature, parseFile, SUPPORTED_TYPES };
