import { randomUUID } from 'crypto';
import { getInterviewRepository } from './interviewRepository.js';
import { getProposalRepository } from './proposalRepository.js';
import type {
  InterviewQuestionSet,
  InterviewQuestionSpec,
  JobApplication,
  InterviewSession,
  PublicInterviewQuestion,
  ProctorEvent,
  ProctorSeverity,
  ProctorEventType,
  SessionPermissions,
  SubmittedAnswer,
  QuestionType,
} from '../types/interview.js';

/**
 * Business logic for the proctored interview gate. Pure orchestration over the
 * interview repository + deterministic auto-scoring. Every mutation persists to
 * DynamoDB (via the repository) so no state is lost across restarts.
 */

export class InterviewError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
  ) {
    super(message);
    this.name = 'InterviewError';
  }
}

const DEFAULT_MAX_WARNINGS = 3;

// ─────────────────────────── Client: author questions ──────────────────────

export interface AuthorQuestionSetInput {
  jobDescription: string;
  roleDescription: string;
  questions: Array<Omit<InterviewQuestionSpec, 'questionId'> & { questionId?: string }>;
  passThresholdPct?: number;
  timeLimitSec?: number;
  requireCamera?: boolean;
  requireMicrophone?: boolean;
  requireFullscreen?: boolean;
  desktopOnly?: boolean;
  maxWarnings?: number;
}

/** Client authors/updates the screening interview for one of their jobs (proposals). */
export async function authorQuestionSet(
  clientId: string,
  jobId: string,
  input: AuthorQuestionSetInput,
): Promise<InterviewQuestionSet> {
  const proposal = await getProposalRepository().get(jobId);
  if (!proposal) throw new InterviewError('Job (proposal) not found.', 404, 'job_not_found');
  if (proposal.userId !== clientId) {
    throw new InterviewError('You do not own this job.', 403, 'not_job_owner');
  }
  if (!Array.isArray(input.questions) || input.questions.length === 0) {
    throw new InterviewError('At least one question is required.', 400, 'no_questions');
  }

  const questions: InterviewQuestionSpec[] = input.questions.map((q) => normalizeQuestion(q));
  const totalMaxScore = questions.reduce((sum, q) => sum + (q.maxScore || 0), 0);
  if (totalMaxScore <= 0) {
    throw new InterviewError('Total score must be greater than zero.', 400, 'invalid_scores');
  }

  const repo = getInterviewRepository();
  const existing = await repo.getQuestionSet(jobId);
  const now = new Date().toISOString();
  const set: InterviewQuestionSet = {
    jobId,
    clientId,
    title: proposal.title || 'Screening interview',
    jobDescription: input.jobDescription ?? '',
    roleDescription: input.roleDescription ?? '',
    questions,
    totalMaxScore,
    passThresholdPct: clamp(input.passThresholdPct ?? 60, 0, 100),
    timeLimitSec: Math.max(0, Math.floor(input.timeLimitSec ?? 0)),
    requireCamera: input.requireCamera ?? true,
    requireMicrophone: input.requireMicrophone ?? true,
    requireFullscreen: input.requireFullscreen ?? true,
    desktopOnly: input.desktopOnly ?? true,
    maxWarnings: Math.max(1, input.maxWarnings ?? DEFAULT_MAX_WARNINGS),
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
    version: (existing?.version ?? 0) + 1,
  };
  await repo.saveQuestionSet(set);
  return set;
}

