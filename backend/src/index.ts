import 'dotenv/config';
import { createServer } from 'http';
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';

import {
  parseBrief,
  evaluateProposal,
  generateInterviewQuestions,
  generateContractExtensions,
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
import { getProposalRepository } from './services/proposalRepository.js';
import { authRouter } from './routes/auth.js';
import { freelancerRouter } from './routes/freelancer.js';
import { requireAuth } from './auth/middleware.js';
import { SyncServer } from './skills/syncServer.js';
import {
  createMilestone,
  getMilestone,
  listMilestones,
  applyTransition,
  getAuditChain,
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
} from './services/paymentService.js';

const app = express();
const PORT = Number(process.env.PORT) || 4000;

app.use(cors());
app.use(express.json({ limit: '2mb' }));

// Mount authentication routes. They live at /api/auth/* and are intentionally
// public — they're the entry point that issues access tokens to the rest of
// the API. Other routes can opt in to protection with the `requireAuth`
// middleware from ./auth/middleware.
app.use('/api/auth', authRouter);

// Freelancer routes (roles/01): verified profile + GitHub scan status/stream.
app.use('/api/freelancer', freelancerRouter);

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
    const proposal = await parseBrief(briefText);
    // Persist the parsed proposal under the authenticated user.
    const stored = await getProposalRepository().create({
      userId: req.auth!.sub,
      briefText,
      proposal,
    });
    res.json({ proposal, proposalId: stored.proposalId });
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
    res.json(result);
  })
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
// AI-006: Freelancer ↔ Client Matching (deterministic, no key required)
// ==========================================

app.post(
  '/api/leads/match',
  requireAuth,
  asyncRoute(async (req, res) => {
    const { requiredSkills = [], budget, limit, domains } = req.body ?? {};
    if (!Array.isArray(requiredSkills)) {
      res.status(400).json({ error: 'requiredSkills must be an array of strings.' });
      return;
    }
    // Roster comes from the repository layer (seed file / HTTP API / future DB),
    // never hardcoded in the engine.
    const roster = await getFreelancerRepository().listActiveFreelancers();
    res.json(
      generateShortlist(
        {
          requiredSkills,
          budget: typeof budget === 'number' ? budget : undefined,
          limit: typeof limit === 'number' ? limit : undefined,
          domains: Array.isArray(domains) ? domains : undefined,
        },
        roster,
      ),
    );
  }),
);

// ==========================================
// Escrow State Machine (milestones + cryptographic audit trail)
// ==========================================

app.post(
  '/api/escrow/milestones',
  requireAuth,
  asyncRoute(async (req, res) => {
    const { proposalId, title, amount } = req.body ?? {};
    if (typeof proposalId !== 'string' || !proposalId.trim()) {
      res.status(400).json({ error: 'proposalId is required.' });
      return;
    }
    if (typeof title !== 'string' || !title.trim()) {
      res.status(400).json({ error: 'title is required.' });
      return;
    }
    if (typeof amount !== 'number' || amount < 0) {
      res.status(400).json({ error: 'amount is required and must be a non-negative number.' });
      return;
    }
    res.status(201).json(await createMilestone({ proposalId, title, amount }));
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

app.post(
  '/api/escrow/milestones/:id/transition',
  requireAuth,
  asyncRoute(async (req, res) => {
    const {
      toState,
      triggerUserId,
      triggerUserRole,
      expectedVersion,
      metadata,
      mfaToken,
    } = req.body ?? {};

    if (typeof toState !== 'string') {
      res.status(400).json({ error: 'toState is required.' });
      return;
    }
    if (typeof triggerUserId !== 'string' || !triggerUserId.trim()) {
      res.status(400).json({ error: 'triggerUserId is required.' });
      return;
    }
    if (typeof expectedVersion !== 'number') {
      res.status(400).json({ error: 'expectedVersion (number) is required for concurrency control.' });
      return;
    }

    try {
      const result = await applyTransition(req.params.id, {
        toState: toState as any,
        triggerUserId,
        triggerUserRole: (triggerUserRole as any) || 'System',
        expectedVersion,
        metadata,
        mfaToken,
      });
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
    const { razorpayPaymentId, razorpayOrderId, razorpaySignature } = req.body ?? {};
    if (!razorpayPaymentId || !razorpayOrderId || !razorpaySignature) {
      res.status(400).json({ error: 'razorpayPaymentId, razorpayOrderId, and razorpaySignature are required.' });
      return;
    }

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
      res.json({ milestone: updated });
    } else if (milestone.state === 'Active') {
      res.json({ milestone });
    } else {
      res.status(400).json({ error: `Cannot verify payment for milestone in state [${milestone.state}].` });
    }
  })
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
    }

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
  console.error('Unhandled API error:', err);
  res.status(500).json({ error: err.message || 'Internal server error.' });
});

// Create a raw HTTP server so the WebSocket sync server can share the same port.
const server = createServer(app);
syncServerRef = new SyncServer(server);

server.listen(PORT, () => {
  console.log(`FixFlowAI backend listening on http://localhost:${PORT}`);
  console.log(`  REST API   : http://localhost:${PORT}/api`);
  console.log(`  Sync socket: ws://localhost:${PORT}/sync`);
  console.log(`  AI features ${isAiServiceConfigured() ? `ENABLED (proxy → ${process.env.AI_SERVICE_URL})` : 'DISABLED (set AI_SERVICE_URL)'}`);
});

export { app, server };
