import type { Milestone } from '../skills/escrowStateMachine.js';

/**
 * Email notifications via AWS SES (STORY-36).
 *
 * Config (env):
 *   SES_FROM_EMAIL   — a *verified* SES sender/identity, e.g. "FixFlowAI <no-reply@fixflowai.xyz>"
 *   SES_REPLY_TO     — optional reply-to address
 *   AWS_REGION       — reused from the shared AWS config
 *   EMAIL_ENABLED    — set "false" to hard-disable even if SES_FROM_EMAIL is set
 *
 * If SES_FROM_EMAIL is missing (or EMAIL_ENABLED=false), the service runs in a
 * no-op "simulated" mode: it logs what it would have sent and returns. This
 * keeps local dev and no-email demos working without AWS. Sending is always
 * fire-and-forget from callers — a mail failure never blocks an escrow action.
 */

const FROM = process.env.SES_FROM_EMAIL || '';
const REPLY_TO = process.env.SES_REPLY_TO || '';
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
        ...(REPLY_TO ? { ReplyToAddresses: [REPLY_TO] } : {}),
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

// ---------- Templates ----------

const BRAND = 'FixFlowAI';
const inr = (n: number) => `₹${Number(n || 0).toLocaleString('en-IN')}`;

function layout(title: string, body: string): string {
  return `<!doctype html><html><body style="margin:0;background:#f1f5f9;font-family:Segoe UI,Arial,sans-serif;color:#0f172a">
  <div style="max-width:520px;margin:0 auto;padding:24px">
    <div style="background:#fff;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden">
      <div style="background:#2563eb;color:#fff;padding:16px 24px;font-weight:700;font-size:16px">${BRAND}</div>
      <div style="padding:24px">
        <h1 style="font-size:18px;margin:0 0 12px">${title}</h1>
        ${body}
      </div>
      <div style="padding:16px 24px;border-top:1px solid #f1f5f9;font-size:12px;color:#94a3b8">
        You're receiving this because you have an active project on ${BRAND}.
      </div>
    </div>
  </div></body></html>`;
}

export type MilestoneEmailEvent =
  | 'funded'
  | 'submitted'
  | 'approved'
  | 'revision_requested'
  | 'released'
  | 'dispute_raised'
  | 'dispute_resolved'
  | 'refunded';

const COPY: Record<MilestoneEmailEvent, { subject: (m: Milestone) => string; line: (m: Milestone) => string }> = {
  funded: {
    subject: (m) => `Milestone funded: ${m.title}`,
    line: (m) => `Funds of ${inr(m.amount)} for <strong>${m.title}</strong> are now secured in escrow. Work can begin.`,
  },
  submitted: {
    subject: (m) => `Deliverable submitted for review: ${m.title}`,
    line: (m) => `The freelancer submitted work for <strong>${m.title}</strong>. Please review and approve or request changes.`,
  },
  approved: {
    subject: (m) => `Milestone approved: ${m.title}`,
    line: (m) => `<strong>${m.title}</strong> was approved. Funds are ready to be released to the freelancer.`,
  },
  revision_requested: {
    subject: (m) => `Revision requested: ${m.title}`,
    line: (m) => `The client requested changes on <strong>${m.title}</strong>. Please review the feedback and resubmit.`,
  },
  released: {
    subject: (m) => `Funds released: ${m.title}`,
    line: (m) => `Escrow funds for <strong>${m.title}</strong> have been released to the freelancer's account.`,
  },
  dispute_raised: {
    subject: (m) => `Dispute opened: ${m.title}`,
    line: (m) => `A dispute was raised on <strong>${m.title}</strong>. Funds remain locked in escrow pending resolution.`,
  },
  dispute_resolved: {
    subject: (m) => `Dispute resolved: ${m.title}`,
    line: (m) => `The dispute on <strong>${m.title}</strong> has been resolved.`,
  },
  refunded: {
    subject: (m) => `Refund issued: ${m.title}`,
    line: (m) => `A refund for <strong>${m.title}</strong> has been issued to the client's original payment method.`,
  },
};

/**
 * Fire-and-forget milestone notification. Never throws; logs failures. Safe to
 * call without awaiting inside a route handler.
 */
export function notifyMilestoneEvent(
  event: MilestoneEmailEvent,
  milestone: Milestone,
  to: string | string[],
): void {
  const copy = COPY[event];
  if (!copy) return;
  const subject = copy.subject(milestone);
  const body = `<p style="font-size:14px;line-height:1.6;color:#334155;margin:0 0 16px">${copy.line(milestone)}</p>
    <p style="font-size:13px;color:#64748b;margin:0">Milestone status: <strong>${milestone.state}</strong> · Amount: ${inr(milestone.amount)}</p>`;
  const text = `${subject}\n\n${copy.line(milestone).replace(/<[^>]+>/g, '')}\nStatus: ${milestone.state} · Amount: ${inr(milestone.amount)}`;

  void sendEmail({ to, subject, html: layout(subject, body), text }).catch(() => {});
}
