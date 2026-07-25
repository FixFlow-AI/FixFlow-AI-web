import { randomUUID } from 'crypto';
import { getCorsair, getCorsairForTenant, isCorsairConfigured } from './corsairClient.js';

/**
 * FixBot — the trust-first project agent (Corsair track).
 *
 * Takes real actions across a user's apps (Slack, Gmail, GitHub) through
 * Corsair's permission-gated integration layer. Philosophy mirrors FixFlowAI's
 * escrow: reads flow, writes ask first (Corsair returns an approval link for
 * gated writes). Every function is fire-and-forget safe — it NEVER throws and
 * NEVER blocks an escrow response; it records an entry in the automation log
 * so the dashboard "Automations" panel can show what the agent did/attempted.
 */

export type AutomationStatus = 'sent' | 'pending_approval' | 'simulated' | 'failed';

export interface AutomationRecord {
  id: string;
  tenantId: string;
  action: string;        // e.g. "slack.messages.post"
  summary: string;       // human text
  status: AutomationStatus;
  approvalUrl?: string;  // Corsair approval link when a write is gated
  detail?: string;
  createdAt: string;
}

// Bounded in-memory log (most recent first). Enough for a live demo/dashboard.
const MAX_LOG = 100;
const log: AutomationRecord[] = [];

function record(entry: Omit<AutomationRecord, 'id' | 'createdAt'>): AutomationRecord {
  const rec: AutomationRecord = { id: randomUUID(), createdAt: new Date().toISOString(), ...entry };
  log.unshift(rec);
  if (log.length > MAX_LOG) log.length = MAX_LOG;
  return rec;
}

export function listAutomations(tenantId?: string): AutomationRecord[] {
  return tenantId ? log.filter((r) => r.tenantId === tenantId) : log.slice();
}

/**
 * Corsair calls may return an approval-request link instead of executing (for
 * gated writes). We normalize the varied SDK response shapes into a status.
 */
function interpretResult(result: any): { status: AutomationStatus; approvalUrl?: string } {
  const approvalUrl =
    result?.approvalUrl || result?.reviewUrl || result?.permission?.reviewUrl || result?.approval?.url;
  if (approvalUrl) return { status: 'pending_approval', approvalUrl };
  return { status: 'sent' };
}

/** Post a message to the project's Slack channel (cautious mode → usually runs). */
export async function notifyProjectChannel(
  tenantId: string,
  channel: string,
  text: string,
): Promise<AutomationRecord> {
  if (!isCorsairConfigured()) {
    return record({ tenantId, action: 'slack.messages.post', summary: text, status: 'simulated', detail: `→ ${channel}` });
  }
  try {
    const client = await getCorsairForTenant(tenantId);
    if (!client?.slack?.api?.messages?.post) {
      return record({ tenantId, action: 'slack.messages.post', summary: text, status: 'simulated', detail: 'slack plugin unavailable' });
    }
    const res = await client.slack.api.messages.post({ channel, text });
    const { status, approvalUrl } = interpretResult(res);
    return record({ tenantId, action: 'slack.messages.post', summary: text, status, approvalUrl, detail: `→ ${channel}` });
  } catch (err) {
    return record({ tenantId, action: 'slack.messages.post', summary: text, status: 'failed', detail: (err as Error).message });
  }
}

/** Draft/send an email to the counterparty (strict mode → approval-gated). */
export async function draftMilestoneEmail(
  tenantId: string,
  to: string,
  subject: string,
  body: string,
): Promise<AutomationRecord> {
  if (!isCorsairConfigured()) {
    return record({ tenantId, action: 'gmail.messages.send', summary: subject, status: 'simulated', detail: `→ ${to}` });
  }
  try {
    const client = await getCorsairForTenant(tenantId);
    if (!client?.gmail?.api?.messages?.send) {
      return record({ tenantId, action: 'gmail.messages.send', summary: subject, status: 'simulated', detail: 'gmail plugin unavailable' });
    }
    const res = await client.gmail.api.messages.send({ to, subject, body });
    const { status, approvalUrl } = interpretResult(res);
    return record({ tenantId, action: 'gmail.messages.send', summary: subject, status, approvalUrl, detail: `→ ${to}` });
  } catch (err) {
    return record({ tenantId, action: 'gmail.messages.send', summary: subject, status: 'failed', detail: (err as Error).message });
  }
}

/**
 * Mint a Corsair Hub connect link so a user can authorize an integration
 * (Slack/GitHub/Gmail) for their workspace/tenant. Returns the URL to redirect to.
 */
export async function createConnectLink(
  tenantId: string,
  plugin: string,
): Promise<{ connectUrl: string | null; simulated: boolean; error?: string }> {
  if (!isCorsairConfigured()) {
    return { connectUrl: null, simulated: true };
  }
  try {
    const c = await getCorsair();
    if (!c?.manage?.connect?.createLink) return { connectUrl: null, simulated: true };
    const res = await c.manage.connect.createLink({ plugin, tenantId });
    return { connectUrl: res?.connectUrl ?? null, simulated: false };
  } catch (err) {
    return { connectUrl: null, simulated: false, error: (err as Error).message };
  }
}

/**
 * Convenience: fire the milestone-event notifications (Slack + optional email)
 * for a tenant. Fire-and-forget from route handlers.
 */
export function fireMilestoneNotifications(opts: {
  tenantId: string;
  slackChannel?: string;
  event: string;
  milestoneTitle: string;
  counterpartyEmail?: string;
}): void {
  const { tenantId, slackChannel, event, milestoneTitle, counterpartyEmail } = opts;
  const text = `FixFlowAI: milestone "${milestoneTitle}" → ${event}.`;
  void notifyProjectChannel(tenantId, slackChannel || '#fixflow', text).catch(() => {});
  if (counterpartyEmail && (event === 'released' || event === 'approved')) {
    void draftMilestoneEmail(
      tenantId,
      counterpartyEmail,
      `Milestone ${event}: ${milestoneTitle}`,
      `Your milestone "${milestoneTitle}" is now ${event} on FixFlowAI.`,
    ).catch(() => {});
  }
}
