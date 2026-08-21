import { Router, Request, Response, NextFunction } from 'express';
import { requireAuth } from '../auth/middleware.js';
import { requireRole } from '../auth/roles.js';
import { verifyAccessToken } from '../auth/tokens.js';
import { getGithubScanRepository } from '../services/githubScanRepository.js';
import { enqueueGithubScan, subscribeToScan } from '../services/githubScanService.js';
import { isAiServiceConfigured } from '../services/aiClient.js';
import { getUserRepository } from '../services/userRepository.js';
import { createLinkedAccount } from '../services/paymentService.js';
import { getProposalRepository, type StoredProposal } from '../services/proposalRepository.js';
import {
  transitionClientMatch,
  verifyClientMatchAudit,
  type ClientMatchCandidate,
} from '../services/clientMatchWorkflow.js';
import { notifyInvitationResponse } from '../services/emailService.js';
import type { SegmentStatus } from '../types/github.js';
import { z } from 'zod';

/**
 * Freelancer routes (roles/01).
 *   GET   /api/freelancer/profile               — verified skills/projects/confidence (read-only)
 *   POST  /api/freelancer/scan/rescan           — trigger a fresh on-demand GitHub re-analysis
 *   GET   /api/freelancer/scan/:jobId           — scan job status (polling fallback)
 *   GET   /api/freelancer/scan/:jobId/stream    — live SSE of segment reveals
 *   GET   /api/freelancer/invitations           — project invitations addressed to me
 *   PATCH /api/freelancer/invitations/:proposalId — accept or decline one invitation
 *
 * Skills are AI-derived and tamper-proof: there is intentionally NO write
 * endpoint for them. They change only via a re-scan.
 */

const asyncRoute =
  (h: (req: Request, res: Response) => Promise<void>) =>
  (req: Request, res: Response, next: NextFunction) =>
    h(req, res).catch(next);

export const freelancerRouter = Router();

// ─────────────────── Project invitations (two-sided hiring) ───────────
//
// A client can only ever OFFER. Moving into the project requires the
// freelancer's own accept, which is why these two endpoints exist and are
// guarded by requireRole('freelancer').

const InvitationResponseSchema = z.object({
  action: z.enum(['accept', 'decline']),
  expectedVersion: z.number().int().positive(),
});

/** Statuses a freelancer is allowed to see in their own invitation inbox. */
const VISIBLE_TO_FREELANCER = new Set([
  'invited',
  'accepted',
  'declined',
  'interviewing',
  'selected',
]);

/**
 * Redact a proposal down to what an invited freelancer may see.
 *
 * Deliberately excludes the full brief, parsed features/timeline/risks, the
 * confidence evaluation, and every other candidate. An invitation is an
 * introduction, not disclosure of the client's whole project file.
 */
function toInvitationDto(
  proposal: StoredProposal,
  candidate: ClientMatchCandidate,
  clientName: string,
) {
  return {
    proposalId: proposal.proposalId,
    projectTitle: proposal.title || 'Untitled project',
    // Short brief only — same 500-char budget as the invitation email.
    brief: (proposal.briefText || '').slice(0, 500),
    briefTruncated: (proposal.briefText || '').length > 500,
    skills: (proposal.proposal?.features || [])
      .map((f: { area?: string; title?: string }) => f.area || f.title || '')
      .filter(Boolean)
      .slice(0, 10),
    clientName,
    status: candidate.status,
    invitedAt: candidate.updatedAt,
    // The freelancer sees only their OWN match score, never the ranking.
    matchScore: Math.round(candidate.compositeScore),
    fitReasons: candidate.fitReasons.slice(0, 3),
    // Needed so the response PATCH can use optimistic concurrency.
    expectedVersion: proposal.clientMatchWorkflow!.version,
  };
}

/** Every invitation addressed to the authenticated freelancer. */
freelancerRouter.get(
  '/invitations',
  requireAuth,
  requireRole('freelancer'),
  asyncRoute(async (req, res) => {
    const freelancerId = req.auth!.sub;
    const proposals = await getProposalRepository().listByCandidateFreelancer(freelancerId);
    const userRepo = getUserRepository();

    const invitations = [];
    for (const proposal of proposals) {
      const workflow = proposal.clientMatchWorkflow;
      if (!workflow) continue;
      // Never surface a tampered hiring history to either party.
      if (!verifyClientMatchAudit(workflow)) continue;

      const candidate = workflow.candidates.find((c) => c.freelancerId === freelancerId);
      if (!candidate || !VISIBLE_TO_FREELANCER.has(candidate.status)) continue;

      const client = await userRepo.findById(proposal.userId);
      invitations.push(
        toInvitationDto(proposal, candidate, client?.name || 'A client'),
      );
    }

    res.json({ invitations });
  }),
);

/**
 * Accept or decline one invitation. This is the ONLY way a candidate leaves the
 * `invited` state toward the project, and only the invited freelancer can call it.
 */
