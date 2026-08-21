import 'dotenv/config';

// Boot-time check for Razorpay webhook secret (BUG-04)
const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
if (!webhookSecret) {
  if (process.env.NODE_ENV === 'production' && process.env.ALLOW_PAYMENT_SIMULATION !== 'true') {
    console.error('CRITICAL ERROR: RAZORPAY_WEBHOOK_SECRET is not configured in production. Process exiting.');
    process.exit(1);
  } else {
    console.warn('WARNING: RAZORPAY_WEBHOOK_SECRET is missing. Webhook signature checks will reject all webhook events.');
  }
}

// STORY-18: In production, live Razorpay credentials are mandatory — the app
// must never fall back to simulated payments. Fail fast at boot if missing.
// Exception: a non-payment demo can set ALLOW_PAYMENT_SIMULATION=true to run in
// production (e.g. Render seed demo) without real Razorpay keys.
if (
  process.env.NODE_ENV === 'production' &&
  process.env.ALLOW_PAYMENT_SIMULATION !== 'true'
) {
  if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
    console.error(
      'CRITICAL ERROR: RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET are required in production (simulation mode is disabled). ' +
        'Set ALLOW_PAYMENT_SIMULATION=true if this deploy intentionally runs without live payments. Process exiting.',
    );
    process.exit(1);
  }
}

import { createServer } from 'http';
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';

import { startKeepAliveService } from './services/keepAliveService.js';

import {
  parseBrief,
  evaluateProposal,
  generateInterviewQuestions,
  generateContractExtensions,
  runDiscoveryTurn,
  isAiServiceConfigured,
  AiServiceError,
} from './services/aiClient.js';
import { calculateEarningsBreakdown } from './skills/earningsCalculator.js';
import {
  calculateReputationMetrics,
  buildSBTMetadata,
} from './skills/reputationCalculator.js';
import { calculateClientScore } from './skills/clientScoring.js';
import { generateShortlist } from './services/matchingEngine.js';
import { getFreelancerRepository } from './services/freelancerRepository.js';
import { getGithubScanRepository } from './services/githubScanRepository.js';
import { getProposalRepository } from './services/proposalRepository.js';
import { authRouter } from './routes/auth.js';
import { freelancerRouter } from './routes/freelancer.js';
import { interviewRouter } from './routes/interview.js';
import { requireAuth } from './auth/middleware.js';
import { requireRole } from './auth/roles.js';
import {
  ClientMatchActionSchema,
  ClientMatchPermissionError,
  ClientMatchVersionMismatchError,
  InvalidClientMatchTransitionError,
  createClientMatchWorkflow,
  refreshClientMatchWorkflow,
  transitionClientMatch,
  verifyClientMatchAudit,
} from './services/clientMatchWorkflow.js';
import { SyncServer } from './skills/syncServer.js';
import {
  createMilestone,
  getMilestone,
  listMilestones,
  applyTransition,
  getAuditChain,
  scanAllAuditChains,
} from './services/escrowService.js';
import {
  InvalidTransitionError,
  VersionMismatchError,
  MFARequiredError,
} from './skills/escrowStateMachine.js';
import { getMilestoneRepository } from './services/milestoneRepository.js';
import {
  createRazorpayOrder,
  verifyPaymentSignature,
  verifyWebhookSignature,
  transferFundsToFreelancer,
  refundPayment,
} from './services/paymentService.js';
import { getWebhookEventRepository } from './services/webhookEventRepository.js';
import { getUserRepository } from './services/userRepository.js';
import { logEmailTransportStatus, notifyMilestoneEvent, notifyProjectInvitation, notifyInvitationResponse, notifyProposalEvaluated } from './services/emailService.js';
import { getCorsair, getCorsairError, getCorsairNodeHandler, isCorsairConfigured } from './services/corsairClient.js';
import { fireMilestoneNotifications, listAutomations, createConnectLink } from './services/fixbotAgent.js';
import { getAgentDirectory, getEvaluationMessages, recordEvaluationExchange } from './services/agentRegistry.js';
import {
  generatePlan,
  getPlan,
  listPlanRevisions,
  patchPlan,
  restoreRevision,
  approvePlan,
  reopenPlan,
  PlanNotFoundError,
  PlanValidationError,
  PlanPatchError,
  PlanConflictError,
  PlanStateError,
} from './services/proposalPlanService.js';
import { PlanRevisionConflictError } from './services/proposalPlanRepository.js';
import { randomUUID } from 'crypto';

const app = express();
const PORT = Number(process.env.PORT) || 4000;

// Trust the reverse proxy (needed for correct client IPs behind CloudFront/ALB,
// which the rate limiter keys on).
app.set('trust proxy', 1);

// STORY-19: Strict CORS. Allowed origins come from FRONTEND_ORIGINS (comma
// separated); defaults cover local dev and the production domain. Requests with
// no Origin header (server-to-server, curl, Razorpay webhooks) are allowed.
const ALLOWED_ORIGINS = (
  process.env.FRONTEND_ORIGINS ||
  'http://localhost:5173,http://localhost:3000,https://fixflowai.xyz,https://www.fixflowai.xyz'
)
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || ALLOWED_ORIGINS.includes(origin)) {
        callback(null, true);
        return;
      }
      // Disallowed origin: reflect NO CORS headers instead of throwing. Passing
      // an Error here sends it to the global error handler, which turned every
      // unlisted-origin request into a misleading HTTP 500 and filled the logs
      // with fake server errors. Omitting the header is what actually blocks the
      // browser (the browser enforces CORS, not the server), so this is a
      // cleaner rejection with identical security behaviour.
      callback(null, false);
    },
    credentials: true,
  }),
);
// JSON body parsing for all routes EXCEPT the Corsair handler path, which needs
// the raw request body for Hub delivery + signature-verified webhooks.
app.use((req: Request, res: Response, next: NextFunction) => {
  if (req.path.startsWith('/api/corsair')) return next();
  return express.json({ limit: '2mb' })(req, res, next);
});

// Corsair track: mount the integration-layer handler at /api/corsair (Hub
// delivery, management API, and signature-verified webhooks). Lazily resolved
// per request so the backend boots even when Corsair isn't installed/configured.
app.all('/api/corsair/*', (req: Request, res: Response, next: NextFunction) => {
  getCorsairNodeHandler()
    .then((handler) => {
      if (!handler) {
        res.status(503).json({ error: 'Corsair is not configured on this server.', code: 'CORSAIR_DISABLED' });
        return;
      }
      return handler(req, res);
    })
    .catch(next);
});

// STORY-16: Rate limit escrow + payment endpoints to blunt brute-force and
// abuse. 10 requests/minute per IP. The webhook route lives under /api/webhooks
// (not /api/escrow), so Razorpay retries are never throttled here.
const escrowLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Please slow down and try again in a minute.', code: 'RATE_LIMITED' },
});
app.use('/api/escrow', escrowLimiter);

// Mount authentication routes. They live at /api/auth/* and are intentionally
// public — they're the entry point that issues access tokens to the rest of
// the API. Other routes can opt in to protection with the `requireAuth`
// middleware from ./auth/middleware.
app.use('/api/auth', authRouter);

// Freelancer routes (roles/01): verified profile + GitHub scan status/stream.
app.use('/api/freelancer', freelancerRouter);

// Proctored interview-gate routes: client authors screening questions;
// freelancers take an auto-scored, proctored interview to apply.
app.use('/api/interview', interviewRouter);

/**
 * Small wrapper so async route handlers forward errors to the error middleware
 * instead of crashing the process on an unhandled rejection.
 */
const asyncRoute =
  (handler: (req: Request, res: Response) => Promise<void>) =>
  (req: Request, res: Response, next: NextFunction) => {
    handler(req, res).catch(next);
  };

/** Guards AI endpoints that require the Python AI service. Returns true if the request can proceed. */
function requireAiService(res: Response): boolean {
  if (!isAiServiceConfigured()) {
    res.status(503).json({
      error: 'AI_SERVICE_URL is not configured on the server.',
      hint: 'Set AI_SERVICE_URL in backend/.env to the Python AI service (e.g. http://localhost:8000).',
    });
    return false;
  }
  return true;
}

// ==========================================
// Health
// ==========================================

app.get('/api/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    aiEnabled: isAiServiceConfigured(),
    authEnabled:
      Boolean((process.env.JWT_SECRET || '').trim()) &&
      Boolean((process.env.GOOGLE_OAUTH_CLIENT_ID || '').trim()),
    aiServiceUrl: process.env.AI_SERVICE_URL || null,
    time: new Date().toISOString(),
  });
});

