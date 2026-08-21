import type { Milestone } from '../skills/escrowStateMachine.js';
import {
  type WelcomeData,
  type InvitationData,
  type InvitationResponseData,
  type GithubScanCompleteData,
  type InterviewScheduledData,
  type InterviewCompletedData,
  type ProposalEvaluatedData,
  type MilestoneEmailEvent,
  welcomeFreelancerTemplate,
  welcomeClientTemplate,
  githubScanCompleteTemplate,
  projectInvitationTemplate,
  invitationResponseTemplate,
  interviewScheduledTemplate,
  interviewCompletedTemplate,
  proposalEvaluatedTemplate,
  buildMilestoneEmail,
} from './emailTemplates.js';

/**
 * Transactional email via Resend (STORY-36).
 *
 * Config (env):
 *   RESEND_API_KEY — Resend API key for the verified fixflowai.xyz domain
 *   EMAIL_FROM     — sender identity, e.g. "FixFlowAI <info@fixflowai.xyz>"
 *                    (falls back to the legacy SES_FROM_EMAIL so an older
 *                    deployment keeps working during the cutover)
 *   SES_REPLY_TO   — optional Reply-To. Empty means no-reply.
 *   EMAIL_ENABLED  — set "false" to hard-disable sending entirely
 *
 * Resend is called over plain HTTPS, so there is no SDK dependency. If the key
 * or sender is missing (or EMAIL_ENABLED=false) the service runs in a no-op
 * "simulated" mode: it logs what it would have sent and returns. That keeps
 * local dev and no-email demos working. Sending is always fire-and-forget from
 * callers — a mail failure never blocks a business action.
 *
 * Zoho Mail still owns the info@ inbox for human replies; Resend only sends
 * app-generated mail. Their DNS records coexist (Zoho keeps the MX).
 */

const RESEND_ENDPOINT = 'https://api.resend.com/emails';
const SEND_TIMEOUT_MS = 15_000;

const FROM = process.env.EMAIL_FROM || process.env.SES_FROM_EMAIL || '';
const API_KEY = process.env.RESEND_API_KEY || '';
const REPLY_TO = (process.env.SES_REPLY_TO || '').trim();
const ENABLED =
  process.env.EMAIL_ENABLED !== 'false' && Boolean(FROM) && Boolean(API_KEY);

/**
 * Log the transport decision once at boot. Sends are fire-and-forget, so
 * without this a misconfigured deployment silently drops every email and
 * nothing surfaces the problem.
 */
export function logEmailTransportStatus(): void {
  if (ENABLED) {
    console.log(`[EMAIL] Resend transport ENABLED. from="${FROM}"${REPLY_TO ? ` replyTo="${REPLY_TO}"` : ' (no-reply)'}`);
    return;
  }
  const missing: string[] = [];
  if (!FROM) missing.push('EMAIL_FROM');
  if (!API_KEY) missing.push('RESEND_API_KEY');
  if (process.env.EMAIL_ENABLED === 'false') missing.push('EMAIL_ENABLED=false');
  console.warn(
    `[EMAIL] SIMULATION MODE — no mail will be delivered. Reason: ${missing.join(', ') || 'unknown'}`,
  );
}

export interface SendEmailInput {
  to: string | string[];
  subject: string;
  html: string;
  text: string;
}

export async function sendEmail(input: SendEmailInput): Promise<{ sent: boolean; simulated: boolean; error?: string }> {
  const recipients = (Array.isArray(input.to) ? input.to : [input.to]).filter(Boolean);
  if (recipients.length === 0) return { sent: false, simulated: true };

  if (!ENABLED) {
    console.log(`[EMAIL:SIMULATION] To: ${recipients.join(', ')} | Subject: ${input.subject}`);
    return { sent: false, simulated: true };
  }

  try {
    const res = await fetch(RESEND_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: FROM,
        to: recipients,
        subject: input.subject,
        html: input.html,
        text: input.text,
        ...(REPLY_TO ? { reply_to: REPLY_TO } : {}),
      }),
      // Never let a hung mail call keep a request handler alive.
      signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
    });

    if (!res.ok) {
      // Surface Resend's reason (unverified domain, bad key, invalid sender)
      // rather than a generic failure — these are the usual setup mistakes.
      const detail = (await res.text().catch(() => '')).slice(0, 300);
      throw new Error(`Resend responded ${res.status}: ${detail || res.statusText}`);
    }

    const data = (await res.json().catch(() => ({}))) as { id?: string };
    console.log(
      `[EMAIL] Sent "${input.subject}" to ${recipients.join(', ')} (id: ${data.id ?? 'n/a'})`,
    );
    return { sent: true, simulated: false };
  } catch (err) {
    console.error('[EMAIL] Resend send failed:', (err as Error).message);
    return { sent: false, simulated: false, error: (err as Error).message };
  }
}

