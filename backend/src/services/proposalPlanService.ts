import { createHash } from 'crypto';
import type { ExecutionPlan, PlanDiagnostics, Proposal } from '../types/ai.js';
import { generateExecutionPlan, validateExecutionPlan } from './aiClient.js';
import {
  applyJsonPatch,
  changedScopes,
  scopesDisjoint,
  JsonPatchError,
  type JsonPatchOperation,
} from './jsonPatch.js';
import {
  getProposalPlanRepository,
  PlanRevisionConflictError,
  type PlanActorRole,
  type ProposalPlanDocument,
  type ProposalPlanRevision,
} from './proposalPlanRepository.js';

/**
 * AI-008 orchestration: generate/read/patch/restore/approve/reopen for a deep
 * proposal plan. This layer owns idempotency, optimistic-concurrency conflict
 * handling, SHA-256 revision chaining, and validate-on-write (via the AI
 * service). It never touches escrow/payments — planning state is isolated.
 */

const GENESIS_HASH = '0'.repeat(64);

export class PlanNotFoundError extends Error {
  constructor() {
    super('Plan not found for this proposal.');
    this.name = 'PlanNotFoundError';
  }
}

export class PlanValidationError extends Error {
  constructor(public readonly diagnostics: PlanDiagnostics, message = 'Plan validation failed.') {
    super(message);
    this.name = 'PlanValidationError';
  }
}

export class PlanPatchError extends Error {
  constructor(message: string, public readonly path?: string) {
    super(message);
    this.name = 'PlanPatchError';
  }
}

export class PlanConflictError extends Error {
  constructor(
    public readonly baseRevision: number,
    public readonly currentRevision: number,
    public readonly conflictingScopes: string[],
  ) {
    super('Plan edit conflicts with a newer revision.');
    this.name = 'PlanConflictError';
  }
}

export class PlanStateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PlanStateError';
  }
}

function hashRevision(
  previousHash: string,
  revision: number,
  operationId: string,
  operations: JsonPatchOperation[],
): string {
  return createHash('sha256')
    .update(`${previousHash}|${revision}|${operationId}|${JSON.stringify(operations)}`)
    .digest('hex');
}

async function lastEntryHash(proposalId: string): Promise<string> {
  const repo = getProposalPlanRepository();
  const revs = await repo.listRevisions(proposalId);
  if (revs.length === 0) return GENESIS_HASH;
  return revs[revs.length - 1].entryHash;
}

/**
 * Create the plan for a proposal, or regenerate a section. Preserves client
 * edits outside the regenerated scope when a plan already exists.
 */
export async function generatePlan(opts: {
  proposalId: string;
  proposal: Proposal;
  briefText?: string;
  scope?: 'all' | 'architecture' | 'timeline';
  preserveClientEdits?: boolean;
  confirmOverwrite?: boolean;
  actorUserId: string;
}): Promise<{ document: ProposalPlanDocument; diagnostics: PlanDiagnostics }> {
  const repo = getProposalPlanRepository();
  const scope = opts.scope ?? 'all';
  const existing = await repo.getDocument(opts.proposalId);
  const now = new Date().toISOString();

  // First generation → create the document at revision 0 (the baseline).
  if (!existing) {
    const { executionPlan, diagnostics } = await generateExecutionPlan({
      proposal: opts.proposal,
      briefText: opts.briefText,
      scope: 'all',
    });
    const doc: ProposalPlanDocument = {
      proposalId: opts.proposalId,
      currentRevision: 0,
      status: 'draft',
      generatedBaseline: executionPlan,
      currentPlan: executionPlan,
      lastValidatedAt: now,
      updatedAt: now,
    };
    await repo.createDocument(doc);
    return { document: doc, diagnostics };
  }

  // Regenerating 'all' over an edited plan is destructive — require confirmation.
  if (scope === 'all' && existing.currentRevision > 0 && opts.confirmOverwrite !== true) {
    throw new PlanStateError(
      'Regenerating the whole plan discards client edits. Retry with confirmOverwrite: true.',
    );
  }

  const { executionPlan, diagnostics } = await generateExecutionPlan({
    proposal: opts.proposal,
    briefText: opts.briefText,
    scope,
    existingPlan: existing.currentPlan,
    preserveClientEdits: opts.preserveClientEdits ?? true,
  });

  const revision = existing.currentRevision + 1;
  const operations: JsonPatchOperation[] = []; // regeneration is a system replace, not a patch
  const previousHash = await lastEntryHash(opts.proposalId);
  const entryHash = hashRevision(previousHash, revision, `regen-${revision}`, operations);
  const revisionRecord: ProposalPlanRevision = {
    proposalId: opts.proposalId,
    revision,
    operationId: `regen-${revision}`,
    actorUserId: opts.actorUserId,
    actorRole: 'system',
    occurredAt: now,
    summary: `Regenerated ${scope} section`,
    operations,
    previousHash,
    entryHash,
    diagnosticsAfter: diagnostics,
    planAfter: executionPlan,
  };
  const doc: ProposalPlanDocument = {
    ...existing,
    currentPlan: executionPlan,
    currentRevision: revision,
    status: 'draft',
    lastValidatedAt: now,
    updatedAt: now,
  };
  await repo.commit(doc, revisionRecord, existing.currentRevision);
  return { document: doc, diagnostics };
}