// ==========================================
// Subsystem 1: Semantic Brief Parsing
// ==========================================

app.post(
  '/api/proposals/parse',
  requireAuth,
  asyncRoute(async (req, res) => {
    if (!requireAiService(res)) return;
    const { briefText } = req.body ?? {};
    if (typeof briefText !== 'string' || !briefText.trim()) {
      res.status(400).json({ error: 'briefText is required and must be a non-empty string.' });
      return;
    }
    const result = await parseBrief(briefText);

    if (
      result.source === 'fallback' &&
      result.degradedReason === 'invalid_key'
    ) {
      res.status(503).json({
        error: 'AI temporarily unavailable',
        code: result.degradedReason,
      });
      return;
    }

    // Persist the parsed proposal under the authenticated user.
    const stored = await getProposalRepository().create({
      userId: req.auth!.sub,
      briefText,
      proposal: result.proposal,
      degraded: result.source === "fallback",
    });
    res.json({
      proposal: result.proposal,
      proposalId: stored.proposalId,
      source: result.source,
      degradedReason: result.degradedReason });
  })
);

// List + fetch the authenticated user's proposals (real, persisted data).
app.get(
  '/api/proposals',
  requireAuth,
  asyncRoute(async (req, res) => {
    const items = await getProposalRepository().listByUser(req.auth!.sub);
    res.json({ proposals: items });
  })
);

app.get(
  '/api/proposals/:id',
  requireAuth,
  asyncRoute(async (req, res) => {
    const sp = await getProposalRepository().get(req.params.id);
    if (!sp || sp.userId !== req.auth!.sub) {
      res.status(404).json({ error: 'Proposal not found.' });
      return;
    }
    res.json(sp);
  })
);

// Total steps in the sequential proposal builder (Describe → Scope →
// Intelligence → Timeline → Review). Kept in sync with the frontend stepper.
const PROPOSAL_TOTAL_STEPS = 5;

/**
 * Coerce a client-supplied workflow into a logically valid one:
 * - approvedSteps must be a contiguous prefix starting at 1 (you cannot approve
 *   step 3 without having approved 1 and 2);
 * - activeStep is clamped to [1, TOTAL] and can be at most (highest approved + 1).
 * This makes the persisted state tamper-resistant regardless of client input.
 */
function sanitizeWorkflow(activeStep: unknown, approvedSteps: unknown) {
  const uniq = Array.isArray(approvedSteps)
    ? [...new Set(approvedSteps.filter((n) => Number.isInteger(n) && n >= 1 && n <= PROPOSAL_TOTAL_STEPS))].sort(
        (a, b) => a - b,
      )
    : [];
  const prefix: number[] = [];
  for (let i = 0; i < uniq.length; i++) {
    if (uniq[i] === i + 1) prefix.push(uniq[i]);
    else break;
  }
  const maxAllowed = Math.min((prefix.length ? prefix[prefix.length - 1] : 0) + 1, PROPOSAL_TOTAL_STEPS);
  let step = Number.isInteger(activeStep) ? (activeStep as number) : 1;
  step = Math.min(Math.max(step, 1), maxAllowed);
  return { activeStep: step, approvedSteps: prefix, updatedAt: new Date().toISOString() };
}

// Persist the client's sequential step/approval state for a proposal so the
// builder restores exactly where the owner left off when they return.
app.put(
  '/api/proposals/:id/workflow',
  requireAuth,
  asyncRoute(async (req, res) => {
    const repo = getProposalRepository();
    const sp = await repo.get(req.params.id);
    if (!sp || sp.userId !== req.auth!.sub) {
      res.status(404).json({ error: 'Proposal not found.' });
      return;
    }
    const { activeStep, approvedSteps } = req.body ?? {};
    const workflow = sanitizeWorkflow(activeStep, approvedSteps);

    // Last-write-wins guard: ignore a stale write if the stored workflow is newer.
    const clientUpdatedAt = typeof req.body?.updatedAt === 'string' ? Date.parse(req.body.updatedAt) : NaN;
    const storedUpdatedAt = sp.workflow?.updatedAt ? Date.parse(sp.workflow.updatedAt) : NaN;
    if (!Number.isNaN(clientUpdatedAt) && !Number.isNaN(storedUpdatedAt) && clientUpdatedAt < storedUpdatedAt) {
      res.json({ workflow: sp.workflow });
      return;
    }

    const updated = await repo.setWorkflow(req.params.id, workflow);
    res.json({ workflow: updated?.workflow ?? workflow });
  })
);

// Rename proposal title
app.patch(
  '/api/proposals/:id/title',
  requireAuth,
  asyncRoute(async (req, res) => {
    const { title } = req.body ?? {};
    if (typeof title !== 'string' || !title.trim()) {
      res.status(400).json({ error: 'title is required and must be a non-empty string.' });
      return;
    }
    const repo = getProposalRepository();
    const updated = await repo.updateTitle(req.params.id, title.trim());
    if (!updated) {
      res.status(404).json({ error: 'Proposal not found.' });
      return;
    }
    res.json({ proposal: updated });
  })
);

// Toggle proposal pinned status
app.patch(
  '/api/proposals/:id/pin',
  requireAuth,
  asyncRoute(async (req, res) => {
    const { pinned } = req.body ?? {};
    const repo = getProposalRepository();
    const updated = await repo.togglePin(req.params.id, typeof pinned === 'boolean' ? pinned : undefined);
    if (!updated) {
      res.status(404).json({ error: 'Proposal not found.' });
      return;
    }
    res.json({ proposal: updated });
  })
);


// ==========================================
// Requirement Discovery Agent (Talent section only)
// ==========================================

app.post(
  '/api/discovery/next',
  requireAuth,
  asyncRoute(async (req, res) => {
    if (!requireAiService(res)) return;
    const { initialRequest, answers } = req.body ?? {};
    if (typeof initialRequest !== 'string' || !initialRequest.trim()) {
      res.status(400).json({ error: 'initialRequest is required and must be a non-empty string.' });
      return;
    }

    // Sanitize client inputs & cap lengths
    const cleanRequest = initialRequest.trim().slice(0, 2000);
    const safeAnswers = Array.isArray(answers)
      ? answers
          .filter(
            (a: unknown): a is { question: string; answer: string } =>
              Boolean(a) &&
              typeof (a as any).question === 'string' &&
              typeof (a as any).answer === 'string',
          )
          .map((a) => ({
            question: String(a.question).trim().slice(0, 500),
            answer: String(a.answer).trim().slice(0, 500),
          }))
      : [];

    const result = await runDiscoveryTurn(cleanRequest, safeAnswers);

    // Audit log discovery progress for security and compliance
    const userId = req.auth?.sub || 'anonymous';
    console.log(
      `[Discovery Audit] userId=${userId} turn=${safeAnswers.length + 1} status=${result.status} confidence=${result.confidence}%`
    );

    res.json(result);
  })
);


// ==========================================
// Subsystem 2: Confidence Grid (multi-agent evaluation + self-correction)
// ==========================================

app.post(
  '/api/proposals/evaluate',
  requireAuth,
  asyncRoute(async (req, res) => {
    if (!requireAiService(res)) return;
    const { briefText, proposal, proposalId } = req.body ?? {};
    if (typeof briefText !== 'string' || !briefText.trim()) {
      res.status(400).json({ error: 'briefText is required and must be a non-empty string.' });
      return;
    }
    if (!proposal || typeof proposal !== 'object') {
      res.status(400).json({ error: 'proposal object is required.' });
      return;
    }
    const result = await evaluateProposal(briefText, proposal);
    // Persist the evaluation against the proposal when an id is supplied.
    if (typeof proposalId === 'string' && proposalId) {
      await getProposalRepository().setEvaluation(proposalId, result);
    }

    // Fire-and-forget: notify the client that their proposal has been evaluated.
    if (req.auth?.email && result && typeof result === 'object' && 'confidenceIndex' in (result as any)) {
      const score = (result as any).confidenceIndex ?? 0;
      const projTitle = typeof proposal?.title === 'string' ? proposal.title : 'Your Project';
      notifyProposalEvaluated(
        { clientName: req.auth.name || 'there', projectTitle: projTitle, confidenceScore: Math.round(score) },
        req.auth.email,
      );
    }

    // Bindu track: record the verifiable Agent-to-Agent message trace for this
    // evaluation (Auditor → Optimizer, Feasibility → Optimizer, decision). The
    // correlating evaluationId is returned so the UI can fetch the trace.
    const evaluationId = await recordEvaluationExchange(
      result,
      typeof proposalId === 'string' && proposalId ? proposalId : undefined,
    );

    res.json({ ...result, evaluationId });
  })
);

