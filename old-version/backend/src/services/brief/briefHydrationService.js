const s3Service = require('../storage/s3');
const { parseFile } = require('../fileParser');
const { BadRequestError } = require('../../utils/errors');

function inferInputType({ briefText, fileKey }) {
  if (fileKey?.endsWith('.pdf')) return 'pdf';
  if (fileKey?.endsWith('.docx')) return 'docx';
  if (fileKey?.endsWith('.txt')) return 'txt';
  return briefText ? 'text' : 'text';
}

async function hydrateBriefText(userId, briefText, fileKey) {
  if (fileKey) {
    s3Service.assertOwnedBriefKey(userId, fileKey);
    const fileBuffer = await s3Service.getFile(fileKey);
    const mimeType = s3Service.getMimeTypeFromKey(fileKey);
    return parseFile(fileBuffer, mimeType);
  }

  return String(briefText || '').trim();
}

function assertSufficientBriefLength(briefText, minLength = 50) {
  const normalized = String(briefText || '').trim();

  if (normalized.length < minLength) {
    throw new BadRequestError(`Brief is too short. Provide at least ${minLength} characters.`);
  }

  return normalized;
}

module.exports = {
  inferInputType,
  hydrateBriefText,
  assertSufficientBriefLength,
};