export async function getPlan(proposalId: string): Promise<ProposalPlanDocument | null> {
  return getProposalPlanRepository().getDocument(proposalId);
}

export async function listPlanRevisions(proposalId: string): Promise<ProposalPlanRevision[]> {
  return getProposalPlanRepository().listRevisions(proposalId);
}

export interface PatchResult {
  document: ProposalPlanDocument;
  diagnostics: PlanDiagnostics;
  merged: boolean;
  replayed: boolean;
}

/** Apply a field-level client edit with idempotency, conflict, and validation. */
export async function patchPlan(opts: {
  proposalId: string;
  baseRevision: number;
  operationId: string;
  operations: JsonPatchOperation[];
  actorUserId: string;
  actorRole?: PlanActorRole;
  summary?: string;
}): Promise<PatchResult> {
  const repo = getProposalPlanRepository();
  const doc = await repo.getDocument(opts.proposalId);
  if (!doc) throw new PlanNotFoundError();

  // Idempotency: replay the original result for a repeated operationId.
  const prior = await repo.findRevisionByOperationId(opts.proposalId, opts.operationId);
  if (prior) {
    return {
      document: { ...doc, currentPlan: prior.planAfter, currentRevision: prior.revision },
      diagnostics: prior.diagnosticsAfter,
      merged: false,
      replayed: true,
    };
  }

  if (doc.status === 'approved') {
    throw new PlanStateError('Plan is approved. Reopen it before editing.');
  }

  // Conflict handling for a stale base revision.
  let merged = false;
  if (opts.baseRevision !== doc.currentRevision) {
    const laterRevs = (await repo.listRevisions(opts.proposalId)).filter(
      (r) => r.revision > opts.baseRevision,
    );
    const incoming = changedScopes(opts.operations);
    const theirs = new Set<string>();
    for (const r of laterRevs) for (const s of changedScopes(r.operations)) theirs.add(s);
    if (!scopesDisjoint(incoming, theirs)) {
      throw new PlanConflictError(
        opts.baseRevision,
        doc.currentRevision,
        [...incoming].filter((s) => theirs.has(s)),
      );
    }
    merged = true; // disjoint → safe to auto-merge onto current
  }

  // Apply onto the CURRENT plan (merge target), then validate.
  let nextPlan: ExecutionPlan;
  try {
    nextPlan = applyJsonPatch(doc.currentPlan, opts.operations);
  } catch (err) {
    if (err instanceof JsonPatchError) throw new PlanPatchError(err.message, err.path);
    throw err;
  }

  const diagnostics = await validateExecutionPlan(nextPlan);
  if (diagnostics.errorCount > 0) {
    throw new PlanValidationError(diagnostics);
  }
  nextPlan = { ...nextPlan, diagnostics };

  const now = new Date().toISOString();
  const revision = doc.currentRevision + 1;
  const previousHash = await lastEntryHash(opts.proposalId);
  const entryHash = hashRevision(previousHash, revision, opts.operationId, opts.operations);
  const revisionRecord: ProposalPlanRevision = {
    proposalId: opts.proposalId,
    revision,
    operationId: opts.operationId,
    actorUserId: opts.actorUserId,
    actorRole: opts.actorRole ?? 'client',
    occurredAt: now,
    summary: opts.summary || `${opts.operations.length} edit(s)`,
    operations: opts.operations,
    previousHash,
    entryHash,
    diagnosticsAfter: diagnostics,
    planAfter: nextPlan,
  };
  const nextDoc: ProposalPlanDocument = {
    ...doc,
    currentPlan: nextPlan,
    currentRevision: revision,
    // Editing invalidates a prior "in_review" state back to draft (an approved
    // plan is rejected earlier and can only be edited after reopen).
    status: 'draft',
    lastValidatedAt: now,
    updatedAt: now,
  };
  const committed = await repo.commit(nextDoc, revisionRecord, doc.currentRevision);
  return { document: committed, diagnostics, merged, replayed: false };
}

