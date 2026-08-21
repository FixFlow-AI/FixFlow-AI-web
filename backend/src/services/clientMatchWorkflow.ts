import crypto from 'crypto';
import { z } from 'zod';

import type { MatchResult, ShortlistCoverage, ShortlistOutput } from './matchingEngine.js';

/**
 * Persisted, client-owned hiring workflow for one parsed project proposal.
 *
 * Scores are a snapshot of the shortlist generated at a specific point in
 * time. Client decisions are modelled separately from the score so a re-run
 * can refresh evidence without losing an invitation or interview decision.
 */

export const ClientMatchStatusSchema = z.enum([
  'suggested',
  'shortlisted',
  'invited',
  'accepted',
  'declined',
  'interviewing',
  'selected',
  'archived',
]);

export const ClientMatchActionSchema = z.enum([
  'shortlist',
  'invite',
  'accept',
  'decline',
  'start_interview',
  'select',
  'archive',
]);

const MatchResultSchema = z.object({
  freelancerId: z.string().min(1),
  name: z.string().min(1),
  title: z.string(),
  compositeScore: z.number().min(0).max(100),
  factorBreakdown: z.record(z.number().min(0).max(100)),
  fitReasons: z.array(z.string()),
  skillGaps: z.array(z.string()),
  riskFlags: z.array(z.string()),
  matchType: z.enum(['primary', 'supplementary']).optional(),
  coversSkills: z.array(z.string()).optional(),
  // Provenance of the candidate. 'platform' members have a real account and can
  // accept an invitation; 'sample' profiles are seeded demo data and cannot.
  // Optional so shortlists persisted before this field remain parseable.
  source: z.enum(['platform', 'sample']).optional(),
});

const CoverageSchema = z.object({
  requiredSkills: z.array(z.string()),
  coveredSkills: z.array(z.string()),
  uncoveredSkills: z.array(z.string()),
  coveragePct: z.number().min(0).max(100),
  strongCandidateCount: z.number().int().nonnegative(),
  teamRecommended: z.boolean(),
});

export const ClientMatchCandidateSchema = MatchResultSchema.extend({
  status: ClientMatchStatusSchema,
  updatedAt: z.string().datetime(),
});

export const ClientMatchAuditEntrySchema = z.object({
  timestamp: z.string().datetime(),
  action: z.enum([
    'shortlist_generated',
    'shortlist_refreshed',
    'shortlist',
    'invite',
    'accept',
    'decline',
    'start_interview',
    'select',
    'archive',
  ]),
  freelancerId: z.string().nullable(),
  fromStatus: ClientMatchStatusSchema.nullable(),
  toStatus: ClientMatchStatusSchema.nullable(),
  triggerUserId: z.string().min(1),
  triggerRole: z.enum(['client', 'freelancer', 'system']),
  version: z.number().int().positive(),
  previousHash: z.string(),
  hash: z.string().length(64),
});

