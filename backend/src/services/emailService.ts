import type { Milestone } from '../skills/escrowStateMachine.js';
import {
  type WelcomeData,
  type InvitationData,
  type GithubScanCompleteData,
  type InterviewScheduledData,
  type InterviewCompletedData,
  type ProposalEvaluatedData,
  type MilestoneEmailEvent,
  welcomeFreelancerTemplate,
  welcomeClientTemplate,
  githubScanCompleteTemplate,
  projectInvitationTemplate,
  interviewScheduledTemplate,
  interviewCompletedTemplate,
  proposalEvaluatedTemplate,
  buildMilestoneEmail,
} from './emailTemplates.js';

/**
 * Email notifications via AWS SES (STORY-36).
 *
 * Config (env):
 *   SES_FROM_EMAIL   — a *verified* SES sender/identity, e.g. "FixFlowAI <info@fixflowai.xyz>"
 *   AWS_REGION       — reused from the shared AWS config
 *   EMAIL_ENABLED    — set "false" to hard-disable even if SES_FROM_EMAIL is set
 *
 * All emails are sent as no-reply from info@fixflowai.xyz. If SES_FROM_EMAIL is
 * missing (or EMAIL_ENABLED=false), the service runs in a no-op "simulated" mode:
 * it logs what it would have sent and returns. This keeps local dev and no-email
 * demos working without AWS. Sending is always fire-and-forget from callers — a
 * mail failure never blocks a business action.
 */

const FROM = process.env.SES_FROM_EMAIL || '';
const ENABLED = process.env.EMAIL_ENABLED !== 'false' && Boolean(FROM);

let sesClientPromise: Promise<any> | null = null;

async function getClient() {
  if (!sesClientPromise) {
    sesClientPromise = (async () => {
      const { SESv2Client } = await import('@aws-sdk/client-sesv2');
      const { AWS_REGION } = await import('../config/aws.js');
      return new SESv2Client({ region: AWS_REGION });
    })();
  }
  return sesClientPromise;
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
    const client = await getClient();
    const { SendEmailCommand } = await import('@aws-sdk/client-sesv2');
    await client.send(
      new SendEmailCommand({
        FromEmailAddress: FROM,
        Destination: { ToAddresses: recipients },
        Content: {
          Simple: {
            Subject: { Data: input.subject, Charset: 'UTF-8' },
            Body: {
              Html: { Data: input.html, Charset: 'UTF-8' },
              Text: { Data: input.text, Charset: 'UTF-8' },
            },
          },
        },
      }),
    );
    console.log(`[EMAIL] Sent "${input.subject}" to ${recipients.join(', ')}`);
    return { sent: true, simulated: false };
  } catch (err) {
    console.error('[EMAIL] SES send failed:', (err as Error).message);
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
  GithubScanCompleteData,
  InterviewScheduledData,
  InterviewCompletedData,
  ProposalEvaluatedData,
  MilestoneEmailEvent,
};