/** Restore an earlier revision (or the baseline, revision 0) as a NEW revision. */
export async function restoreRevision(opts: {
  proposalId: string;
  revision: number;
  baseRevision: number;
  operationId: string;
  actorUserId: string;
}): Promise<PatchResult> {
  const repo = getProposalPlanRepository();
  const doc = await repo.getDocument(opts.proposalId);
  if (!doc) throw new PlanNotFoundError();

  const prior = await repo.findRevisionByOperationId(opts.proposalId, opts.operationId);
  if (prior) {
    return {
      document: { ...doc, currentPlan: prior.planAfter, currentRevision: prior.revision },
      diagnostics: prior.diagnosticsAfter,
      merged: false,
      replayed: true,
    };
  }

  if (doc.status === 'approved') {
    throw new PlanStateError('Plan is approved. Reopen it before restoring a revision.');
  }
  if (opts.baseRevision !== doc.currentRevision) {
    throw new PlanConflictError(opts.baseRevision, doc.currentRevision, []);
  }

  // Resolve the target plan snapshot.
  let target: ExecutionPlan;
  if (opts.revision === 0) {
    target = doc.generatedBaseline;
  } else {
    const rev = await repo.getRevision(opts.proposalId, opts.revision);
    if (!rev) throw new PlanNotFoundError();
    target = rev.planAfter;
  }

  const diagnostics = await validateExecutionPlan(target);
  const restored: ExecutionPlan = { ...target, diagnostics };

  const now = new Date().toISOString();
  const revision = doc.currentRevision + 1;
  const operations: JsonPatchOperation[] = [];
  const previousHash = await lastEntryHash(opts.proposalId);
  const entryHash = hashRevision(previousHash, revision, opts.operationId, operations);
  const revisionRecord: ProposalPlanRevision = {
    proposalId: opts.proposalId,
    revision,
    operationId: opts.operationId,
    actorUserId: opts.actorUserId,
    actorRole: 'client',
    occurredAt: now,
    summary: `Restored revision ${opts.revision}`,
    operations,
    previousHash,
    entryHash,
    diagnosticsAfter: diagnostics,
    planAfter: restored,
  };
  const nextDoc: ProposalPlanDocument = {
    ...doc,
    currentPlan: restored,
    currentRevision: revision,
    status: 'draft',
    lastValidatedAt: now,
    updatedAt: now,
  };
  const committed = await repo.commit(nextDoc, revisionRecord, doc.currentRevision);
  return { document: committed, diagnostics, merged: false, replayed: false };
}

/** Freeze the reviewed revision. Rejects on validation errors / open blockers. */
export async function approvePlan(opts: {
  proposalId: string;
  expectedRevision: number;
  actorUserId: string;
}): Promise<ProposalPlanDocument> {
  const repo = getProposalPlanRepository();
  const doc = await repo.getDocument(opts.proposalId);
  if (!doc) throw new PlanNotFoundError();
  if (doc.currentRevision !== opts.expectedRevision) {
    throw new PlanConflictError(opts.expectedRevision, doc.currentRevision, []);
  }

  const diagnostics = doc.currentPlan.diagnostics || (await validateExecutionPlan(doc.currentPlan));
  if (diagnostics.errorCount > 0) {
    throw new PlanValidationError(diagnostics, 'Cannot approve a plan with validation errors.');
  }
  const blockingOpen = doc.currentPlan.openQuestions.filter((q) => q.blocking);
  if (blockingOpen.length > 0) {
    throw new PlanStateError(
      `Cannot approve: ${blockingOpen.length} blocking open question(s) unresolved.`,
    );
  }

  const now = new Date().toISOString();
  const nextDoc: ProposalPlanDocument = {
    ...doc,
    status: 'approved',
    approvedRevision: doc.currentRevision,
    updatedAt: now,
  };
  return repo.putDocument(nextDoc);
}

/** Reopen an approved plan for editing (invalidates only the plan approval). */
export async function reopenPlan(opts: {
  proposalId: string;
  actorUserId: string;
}): Promise<ProposalPlanDocument> {
  const repo = getProposalPlanRepository();
  const doc = await repo.getDocument(opts.proposalId);
  if (!doc) throw new PlanNotFoundError();
  const now = new Date().toISOString();
  const nextDoc: ProposalPlanDocument = { ...doc, status: 'draft', updatedAt: now };
  return repo.putDocument(nextDoc);
}