// ─────────────────────────── Fire-and-forget notifiers ────────────────
// Each function is safe to call without awaiting. Failures are logged, never thrown.

function fireAndForget(to: string | string[], subject: string, html: string, text: string): void {
  void sendEmail({ to, subject, html, text }).catch(() => {});
}

/**
 * Send a role-appropriate welcome email to a new user.
 */
export function notifyWelcome(data: WelcomeData, to: string): void {
  const template = data.role === 'freelancer'
    ? welcomeFreelancerTemplate
    : welcomeClientTemplate;
  fireAndForget(to, template.subject(data), template.html(data), template.text(data));
}

/**
 * Notify a freelancer that a client has invited them to a project.
 */
export function notifyProjectInvitation(data: InvitationData, to: string): void {
  fireAndForget(
    to,
    projectInvitationTemplate.subject(data),
    projectInvitationTemplate.html(data),
    projectInvitationTemplate.text(data),
  );
}

/**
 * Notify a client that the freelancer accepted or declined their invitation.
 * This closes the second half of the two-sided hiring handshake.
 */
export function notifyInvitationResponse(data: InvitationResponseData, to: string): void {
  fireAndForget(
    to,
    invitationResponseTemplate.subject(data),
    invitationResponseTemplate.html(data),
    invitationResponseTemplate.text(data),
  );
}

/**
 * Notify a freelancer that their GitHub profile scan is complete.
 */
export function notifyGithubScanComplete(data: GithubScanCompleteData, to: string): void {
  fireAndForget(
    to,
    githubScanCompleteTemplate.subject(data),
    githubScanCompleteTemplate.html(data),
    githubScanCompleteTemplate.text(data),
  );
}

/**
 * Notify a freelancer that a screening interview has been scheduled.
 */
export function notifyInterviewScheduled(data: InterviewScheduledData, to: string): void {
  fireAndForget(
    to,
    interviewScheduledTemplate.subject(data),
    interviewScheduledTemplate.html(data),
    interviewScheduledTemplate.text(data),
  );
}

/**
 * Notify a client that a candidate has completed their interview.
 */
export function notifyInterviewCompleted(data: InterviewCompletedData, to: string): void {
  fireAndForget(
    to,
    interviewCompletedTemplate.subject(data),
    interviewCompletedTemplate.html(data),
    interviewCompletedTemplate.text(data),
  );
}

/**
 * Notify a client that their proposal has been evaluated by the confidence grid.
 */
export function notifyProposalEvaluated(data: ProposalEvaluatedData, to: string): void {
  fireAndForget(
    to,
    proposalEvaluatedTemplate.subject(data),
    proposalEvaluatedTemplate.html(data),
    proposalEvaluatedTemplate.text(data),
  );
}

/**
 * Fire-and-forget milestone notification. Never throws; logs failures. Safe to
 * call without awaiting inside a route handler.
 *
 * Signature preserved from the original for backward compatibility with existing
 * call sites in index.ts.
 */
export function notifyMilestoneEvent(
  event: MilestoneEmailEvent,
  milestone: Milestone,
  to: string | string[],
): void {
  const email = buildMilestoneEmail(event, milestone);
  if (!email) return;
  fireAndForget(to, email.subject, email.html, email.text);
}

// Re-export types for consumers
export type {
  WelcomeData,
  InvitationData,
  InvitationResponseData,
  GithubScanCompleteData,
  InterviewScheduledData,
  InterviewCompletedData,
  ProposalEvaluatedData,
  MilestoneEmailEvent,
};