export const ClientMatchWorkflowSchema = z.object({
  version: z.number().int().positive(),
  candidates: z.array(ClientMatchCandidateSchema),
  coverage: CoverageSchema,
  totalCandidatesEvaluated: z.number().int().nonnegative(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  lastAuditHash: z.string(),
  auditTrail: z.array(ClientMatchAuditEntrySchema),
});

export type ClientMatchStatus = z.infer<typeof ClientMatchStatusSchema>;
export type ClientMatchAction = z.infer<typeof ClientMatchActionSchema>;
export type ClientMatchTriggerRole = 'client' | 'freelancer' | 'system';
export type ClientMatchCandidate = z.infer<typeof ClientMatchCandidateSchema>;
export type ClientMatchWorkflow = z.infer<typeof ClientMatchWorkflowSchema>;

export class ClientMatchVersionMismatchError extends Error {
  constructor(
    public readonly expectedVersion: number,
    public readonly actualVersion: number,
  ) {
    super(`Match workflow changed (expected version ${expectedVersion}, current version ${actualVersion}).`);
    this.name = 'ClientMatchVersionMismatchError';
  }
}

export class InvalidClientMatchTransitionError extends Error {
  constructor(from: ClientMatchStatus, action: ClientMatchAction) {
    super(`Cannot ${action} a candidate while their match is ${from}.`);
    this.name = 'InvalidClientMatchTransitionError';
  }
}

/** Raised when a role attempts an action reserved for the other party. */
export class ClientMatchPermissionError extends Error {
  constructor(role: ClientMatchTriggerRole, action: ClientMatchAction) {
    super(`A ${role} cannot perform the "${action}" action on a project match.`);
    this.name = 'ClientMatchPermissionError';
  }
}

/**
 * Hiring is a TWO-SIDED handshake. A client may only *offer* — they can never
 * move a candidate into the project on their own.
 *
 * Deliberate constraint: `invited` does NOT allow `start_interview` or `select`.
 * The only exits from `invited` are the freelancer's own `accept`/`decline`
 * (or the client withdrawing via `archive`). That is what stops a client from
 * hiring someone who never agreed.
 *
 *   suggested ──shortlist──> shortlisted ──invite──> invited
 *                                                      │
 *                          freelancer decides ─────────┤
 *                                                      ├─accept──> accepted ──select──> selected
 *                                                      └─decline─> declined
 */
const ACTION_TARGETS: Record<ClientMatchStatus, Partial<Record<ClientMatchAction, ClientMatchStatus>>> = {
  suggested: { shortlist: 'shortlisted', invite: 'invited', archive: 'archived' },
  shortlisted: { invite: 'invited', archive: 'archived' },
  // Freelancer-controlled gate. No client action can skip past this.
  invited: { accept: 'accepted', decline: 'declined', archive: 'archived' },
  // Consent given: only now may the client interview or select.
  accepted: { start_interview: 'interviewing', select: 'selected', archive: 'archived' },
  interviewing: { select: 'selected', archive: 'archived' },
  declined: { archive: 'archived' },
  selected: {},
  archived: {},
};

/** Which party is allowed to trigger each action. */
const ACTION_ROLES: Record<ClientMatchAction, ClientMatchTriggerRole[]> = {
  shortlist: ['client'],
  invite: ['client'],
  accept: ['freelancer'],
  decline: ['freelancer'],
  start_interview: ['client'],
  select: ['client'],
  archive: ['client'],
};

/**
 * Deterministic, key-order-independent JSON serialisation.
 *
 * The audit chain is hashed, then stored and read back. `JSON.stringify` emits
 * keys in insertion order, but DynamoDB stores maps UNORDERED — a round-trip
 * returns the same data with a different key order, which changed the hash and
 * made every persisted chain fail verification (surfacing as HTTP 409
 * "Match history integrity check failed"). Sorting keys makes the hash depend
 * on the data alone, so it survives any storage backend.
 */
function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  const record = value as Record<string, unknown>;
  const entries = Object.keys(record)
    .sort()
    // Mirror JSON.stringify, which omits undefined-valued keys entirely.
    .filter((key) => record[key] !== undefined)
    .map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`);
  return `{${entries.join(',')}}`;
}

function auditHash(input: Omit<z.infer<typeof ClientMatchAuditEntrySchema>, 'hash'>): string {
  return crypto.createHash('sha256').update(canonicalJson(input)).digest('hex');
}

function appendAudit(
  workflow: Omit<ClientMatchWorkflow, 'auditTrail' | 'lastAuditHash'> & {
    auditTrail: z.infer<typeof ClientMatchAuditEntrySchema>[];
    lastAuditHash: string;
  },
  input: {
    action: z.infer<typeof ClientMatchAuditEntrySchema>['action'];
    freelancerId: string | null;
    fromStatus: ClientMatchStatus | null;
    toStatus: ClientMatchStatus | null;
    triggerUserId: string;
    triggerRole: ClientMatchTriggerRole;
    version: number;
    timestamp: string;
  },
): ClientMatchWorkflow {
  const entryWithoutHash = {
    ...input,
    previousHash: workflow.lastAuditHash,
  };
  const entry = { ...entryWithoutHash, hash: auditHash(entryWithoutHash) };
  return ClientMatchWorkflowSchema.parse({
    ...workflow,
    lastAuditHash: entry.hash,
    auditTrail: [...workflow.auditTrail, entry],
  });
}

function dedupeMatches(output: ShortlistOutput): MatchResult[] {
  const seen = new Set<string>();
  return [...output.shortlist, ...output.supplementary].filter((candidate) => {
    if (seen.has(candidate.freelancerId)) return false;
    seen.add(candidate.freelancerId);
    return true;
  });
}

function makeCandidate(match: MatchResult, status: ClientMatchStatus, updatedAt: string): ClientMatchCandidate {
  return ClientMatchCandidateSchema.parse({ ...match, status, updatedAt });
}

function cloneCoverage(coverage: ShortlistCoverage): z.infer<typeof CoverageSchema> {
  return CoverageSchema.parse(coverage);
}

/** Create the initial, immutable-audited hiring state from a shortlist. */
export function createClientMatchWorkflow(
  output: ShortlistOutput,
  triggerUserId: string,
): ClientMatchWorkflow {
  const now = new Date().toISOString();
  const candidates = dedupeMatches(output).map((match) => makeCandidate(match, 'suggested', now));

  return appendAudit(
    {
      version: 1,
      candidates,
      coverage: cloneCoverage(output.coverage),
      totalCandidatesEvaluated: output.totalCandidatesEvaluated,
      createdAt: now,
      updatedAt: now,
      lastAuditHash: '',
      auditTrail: [],
    },
    {
      timestamp: now,
      action: 'shortlist_generated',
      freelancerId: null,
      fromStatus: null,
      toStatus: null,
      triggerUserId,
      triggerRole: 'client',
      version: 1,
    },
  );
}

/** Refresh score evidence while preserving every existing client decision. */
export function refreshClientMatchWorkflow(
  workflow: ClientMatchWorkflow,
  output: ShortlistOutput,
  expectedVersion: number,
  triggerUserId: string,
): ClientMatchWorkflow {
  if (workflow.version !== expectedVersion) {
    throw new ClientMatchVersionMismatchError(expectedVersion, workflow.version);
  }

  const now = new Date().toISOString();
  const existingByFreelancer = new Map(workflow.candidates.map((candidate) => [candidate.freelancerId, candidate]));
  const candidates = dedupeMatches(output).map((match) => {
    const existing = existingByFreelancer.get(match.freelancerId);
    return makeCandidate(match, existing?.status ?? 'suggested', existing?.updatedAt ?? now);
  });

  return appendAudit(
    {
      ...workflow,
      version: workflow.version + 1,
      candidates,
      coverage: cloneCoverage(output.coverage),
      totalCandidatesEvaluated: output.totalCandidatesEvaluated,
      updatedAt: now,
    },
    {
      timestamp: now,
      action: 'shortlist_refreshed',
      freelancerId: null,
      fromStatus: null,
      toStatus: null,
      triggerUserId,
      triggerRole: 'client',
      version: workflow.version + 1,
    },
  );
}

/**
 * Apply one hiring decision using optimistic concurrency, the hiring FSM, and
 * the per-role permission matrix.
 *
 * `triggerRole` is required: the same workflow is now mutated by two different
 * parties, so the caller must state which side is acting. The FSM alone is not
 * enough — without this check a client could call `accept` on the freelancer's
 * behalf, which is exactly the consent bypass this guards against.
 */
export function transitionClientMatch(
  workflow: ClientMatchWorkflow,
  freelancerId: string,
  action: ClientMatchAction,
  expectedVersion: number,
  triggerUserId: string,
  triggerRole: ClientMatchTriggerRole,
): ClientMatchWorkflow {
  if (workflow.version !== expectedVersion) {
    throw new ClientMatchVersionMismatchError(expectedVersion, workflow.version);
  }

  if (!ACTION_ROLES[action].includes(triggerRole)) {
    throw new ClientMatchPermissionError(triggerRole, action);
  }

  const candidate = workflow.candidates.find((item) => item.freelancerId === freelancerId);
  if (!candidate) throw new Error('Candidate is not part of this project shortlist.');

  const nextStatus = ACTION_TARGETS[candidate.status][action];
  if (!nextStatus) throw new InvalidClientMatchTransitionError(candidate.status, action);

  const now = new Date().toISOString();
  return appendAudit(
    {
      ...workflow,
      version: workflow.version + 1,
      candidates: workflow.candidates.map((item) =>
        item.freelancerId === freelancerId
          ? { ...item, status: nextStatus, updatedAt: now }
          : item,
      ),
      updatedAt: now,
    },
    {
      timestamp: now,
      action,
      freelancerId,
      fromStatus: candidate.status,
      toStatus: nextStatus,
      triggerUserId,
      triggerRole,
      version: workflow.version + 1,
    },
  );
}

/** Verifies every chained state-change audit entry before presenting it to a client. */
export function verifyClientMatchAudit(workflow: ClientMatchWorkflow): boolean {
  let previousHash = '';
  for (const entry of workflow.auditTrail) {
    if (entry.previousHash !== previousHash) return false;
    const { hash, ...withoutHash } = entry;
    if (auditHash(withoutHash) !== hash) return false;
    previousHash = hash;
  }
  return previousHash === workflow.lastAuditHash;
}