function normalizeQuestion(
  q: Omit<InterviewQuestionSpec, 'questionId'> & { questionId?: string },
): InterviewQuestionSpec {
  const type = q.type as QuestionType;
  if (!['mcq', 'acq', 'text'].includes(type)) {
    throw new InterviewError(`Invalid question type: ${q.type}`, 400, 'invalid_question_type');
  }
  if (!q.prompt || !q.prompt.trim()) {
    throw new InterviewError('Every question needs a prompt.', 400, 'empty_prompt');
  }
  const base: InterviewQuestionSpec = {
    questionId: q.questionId || `q_${randomUUID()}`,
    type,
    prompt: q.prompt.trim(),
    maxScore: Math.max(1, Math.floor(q.maxScore || 1)),
    rationale: q.rationale,
  };
  if (type === 'mcq' || type === 'acq') {
    const options = (q.options ?? []).filter((o) => o && o.text?.trim());
    if (options.length < 2) {
      throw new InterviewError('Choice questions need at least 2 options.', 400, 'too_few_options');
    }
    const optionIds = new Set(options.map((o) => o.optionId));
    const correct = (q.correctOptionIds ?? []).filter((id) => optionIds.has(id));
    if (correct.length === 0) {
      throw new InterviewError('Choice questions need at least one correct option.', 400, 'no_correct_option');
    }
    if (type === 'mcq' && correct.length !== 1) {
      throw new InterviewError('MCQ must have exactly one correct option.', 400, 'mcq_single_answer');
    }
    base.options = options;
    base.correctOptionIds = correct;
  } else {
    base.expectedKeywords = (q.expectedKeywords ?? []).map((k) => k.trim()).filter(Boolean);
    base.idealAnswer = q.idealAnswer;
  }
  return base;
}

// ─────────────────────────── Freelancer: start application ─────────────────

export interface StartApplicationResult {
  application: JobApplication;
  session: InterviewSession;
  questions: PublicInterviewQuestion[];
  set: {
    title: string;
    jobDescription: string;
    roleDescription: string;
    passThresholdPct: number;
    timeLimitSec: number;
    requireCamera: boolean;
    requireMicrophone: boolean;
    requireFullscreen: boolean;
    desktopOnly: boolean;
    maxWarnings: number;
    totalMaxScore: number;
  };
}

/**
 * A freelancer opens a job to apply. Enforces the ban (a terminated candidate
 * cannot reapply) and returns a fresh proctored session + the answer-key-free
 * questions. Reuses an in-progress session if one already exists.
 */
export async function startApplication(
  freelancerId: string,
  jobId: string,
): Promise<StartApplicationResult> {
  const repo = getInterviewRepository();
  const set = await repo.getQuestionSet(jobId);
  if (!set) {
    throw new InterviewError('This job has no screening interview yet.', 404, 'no_question_set');
  }

  let application = await repo.getApplication(jobId, freelancerId);

  if (application?.banned) {
    throw new InterviewError(
      'You can no longer apply to this job — a previous interview was terminated for policy violations.',
      403,
      'application_banned',
    );
  }
  if (application?.status === 'passed' || application?.status === 'withdrawn') {
    throw new InterviewError('You have already completed your application for this job.', 409, 'already_applied');
  }

  const now = new Date().toISOString();
  if (!application) {
    application = {
      jobId,
      freelancerId,
      applicationId: `app_${randomUUID()}`,
      clientId: set.clientId,
      status: 'eligible',
      banned: false,
      attemptCount: 0,
      createdAt: now,
      updatedAt: now,
    };
    await repo.createApplication(application);
  }

  // Fresh session for this attempt.
  const sessionId = `isess_${randomUUID()}`;
  const expiresAt =
    set.timeLimitSec > 0 ? new Date(Date.now() + set.timeLimitSec * 1000).toISOString() : undefined;
  const session: InterviewSession = {
    sessionId,
    applicationId: application.applicationId,
    jobId,
    freelancerId,
    clientId: set.clientId,
    status: 'created',
    permissions: {
      cameraGranted: false,
      micGranted: false,
      wideAngleAcknowledged: false,
      deviceType: 'unknown',
      isDesktopClass: false,
      screenWidth: 0,
      screenHeight: 0,
      userAgent: '',
    },
    warnings: 0,
    maxWarnings: set.maxWarnings,
    fullscreenActive: false,
    terminated: false,
    answers: [],
    media: { audioKeys: [], videoKeys: [] },
    startedAt: now,
    updatedAt: now,
    expiresAt,
  };
  await repo.createSession(session);
  application = (await repo.updateApplication(jobId, freelancerId, {
    status: 'interview_in_progress',
    attemptCount: application.attemptCount + 1,
    latestSessionId: sessionId,
  }))!;

  await repo.appendEvent(sessionId, {
    type: 'session_started',
    severity: 'info',
    detail: `attempt ${application.attemptCount}`,
  });

  return {
    application,
    session,
    questions: set.questions.map(toPublicQuestion),
    set: {
      title: set.title,
      jobDescription: set.jobDescription,
      roleDescription: set.roleDescription,
      passThresholdPct: set.passThresholdPct,
      timeLimitSec: set.timeLimitSec,
      requireCamera: set.requireCamera,
      requireMicrophone: set.requireMicrophone,
      requireFullscreen: set.requireFullscreen,
      desktopOnly: set.desktopOnly,
      maxWarnings: set.maxWarnings,
      totalMaxScore: set.totalMaxScore,
    },
  };
}

