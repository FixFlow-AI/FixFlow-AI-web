const path = require('path');
const {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { env } = require('../../config/env');
const { BadRequestError, ForbiddenError } = require('../../utils/errors');

const ALLOWED_UPLOADS = new Map([
  ['application/pdf', 'pdf'],
  ['application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'docx'],
  ['text/plain', 'txt'],
]);

const s3 = new S3Client({ region: env.AWS_REGION });

function isStorageObjectMissingError(error) {
  return ['NoSuchKey', 'NotFound'].includes(error?.Code || error?.name);
}

function isStorageBucketMissingError(error) {
  return ['NoSuchBucket', 'PermanentRedirect'].includes(error?.Code || error?.name);
}

function isRecoverableStorageError(error) {
  return isStorageObjectMissingError(error) || isStorageBucketMissingError(error);
}

function normalizeExtension(fileName) {
  return path.extname(fileName || '').replace('.', '').toLowerCase();
}

function getUploadExtension(fileType, fileName) {
  const mapped = ALLOWED_UPLOADS.get(fileType);
  const extension = normalizeExtension(fileName);

  if (mapped && extension && mapped !== extension) {
    return mapped;
  }

  if (mapped) {
    return mapped;
  }

  if (['pdf', 'docx', 'txt'].includes(extension)) {
    return extension;
  }

  throw new BadRequestError('Unsupported file type. Upload a PDF, DOCX, or TXT file.');
}

function getMimeTypeFromKey(fileKey) {
  const extension = normalizeExtension(fileKey);

  if (extension === 'pdf') {
    return 'application/pdf';
  }

  if (extension === 'docx') {
    return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  }

  if (extension === 'txt') {
    return 'text/plain';
  }

  throw new BadRequestError('Unsupported uploaded file type.');
}

function makeProposalKey(userId, proposalId, version) {
  return `output/${userId}/${proposalId}/v${version}.json`;
}

function assertOwnedBriefKey(userId, fileKey) {
  if (!fileKey.startsWith(`briefs/${userId}/`)) {
    throw new ForbiddenError('You do not have access to this uploaded file.');
  }
}

async function generateUploadUrl(userId, fileType, fileName) {
  const extension = getUploadExtension(fileType, fileName);
  const fileKey = `briefs/${userId}/${Date.now()}.${extension}`;

  const uploadUrl = await getSignedUrl(
    s3,
    new PutObjectCommand({
      Bucket: env.S3_BUCKET,
      Key: fileKey,
      ContentType: fileType,
    }),
    { expiresIn: 300 }
  );

  return { uploadUrl, fileKey };
}

async function getFile(fileKey) {
  const response = await s3.send(
    new GetObjectCommand({
      Bucket: env.S3_BUCKET,
      Key: fileKey,
    })
  );

  return Buffer.from(await response.Body.transformToByteArray());
}

async function uploadProposalJSON(userId, proposalId, version, data) {
  const s3Key = makeProposalKey(userId, proposalId, version);

  try {
    await s3.send(
      new PutObjectCommand({
        Bucket: env.S3_BUCKET,
        Key: s3Key,
        Body: JSON.stringify(data, null, 2),
        ContentType: 'application/json',
      })
    );
  } catch (error) {
    if (!isRecoverableStorageError(error)) {
      throw error;
    }

    if (env.NODE_ENV !== 'production') {
      console.warn(
        `S3 upload skipped for ${s3Key}: ${error.Code || error.name || error.message}. ` +
          'Proposal JSON will be served from MongoDB fallback storage.'
      );
    }
  }

  return s3Key;
}

async function getProposalJSON(s3Key) {
  const response = await s3.send(
    new GetObjectCommand({
      Bucket: env.S3_BUCKET,
      Key: s3Key,
    })
  );

  const rawText = await response.Body.transformToString();
  return JSON.parse(rawText);
}

async function deleteObject(s3Key) {
  await s3.send(
    new DeleteObjectCommand({
      Bucket: env.S3_BUCKET,
      Key: s3Key,
    })
  );
}

async function deleteProposalVersions(userId, proposalId, versionCount) {
  const deletions = [];

  for (let version = 1; version <= versionCount; version += 1) {
    deletions.push(deleteObject(makeProposalKey(userId, proposalId, version)));
  }

  await Promise.allSettled(deletions);
}

module.exports = {
  ALLOWED_UPLOADS,
  assertOwnedBriefKey,
  deleteObject,
  deleteProposalVersions,
  generateUploadUrl,
  getFile,
  getMimeTypeFromKey,
  getProposalJSON,
  isRecoverableStorageError,
  makeProposalKey,
  uploadProposalJSON,
};