// ==========================================
// AI-008 — Deep proposal plan (v2 execution plan) API
// All endpoints: authenticated + proposal-owner only. Planning state is fully
// isolated from escrow/payments — none of these call any escrow/order/release.
// ==========================================

// Load a proposal and enforce owner-only access. Returns null (and responds)
// when missing/forbidden so the caller can early-return.
async function loadOwnedProposal(req: Request, res: Response) {
  const sp = await getProposalRepository().get(req.params.id);
  if (!sp) {
    res.status(404).json({ error: 'Proposal not found.' });
    return null;
  }
  if (sp.userId !== req.auth?.sub) {
    res.status(403).json({ error: 'You do not have access to this proposal.' });
    return null;
  }
  return sp;
}

// Map plan-service errors to precise HTTP responses. Returns true if handled.
function handlePlanError(err: unknown, res: Response): boolean {
  if (err instanceof PlanNotFoundError) {
    res.status(404).json({ error: err.message });
    return true;
  }
  if (err instanceof PlanValidationError) {
    res.status(422).json({ error: err.message, diagnostics: err.diagnostics });
    return true;
  }
  if (err instanceof PlanPatchError) {
    res.status(422).json({ error: err.message, path: err.path });
    return true;
  }
  if (err instanceof PlanConflictError) {
    res.status(409).json({
      error: err.message,
      baseRevision: err.baseRevision,
      currentRevision: err.currentRevision,
      conflictingScopes: err.conflictingScopes,
    });
    return true;
  }
  if (err instanceof PlanRevisionConflictError) {
    res.status(409).json({ error: err.message, expected: err.expected, currentRevision: err.actual });
    return true;
  }
  if (err instanceof PlanStateError) {
    res.status(409).json({ error: err.message });
    return true;
  }
  if (err instanceof AiServiceError) {
    res.status(err.status >= 400 && err.status < 600 ? err.status : 502).json({ error: err.message });
    return true;
  }
  return false;
}

// Create or regenerate (a section of) the plan.
app.post(
  '/api/proposals/:id/plan/generate',
  requireAuth,
  asyncRoute(async (req, res) => {
    if (!requireAiService(res)) return;
    const sp = await loadOwnedProposal(req, res);
    if (!sp) return;
    const { scope, preserveClientEdits, confirmOverwrite } = req.body ?? {};
    if (scope !== undefined && !['all', 'architecture', 'timeline'].includes(scope)) {
      res.status(400).json({ error: "scope must be 'all', 'architecture', or 'timeline'." });
      return;
    }
    try {
      const { document, diagnostics } = await generatePlan({
        proposalId: sp.proposalId,
        proposal: sp.proposal,
        briefText: sp.briefText,
        scope,
        preserveClientEdits: preserveClientEdits !== false,
        confirmOverwrite: confirmOverwrite === true,
        actorUserId: req.auth!.sub,
      });
      res.json({ plan: document.currentPlan, currentRevision: document.currentRevision, status: document.status, diagnostics });
    } catch (err) {
      if (!handlePlanError(err, res)) throw err;
    }
  }),
);

// Read the current plan + metadata.
app.get(
  '/api/proposals/:id/plan',
  requireAuth,
  asyncRoute(async (req, res) => {
    const sp = await loadOwnedProposal(req, res);
    if (!sp) return;
    const doc = await getPlan(sp.proposalId);
    if (!doc) {
      res.status(404).json({ error: 'No plan generated for this proposal yet.', code: 'PLAN_NOT_GENERATED' });
      return;
    }
    res.setHeader('ETag', `W/"plan-${doc.currentRevision}"`);
    res.json({
      plan: doc.currentPlan,
      diagnostics: doc.currentPlan.diagnostics ?? null,
      currentRevision: doc.currentRevision,
      approvedRevision: doc.approvedRevision ?? null,
      status: doc.status,
      degraded: Boolean(doc.currentPlan.degraded),
      updatedAt: doc.updatedAt,
    });
  }),
);

// Apply field-level edits (idempotent, conflict-safe, validated).
app.patch(
  '/api/proposals/:id/plan',
  requireAuth,
  asyncRoute(async (req, res) => {
    if (!requireAiService(res)) return;
    const sp = await loadOwnedProposal(req, res);
    if (!sp) return;
    const { baseRevision, operationId, operations, summary } = req.body ?? {};
    if (typeof baseRevision !== 'number' || !Number.isInteger(baseRevision) || baseRevision < 0) {
      res.status(400).json({ error: 'baseRevision (non-negative integer) is required.' });
      return;
    }
    if (typeof operationId !== 'string' || !operationId.trim()) {
      res.status(400).json({ error: 'operationId (UUID string) is required.' });
      return;
    }
    if (!Array.isArray(operations) || operations.length === 0) {
      res.status(400).json({ error: 'operations must be a non-empty JSON Patch array.' });
      return;
    }
    try {
      const result = await patchPlan({
        proposalId: sp.proposalId,
        baseRevision,
        operationId,
        operations,
        actorUserId: req.auth!.sub,
        summary: typeof summary === 'string' ? summary : undefined,
      });
      res.json({
        plan: result.document.currentPlan,
        currentRevision: result.document.currentRevision,
        status: result.document.status,
        diagnostics: result.diagnostics,
        merged: result.merged,
        replayed: result.replayed,
      });
    } catch (err) {
      if (!handlePlanError(err, res)) throw err;
    }
  }),
);

// List revision metadata (lightweight — snapshots omitted).
app.get(
  '/api/proposals/:id/plan/revisions',
  requireAuth,
  asyncRoute(async (req, res) => {
    const sp = await loadOwnedProposal(req, res);
    if (!sp) return;
    const revs = await listPlanRevisions(sp.proposalId);
    res.json({
      revisions: revs.map((r) => ({
        revision: r.revision,
        operationId: r.operationId,
        actorRole: r.actorRole,
        occurredAt: r.occurredAt,
        summary: r.summary,
        entryHash: r.entryHash,
        previousHash: r.previousHash,
        errorCount: r.diagnosticsAfter?.errorCount ?? 0,
        warningCount: r.diagnosticsAfter?.warningCount ?? 0,
      })),
    });
  }),
);

// Restore an earlier revision (or baseline 0) as a new revision.
app.post(
  '/api/proposals/:id/plan/revisions/:revision/restore',
  requireAuth,
  asyncRoute(async (req, res) => {
    if (!requireAiService(res)) return;
    const sp = await loadOwnedProposal(req, res);
    if (!sp) return;
    const revision = Number(req.params.revision);
    const { baseRevision, operationId } = req.body ?? {};
    if (!Number.isInteger(revision) || revision < 0) {
      res.status(400).json({ error: 'revision must be a non-negative integer.' });
      return;
    }
    if (typeof baseRevision !== 'number' || typeof operationId !== 'string' || !operationId.trim()) {
      res.status(400).json({ error: 'baseRevision (number) and operationId (string) are required.' });
      return;
    }
    try {
      const result = await restoreRevision({
        proposalId: sp.proposalId,
        revision,
        baseRevision,
        operationId,
        actorUserId: req.auth!.sub,
      });
      res.json({
        plan: result.document.currentPlan,
        currentRevision: result.document.currentRevision,
        status: result.document.status,
        diagnostics: result.diagnostics,
        replayed: result.replayed,
      });
    } catch (err) {
      if (!handlePlanError(err, res)) throw err;
    }
  }),
);

// Approve (freeze) the current revision.
app.post(
  '/api/proposals/:id/plan/approve',
  requireAuth,
  asyncRoute(async (req, res) => {
    const sp = await loadOwnedProposal(req, res);
    if (!sp) return;
    const { expectedRevision } = req.body ?? {};
    if (typeof expectedRevision !== 'number' || !Number.isInteger(expectedRevision)) {
      res.status(400).json({ error: 'expectedRevision (integer) is required.' });
      return;
    }
    try {
      const doc = await approvePlan({ proposalId: sp.proposalId, expectedRevision, actorUserId: req.auth!.sub });
      res.json({ status: doc.status, approvedRevision: doc.approvedRevision, currentRevision: doc.currentRevision });
    } catch (err) {
      if (!handlePlanError(err, res)) throw err;
    }
  }),
);

