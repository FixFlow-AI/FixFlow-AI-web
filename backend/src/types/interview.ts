/**
 * Proctored freelancer-application interview (feature: "interview gate").
 *
 * Flow: an eligible freelancer opens a job → reads the job + role description →
 * must pass a client-authored, business-specific screening interview (MCQ / ACQ
 * / text questions) taken under proctoring (wide-angle camera + mic audio,
 * desktop-only, forced full-screen, 3-strike termination) → answers are
 * auto-scored → a passing score submits the application. A terminated candidate
 * is banned from reapplying to that job.
 *
 * Persistence tables (see infra/dynamodb/create-tables):
 *   interview_question_sets  PK jobId
 *   job_applications         PK jobId, SK freelancerId, GSI FreelancerApplicationsIndex
 *   interview_sessions       PK sessionId, GSI ApplicationSessionsIndex
 *   interview_events         PK sessionId, SK eventSeq (append-only proctor log)
 *
 * Large binary media (audio/video) NEVER lives in DynamoDB (400 KB item cap).
 * Recordings are uploaded to S3; only their object keys are stored here.
 */

// ─────────────────────────── Question authoring ───────────────────────────

export type QuestionType = 'mcq' | 'acq' | 'text';
// mcq  = multiple-choice, exactly one correct option
// acq  = "all-correct" multi-select, one or more correct options
// text = free-text answer, auto-scored by keyword coverage + AI grading

export interface QuestionOption {
  optionId: string;
  text: string;
}

export interface InterviewQuestionSpec {
  questionId: string;
  type: QuestionType;
  prompt: string;
  /** For mcq/acq only. */
  options?: QuestionOption[];
  /** Answer key — option ids that are correct (mcq: 1, acq: ≥1). Not sent to the freelancer. */
  correctOptionIds?: string[];
  /** For text questions — keywords that earn partial credit, plus an ideal answer for AI grading. */
  expectedKeywords?: string[];
  idealAnswer?: string;
  /** Points this question contributes to the total. */
  maxScore: number;
  /** Optional business rationale (client-facing only). */
  rationale?: string;
}

export interface InterviewQuestionSet {
  jobId: string; // = proposalId of the client's job/brief
  clientId: string;
  title: string;
  /** The job description + the specific role description shown before the interview. */
  jobDescription: string;
  roleDescription: string;
  questions: InterviewQuestionSpec[];
  /** Sum of question maxScores (denormalized for convenience). */
  totalMaxScore: number;
  /** Percentage (0-100) a candidate must reach to pass and submit the application. */
  passThresholdPct: number;
  /** Whole-interview time limit in seconds (0 = untimed). */
  timeLimitSec: number;
  /** Interview cannot be taken unless these proctoring gates are enforced. */
  requireCamera: boolean;
  requireMicrophone: boolean;
  requireFullscreen: boolean;
  desktopOnly: boolean;
  maxWarnings: number; // default 3
  createdAt: string;
  updatedAt: string;
  version: number;
}

/** Freelancer-facing view of a question — answer key stripped out. */
export interface PublicInterviewQuestion {
  questionId: string;
  type: QuestionType;
  prompt: string;
  options?: QuestionOption[];
  maxScore: number;
}

// ─────────────────────────── Application lifecycle ─────────────────────────

export type ApplicationStatus =
  | 'eligible' // matched/eligible, not yet started
  | 'interview_in_progress'
  | 'passed' // interview passed, application auto-submitted
  | 'failed' // interview completed below threshold
  | 'terminated' // proctoring violations → banned from reapplying
  | 'withdrawn';

export interface JobApplication {
  jobId: string;
  freelancerId: string;
  applicationId: string; // stable id, also used to correlate sessions
  clientId: string;
  status: ApplicationStatus;
  /** True once terminated — hard block on re-application to this job. */
  banned: boolean;
  bannedReason?: string;
  /** Latest interview outcome. */
  score?: number;
  maxScore?: number;
  scorePct?: number;
  passed?: boolean;
  attemptCount: number;
  latestSessionId?: string;
  createdAt: string;
  updatedAt: string;
  submittedAt?: string;
}

// ─────────────────────────── Proctored session ────────────────────────────

export type SessionStatus =
  | 'created'
  | 'permissions_pending'
  | 'active'
  | 'submitted'
  | 'terminated'
  | 'expired';

export interface SessionPermissions {
  cameraGranted: boolean;
  micGranted: boolean;
  wideAngleAcknowledged: boolean;
  /** Device gate — must be a laptop/desktop, never a phone/tablet. */
  deviceType: 'desktop' | 'laptop' | 'mobile' | 'tablet' | 'unknown';
  isDesktopClass: boolean;
  screenWidth: number;
  screenHeight: number;
  userAgent: string;
  grantedAt?: string;
}

export interface SubmittedAnswer {
  questionId: string;
  type: QuestionType;
  /** mcq/acq answers. */
  selectedOptionIds?: string[];
  /** text answer. */
  textAnswer?: string;
  /** Filled in by the scorer. */
  autoScore?: number;
  maxScore: number;
  scoredBy?: 'auto' | 'ai';
  scoreRationale?: string;
}

export interface SessionScoring {
  totalScore: number;
  maxScore: number;
  scorePct: number;
  passed: boolean;
  scoredAt?: string;
}

export interface SessionMedia {
  /** S3 object keys for uploaded audio chunks (mic recording). */
  audioKeys: string[];
  /** S3 object keys for periodic wide-angle camera snapshots / video chunks. */
  videoKeys: string[];
}

export interface InterviewSession {
  sessionId: string;
  applicationId: string;
  jobId: string;
  freelancerId: string;
  clientId: string;
  status: SessionStatus;
  permissions: SessionPermissions;
  /** Number of proctoring warnings issued; termination fires after maxWarnings. */
  warnings: number;
  maxWarnings: number;
  fullscreenActive: boolean;
  terminated: boolean;
  terminationReason?: string;
  answers: SubmittedAnswer[];
  scoring?: SessionScoring;
  media: SessionMedia;
  startedAt: string;
  updatedAt: string;
  submittedAt?: string;
  terminatedAt?: string;
  /** Server-side deadline (startedAt + timeLimitSec), if timed. */
  expiresAt?: string;
}

// ─────────────────────────── Proctoring events ────────────────────────────

export type ProctorEventType =
  | 'permission_granted'
  | 'permission_denied'
  | 'session_started'
  | 'fullscreen_enter'
  | 'fullscreen_exit'
  | 'tab_hidden'
  | 'window_blur'
  | 'multiple_faces'
  | 'no_face'
  | 'audio_alert'
  | 'copy_paste'
  | 'devtools_open'
  | 'second_screen'
  | 'warning_issued'
  | 'answer_saved'
  | 'submitted'
  | 'terminated';

export type ProctorSeverity = 'info' | 'warning' | 'critical';

export interface ProctorEvent {
  sessionId: string;
  eventSeq: number; // monotonic per session (SK)
  ts: string;
  type: ProctorEventType;
  severity: ProctorSeverity;
  detail?: string;
  /** Which of the N warnings this represents, when severity=warning. */
  warningNumber?: number;
}
