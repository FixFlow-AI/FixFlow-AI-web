const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { authMiddleware } = require('../middleware/auth');
const {
  proposalGenerateSchema,
  uploadUrlSchema,
} = require('../models/schemas');
const Proposal = require('../models/Proposal');
const User = require('../models/User');
const { buildPrompt } = require('../services/llm/promptBuilder');
const { streamProposal } = require('../services/llm/client');
const { validateAndRepair } = require('../services/llm/jsonValidator');
const {
  inferInputType,
  hydrateBriefText,
  assertSufficientBriefLength,
} = require('../services/brief/briefHydrationService');
const s3Service = require('../services/storage/s3');
const { buildBriefSignals, buildBriefSnapshot } = require('../services/agencyBrain/briefSignalService');
const { getPersonalCapabilities, getWorkspaceCapabilities, assertCapability } = require('../services/capabilities/capabilityService');
const { assertWorkspacePermission } = require('../services/workspace/workspaceService');
const { upsertTripProposal } = require('../services/trips/tripService');
const { refreshAgencyPatternsForProposal } = require('../services/agencyBrain/agencyBrainService');
const { assertCanCreateProposal, incrementProposalUsage } = require('../services/billing/planEnforcer');
const { evaluate: evaluateProposal } = require('../services/eval/proposalEvalService');
const {
  getEditableProposal,
  upsertEmbeddedProposalVersion,
} = require('../services/proposal/proposalAccess');
const { ensureDeliveryPlan } = require('../services/proposal/deliveryPlanService');
const { BadRequestError, NotFoundError } = require('../utils/errors');

const router = express.Router();

function buildTitle(projectSummary) {
  const firstSentence = String(projectSummary || '')
    .replace(/\s+/g, ' ')
    .split('.')
    .find(Boolean);

  return (firstSentence || 'Generated proposal').slice(0, 100);
}

router.post('/', authMiddleware, async (req, res, next) => {
  let proposalRecord = null;

  try {
    const payload = proposalGenerateSchema.parse(req.body);
    const currentUser = await User.findById(req.user.userId);
    if (!currentUser) {
      throw new NotFoundError('User not found');
    }
    const isNewProposal = !req.body?.proposalId;
    if (isNewProposal) {
      await assertCanCreateProposal(currentUser);
    }

    let workspaceContext = null;
    if (payload.workspaceId) {
      workspaceContext = await assertWorkspacePermission(
        req.user.userId,
        payload.workspaceId,
        payload.proposalId ? 'proposals.edit' : 'proposals.create'
      );
    }

    if (payload.calibrationContext) {
      const capabilities = workspaceContext
        ? getWorkspaceCapabilities(workspaceContext.workspace.plan)
        : getPersonalCapabilities(currentUser.plan);
      assertCapability(
        capabilities.agencyBrain,
        'Your current plan does not include Agency Brain calibration.'
      );
    }

    if (payload.strategy !== 'standard') {
      const capabilities = workspaceContext
        ? getWorkspaceCapabilities(workspaceContext.workspace.plan)
        : getPersonalCapabilities(currentUser.plan);
      assertCapability(
        capabilities.triProposal,
        'Your current plan does not include TriProposal strategy generation.'
      );
    }

    const inputType = inferInputType(payload);
    const hydratedText = assertSufficientBriefLength(
      await hydrateBriefText(req.user.userId, payload.briefText, payload.fileKey)
    );
    const briefSnapshot = buildBriefSnapshot(hydratedText);
    const briefSignals = buildBriefSignals(hydratedText);

    let proposalId = payload.proposalId || uuidv4();
    let nextVersion = 1;

    if (payload.proposalId) {
      proposalRecord = await getEditableProposal(req.user.userId, payload.proposalId);

      nextVersion = proposalRecord.versionCount + 1;
    } else {
      proposalRecord = new Proposal({
        userId: req.user.userId,
        createdBy: req.user.userId,
        proposalId,
        title: 'Generating proposal...',
        projectSummary: 'Proposal generation in progress.',
        status: 'generating',
        versionCount: 1,
        inputType,
        sourceFileKey: payload.fileKey || '',
        briefScore: payload.briefScore || null,
        briefSnapshot,
        briefSignals,
        strategy: payload.strategy,
        tripId: payload.tripId || '',
        workspaceId: workspaceContext?.workspace?._id || null,
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
        proposalRecord.briefScore = payload.briefScore || proposalRecord.briefScore || null;
        proposalRecord.briefSnapshot = briefSnapshot || proposalRecord.briefSnapshot || '';
        proposalRecord.briefSignals = briefSignals || proposalRecord.briefSignals || null;
        proposalRecord.strategy = payload.strategy || proposalRecord.strategy || 'standard';
        proposalRecord.tripId = payload.tripId || proposalRecord.tripId || '';
        proposalRecord.workspaceId = workspaceContext?.workspace?._id || proposalRecord.workspaceId || null;
        await proposalRecord.save();
      }

      const { system, user } = buildPrompt(hydratedText, {
        calibrationContext: payload.calibrationContext,
        strategy: payload.strategy,
      });
      let fullBuffer = '';

      for await (const chunk of streamProposal(system, user, { userId: req.user.userId, requestId: proposalId })) {
        fullBuffer += chunk;
        sendEvent('chunk', { content: chunk });
      }

      const validatedProposal = ensureDeliveryPlan(await validateAndRepair(fullBuffer));
      const s3Key = await s3Service.uploadProposalJSON(
        req.user.userId,
        proposalId,
        nextVersion,
        validatedProposal
      );

      upsertEmbeddedProposalVersion(proposalRecord, nextVersion, validatedProposal, s3Key);

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
        briefScore: payload.briefScore || proposalRecord.briefScore || null,
        briefSnapshot,
        briefSignals,
        strategy: payload.strategy,
        tripId: payload.tripId || proposalRecord.tripId || '',
        workspaceId: workspaceContext?.workspace?._id || proposalRecord.workspaceId || null,
      });
      await proposalRecord.save();
      await upsertTripProposal({
        tripId: payload.tripId,
        userId: req.user.userId,
        workspaceId: workspaceContext?.workspace?._id || null,
        proposalId,
        strategy: payload.strategy,
        status: 'complete',
        title: proposalRecord.title,
      });
      await refreshAgencyPatternsForProposal(proposalRecord).catch(() => null);
      setImmediate(() => {
        evaluateProposal(proposalRecord).catch((evalError) => {
          console.error('Proposal evaluation failed:', evalError);
        });
      });
      if (isNewProposal) {
        await incrementProposalUsage(currentUser).catch(() => null);
      }

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
      let friendlyMessage = error.message;
      try {
        const match = error.message.match(/\{.*\}/s);
        if (match) {
          const parsed = JSON.parse(match[0]);
          friendlyMessage = parsed.error?.message || parsed.message || friendlyMessage;
        }
      } catch (e) {
        // Ignore parse errors and keep original
      }

      proposalRecord.set({
        status: 'failed',
        generationError: friendlyMessage,
      });
      await proposalRecord.save();
      await upsertTripProposal({
        tripId: payload.tripId,
        userId: req.user.userId,
        workspaceId: workspaceContext?.workspace?._id || null,
        proposalId,
        strategy: payload.strategy,
        status: 'failed',
        title: proposalRecord.title,
      });

      console.log(
        JSON.stringify({
          event: 'LLM_ERROR',
          proposalId,
          userId: req.user.userId,
          error: friendlyMessage,
        })
      );

      sendEvent('error', { message: friendlyMessage });
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