function toPublicQuestion(q: InterviewQuestionSpec): PublicInterviewQuestion {
  return {
    questionId: q.questionId,
    type: q.type,
    prompt: q.prompt,
    options: q.options?.map((o) => ({ optionId: o.optionId, text: o.text })),
    maxScore: q.maxScore,
  };
}

// ─────────────────────────── Session: permissions gate ─────────────────────

export interface PermissionInput {
  cameraGranted: boolean;
  micGranted: boolean;
  wideAngleAcknowledged: boolean;
  deviceType: SessionPermissions['deviceType'];
  isDesktopClass: boolean;
  screenWidth: number;
  screenHeight: number;
  userAgent: string;
}

/** Validate and record the pre-interview permission/device gate. */
export async function recordPermissions(
  freelancerId: string,
  sessionId: string,
  input: PermissionInput,
): Promise<InterviewSession> {
  const { repo, session } = await loadOwnedSession(freelancerId, sessionId);
  const set = await requireQuestionSet(session.jobId);

  if (session.status === 'terminated') {
    throw new InterviewError('This interview was terminated.', 409, 'terminated');
  }

  const failures: string[] = [];
  if (set.desktopOnly && (!input.isDesktopClass || input.deviceType === 'mobile' || input.deviceType === 'tablet')) {
    failures.push('Interviews can only be taken on a laptop or desktop.');
  }
  if (set.requireCamera && !input.cameraGranted) failures.push('Camera access (wide-angle) is required.');
  if (set.requireMicrophone && !input.micGranted) failures.push('Microphone access is required.');

  const permissions: SessionPermissions = {
    cameraGranted: input.cameraGranted,
    micGranted: input.micGranted,
    wideAngleAcknowledged: input.wideAngleAcknowledged,
    deviceType: input.deviceType,
    isDesktopClass: input.isDesktopClass,
    screenWidth: input.screenWidth,
    screenHeight: input.screenHeight,
    userAgent: input.userAgent,
    grantedAt: new Date().toISOString(),
  };

  if (failures.length > 0) {
    await repo.appendEvent(sessionId, {
      type: 'permission_denied',
      severity: 'critical',
      detail: failures.join(' '),
    });
    await repo.updateSession(sessionId, { permissions, status: 'permissions_pending' });
    throw new InterviewError(failures.join(' '), 400, 'permissions_failed');
  }

  await repo.appendEvent(sessionId, { type: 'permission_granted', severity: 'info' });
  const updated = await repo.updateSession(sessionId, {
    permissions,
    status: 'active',
    fullscreenActive: true,
  });
  await repo.appendEvent(sessionId, { type: 'fullscreen_enter', severity: 'info' });
  return updated!;
}

// ─────────────────────────── Session: proctoring events ────────────────────

const CRITICAL_TYPES: ProctorEventType[] = [
  'fullscreen_exit',
  'tab_hidden',
  'window_blur',
  'multiple_faces',
  'second_screen',
  'devtools_open',
  'copy_paste',
];

export interface RecordEventResult {
  event: ProctorEvent;
  warnings: number;
  maxWarnings: number;
  terminated: boolean;
  terminationReason?: string;
}