// Reopen an approved plan for editing.
app.post(
  '/api/proposals/:id/plan/reopen',
  requireAuth,
  asyncRoute(async (req, res) => {
    const sp = await loadOwnedProposal(req, res);
    if (!sp) return;
    try {
      const doc = await reopenPlan({ proposalId: sp.proposalId, actorUserId: req.auth!.sub });
      res.json({ status: doc.status, currentRevision: doc.currentRevision });
    } catch (err) {
      if (!handlePlanError(err, res)) throw err;
    }
  }),
);

// ==========================================
// Interview Vetting Generator
// ==========================================

app.post(
  '/api/interview-questions',
  requireAuth,
  asyncRoute(async (req, res) => {
    if (!requireAiService(res)) return;
    const { briefText, githubScan = '', missingSkills = [] } = req.body ?? {};
    if (typeof briefText !== 'string' || !briefText.trim()) {
      res.status(400).json({ error: 'briefText is required and must be a non-empty string.' });
      return;
    }
    const output = await generateInterviewQuestions(
      briefText,
      githubScan,
      Array.isArray(missingSkills) ? missingSkills : []
    );
    res.json(output);
  })
);

// ==========================================
// Contextual Contract Extensions
// ==========================================

app.post(
  '/api/contract-extensions',
  requireAuth,
  asyncRoute(async (req, res) => {
    if (!requireAiService(res)) return;
    const { completedDeliverables = '', chatSummary = '' } = req.body ?? {};
    const output = await generateContractExtensions(
      completedDeliverables,
      String(chatSummary)
    );
    res.json(output);
  })
);

// ==========================================
// Deterministic calculators (no API key required)
// ==========================================

app.post('/api/earnings', (req: Request, res: Response) => {
  const { grossAmount, platformPlan = 'FREE', taxCountryCode = '' } = req.body ?? {};
  if (typeof grossAmount !== 'number' || grossAmount < 0) {
    res.status(400).json({ error: 'grossAmount is required and must be a non-negative number.' });
    return;
  }
  res.json(calculateEarningsBreakdown(grossAmount, platformPlan, taxCountryCode));
});

app.post('/api/reputation', (req: Request, res: Response) => {
  const { escrowHistory = [], freelancerDid } = req.body ?? {};
  const metrics = calculateReputationMetrics(escrowHistory);
  const sbtMetadata = freelancerDid ? buildSBTMetadata(metrics, freelancerDid) : null;
  res.json({ metrics, sbtMetadata });
});

app.post('/api/client-score', (req: Request, res: Response) => {
  const { clientHistory = [] } = req.body ?? {};
  res.json(calculateClientScore(clientHistory));
});

// ==========================================
// AI-006: Client hiring matches
// ==========================================

const ClientMatchRunInputSchema = z.object({
  requiredSkills: z.array(z.string().trim().min(1)).min(1).max(30),
  budget: z.number().positive().max(10_000_000).optional(),
  domains: z.array(z.string().trim().min(1)).max(12).optional(),
  // The zero-noise product promise is a compact shortlist, not an open roster.
  limit: z.number().int().min(3).max(5).optional(),
  // Required only when refreshing a persisted shortlist, preventing stale overwrites.
  expectedVersion: z.number().int().positive().optional(),
});

const ClientMatchActionInputSchema = z.object({
  action: ClientMatchActionSchema,
  expectedVersion: z.number().int().positive(),
});

function getOwnedProposalForClient(proposalId: string, clientId: string) {
  return getProposalRepository().get(proposalId).then((proposal) =>
    proposal && proposal.userId === clientId ? proposal : null,
  );
}

/**
 * Generates or refreshes a persisted client shortlist. Candidate scores are
 * evidence snapshots; invitation and selection state is retained across a re-run.
 */
app.post(
  '/api/proposals/:id/matches/run',
  requireAuth,
  requireRole('client'),
  asyncRoute(async (req, res) => {
    const parsed = ClientMatchRunInputSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid match request.', details: parsed.error.flatten() });
      return;
    }

    const repo = getProposalRepository();
    const proposal = await getOwnedProposalForClient(req.params.id, req.auth!.sub);
    if (!proposal) {
      res.status(404).json({ error: 'Project proposal not found.' });
      return;
    }

    const roster = await getFreelancerRepository().listActiveFreelancers();
    const output = generateShortlist(
      {
        requiredSkills: parsed.data.requiredSkills,
        budget: parsed.data.budget,
        domains: parsed.data.domains,
        limit: parsed.data.limit ?? 5,
      },
      roster,
    );

    const existing = proposal.clientMatchWorkflow;
    if (existing && parsed.data.expectedVersion === undefined) {
      res.status(409).json({
        error: 'The shortlist already exists. Reload it before refreshing so client decisions are preserved.',
        workflow: existing,
      });
      return;
    }

    const workflow = existing
      ? refreshClientMatchWorkflow(existing, output, parsed.data.expectedVersion!, req.auth!.sub)
      : createClientMatchWorkflow(output, req.auth!.sub);
    const updated = await repo.setClientMatchWorkflow(
      proposal.proposalId,
      workflow,
      existing?.version,
    );

    res.json({ workflow: updated?.clientMatchWorkflow ?? workflow });
  }),
);

/** Returns the client-owned hiring state for one project. */
app.get(
  '/api/proposals/:id/matches',
  requireAuth,
  requireRole('client'),
  asyncRoute(async (req, res) => {
    const proposal = await getOwnedProposalForClient(req.params.id, req.auth!.sub);
    if (!proposal) {
      res.status(404).json({ error: 'Project proposal not found.' });
      return;
    }
    if (proposal.clientMatchWorkflow && !verifyClientMatchAudit(proposal.clientMatchWorkflow)) {
      res.status(409).json({ error: 'Match history integrity check failed. Re-run the shortlist before taking action.' });
      return;
    }
    res.json({ workflow: proposal.clientMatchWorkflow ?? null });
  }),
);

/** Moves a candidate through the client-side hiring FSM using optimistic concurrency. */
app.patch(
  '/api/proposals/:id/matches/:freelancerId',
  requireAuth,
  requireRole('client'),
  asyncRoute(async (req, res) => {
    const parsed = ClientMatchActionInputSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid hiring action.', details: parsed.error.flatten() });
      return;
    }

    const proposal = await getOwnedProposalForClient(req.params.id, req.auth!.sub);
    if (!proposal || !proposal.clientMatchWorkflow) {
      res.status(404).json({ error: 'Project shortlist not found.' });
      return;
    }

    // triggerRole 'client' means accept/decline are rejected here by the
    // permission matrix — only the invited freelancer can consent.
    const workflow = transitionClientMatch(
      proposal.clientMatchWorkflow,
      req.params.freelancerId,
      parsed.data.action,
      parsed.data.expectedVersion,
      req.auth!.sub,
      'client',
    );
    const updated = await getProposalRepository().setClientMatchWorkflow(
      proposal.proposalId,
      workflow,
      proposal.clientMatchWorkflow.version,
    );

    // Fire-and-forget: when a client invites a freelancer, email them.
    if (parsed.data.action === 'invite') {
      const candidate = workflow.candidates.find((c) => c.freelancerId === req.params.freelancerId);
      if (candidate) {
        // Look up the freelancer's email from the user repository.
        void (async () => {
          try {
            const userRepo = getUserRepository();
            const freelancerUser = await userRepo.findById(req.params.freelancerId);
            if (freelancerUser?.email) {
              notifyProjectInvitation(
                {
                  freelancerName: candidate.name,
                  clientName: req.auth!.name || 'A client',
                  projectTitle: proposal.title || 'A new project',
                  projectBrief: proposal.briefText?.slice(0, 500) || '',
                  skills: (proposal.proposal?.features || []).map((f: any) => f.area || f.title || '').filter(Boolean).slice(0, 10),
                },
                freelancerUser.email,
              );
            }
          } catch (err) {
            console.error('[EMAIL] Failed to send invitation email:', (err as Error).message);
          }
        })();
      }
    }

    res.json({ workflow: updated?.clientMatchWorkflow ?? workflow });
  }),
);

// Backwards-compatible direct scoring endpoint. New dashboard code must use
// the project-scoped routes above so invitations and selections are durable.
app.post(
  '/api/leads/match',
  requireAuth,
  requireRole('client'),
  asyncRoute(async (req, res) => {
    const parsed = ClientMatchRunInputSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid match request.', details: parsed.error.flatten() });
      return;
    }
    const roster = await getFreelancerRepository().listActiveFreelancers();
    res.json(generateShortlist({ ...parsed.data, limit: parsed.data.limit ?? 5 }, roster));
  }),
);

