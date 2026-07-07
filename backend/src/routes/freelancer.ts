import { Router, Request, Response, NextFunction } from 'express';
import { requireAuth } from '../auth/middleware.js';
import { requireRole } from '../auth/roles.js';
import { verifyAccessToken } from '../auth/tokens.js';
import { getGithubScanRepository } from '../services/githubScanRepository.js';
import { subscribeToScan } from '../services/githubScanService.js';
import type { SegmentStatus } from '../types/github.js';

/**
 * Freelancer routes (roles/01).
 *   GET /api/freelancer/profile               — verified skills/projects/confidence (read-only)
 *   GET /api/freelancer/scan/:jobId           — scan job status (polling fallback)
 *   GET /api/freelancer/scan/:jobId/stream    — live SSE of segment reveals
 *
 * Skills are AI-derived and tamper-proof: there is intentionally NO write
 * endpoint for them. They change only via a re-scan.
 */

const asyncRoute =
  (h: (req: Request, res: Response) => Promise<void>) =>
  (req: Request, res: Response, next: NextFunction) =>
    h(req, res).catch(next);

export const freelancerRouter = Router();

freelancerRouter.get(
  '/profile',
  requireAuth,
  requireRole('freelancer'),
  asyncRoute(async (req, res) => {
    const profile = await getGithubScanRepository().getProfile(req.auth!.sub);
    res.json(profile);
  }),
);

freelancerRouter.get(
  '/scan/:jobId',
  requireAuth,
  requireRole('freelancer'),
  asyncRoute(async (req, res) => {
    const job = await getGithubScanRepository().getJob(req.params.jobId);
    if (!job || job.freelancerId !== req.auth!.sub) {
      res.status(404).json({ error: 'Scan job not found.' });
      return;
    }
    res.json({ job });
  }),
);

/**
 * SSE stream of segment reveals. EventSource cannot set Authorization headers,
 * so the access token is accepted as a `?token=` query param (same pattern as
 * the proposal stream in the ERD doc).
 */
freelancerRouter.get(
  '/scan/:jobId/stream',
  asyncRoute(async (req, res) => {
    // --- auth (query token or bearer header) ---
    const token =
      (typeof req.query.token === 'string' && req.query.token) ||
      (req.headers.authorization?.split(' ')[1] ?? '');
    let claims;
    try {
      claims = verifyAccessToken(token);
    } catch {
      res.status(401).json({ error: 'Invalid or missing access token.' });
      return;
    }
    if (claims.role !== 'freelancer') {
      res.status(403).json({ error: 'forbidden_for_role' });
      return;
    }

    const repo = getGithubScanRepository();
    const job = await repo.getJob(req.params.jobId);
    if (!job || job.freelancerId !== claims.sub) {
      res.status(404).json({ error: 'Scan job not found.' });
      return;
    }

    // --- open the SSE channel ---
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    (res as any).flushHeaders?.();

    const send = (event: string, data: unknown) => {
      res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    };
    send('connected', { jobId: job.jobId });

    // --- snapshot: replay segments that already finished (late-join safety) ---
    const profile = await repo.getProfile(claims.sub);
    const seg: SegmentStatus = job.segmentStatus;
    const done = (s: string) => s === 'done' || s === 'fallback' || s === 'error';
    if (done(seg.experience) && job.experience) {
      send('segment_ready', { segment: 'experience', state: seg.experience, payload: job.experience });
    }
    if (done(seg.skills)) {
      send('segment_ready', { segment: 'skills', state: seg.skills, payload: profile.skills });
    }
    if (done(seg.projects)) {
      send('segment_ready', { segment: 'projects', state: seg.projects, payload: profile.projects });
    }

    // If already finished, emit completion and close.
    if (job.status === 'complete' || job.status === 'failed') {
      send(job.status === 'failed' ? 'scan_error' : 'scan_complete', {
        confidence: profile.confidence,
        segmentStatus: seg,
        error: job.error ?? undefined,
      });
      res.end();
      return;
    }

    // --- live: subscribe to the in-process bus for the rest ---
    const unsubscribe = subscribeToScan(job.jobId, ({ event, data }) => {
      send(event, data);
      if (event === 'scan_complete' || event === 'scan_error') {
        cleanup();
        res.end();
      }
    });

    const heartbeat = setInterval(() => res.write(': ping\n\n'), 15000);

    function cleanup() {
      clearInterval(heartbeat);
      unsubscribe();
    }
    req.on('close', cleanup);
  }),
);