/**
 * Ingest a proctoring signal from the client. Violations count as warnings;
 * after `maxWarnings` the interview is terminated and the candidate is banned
 * from reapplying to this job. Fully server-authoritative — the client cannot
 * bypass termination by not sending the event.
 */
export async function recordProctorEvent(
  freelancerId: string,
  sessionId: string,
  type: ProctorEventType,
  detail?: string,
  severityOverride?: ProctorSeverity,
): Promise<RecordEventResult> {
  const { repo, session } = await loadOwnedSession(freelancerId, sessionId);

  if (session.terminated || session.status === 'terminated') {
    throw new InterviewError('This interview was terminated.', 409, 'terminated');
  }
  if (session.status === 'submitted') {
    throw new InterviewError('This interview was already submitted.', 409, 'already_submitted');
  }

  const isViolation = CRITICAL_TYPES.includes(type) || severityOverride === 'warning' || severityOverride === 'critical';
  const severity: ProctorSeverity =
    severityOverride ?? (isViolation ? 'warning' : 'info');

  let warnings = session.warnings;
  let terminated = false;
  let terminationReason: string | undefined;

  if (severity === 'warning' || severity === 'critical') {
    warnings += 1;
    const evt = await repo.appendEvent(sessionId, {
      type: 'warning_issued',
      severity: 'warning',
      detail: detail || type,
      warningNumber: warnings,
    });

    if (warnings >= session.maxWarnings) {
      terminated = true;
      terminationReason = `Terminated after ${warnings} proctoring violations (last: ${type}).`;
      await repo.appendEvent(sessionId, { type: 'terminated', severity: 'critical', detail: terminationReason });
      await repo.updateSession(sessionId, {
        status: 'terminated',
        terminated: true,
        terminationReason,
        warnings,
        fullscreenActive: false,
        terminatedAt: new Date().toISOString(),
      });
      // Hard ban: cannot reapply to this job.
      await repo.updateApplication(session.jobId, freelancerId, {
        status: 'terminated',
        banned: true,
        bannedReason: terminationReason,
        latestSessionId: sessionId,
      });
    } else {
      // Record the raw signal too (for the audit trail) and bump the counter.
      await repo.updateSession(sessionId, { warnings });
    }
    return { event: evt, warnings, maxWarnings: session.maxWarnings, terminated, terminationReason };
  }

  // Non-violation signal — log only (e.g. fullscreen_enter, answer_saved).
  const evt = await repo.appendEvent(sessionId, { type, severity, detail });
  return { event: evt, warnings, maxWarnings: session.maxWarnings, terminated: false };
}

// ─────────────────────────── Session: submit & score ───────────────────────

export interface SubmitResult {
  session: InterviewSession;
  application: JobApplication;
  passed: boolean;
  score: number;
  maxScore: number;
  scorePct: number;
}

/** Submit answers, auto-score them, and finalize the application (pass → submitted). */
export async function submitInterview(
  freelancerId: string,
  sessionId: string,
  rawAnswers: Array<{ questionId: string; selectedOptionIds?: string[]; textAnswer?: string }>,
): Promise<SubmitResult> {
  const { repo, session } = await loadOwnedSession(freelancerId, sessionId);
  if (session.terminated || session.status === 'terminated') {
    throw new InterviewError('This interview was terminated and cannot be submitted.', 409, 'terminated');
  }
  if (session.status === 'submitted') {
    throw new InterviewError('This interview was already submitted.', 409, 'already_submitted');
  }

  const set = await requireQuestionSet(session.jobId);
  const answerByQ = new Map(rawAnswers.map((a) => [a.questionId, a]));

  const scored: SubmittedAnswer[] = set.questions.map((q) => {
    const given = answerByQ.get(q.questionId);
    return scoreAnswer(q, given);
  });

  const totalScore = scored.reduce((s, a) => s + (a.autoScore ?? 0), 0);
  const maxScore = set.totalMaxScore;
  const scorePct = maxScore > 0 ? Math.round((totalScore / maxScore) * 100) : 0;
  const passed = scorePct >= set.passThresholdPct;
  const now = new Date().toISOString();

  const updatedSession = (await repo.updateSession(sessionId, {
    status: 'submitted',
    fullscreenActive: false,
    answers: scored,
    submittedAt: now,
    scoring: { totalScore, maxScore, scorePct, passed, scoredAt: now },
  }))!;

  await repo.appendEvent(sessionId, {
    type: 'submitted',
    severity: 'info',
    detail: `score ${totalScore}/${maxScore} (${scorePct}%) — ${passed ? 'PASS' : 'FAIL'}`,
  });

  const application = (await repo.updateApplication(session.jobId, freelancerId, {
    status: passed ? 'passed' : 'failed',
    score: totalScore,
    maxScore,
    scorePct,
    passed,
    latestSessionId: sessionId,
    submittedAt: passed ? now : undefined,
  }))!;

  return { session: updatedSession, application, passed, score: totalScore, maxScore, scorePct };
}