// ==========================================
// Candidate profile — a client viewing a matched freelancer's analytics.
// Returns the same shape the freelancer sees in their Analytics dashboard
// (verified skills, projects, confidence). Falls back to the roster profile
// when a freelancer has no GitHub scan yet, so clients always see something.
// ==========================================

app.get(
  ['/api/freelancers/:id/profile', '/api/freelancer/:id/profile'],
  requireAuth,
  requireRole('client'),
  asyncRoute(async (req, res) => {
    const proposalId = typeof req.query.proposalId === 'string' ? req.query.proposalId : '';
    const proposal = proposalId
      ? await getOwnedProposalForClient(proposalId, req.auth!.sub)
      : null;
    const isMatchedCandidate = Boolean(
      proposal?.clientMatchWorkflow?.candidates.some(
        (candidate) => candidate.freelancerId === req.params.id,
      ),
    );
    if (!isMatchedCandidate) {
      res.status(404).json({ error: 'Candidate is not part of this project shortlist.' });
      return;
    }
    const id = req.params.id;
    const scan = await getGithubScanRepository().getProfile(id);
    const hasScan = Boolean(
      (scan.skills && scan.skills.length) ||
        (scan.projects && scan.projects.length) ||
        scan.confidence,
    );

    if (hasScan) {
      res.json({ ...scan, source: 'scan' });
      return;
    }

    // No scan on file → synthesize a lightweight, honest profile from the roster
    // (skills + reputation are real roster fields; projects remain empty).
    const roster = await getFreelancerRepository().listActiveFreelancers();
    const entry = roster.find((f) => f.id === id) || null;
    if (!entry) {
      res.status(404).json({ error: 'Candidate not found.' });
      return;
    }

    const rep = typeof entry.reputationScore === 'number' ? entry.reputationScore : 80;
    const languages: Record<string, number> = {};
    const langs = entry.githubLanguages ?? [];
    langs.forEach((l) => {
      languages[l] = Math.max(1, Math.round(100 / langs.length));
    });

    res.json({
      source: 'roster',
      skills: (entry.skills ?? []).map((name) => ({
        name,
        confidence: Math.min(95, rep),
        category: 'skill',
        evidence: [],
      })),
      projects: [],
      confidence: {
        score: rep,
        band: rep >= 85 ? 'match_ready' : rep >= 70 ? 'developing' : 'emerging',
      },
      latestJob: { languages },
      snapshot: { name: entry.name, bio: entry.title },
    });
  }),
);

// ==========================================
// Escrow State Machine (milestones + cryptographic audit trail)
// ==========================================

// STORY-17: Strict Zod schemas for escrow/payment request bodies. Amounts are
// bounded to ₹100–₹50,00,000 to reject nonsensical or abusive values.
const MILESTONE_STATES = [
  'Draft',
  'Pending_Deposit',
  'Active',
  'In_Review',
  'Revision_Requested',
  'Approved',
  'Funds_Released',
  'Dispute',
] as const;

const AmountSchema = z
  .number({ invalid_type_error: 'amount must be a number.' })
  .finite()
  .min(100, 'amount must be at least ₹100.')
  .max(5_000_000, 'amount must not exceed ₹50,00,000.');

const CreateMilestoneSchema = z.object({
  proposalId: z.string().trim().min(1, 'proposalId is required.'),
  title: z.string().trim().min(1, 'title is required.'),
  amount: AmountSchema,
});

const TransitionSchema = z.object({
  toState: z.enum(MILESTONE_STATES),
  triggerUserId: z.string().trim().min(1, 'triggerUserId is required.'),
  triggerUserRole: z.enum(['Freelancer', 'Client', 'Arbitrator', 'System']).optional(),
  expectedVersion: z.number().int().nonnegative(),
  metadata: z.string().max(2000).optional(),
  mfaToken: z.string().trim().optional(),
});

const VerifyPaymentSchema = z.object({
  razorpayPaymentId: z.string().trim().min(1, 'razorpayPaymentId is required.'),
  razorpayOrderId: z.string().trim().min(1, 'razorpayOrderId is required.'),
  razorpaySignature: z.string().trim().min(1, 'razorpaySignature is required.'),
});

const ReleaseSchema = z.object({
  mfaToken: z.string().trim().min(1, 'mfaToken is required to release funds.'),
  freelancerAccountId: z.string().trim().optional(),
  platformPlan: z.string().trim().optional(),
  taxCountryCode: z.string().trim().optional(),
});

/**
 * Validates a request body against a Zod schema. On failure it writes a 400
 * with the first validation issue and returns null; on success returns the
 * parsed, typed data.
 */
function parseBody<T>(schema: z.ZodSchema<T>, req: Request, res: Response): T | null {
  const result = schema.safeParse(req.body ?? {});
  if (!result.success) {
    const first = result.error.issues[0];
    res.status(400).json({
      error: first?.message || 'Invalid request body.',
      code: 'VALIDATION_ERROR',
      field: first?.path?.join('.') || undefined,
    });
    return null;
  }
  return result.data;
}

app.post(
  '/api/escrow/milestones',
  requireAuth,
  asyncRoute(async (req, res) => {
    const data = parseBody(CreateMilestoneSchema, req, res);
    if (!data) return;
    res.status(201).json(await createMilestone(data));
  }),
);

app.get(
  '/api/escrow/milestones',
  requireAuth,
  asyncRoute(async (req, res) => {
    const proposalId = typeof req.query.proposalId === 'string' ? req.query.proposalId : undefined;
    res.json({ milestones: await listMilestones(proposalId) });
  }),
);

app.get(
  '/api/escrow/milestones/:id',
  requireAuth,
  asyncRoute(async (req, res) => {
    const milestone = await getMilestone(req.params.id);
    if (!milestone) {
      res.status(404).json({ error: 'Milestone not found.' });
      return;
    }
    res.json(milestone);
  }),
);

app.get(
  '/api/escrow/milestones/:id/audit',
  requireAuth,
  asyncRoute(async (req, res) => {
    if (!(await getMilestone(req.params.id))) {
      res.status(404).json({ error: 'Milestone not found.' });
      return;
    }
    res.json(await getAuditChain(req.params.id));
  }),
);

// STORY-21: On-demand integrity scan across all milestone audit chains.
// Restricted to the developer/admin role; also intended to be invoked on a
// schedule by an external trigger.
app.get(
  '/api/escrow/audit/scan',
  requireAuth,
  requireRole('developer'),
  asyncRoute(async (_req, res) => {
    res.json(await scanAllAuditChains());
  }),
);

// STORY-07: Payment history — a per-user financial ledger derived from the
// user's proposals + their milestones, with the full fee breakdown for each.
app.get(
  '/api/payments/history',
  requireAuth,
  asyncRoute(async (req, res) => {
    const userId = req.auth!.sub;
    const proposals = await getProposalRepository().listByUser(userId);

    const transactions: any[] = [];
    for (const p of proposals) {
      const milestones = await listMilestones(p.proposalId);
      for (const m of milestones) {
        const breakdown = calculateEarningsBreakdown(m.amount, 'FREE', 'IN');
        transactions.push({
          milestoneId: m.id,
          proposalId: m.proposalId,
          projectTitle: p.title,
          title: m.title,
          state: m.state,
          amount: m.amount,
          funded: m.state !== 'Draft' && m.state !== 'Pending_Deposit',
          released: m.state === 'Funds_Released',
          razorpayOrderId: m.razorpayOrderId,
          razorpayPaymentId: m.razorpayPaymentId,
          razorpayTransferId: m.razorpayTransferId,
          razorpayRefundId: m.razorpayRefundId,
          disputeStatus: m.disputeStatus,
          grossAmount: breakdown.grossAmount,
          platformFee: breakdown.platformFee,
          paymentGatewayFee: breakdown.paymentGatewayFee,
          withholdingTax: breakdown.withholdingTax,
          netFreelancerEarnings: breakdown.netFreelancerEarnings,
          totalClientCheckout: breakdown.totalClientCheckout,
        });
      }
    }

    const summary = {
      total: transactions.length,
      funded: transactions.filter((t) => t.funded).length,
      released: transactions.filter((t) => t.released).length,
      totalInEscrow: transactions
        .filter((t) => t.funded && !t.released)
        .reduce((s, t) => s + t.amount, 0),
      totalReleased: transactions
        .filter((t) => t.released)
        .reduce((s, t) => s + t.netFreelancerEarnings, 0),
    };

    res.json({ transactions, summary });
  }),
);

// ==========================================
// Corsair track — FixBot agent automations
// ==========================================

