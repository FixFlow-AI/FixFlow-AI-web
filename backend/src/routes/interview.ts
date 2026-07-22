import { Router, Request, Response, NextFunction } from 'express';
import { requireAuth } from '../auth/middleware.js';
import { requireRole } from '../auth/roles.js';
import { getInterviewRepository } from '../services/interviewRepository.js';
import {
  authorQuestionSet,
  startApplication,
  recordPermissions,
  recordProctorEvent,
  submitInterview,
  InterviewError,
} from '../services/interviewService.js';
import type { ProctorEventType, ProctorSeverity } from '../types/interview.js';

/**
 * Proctored interview-gate routes.
 *
 * Client (job owner):
 *   POST /api/interview/jobs/:jobId/questions      author/update the screening interview
 *   GET  /api/interview/jobs/:jobId/questions      full set incl. answer keys (owner only)
 *   GET  /api/interview/jobs/:jobId/applications   applications + scores for this job
 *
 * Freelancer (candidate):
 *   POST /api/interview/jobs/:jobId/apply          start a proctored attempt (blocked if banned)
 *   GET  /api/interview/sessions/:sessionId        session status
 *   POST /api/interview/sessions/:sessionId/permissions   device + camera/mic gate
 *   POST /api/interview/sessions/:sessionId/events        proctoring signal (server-authoritative)
 *   POST /api/interview/sessions/:sessionId/submit        submit answers → auto-score
 *   GET  /api/interview/applications               my applications
 */

const asyncRoute =
  (h: (req: Request, res: Response) => Promise<void>) =>
  (req: Request, res: Response, next: NextFunction) =>
    h(req, res).catch(next);

/** Turn an InterviewError into its HTTP response; rethrow anything else. */
function handle(res: Response, err: unknown): void {
  if (err instanceof InterviewError) {
    res.status(err.status).json({ error: err.message, code: err.code });
    return;
  }
  throw err;
}

export const interviewRouter = Router();

// ─────────────────────────── Client: author ───────────────────────────

interviewRouter.post(
  '/jobs/:jobId/questions',
  requireAuth,
  requireRole('client'),
  asyncRoute(async (req, res) => {
    try {
      const set = await authorQuestionSet(req.auth!.sub, req.params.jobId, req.body ?? {});
      res.json({ questionSet: set });
    } catch (err) {
      handle(res, err);
    }
  }),
);

interviewRouter.get(
  '/jobs/:jobId/questions',
  requireAuth,
  requireRole('client'),
  asyncRoute(async (req, res) => {
    const set = await getInterviewRepository().getQuestionSet(req.params.jobId);
    if (!set) {
      res.status(404).json({ error: 'No screening interview for this job.', code: 'no_question_set' });
      return;
    }
    if (set.clientId !== req.auth!.sub) {
      res.status(403).json({ error: 'You do not own this job.', code: 'not_job_owner' });
      return;
    }
    res.json({ questionSet: set });
  }),
);

interviewRouter.get(
  '/jobs/:jobId/applications',
  requireAuth,
  requireRole('client'),
  asyncRoute(async (req, res) => {
    const repo = getInterviewRepository();
    const set = await repo.getQuestionSet(req.params.jobId);
    if (set && set.clientId !== req.auth!.sub) {
      res.status(403).json({ error: 'You do not own this job.', code: 'not_job_owner' });
      return;
    }
    const applications = await repo.listApplicationsByJob(req.params.jobId);
    res.json({ applications });
  }),
);

// ─────────────────────────── Freelancer: apply/session ─────────────────

interviewRouter.post(
  '/jobs/:jobId/apply',
  requireAuth,
  requireRole('freelancer'),
  asyncRoute(async (req, res) => {
    try {
      const result = await startApplication(req.auth!.sub, req.params.jobId);
      res.json(result);
    } catch (err) {
      handle(res, err);
    }
  }),
);

interviewRouter.get(
  '/sessions/:sessionId',
  requireAuth,
  requireRole('freelancer'),
  asyncRoute(async (req, res) => {
    const session = await getInterviewRepository().getSession(req.params.sessionId);
    if (!session || session.freelancerId !== req.auth!.sub) {
      res.status(404).json({ error: 'Interview session not found.', code: 'session_not_found' });
      return;
    }
    res.json({ session });
  }),
);

interviewRouter.post(
  '/sessions/:sessionId/permissions',
  requireAuth,
  requireRole('freelancer'),
  asyncRoute(async (req, res) => {
    try {
      const b = req.body ?? {};
      const session = await recordPermissions(req.auth!.sub, req.params.sessionId, {
        cameraGranted: Boolean(b.cameraGranted),
        micGranted: Boolean(b.micGranted),
        wideAngleAcknowledged: Boolean(b.wideAngleAcknowledged),
        deviceType: b.deviceType ?? 'unknown',
        isDesktopClass: Boolean(b.isDesktopClass),
        screenWidth: Number(b.screenWidth) || 0,
        screenHeight: Number(b.screenHeight) || 0,
        userAgent: String(b.userAgent ?? ''),
      });
      res.json({ session });
    } catch (err) {
      handle(res, err);
    }
  }),
);

interviewRouter.post(
  '/sessions/:sessionId/events',
  requireAuth,
  requireRole('freelancer'),
  asyncRoute(async (req, res) => {
    try {
      const b = req.body ?? {};
      const result = await recordProctorEvent(
        req.auth!.sub,
        req.params.sessionId,
        b.type as ProctorEventType,
        typeof b.detail === 'string' ? b.detail : undefined,
        b.severity as ProctorSeverity | undefined,
      );
      res.json(result);
    } catch (err) {
      handle(res, err);
    }
  }),
);

interviewRouter.post(
  '/sessions/:sessionId/submit',
  requireAuth,
  requireRole('freelancer'),
  asyncRoute(async (req, res) => {
    try {
      const answers = Array.isArray(req.body?.answers) ? req.body.answers : [];
      const result = await submitInterview(req.auth!.sub, req.params.sessionId, answers);
      res.json(result);
    } catch (err) {
      handle(res, err);
    }
  }),
);

interviewRouter.get(
  '/applications',
  requireAuth,
  requireRole('freelancer'),
  asyncRoute(async (req, res) => {
    const applications = await getInterviewRepository().listApplicationsByFreelancer(req.auth!.sub);
    res.json({ applications });
  }),
);