/** Deterministic auto-scoring for a single question. */
function scoreAnswer(
  q: InterviewQuestionSpec,
  given: { selectedOptionIds?: string[]; textAnswer?: string } | undefined,
): SubmittedAnswer {
  const base: SubmittedAnswer = {
    questionId: q.questionId,
    type: q.type,
    maxScore: q.maxScore,
    scoredBy: 'auto',
    autoScore: 0,
  };

  if (!given) {
    base.scoreRationale = 'No answer provided.';
    return base;
  }

  if (q.type === 'mcq') {
    const selected = new Set(given.selectedOptionIds ?? []);
    const correct = new Set(q.correctOptionIds ?? []);
    const isCorrect = selected.size === 1 && [...selected].every((id) => correct.has(id));
    base.selectedOptionIds = [...selected];
    base.autoScore = isCorrect ? q.maxScore : 0;
    base.scoreRationale = isCorrect ? 'Correct option.' : 'Incorrect option.';
    return base;
  }

  if (q.type === 'acq') {
    const selected = new Set(given.selectedOptionIds ?? []);
    const correct = new Set(q.correctOptionIds ?? []);
    base.selectedOptionIds = [...selected];
    // Proportional credit: +1 per correct pick, -1 per wrong pick, floored at 0.
    let hits = 0;
    let wrong = 0;
    for (const id of selected) (correct.has(id) ? hits++ : wrong++);
    const raw = Math.max(0, hits - wrong) / correct.size;
    base.autoScore = Math.round(raw * q.maxScore);
    base.scoreRationale = `${hits}/${correct.size} correct, ${wrong} incorrect selections.`;
    return base;
  }

  // text — keyword coverage
  const text = (given.textAnswer ?? '').toLowerCase();
  base.textAnswer = given.textAnswer ?? '';
  const keywords = q.expectedKeywords ?? [];
  if (keywords.length === 0) {
    base.autoScore = 0;
    base.scoreRationale = 'Text answer recorded; no keyword key configured for auto-scoring.';
    return base;
  }
  const matched = keywords.filter((k) => text.includes(k.toLowerCase()));
  base.autoScore = Math.round((matched.length / keywords.length) * q.maxScore);
  base.scoreRationale = `Matched ${matched.length}/${keywords.length} expected keywords.`;
  return base;
}

// ─────────────────────────── helpers ───────────────────────────

async function loadOwnedSession(freelancerId: string, sessionId: string) {
  const repo = getInterviewRepository();
  const session = await repo.getSession(sessionId);
  if (!session) throw new InterviewError('Interview session not found.', 404, 'session_not_found');
  if (session.freelancerId !== freelancerId) {
    throw new InterviewError('This is not your interview session.', 403, 'not_session_owner');
  }
  return { repo, session };
}

async function requireQuestionSet(jobId: string): Promise<InterviewQuestionSet> {
  const set = await getInterviewRepository().getQuestionSet(jobId);
  if (!set) throw new InterviewError('This job has no screening interview.', 404, 'no_question_set');
  return set;
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}