// List recent agent actions (optionally scoped to a proposal/tenant).
app.get(
  '/api/automations',
  requireAuth,
  asyncRoute(async (req, res) => {
    const tenantId = typeof req.query.proposalId === 'string' ? req.query.proposalId : undefined;
    // `configured` = env vars present. `ready` = the SDK actually initialized
    // (packages installed + init succeeded). These are DIFFERENT states — the
    // UI must key off `ready`, not `configured`, or it shows "connected" while
    // Corsair is actually dead. `reason` explains why it isn't ready.
    const ready = Boolean(await getCorsair());
    res.json({
      configured: isCorsairConfigured(),
      ready,
      reason: ready ? null : getCorsairError(),
      automations: await listAutomations(tenantId),
    });
  }),
);

// Mint a Corsair Hub connect link so the user can authorize an integration
// (slack / github / gmail) for their workspace/tenant.
app.post(
  '/api/automations/connect',
  requireAuth,
  asyncRoute(async (req, res) => {
    const { plugin, proposalId } = req.body ?? {};
    if (typeof plugin !== 'string' || !plugin.trim()) {
      res.status(400).json({ error: 'plugin is required (e.g. "slack", "github", "gmail").' });
      return;
    }
    const tenantId = typeof proposalId === 'string' && proposalId.trim() ? proposalId : req.auth!.sub;
    const result = await createConnectLink(tenantId, plugin.trim());
    res.json(result);
  }),
);

// Mount Corsair handler for Hub self-registration, OAuth callbacks, and webhooks
app.use('/api/corsair', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const handler = await getCorsairNodeHandler();
    if (handler) {
      return (handler as any)(req, res, next);
    }
  } catch (err) {
    console.error('[Corsair Route Handler Error]:', err);
  }
  next();
});


// ==========================================
// Bindu track — verifiable agent marketplace (DID registry + A2A trace)
// ==========================================

// The DID registry: identity-verified Confidence-Grid agents + advertised
// (Bindu) skills. Powers the "marketplace of verifiable agents" story.
app.get(
  '/api/agents',
  requireAuth,
  asyncRoute(async (_req, res) => {
    res.json(await getAgentDirectory());
  }),
);

// The ordered, signature-verified A2A message trace for one proposal
// evaluation (correlate via the evaluationId returned by /api/proposals/evaluate).
app.get(
  '/api/agents/messages',
  requireAuth,
  asyncRoute(async (req, res) => {
    const evaluationId = typeof req.query.evaluationId === 'string' ? req.query.evaluationId : '';
    if (!evaluationId) {
      res.status(400).json({ error: 'evaluationId query parameter is required.' });
      return;
    }
    res.json({ evaluationId, messages: await getEvaluationMessages(evaluationId) });
  }),
);

app.post(
  '/api/escrow/milestones/:id/transition',
  requireAuth,
  asyncRoute(async (req, res) => {
    const data = parseBody(TransitionSchema, req, res);
    if (!data) return;
    const { toState, triggerUserId, triggerUserRole, expectedVersion, metadata, mfaToken } = data;

    try {
      const result = await applyTransition(req.params.id, {
        toState: toState as any,
        triggerUserId,
        triggerUserRole: (triggerUserRole as any) || 'System',
        expectedVersion,
        metadata,
        mfaToken,
      });
      // STORY-36: notify on the meaningful lifecycle transitions.
      const evtMap: Record<string, any> = {
        In_Review: 'submitted',
        Approved: 'approved',
        Revision_Requested: 'revision_requested',
      };
      if (evtMap[toState] && req.auth?.email) {
        notifyMilestoneEvent(evtMap[toState], result.milestone, req.auth.email);
      }
      res.json(result);
    } catch (err) {
      if (err instanceof VersionMismatchError) {
        res.status(409).json({ error: err.message, code: 'VERSION_MISMATCH' });
        return;
      }
      if (err instanceof InvalidTransitionError) {
        res.status(422).json({ error: err.message, code: 'INVALID_TRANSITION' });
        return;
      }
      if (err instanceof MFARequiredError) {
        res.status(401).json({ error: err.message, code: 'MFA_REQUIRED' });
        return;
      }
      if (err instanceof Error && err.message.startsWith('MFA Verification Failed')) {
        res.status(401).json({ error: err.message, code: 'MFA_REQUIRED' });
        return;
      }
      if (err instanceof Error && err.message.includes('not found')) {
        res.status(404).json({ error: err.message });
        return;
      }
      throw err;
    }
  }),
);

app.post(
  '/api/escrow/milestones/:id/fund',
  requireAuth,
  asyncRoute(async (req, res) => {
    let milestone = await getMilestone(req.params.id);
    if (!milestone) {
      res.status(404).json({ error: 'Milestone not found.' });
      return;
    }
    if (milestone.state !== 'Draft' && milestone.state !== 'Pending_Deposit') {
      res.status(400).json({ error: `Cannot fund milestone in state [${milestone.state}].` });
      return;
    }

    const order = await createRazorpayOrder(milestone.id, milestone.amount);

    if (milestone.state === 'Draft') {
      const transitionResult = await applyTransition(milestone.id, {
        toState: 'Pending_Deposit',
        triggerUserId: req.auth!.sub,
        triggerUserRole: (req.auth!.role as any) || 'Client',
        expectedVersion: milestone.version,
        metadata: `Razorpay Order generated: ${order.id}`
      });
      milestone = transitionResult.milestone;
    }

    milestone.razorpayOrderId = order.id;
    await getMilestoneRepository().save(milestone);

    res.json({
      key: process.env.RAZORPAY_KEY_ID || 'rzp_test_mock',
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      milestone
    });
  })
);

app.post(
  '/api/escrow/milestones/:id/verify-payment',
  requireAuth,
  asyncRoute(async (req, res) => {
    const data = parseBody(VerifyPaymentSchema, req, res);
    if (!data) return;
    const { razorpayPaymentId, razorpayOrderId, razorpaySignature } = data;

    const milestone = await getMilestone(req.params.id);
    if (!milestone) {
      res.status(404).json({ error: 'Milestone not found.' });
      return;
    }

    const isValid = verifyPaymentSignature(razorpayOrderId, razorpayPaymentId, razorpaySignature);
    if (!isValid) {
      res.status(400).json({ error: 'Invalid Razorpay signature verification.' });
      return;
    }

    if (milestone.state === 'Pending_Deposit') {
      const transitionResult = await applyTransition(milestone.id, {
        toState: 'Active',
        triggerUserId: req.auth!.sub,
        triggerUserRole: (req.auth!.role as any) || 'Client',
        expectedVersion: milestone.version,
        metadata: `Payment verified. Razorpay Payment ID: ${razorpayPaymentId}`
      });
      const updated = {
        ...transitionResult.milestone,
        razorpayOrderId,
        razorpayPaymentId,
        razorpaySignature
      };
      await getMilestoneRepository().save(updated);
      if (req.auth?.email) notifyMilestoneEvent('funded', updated, req.auth.email);
      // Corsair FixBot: post to the project's Slack channel (permission-gated).
      fireMilestoneNotifications({
        tenantId: updated.proposalId,
        event: 'funded',
        milestoneTitle: updated.title,
      });
      res.json({ milestone: updated });
    } else if (milestone.state === 'Active') {
      res.json({ milestone });
    } else {
      res.status(400).json({ error: `Cannot verify payment for milestone in state [${milestone.state}].` });
    }
  })
);