freelancerRouter.patch(
  '/invitations/:proposalId',
  requireAuth,
  requireRole('freelancer'),
  asyncRoute(async (req, res) => {
    const parsed = InvitationResponseSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid invitation response.', details: parsed.error.flatten() });
      return;
    }

    const freelancerId = req.auth!.sub;
    const repo = getProposalRepository();
    const proposal = await repo.get(req.params.proposalId);

    // Authorization: the invitation must exist AND name this freelancer. A
    // 404 (not 403) avoids confirming that someone else's project exists.
    const workflow = proposal?.clientMatchWorkflow;
    const candidate = workflow?.candidates.find((c) => c.freelancerId === freelancerId);
    if (!proposal || !workflow || !candidate) {
      res.status(404).json({ error: 'Invitation not found.' });
      return;
    }
    if (candidate.status !== 'invited') {
      res.status(409).json({
        error: `This invitation is already ${candidate.status}.`,
        status: candidate.status,
      });
      return;
    }

    // The FSM + permission matrix enforce that only a freelancer may do this.
    const next = transitionClientMatch(
      workflow,
      freelancerId,
      parsed.data.action,
      parsed.data.expectedVersion,
      freelancerId,
      'freelancer',
    );
    const updated = await repo.setClientMatchWorkflow(
      proposal.proposalId,
      next,
      workflow.version,
    );

    // Fire-and-forget: tell the client which way it went. Never blocks the response.
    void (async () => {
      try {
        const userRepo = getUserRepository();
        const client = await userRepo.findById(proposal.userId);
        if (client?.email) {
          notifyInvitationResponse(
            {
              clientName: client.name || 'there',
              freelancerName: candidate.name,
              projectTitle: proposal.title || 'your project',
              accepted: parsed.data.action === 'accept',
            },
            client.email,
          );
        }
      } catch (err) {
        console.error('[EMAIL] Failed to send invitation response email:', (err as Error).message);
      }
    })();

    const saved = updated?.clientMatchWorkflow ?? next;
    const savedCandidate = saved.candidates.find((c) => c.freelancerId === freelancerId)!;
    res.json({
      invitation: toInvitationDto({ ...proposal, clientMatchWorkflow: saved }, savedCandidate, 'A client'),
    });
  }),
);

freelancerRouter.get(
  '/profile',
  requireAuth,
  requireRole('freelancer'),
  asyncRoute(async (req, res) => {
    const profile = await getGithubScanRepository().getProfile(req.auth!.sub);
    res.json(profile);
  }),
);

/**
 * Trigger an on-demand re-analysis of the freelancer's GitHub profile.
 *
 * This is the ONLY place (besides first-time sign-up) where the GitHub API is
 * called — returning users are never auto-scanned on login. We reuse the
 * server-side stored OAuth token so the freelancer doesn't have to re-auth.
 */
freelancerRouter.post(
  '/scan/rescan',
  requireAuth,
  requireRole('freelancer'),
  asyncRoute(async (req, res) => {
    if (!isAiServiceConfigured()) {
      res.status(503).json({ error: 'AI service is not configured; cannot run a scan.' });
      return;
    }

    const user = await getUserRepository().findById(req.auth!.sub);
    if (!user || !user.githubUsername) {
      res.status(400).json({
        error: 'No GitHub account is linked to this profile.',
        code: 'github_not_linked',
      });
      return;
    }
    if (!user.githubAccessToken) {
      // Token predates this feature (or was cleared). A fresh GitHub sign-in
      // will re-store it. Fail clearly instead of silently 500-ing downstream.
      res.status(409).json({
        error: 'Please sign in with GitHub again to enable re-analysis.',
        code: 'github_token_missing',
      });
      return;
    }

    const jobId = await enqueueGithubScan(
      user.id,
      user.githubUsername,
      user.githubAccessToken,
    );
    res.json({ scanJobId: jobId, githubUsername: user.githubUsername });
  }),
);

/**
 * Razorpay Route payout onboarding.
 *   POST /api/freelancer/razorpay-account  — create/link a Razorpay Route
 *   linked account (acc_xxxx) so milestone releases can be routed to the
 *   freelancer's bank account. Returns the (non-secret) account id.
 *
 * Bank details are forwarded to Razorpay and never persisted in our store —
 * only the resulting linked-account id is saved on the user record.
 */
freelancerRouter.post(
  '/razorpay-account',
  requireAuth,
  requireRole('freelancer'),
  asyncRoute(async (req, res) => {
    const repo = getUserRepository();
    const user = await repo.findById(req.auth!.sub);
    if (!user) {
      res.status(404).json({ error: 'User not found.' });
      return;
    }
    if (user.razorpayAccountId) {
      res.status(200).json({
        accountId: user.razorpayAccountId,
        alreadyLinked: true,
      });
      return;
    }

    const {
      legalBusinessName,
      ifscCode,
      accountNumber,
      beneficiaryName,
      contactName,
      phone,
    } = req.body ?? {};

    if (typeof legalBusinessName !== 'string' || !legalBusinessName.trim()) {
      res.status(400).json({ error: 'legalBusinessName is required.' });
      return;
    }

    const result = await createLinkedAccount({
      email: user.email,
      name: user.name,
      legalBusinessName,
      ifscCode: typeof ifscCode === 'string' ? ifscCode : undefined,
      accountNumber: typeof accountNumber === 'string' ? accountNumber : undefined,
      beneficiaryName: typeof beneficiaryName === 'string' ? beneficiaryName : undefined,
      contactName: typeof contactName === 'string' ? contactName : undefined,
      phone: typeof phone === 'string' ? phone : undefined,
    });

    if (!result.success || !result.accountId) {
      res.status(502).json({
        error: 'Failed to create Razorpay linked account.',
        detail: result.error,
      });
      return;
    }

    const updated = await repo.setRazorpayAccountId(user.id, result.accountId);
    res.status(201).json({
      accountId: result.accountId,
      isSimulated: result.isSimulated,
      user: updated
        ? { id: updated.id, razorpayAccountId: updated.razorpayAccountId }
        : undefined,
    });
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
