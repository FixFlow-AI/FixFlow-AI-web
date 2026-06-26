import 'dotenv/config';
import { createServer } from 'http';
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';

import { parseBrief } from './skills/briefParser.js';
import { processConfidenceGrid } from './skills/confidenceGrid.js';
import { generateInterviewQuestions } from './skills/interviewGenerator.js';
import { generateContractExtensions } from './skills/contextExtensions.js';
import { calculateEarningsBreakdown } from './skills/earningsCalculator.js';
import {
  calculateReputationMetrics,
  buildSBTMetadata,
} from './skills/reputationCalculator.js';
import { calculateClientScore } from './skills/clientScoring.js';
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

const app = express();
const PORT = Number(process.env.PORT) || 4000;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-pro';

app.use(cors());
app.use(express.json({ limit: '2mb' }));

/**
 * Small wrapper so async route handlers forward errors to the error middleware
 * instead of crashing the process on an unhandled rejection.
 */
const asyncRoute =
  (handler: (req: Request, res: Response) => Promise<void>) =>
  (req: Request, res: Response, next: NextFunction) => {
    handler(req, res).catch(next);
  };

/** Guards AI endpoints that require a Gemini key. Returns true if the request can proceed. */
function requireGeminiKey(res: Response): boolean {
  if (!GEMINI_API_KEY.trim()) {
    res.status(503).json({
      error: 'GEMINI_API_KEY is not configured on the server.',
      hint: 'Copy backend/.env.example to backend/.env and set GEMINI_API_KEY.',
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
    aiEnabled: Boolean(GEMINI_API_KEY.trim()),
    model: GEMINI_MODEL,
    time: new Date().toISOString(),
  });
});

// ==========================================
// Subsystem 1: Semantic Brief Parsing
// ==========================================

app.post(
  '/api/proposals/parse',
  asyncRoute(async (req, res) => {
    if (!requireGeminiKey(res)) return;
    const { briefText } = req.body ?? {};
    if (typeof briefText !== 'string' || !briefText.trim()) {
      res.status(400).json({ error: 'briefText is required and must be a non-empty string.' });
      return;
    }
    const proposal = await parseBrief(briefText, GEMINI_API_KEY, GEMINI_MODEL);
    res.json({ proposal });
  })
);

// ==========================================
// Subsystem 2: Confidence Grid (multi-agent evaluation + self-correction)
// ==========================================

app.post(
  '/api/proposals/evaluate',
  asyncRoute(async (req, res) => {
    if (!requireGeminiKey(res)) return;
    const { briefText, proposal } = req.body ?? {};
    if (typeof briefText !== 'string' || !briefText.trim()) {
      res.status(400).json({ error: 'briefText is required and must be a non-empty string.' });
      return;
    }
    if (!proposal || typeof proposal !== 'object') {
      res.status(400).json({ error: 'proposal object is required.' });
      return;
    }
    const result = await processConfidenceGrid(briefText, proposal, GEMINI_API_KEY, GEMINI_MODEL);
    res.json(result);
  })
);

// ==========================================
// Interview Vetting Generator
// ==========================================

app.post(
  '/api/interview-questions',
  asyncRoute(async (req, res) => {
    if (!requireGeminiKey(res)) return;
    const { briefText, githubScan = '', missingSkills = [] } = req.body ?? {};
    if (typeof briefText !== 'string' || !briefText.trim()) {
      res.status(400).json({ error: 'briefText is required and must be a non-empty string.' });
      return;
    }
    const output = await generateInterviewQuestions(
      briefText,
      githubScan,
      Array.isArray(missingSkills) ? missingSkills : [],
      GEMINI_API_KEY,
      GEMINI_MODEL
    );
    res.json(output);
  })
);

// ==========================================
// Contextual Contract Extensions
// ==========================================

app.post(
  '/api/contract-extensions',
  asyncRoute(async (req, res) => {
    if (!requireGeminiKey(res)) return;
    const { completedDeliverables = '', chatSummary = '' } = req.body ?? {};
    const output = await generateContractExtensions(
      completedDeliverables,
      String(chatSummary),
      GEMINI_API_KEY,
      GEMINI_MODEL
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
// Escrow State Machine (milestones + cryptographic audit trail)
// ==========================================

app.post('/api/escrow/milestones', (req: Request, res: Response) => {
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
  res.status(201).json(createMilestone({ proposalId, title, amount }));
});

app.get('/api/escrow/milestones', (req: Request, res: Response) => {
  const proposalId = typeof req.query.proposalId === 'string' ? req.query.proposalId : undefined;
  res.json({ milestones: listMilestones(proposalId) });
});

app.get('/api/escrow/milestones/:id', (req: Request, res: Response) => {
  const milestone = getMilestone(req.params.id);
  if (!milestone) {
    res.status(404).json({ error: 'Milestone not found.' });
    return;
  }
  res.json(milestone);
});

app.get('/api/escrow/milestones/:id/audit', (req: Request, res: Response) => {
  if (!getMilestone(req.params.id)) {
    res.status(404).json({ error: 'Milestone not found.' });
    return;
  }
  res.json(getAuditChain(req.params.id));
});

app.post('/api/escrow/milestones/:id/transition', (req: Request, res: Response) => {
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
    const result = applyTransition(req.params.id, {
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
});

// ==========================================
// Real-time sync telemetry (the live socket is at ws://<host>/sync)
// ==========================================

let syncServerRef: SyncServer | null = null;

app.get('/api/sync/rooms/:proposalId', (req: Request, res: Response) => {
  const details = syncServerRef?.getRoomDetails(req.params.proposalId) ?? null;
  res.json({ room: details });
});

// ==========================================
// Error handling
// ==========================================

app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
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
  console.log(`  AI features ${GEMINI_API_KEY.trim() ? 'ENABLED' : 'DISABLED (set GEMINI_API_KEY)'}`);
});

export { app, server };