app.post(
  '/api/escrow/milestones/:id/release',
  requireAuth,
  asyncRoute(async (req, res) => {
    const data = parseBody(ReleaseSchema, req, res);
    if (!data) return;
    const { mfaToken, freelancerAccountId, platformPlan, taxCountryCode } = data;

    const milestone = await getMilestone(req.params.id);
    if (!milestone) {
      res.status(404).json({ error: 'Milestone not found.' });
      return;
    }
    if (milestone.state !== 'Approved') {
      res.status(400).json({
        error: `Cannot release funds for milestone in state [${milestone.state}]. Milestone must be Approved.`,
      });
      return;
    }

    // Resolve the payout destination: explicit body value wins, else the value
    // already stored on the milestone. In live mode a destination is mandatory.
    const payoutAccountId =
      (typeof freelancerAccountId === 'string' && freelancerAccountId.trim()) ||
      milestone.freelancerAccountId ||
      '';

    // Compute the exact fee breakdown so the payout matches the earnings engine.
    const breakdown = calculateEarningsBreakdown(
      milestone.amount,
      typeof platformPlan === 'string' ? platformPlan : 'FREE',
      typeof taxCountryCode === 'string' ? taxCountryCode : 'IN',
    );

    // 1. Advance the FSM (enforces MFA + optimistic concurrency + audit block).
    let released;
    try {
      released = await applyTransition(milestone.id, {
        toState: 'Funds_Released',
        triggerUserId: req.auth!.sub,
        triggerUserRole: (req.auth!.role as any) || 'Client',
        expectedVersion: milestone.version,
        metadata: `Funds released. Net payout ₹${breakdown.netFreelancerEarnings} to ${payoutAccountId || 'freelancer'}.`,
        mfaToken,
      });
    } catch (err) {
      if (err instanceof VersionMismatchError) {
        res.status(409).json({ error: err.message, code: 'VERSION_MISMATCH' });
        return;
      }
      if (err instanceof InvalidTransitionError) {
        res.status(422).json({ error: err.message, code: 'INVALID_TRANSITION' });
        return;
      }
      if (err instanceof MFARequiredError) {
        res.status(401).json({ error: err.message, code: 'MFA_REQUIRED' });
        return;
      }
      if (err instanceof Error && err.message.startsWith('MFA Verification Failed')) {
        res.status(401).json({ error: err.message, code: 'MFA_REQUIRED' });
        return;
      }
      throw err;
    }

    // 2. Route the net earnings to the freelancer via Razorpay Route.
    const transfer = await transferFundsToFreelancer(
      breakdown.netFreelancerEarnings,
      payoutAccountId,
    );

    // 3. Persist the payout reference on the milestone (best-effort side data).
    const updated = {
      ...released.milestone,
      freelancerAccountId: payoutAccountId || released.milestone.freelancerAccountId,
      razorpayTransferId: transfer.transferId,
    };
    await getMilestoneRepository().save(updated);
    if (req.auth?.email) notifyMilestoneEvent('released', updated, req.auth.email);
    // Corsair FixBot: Slack ping + approval-gated payout email to the freelancer.
    fireMilestoneNotifications({
      tenantId: updated.proposalId,
      event: 'released',
      milestoneTitle: updated.title,
      counterpartyEmail: req.auth?.email,
    });

    res.json({
      milestone: updated,
      transfer: { success: transfer.success, transferId: transfer.transferId },
      breakdown,
    });
  }),
);

app.post(
  '/api/escrow/milestones/:id/dispute',
  requireAuth,
  asyncRoute(async (req, res) => {
    const { reason, evidenceUrls } = req.body ?? {};
    if (typeof reason !== 'string' || !reason.trim()) {
      res.status(400).json({ error: 'reason is required to raise a dispute.' });
      return;
    }
    const urls = Array.isArray(evidenceUrls)
      ? evidenceUrls.filter((u): u is string => typeof u === 'string')
      : [];

    const milestone = await getMilestone(req.params.id);
    if (!milestone) {
      res.status(404).json({ error: 'Milestone not found.' });
      return;
    }

    const disputeId = randomUUID();

    let result;
    try {
      result = await applyTransition(milestone.id, {
        toState: 'Dispute',
        triggerUserId: req.auth!.sub,
        triggerUserRole: (req.auth!.role as any) || 'Client',
        expectedVersion: milestone.version,
        metadata: `Dispute [${disputeId}] raised: ${reason.slice(0, 200)}`,
      });
    } catch (err) {
      if (err instanceof VersionMismatchError) {
        res.status(409).json({ error: err.message, code: 'VERSION_MISMATCH' });
        return;
      }
      if (err instanceof InvalidTransitionError) {
        res.status(422).json({
          error: err.message,
          code: 'INVALID_TRANSITION',
          hint: 'Disputes can only be raised from Active, In_Review, or Revision_Requested states.',
        });
        return;
      }
      throw err;
    }

    const updated = {
      ...result.milestone,
      disputeId,
      disputeReason: reason,
      disputeEvidenceUrls: urls,
      disputeStatus: 'open' as const,
    };
    await getMilestoneRepository().save(updated);
    if (req.auth?.email) notifyMilestoneEvent('dispute_raised', updated, req.auth.email);

    res.status(201).json({ milestone: updated, disputeId });
  }),
);

app.post(
  '/api/escrow/milestones/:id/resolve-dispute',
  requireAuth,
  // NOTE: In production this route should be gated to a dedicated Arbitrator
  // role. The current auth model has no such role, so it is authenticated-only
  // and the FSM records the trigger as 'Arbitrator' for the audit trail.
  asyncRoute(async (req, res) => {
    const { resolution, resolvedState, refundAmount, mfaToken } = req.body ?? {};

    const validResolutions = ['freelancer_payout', 'client_refund', 'split'];
    if (typeof resolution !== 'string' || !validResolutions.includes(resolution)) {
      res.status(400).json({ error: `resolution must be one of: ${validResolutions.join(', ')}.` });
      return;
    }
    const validStates = ['Approved', 'Funds_Released', 'Draft', 'Pending_Deposit'];
    if (typeof resolvedState !== 'string' || !validStates.includes(resolvedState)) {
      res.status(400).json({ error: `resolvedState must be one of: ${validStates.join(', ')}.` });
      return;
    }

    const milestone = await getMilestone(req.params.id);
    if (!milestone) {
      res.status(404).json({ error: 'Milestone not found.' });
      return;
    }
    if (milestone.state !== 'Dispute') {
      res.status(400).json({ error: `Milestone is not under dispute (current state [${milestone.state}]).` });
      return;
    }

    // MFA-gated resolutions (payout / approval) require a token, mirroring the
    // FSM's high-value transition rules.
    const requiresMfa = resolvedState === 'Approved' || resolvedState === 'Funds_Released';
    if (requiresMfa && (typeof mfaToken !== 'string' || !mfaToken.trim())) {
      res.status(400).json({ error: `mfaToken is required to resolve a dispute into [${resolvedState}].`, code: 'MFA_REQUIRED' });
      return;
    }

    let result;
    try {
      result = await applyTransition(milestone.id, {
        toState: resolvedState as any,
        triggerUserId: req.auth!.sub,
        triggerUserRole: 'Arbitrator',
        expectedVersion: milestone.version,
        metadata: `Dispute resolved [${resolution}] → ${resolvedState}.`,
        mfaToken: requiresMfa ? mfaToken : undefined,
      });
    } catch (err) {
      if (err instanceof VersionMismatchError) {
        res.status(409).json({ error: err.message, code: 'VERSION_MISMATCH' });
        return;
      }
      if (err instanceof InvalidTransitionError) {
        res.status(422).json({ error: err.message, code: 'INVALID_TRANSITION' });
        return;
      }
      if (err instanceof MFARequiredError) {
        res.status(401).json({ error: err.message, code: 'MFA_REQUIRED' });
        return;
      }
      if (err instanceof Error && err.message.startsWith('MFA Verification Failed')) {
        res.status(401).json({ error: err.message, code: 'MFA_REQUIRED' });
        return;
      }
      throw err;
    }

    // Trigger the money movement implied by the resolution.
    let transfer: { success: boolean; transferId?: string } | undefined;
    let refund: { success: boolean; refundId?: string } | undefined;

    if (resolution === 'client_refund') {
      const amount =
        typeof refundAmount === 'number' && refundAmount > 0 ? refundAmount : milestone.amount;
      const r = await refundPayment(milestone.razorpayPaymentId || '', amount);
      refund = { success: r.success, refundId: r.refundId };
      result.milestone.razorpayRefundId = r.refundId;
    } else if (resolution === 'freelancer_payout' && resolvedState === 'Funds_Released') {
      const breakdown = calculateEarningsBreakdown(milestone.amount, 'FREE', 'IN');
      const t = await transferFundsToFreelancer(
        breakdown.netFreelancerEarnings,
        milestone.freelancerAccountId || '',
      );
      transfer = { success: t.success, transferId: t.transferId };
      result.milestone.razorpayTransferId = t.transferId;
    } else if (resolution === 'split' && typeof refundAmount === 'number' && refundAmount > 0) {
      const r = await refundPayment(milestone.razorpayPaymentId || '', refundAmount);
      refund = { success: r.success, refundId: r.refundId };
      result.milestone.razorpayRefundId = r.refundId;
    }

    const updated = { ...result.milestone, disputeStatus: 'resolved' as const };
    await getMilestoneRepository().save(updated);
    if (req.auth?.email) {
      notifyMilestoneEvent(refund ? 'refunded' : 'dispute_resolved', updated, req.auth.email);
    }

    res.json({ milestone: updated, auditBlock: result.block, transfer, refund });
  }),
);

