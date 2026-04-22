const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { authMiddleware } = require('../middleware/auth');
const {
  proposalGenerateSchema,
  uploadUrlSchema,
} = require('../models/schemas');
const Proposal = require('../models/Proposal');
const { parseFile } = require('../services/fileParser');
const { buildPrompt } = require('../services/llm/promptBuilder');
const { streamProposal } = require('../services/llm/client');
const { validateAndRepair } = require('../services/llm/jsonValidator');
const s3Service = require('../services/storage/s3');
const { BadRequestError, NotFoundError } = require('../utils/errors');

const router = express.Router();

function inferInputType({ briefText, fileKey }) {
  if (fileKey?.endsWith('.pdf')) return 'pdf';
  if (fileKey?.endsWith('.docx')) return 'docx';
  if (fileKey?.endsWith('.txt')) return 'txt';
  return briefText ? 'text' : 'text';
}

function buildTitle(projectSummary) {
  const firstSentence = String(projectSummary || '')
    .replace(/\s+/g, ' ')
    .split('.')
    .find(Boolean);

  return (firstSentence || 'Generated proposal').slice(0, 100);
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

router.post('/', authMiddleware, async (req, res, next) => {
  let proposalRecord = null;

  try {
    const payload = proposalGenerateSchema.parse(req.body);
    const inputType = inferInputType(payload);
    const hydratedText = await hydrateBriefText(req.user.userId, payload.briefText, payload.fileKey);

    if (!hydratedText || hydratedText.trim().length < 50) {
      throw new BadRequestError('Brief is too short. Provide at least 50 characters.');
    }

    let proposalId = payload.proposalId || uuidv4();
    let nextVersion = 1;

    if (payload.proposalId) {
      proposalRecord = await Proposal.findOne({
        proposalId: payload.proposalId,
        userId: req.user.userId,
      });

      if (!proposalRecord) {
        throw new NotFoundError('Proposal not found');
      }

      nextVersion = proposalRecord.versionCount + 1;
    } else {
      proposalRecord = new Proposal({
        userId: req.user.userId,
        proposalId,
        title: 'Generating proposal...',
        projectSummary: 'Proposal generation in progress.',
        status: 'generating',
        versionCount: 1,
        inputType,
        sourceFileKey: payload.fileKey || '',
      });
      await proposalRecord.save();
    }

    proposalId = proposalRecord.proposalId;

    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    res.flushHeaders?.();

    const keepAlive = setInterval(() => res.write(': keepalive\n\n'), 20000);
    const startTime = Date.now();

    const sendEvent = (type, payloadData = {}) => {
      res.write(`data: ${JSON.stringify({ type, ...payloadData })}\n\n`);
    };

    sendEvent('started', { proposalId, version: nextVersion });

    try {
      if (payload.proposalId) {
        proposalRecord.status = 'generating';
        proposalRecord.generationError = '';
        proposalRecord.inputType = inputType;
        proposalRecord.sourceFileKey = payload.fileKey || proposalRecord.sourceFileKey || '';
        await proposalRecord.save();
      }

      const { system, user } = buildPrompt(hydratedText);
      let fullBuffer = '';

      for await (const chunk of streamProposal(system, user)) {
        fullBuffer += chunk;
        sendEvent('chunk', { content: chunk });
      }

      const validatedProposal = await validateAndRepair(fullBuffer);
      const s3Key = await s3Service.uploadProposalJSON(
        req.user.userId,
        proposalId,
        nextVersion,
        validatedProposal
      );

      proposalRecord.set({
        s3Key,
        title: buildTitle(validatedProposal.project_summary),
        projectSummary: validatedProposal.project_summary,
        status: 'complete',
        versionCount: nextVersion,
        inputType,
        generationTimeMs: Date.now() - startTime,
        generationError: '',
        sourceFileKey: payload.fileKey || proposalRecord.sourceFileKey || '',
      });
      await proposalRecord.save();

      console.log(
        JSON.stringify({
          event: 'GENERATION_COMPLETE',
          proposalId,
          userId: req.user.userId,
          duration: Date.now() - startTime,
          version: nextVersion,
        })
      );

      sendEvent('complete', { proposalId, version: nextVersion });
    } catch (error) {
      proposalRecord.set({
        status: 'failed',
        generationError: error.message,
      });
      await proposalRecord.save();

      console.log(
        JSON.stringify({
          event: 'LLM_ERROR',
          proposalId,
          userId: req.user.userId,
          error: error.message,
        })
      );

      sendEvent('error', { message: error.message });
    } finally {
      clearInterval(keepAlive);
      res.end();
    }
  } catch (error) {
    next(error);
  }
});

router.post('/upload-url', authMiddleware, async (req, res, next) => {
  try {
    const { fileName, fileType } = uploadUrlSchema.parse(req.body);
    const upload = await s3Service.generateUploadUrl(req.user.userId, fileType, fileName);
    res.json(upload);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
