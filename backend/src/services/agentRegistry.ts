import { createHash, randomUUID } from 'crypto';
import {
  getAgentRegistryRepository,
  type AgentIdentity,
  type AgentMode,
  type A2AMessage,
  type AgentSkill,
} from './agentRegistryRepository.js';
import type { ConfidenceGridResult } from '../types/ai.js';

/**
 * BINDU track — the "marketplace of verifiable agents" service layer.
 *
 * The Confidence-Grid personas are modeled as DID-identified A2A agents. Today
 * they run in-process (mode="inproc") and we synthesize deterministic DIDs +
 * signature envelopes so the whole flow — identities, verifiable messages,
 * skills discovery — is demoable and persisted NOW. When Bindu is installed in
 * the Python `ai-service` (AGENTS_MODE=bindu), it supplies real did:key DIDs
 * and cryptographic signatures; the schema and these repositories are unchanged.
 */

const AGENTS_MODE: AgentMode = (process.env.AGENTS_MODE || 'inproc').toLowerCase() === 'bindu'
  ? 'bindu'
  : 'inproc';

/** Stable public-key fingerprint stand-in until Bindu mints real keys. */
function fingerprintFor(did: string): string {
  return createHash('sha256').update(did).digest('hex').slice(0, 32);
}

/** Verifiable-envelope signature stub (replaced by Bindu's real signatures). */
function signMessage(parts: string[]): string {
  return createHash('sha256').update(parts.join('|')).digest('hex');
}

interface AgentSeed {
  agentId: string;
  name: string;
  role: string;
  skills: Array<{ skillName: string; description: string }>;
}

/** The canonical FixFlowAI agents and the skills they advertise via Bindu. */
const AGENT_SEEDS: AgentSeed[] = [
  {
    agentId: 'auditor',
    name: 'Auditor Agent',
    role: 'Reviews budget alignment and deliverable coverage.',
    skills: [
      { skillName: 'proposal.audit', description: 'Audit a proposal for budget alignment and deliverable coverage.' },
    ],
  },
  {
    agentId: 'feasibility',
    name: 'Feasibility Agent',
    role: 'Reviews technical feasibility and timeline realism.',
    skills: [
      { skillName: 'proposal.feasibility', description: 'Assess technical feasibility and timeline realism of a proposal.' },
    ],
  },
  {
    agentId: 'optimizer',
    name: 'Optimizer Agent',
    role: 'Aggregates agent findings into the consensus confidence index.',
    skills: [
      { skillName: 'proposal.optimize', description: 'Aggregate audit + feasibility findings and self-correct the proposal.' },
    ],
  },
  {
    agentId: 'matching',
    name: 'Matching Agent',
    role: 'Advertises matching/lead-scoring capability for client agents to invoke.',
    skills: [
      { skillName: 'talent.match', description: 'Match a scored brief to top freelancer candidates.' },
    ],
  },
];

function didFor(agentId: string): string {
  return `did:fixflow:${agentId}`;
}

let ensured = false;

/**
 * Idempotently register the canonical agent identities + their skills. Safe to
 * call on every request; the underlying writes are upserts. Never throws.
 */
export async function ensureAgentsRegistered(): Promise<void> {
  if (ensured) return;
  const repo = getAgentRegistryRepository();
  const now = new Date().toISOString();
  try {
    for (const seed of AGENT_SEEDS) {
      const did = didFor(seed.agentId);
      const identity: AgentIdentity = {
        agentId: seed.agentId,
        did,
        name: seed.name,
        role: seed.role,
        fingerprint: fingerprintFor(did),
        mode: AGENTS_MODE,
        createdAt: now,
      };
      await repo.registerIdentity(identity);
      for (const s of seed.skills) {
        const skill: AgentSkill = {
          agentId: seed.agentId,
          skillName: s.skillName,
          description: s.description,
          createdAt: now,
        };
        await repo.registerSkill(skill);
      }
    }
    ensured = true;
  } catch (err) {
    // Registration is best-effort; a later call retries.
    console.warn('[Bindu] ensureAgentsRegistered failed:', (err as Error).message);
  }
}

/** Return the DID registry (identities) + advertised skills. */
export async function getAgentDirectory(): Promise<{
  mode: AgentMode;
  identities: AgentIdentity[];
  skills: AgentSkill[];
}> {
  await ensureAgentsRegistered();
  const repo = getAgentRegistryRepository();
  const [identities, skills] = await Promise.all([repo.listIdentities(), repo.listSkills()]);
  return { mode: AGENTS_MODE, identities, skills };
}

/** Return the ordered A2A message trace for one evaluation. */
export async function getEvaluationMessages(evaluationId: string): Promise<A2AMessage[]> {
  return getAgentRegistryRepository().listMessages(evaluationId);
}

function short(text: string, max = 240): string {
  const t = (text || '').trim();
  return t.length > max ? `${t.slice(0, max - 1)}…` : t;
}

/**
 * Build + persist the verifiable A2A message trace for a completed Confidence
 * Grid evaluation: Auditor → Optimizer, Feasibility → Optimizer, then the
 * Optimizer's decision. Returns the evaluationId used to correlate the trace.
 *
 * Fire-and-forget from the route: it never throws and never blocks the response.
 */
export async function recordEvaluationExchange(
  result: ConfidenceGridResult,
  correlationId?: string,
): Promise<string> {
  const evaluationId = correlationId || randomUUID();
  try {
    await ensureAgentsRegistered();
    const repo = getAgentRegistryRepository();
    const now = new Date().toISOString();

    const auditorDid = didFor('auditor');
    const feasibilityDid = didFor('feasibility');
    const optimizerDid = didFor('optimizer');

    const auditorSummary = short(
      `${result.auditor?.findings || 'Audit complete.'} Issues: ${(result.auditor?.issues || []).join('; ') || 'none'}.`,
    );
    const feasibilitySummary = short(
      `${result.feasibility?.findings || 'Feasibility review complete.'} Issues: ${(result.feasibility?.issues || []).join('; ') || 'none'}.`,
    );
    const decisionSummary = short(
      `Consensus confidence index ${Math.round(result.confidenceIndex)}${result.optimized ? ' (self-corrected)' : ''}.`,
    );

    const drafts: Array<Omit<A2AMessage, 'signature'>> = [
      {
        evaluationId,
        messageSeq: 1,
        fromAgent: 'auditor',
        fromDid: auditorDid,
        toAgent: 'optimizer',
        kind: 'audit.findings',
        summary: auditorSummary,
        createdAt: now,
      },
      {
        evaluationId,
        messageSeq: 2,
        fromAgent: 'feasibility',
        fromDid: feasibilityDid,
        toAgent: 'optimizer',
        kind: 'feasibility.findings',
        summary: feasibilitySummary,
        createdAt: now,
      },
      {
        evaluationId,
        messageSeq: 3,
        fromAgent: 'optimizer',
        fromDid: optimizerDid,
        toAgent: 'broadcast',
        kind: 'optimizer.decision',
        summary: decisionSummary,
        createdAt: now,
      },
    ];

    for (const d of drafts) {
      const signature = signMessage([d.evaluationId, String(d.messageSeq), d.fromDid, d.kind, d.summary]);
      await repo.appendMessage({ ...d, signature });
    }
  } catch (err) {
    console.warn('[Bindu] recordEvaluationExchange failed:', (err as Error).message);
  }
  return evaluationId;
}