app.post(
  '/api/webhooks/razorpay',
  asyncRoute(async (req, res) => {
    const signature = req.headers['x-razorpay-signature'] as string;
    const body = JSON.stringify(req.body);
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET || '';

    const isValid = verifyWebhookSignature(body, signature, webhookSecret);
    if (!isValid) {
      res.status(400).json({ error: 'Invalid webhook signature.' });
      return;
    }

    // Idempotency guard: Razorpay retries webhooks until it gets a 2xx, so the
    // same event can arrive many times. Skip anything we've already processed.
    const eventRepo = getWebhookEventRepository();
    const eventId =
      (req.headers['x-razorpay-event-id'] as string) ||
      `${(req.body?.event ?? 'unknown')}:${req.body?.payload?.payment?.entity?.id ?? randomUUID()}`;
    if (await eventRepo.hasProcessed(eventId)) {
      console.log(`[Webhook] Duplicate event ${eventId} ignored (already processed).`);
      res.json({ status: 'ok', deduplicated: true });
      return;
    }

    const { event, payload } = req.body ?? {};
    if (event === 'payment.captured') {
      const payment = payload.payment.entity;
      const orderId = payment.order_id;
      const paymentId = payment.id;

      const repo = getMilestoneRepository();
      const allMilestones = await repo.list();
      const milestone = allMilestones.find(m => m.razorpayOrderId === orderId);

      if (milestone && milestone.state === 'Pending_Deposit') {
        console.log(`[Webhook] Processing payment.captured for milestone ${milestone.id}`);
        const transitionResult = await applyTransition(milestone.id, {
          toState: 'Active',
          triggerUserId: 'system',
          triggerUserRole: 'System',
          expectedVersion: milestone.version,
          metadata: `Payment captured via webhook. Razorpay Payment ID: ${paymentId}`
        });
        const updated = {
          ...transitionResult.milestone,
          razorpayPaymentId: paymentId
        };
        await repo.save(updated);
      }
    } else if (event === 'payment.failed') {
      // STORY-05: A failed payment leaves the milestone in Pending_Deposit so
      // the client can retry funding. We only log and annotate — no transition.
      const payment = payload?.payment?.entity;
      const orderId = payment?.order_id;
      const repo = getMilestoneRepository();
      const milestone = (await repo.list()).find((m) => m.razorpayOrderId === orderId);
      console.warn(
        `[Webhook] payment.failed for order ${orderId}` +
          (milestone ? ` (milestone ${milestone.id}, kept in ${milestone.state})` : ' (no matching milestone)') +
          `. Reason: ${payment?.error_description ?? 'unknown'}`,
      );
    } else if (event === 'refund.processed') {
      // STORY-05: Confirm a refund we initiated (dispute resolved in client's
      // favor) actually settled, and stamp the refund id on the milestone.
      const refund = payload?.refund?.entity;
      const paymentId = refund?.payment_id;
      const repo = getMilestoneRepository();
      const milestone = (await repo.list()).find((m) => m.razorpayPaymentId === paymentId);
      if (milestone) {
        console.log(`[Webhook] refund.processed for milestone ${milestone.id} (refund ${refund?.id}).`);
        await repo.save({ ...milestone, razorpayRefundId: refund?.id });
      } else {
        console.warn(`[Webhook] refund.processed for payment ${paymentId} — no matching milestone.`);
      }
    } else if (event === 'transfer.processed') {
      // STORY-05: Confirm a Route payout to a freelancer settled.
      const transfer = payload?.transfer?.entity;
      const transferId = transfer?.id;
      const repo = getMilestoneRepository();
      const milestone = (await repo.list()).find((m) => m.razorpayTransferId === transferId);
      if (milestone) {
        console.log(`[Webhook] transfer.processed confirmed for milestone ${milestone.id} (transfer ${transferId}).`);
      } else {
        console.warn(`[Webhook] transfer.processed for transfer ${transferId} — no matching milestone.`);
      }
    } else {
      // STORY-05: Structured log for any event type we do not explicitly handle.
      console.log(`[Webhook] Unhandled event type received and acknowledged: ${event}`);
    }

    // Record the event only after successful handling so a transient failure
    // (which returns 5xx below via the error middleware) is retried by Razorpay.
    await eventRepo.markProcessed(eventId);

    res.json({ status: 'ok' });
  })
);

// ==========================================
// Real-time sync telemetry (the live socket is at ws://<host>/sync)
// ==========================================

let syncServerRef: SyncServer | null = null;

app.get('/api/sync/rooms/:proposalId', (req: Request, res: Response) => {
  const details = syncServerRef?.getRoomDetails(req.params.proposalId) ?? null;
  res.json({ room: details });
});

// ==========================================
// Overview — aggregated, per-user dashboard summary (real data)
// ==========================================

app.get(
  '/api/overview',
  requireAuth,
  asyncRoute(async (req, res) => {
    const userId = req.auth!.sub;
    const proposals = await getProposalRepository().listByUser(userId);
    const latest = proposals[0] ?? null;
    const milestones = latest ? await listMilestones(latest.proposalId) : [];

    const milestoneSummary = {
      total: milestones.length,
      funded: milestones.filter((m) => m.state === 'Active' || m.state === 'In_Review').length,
      released: milestones.filter((m) => m.state === 'Funds_Released').length,
    };

    res.json({
      user: { id: userId, email: req.auth!.email, role: req.auth!.role, name: req.auth!.name },
      counts: {
        proposals: proposals.length,
        milestones: milestoneSummary.total,
      },
      latestProposal: latest
        ? {
            proposalId: latest.proposalId,
            title: latest.title,
            createdAt: latest.createdAt,
            features: latest.proposal.features?.length ?? 0,
            risks: latest.proposal.risks?.length ?? 0,
            hasEvaluation: Boolean(latest.evaluation),
          }
        : null,
      // Full proposal history so the dashboard can list every past project.
      proposals: proposals.map((p) => ({
        proposalId: p.proposalId,
        title: p.title,
        briefText: p.briefText,
        createdAt: p.createdAt,
        features: p.proposal.features?.length ?? 0,
        risks: p.proposal.risks?.length ?? 0,
        hasEvaluation: Boolean(p.evaluation),
      })),
      milestoneSummary,
    });
  })
);

// ==========================================
// Error handling
// ==========================================

app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof AiServiceError) {
    console.error('AI service error:', err.message);
    res.status(err.status).json({ error: err.message });
    return;
  }
  if (err instanceof ClientMatchVersionMismatchError) {
    res.status(409).json({
      error: err.message,
      expectedVersion: err.expectedVersion,
      actualVersion: err.actualVersion,
    });
    return;
  }
  if (err instanceof InvalidClientMatchTransitionError) {
    res.status(409).json({ error: err.message });
    return;
  }
  if (err instanceof ClientMatchPermissionError) {
    // 403, not 409: the action is well-formed but belongs to the other party.
    res.status(403).json({ error: err.message, code: 'match_action_forbidden' });
    return;
  }
  // Client-side request faults raised by middleware (e.g. body-parser's
  // `entity.parse.failed` for malformed JSON) already carry a 4xx statusCode and
  // set `expose: true`. Honour it instead of reporting a caller's bad request as
  // a 500 server error, which hid real client bugs and polluted error logs.
  const exposed = err as Error & { statusCode?: number; status?: number; expose?: boolean };
  const exposedStatus = exposed.statusCode ?? exposed.status;
  if (exposed.expose === true && typeof exposedStatus === 'number' && exposedStatus >= 400 && exposedStatus < 500) {
    res.status(exposedStatus).json({ error: exposed.message || 'Malformed request.' });
    return;
  }
  console.error('Unhandled API error:', err);
  res.status(500).json({
    error: 'We could not complete that request right now. Please try again.',
  });
});

// Create a raw HTTP server so the WebSocket sync server can share the same port.
const server = createServer(app);
syncServerRef = new SyncServer(server);

server.listen(PORT, () => {
  console.log(`FixFlowAI backend listening on http://localhost:${PORT}`);
  console.log(`  REST API   : http://localhost:${PORT}/api`);
  console.log(`  Sync socket: ws://localhost:${PORT}/sync`);
  console.log(`  AI features ${isAiServiceConfigured() ? `ENABLED (proxy → ${process.env.AI_SERVICE_URL})` : 'DISABLED (set AI_SERVICE_URL)'}`);
  logEmailTransportStatus();
  startKeepAliveService();
});

export { app, server };
