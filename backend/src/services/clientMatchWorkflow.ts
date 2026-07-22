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
  'interviewing',
  'selected',
  'archived',
]);

export const ClientMatchActionSchema = z.enum([
  'shortlist',
  'invite',
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
    'start_interview',
    'select',
    'archive',
  ]),
  freelancerId: z.string().nullable(),
  fromStatus: ClientMatchStatusSchema.nullable(),
  toStatus: ClientMatchStatusSchema.nullable(),
  triggerUserId: z.string().min(1),
  triggerRole: z.enum(['client', 'system']),
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

const ACTION_TARGETS: Record<ClientMatchStatus, Partial<Record<ClientMatchAction, ClientMatchStatus>>> = {
  suggested: { shortlist: 'shortlisted', invite: 'invited', archive: 'archived' },
  shortlisted: { invite: 'invited', archive: 'archived' },
  invited: { start_interview: 'interviewing', archive: 'archived' },
  interviewing: { select: 'selected', archive: 'archived' },
  selected: {},
  archived: {},
};

function auditHash(input: Omit<z.infer<typeof ClientMatchAuditEntrySchema>, 'hash'>): string {
  return crypto.createHash('sha256').update(JSON.stringify(input)).digest('hex');
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
    triggerRole: 'client' | 'system';
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

/** Apply one client decision using optimistic concurrency and the hiring FSM. */
export function transitionClientMatch(
  workflow: ClientMatchWorkflow,
  freelancerId: string,
  action: ClientMatchAction,
  expectedVersion: number,
  triggerUserId: string,
): ClientMatchWorkflow {
  if (workflow.version !== expectedVersion) {
    throw new ClientMatchVersionMismatchError(expectedVersion, workflow.version);
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
      triggerRole: 'client',
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
