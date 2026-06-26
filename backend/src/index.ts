import 'dotenv/config';
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
// Error handling
// ==========================================

app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error('Unhandled API error:', err);
  res.status(500).json({ error: err.message || 'Internal server error.' });
});

app.listen(PORT, () => {
  console.log(`FixFlowAI backend listening on http://localhost:${PORT}`);
  console.log(`  AI features ${GEMINI_API_KEY.trim() ? 'ENABLED' : 'DISABLED (set GEMINI_API_KEY)'}`);
});

export { app };
