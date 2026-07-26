import { readFile, writeFile, mkdir } from 'fs/promises';
import { dirname, resolve } from 'path';
import type { ExecutionPlan, PlanDiagnostics } from '../types/ai.js';
import type { JsonPatchOperation } from './jsonPatch.js';

/**
 * Durable storage for AI-008 proposal plans + their revision audit chain.
 *
 * Two record kinds, mirroring the escrow audit pattern:
 *   - ProposalPlanDocument  (one per proposal) — the current + baseline plan,
 *     status, and monotonically increasing currentRevision.
 *   - ProposalPlanRevision  (append-only) — every accepted edit, SHA-256
 *     chained, with the JSON Patch operations and post-edit diagnostics.
 *
 * Provider via env (mirrors proposalRepository):
 *   PERSISTENCE_PROVIDER = "dynamodb" → DynamoDB (proposal_plans + proposal_plan_revisions)
 *   "memory"                          → in-memory
 *   (else / "file")                   → file-backed
 *
 * Concurrency: writes are conditional on the expected currentRevision so two
 * clients can never silently overwrite the same plan (spec §7).
 */

export type ProposalPlanStatus = 'draft' | 'in_review' | 'approved' | 'superseded';
export type PlanActorRole = 'client' | 'freelancer' | 'system';

export interface ProposalPlanDocument {
  proposalId: string;
  currentRevision: number;
  status: ProposalPlanStatus;
  generatedBaseline: ExecutionPlan;
  currentPlan: ExecutionPlan;
  approvedRevision?: number;
  lastValidatedAt: string;
  updatedAt: string;
}

export interface ProposalPlanRevision {
  proposalId: string;
  revision: number;
  operationId: string;
  actorUserId: string;
  actorRole: PlanActorRole;
  occurredAt: string;
  summary: string; // short human description of the change
  operations: JsonPatchOperation[];
  previousHash: string;
  entryHash: string;
  diagnosticsAfter: PlanDiagnostics;
  /** Snapshot of the plan *after* this revision — enables reliable restore. */
  planAfter: ExecutionPlan;
}

/** Thrown when a conditional write loses the optimistic-concurrency race. */
export class PlanRevisionConflictError extends Error {
  constructor(
    public readonly expected: number,
    public readonly actual: number,
  ) {
    super(`Plan revision conflict: expected ${expected}, found ${actual}.`);
    this.name = 'PlanRevisionConflictError';
  }
}

export interface ProposalPlanRepository {
  getDocument(proposalId: string): Promise<ProposalPlanDocument | null>;
  /** Create the initial document (revision 0). Fails if one already exists. */
  createDocument(doc: ProposalPlanDocument): Promise<ProposalPlanDocument>;
  /**
   * Atomically persist the new document + its revision, but only if the stored
   * currentRevision equals `expectedRevision`. Throws PlanRevisionConflictError
   * otherwise.
   */
  commit(
    doc: ProposalPlanDocument,
    revision: ProposalPlanRevision,
    expectedRevision: number,
  ): Promise<ProposalPlanDocument>;
  /** Overwrite the document without adding a revision (status/approve/reopen). */
  putDocument(doc: ProposalPlanDocument): Promise<ProposalPlanDocument>;
  listRevisions(proposalId: string): Promise<ProposalPlanRevision[]>;
  getRevision(proposalId: string, revision: number): Promise<ProposalPlanRevision | null>;
  findRevisionByOperationId(proposalId: string, operationId: string): Promise<ProposalPlanRevision | null>;
}

// ---------- In-memory ----------

class InMemoryProposalPlanRepository implements ProposalPlanRepository {
  private docs = new Map<string, ProposalPlanDocument>();
  private revs = new Map<string, ProposalPlanRevision[]>();

  async getDocument(id: string) {
    return this.docs.get(id) ?? null;
  }
  async createDocument(doc: ProposalPlanDocument) {
    if (this.docs.has(doc.proposalId)) throw new Error('Plan document already exists.');
    this.docs.set(doc.proposalId, doc);
    this.revs.set(doc.proposalId, []);
    return doc;
  }
  async commit(doc: ProposalPlanDocument, revision: ProposalPlanRevision, expectedRevision: number) {
    const cur = this.docs.get(doc.proposalId);
    const actual = cur?.currentRevision ?? -1;
    if (actual !== expectedRevision) throw new PlanRevisionConflictError(expectedRevision, actual);
    this.docs.set(doc.proposalId, doc);
    const list = this.revs.get(doc.proposalId) ?? [];
    list.push(revision);
    this.revs.set(doc.proposalId, list);
    return doc;
  }
  async putDocument(doc: ProposalPlanDocument) {
    this.docs.set(doc.proposalId, doc);
    return doc;
  }
  async listRevisions(id: string) {
    return [...(this.revs.get(id) ?? [])].sort((a, b) => a.revision - b.revision);
  }
  async getRevision(id: string, revision: number) {
    return (this.revs.get(id) ?? []).find((r) => r.revision === revision) ?? null;
  }
  async findRevisionByOperationId(id: string, operationId: string) {
    return (this.revs.get(id) ?? []).find((r) => r.operationId === operationId) ?? null;
  }
}

// ---------- File-backed ----------

interface PlanStoreShape {
  documents: Record<string, ProposalPlanDocument>;
  revisions: Record<string, ProposalPlanRevision[]>;
}

class FileProposalPlanRepository implements ProposalPlanRepository {
  private cache: PlanStoreShape | null = null;
  private writeChain: Promise<void> = Promise.resolve();

  constructor(private readonly filePath: string) {}

  private async load(): Promise<PlanStoreShape> {
    if (this.cache) return this.cache;
    let loaded: PlanStoreShape;
    try {
      const raw = await readFile(this.filePath, 'utf-8');
      const parsed = JSON.parse(raw);
      loaded = {
        documents: parsed.documents || {},
        revisions: parsed.revisions || {},
      };
    } catch {
      loaded = { documents: {}, revisions: {} };
    }
    this.cache = loaded;
    return loaded;
  }

  private persist(): Promise<void> {
    this.writeChain = this.writeChain.then(async () => {
      if (!this.cache) return;
      await mkdir(dirname(this.filePath), { recursive: true });
      await writeFile(this.filePath, JSON.stringify(this.cache, null, 2) + '\n', 'utf-8');
    });
    return this.writeChain;
  }

  async getDocument(id: string) {
    const s = await this.load();
    return s.documents[id] ?? null;
  }
  async createDocument(doc: ProposalPlanDocument) {
    const s = await this.load();
    if (s.documents[doc.proposalId]) throw new Error('Plan document already exists.');
    s.documents[doc.proposalId] = doc;
    s.revisions[doc.proposalId] = [];
    await this.persist();
    return doc;
  }
  async commit(doc: ProposalPlanDocument, revision: ProposalPlanRevision, expectedRevision: number) {
    const s = await this.load();
    const actual = s.documents[doc.proposalId]?.currentRevision ?? -1;
    if (actual !== expectedRevision) throw new PlanRevisionConflictError(expectedRevision, actual);
    s.documents[doc.proposalId] = doc;
    s.revisions[doc.proposalId] = [...(s.revisions[doc.proposalId] || []), revision];
    await this.persist();
    return doc;
  }
  async putDocument(doc: ProposalPlanDocument) {
    const s = await this.load();
    s.documents[doc.proposalId] = doc;
    await this.persist();
    return doc;
  }
  async listRevisions(id: string) {
    const s = await this.load();
    return [...(s.revisions[id] || [])].sort((a, b) => a.revision - b.revision);
  }
  async getRevision(id: string, revision: number) {
    const s = await this.load();
    return (s.revisions[id] || []).find((r) => r.revision === revision) ?? null;
  }
  async findRevisionByOperationId(id: string, operationId: string) {
    const s = await this.load();
    return (s.revisions[id] || []).find((r) => r.operationId === operationId) ?? null;
  }
}

// ---------- DynamoDB ----------

class DynamoDbProposalPlanRepository implements ProposalPlanRepository {
  async getDocument(id: string) {
    const { ddb, table } = await import('../config/aws.js');
    const { GetCommand } = await import('@aws-sdk/lib-dynamodb');
    const res = await ddb.send(
      new GetCommand({ TableName: table('proposal_plans'), Key: { proposalId: id } }),
    );
    return (res.Item as ProposalPlanDocument) ?? null;
  }
  async createDocument(doc: ProposalPlanDocument) {
    const { ddb, table } = await import('../config/aws.js');
    const { PutCommand } = await import('@aws-sdk/lib-dynamodb');
    await ddb.send(
      new PutCommand({
        TableName: table('proposal_plans'),
        Item: doc,
        ConditionExpression: 'attribute_not_exists(proposalId)',
      }),
    );
    return doc;
  }
  async commit(doc: ProposalPlanDocument, revision: ProposalPlanRevision, expectedRevision: number) {
    const { ddb, table } = await import('../config/aws.js');
    const { TransactWriteCommand } = await import('@aws-sdk/lib-dynamodb');
    try {
      await ddb.send(
        new TransactWriteCommand({
          TransactItems: [
            {
              Put: {
                TableName: table('proposal_plans'),
                Item: doc,
                ConditionExpression: 'currentRevision = :expected',
                ExpressionAttributeValues: { ':expected': expectedRevision },
              },
            },
            {
              Put: {
                TableName: table('proposal_plan_revisions'),
                Item: revision,
                ConditionExpression: 'attribute_not_exists(revision)',
              },
            },
          ],
        }),
      );
      return doc;
    } catch (err: any) {
      if (
        err?.name === 'TransactionCanceledException' ||
        err?.name === 'ConditionalCheckFailedException'
      ) {
        const current = await this.getDocument(doc.proposalId);
        throw new PlanRevisionConflictError(expectedRevision, current?.currentRevision ?? -1);
      }
      throw err;
    }
  }
  async putDocument(doc: ProposalPlanDocument) {
    const { ddb, table } = await import('../config/aws.js');
    const { PutCommand } = await import('@aws-sdk/lib-dynamodb');
    await ddb.send(new PutCommand({ TableName: table('proposal_plans'), Item: doc }));
    return doc;
  }
  async listRevisions(id: string) {
    const { ddb, table } = await import('../config/aws.js');
    const { QueryCommand } = await import('@aws-sdk/lib-dynamodb');
    const res = await ddb.send(
      new QueryCommand({
        TableName: table('proposal_plan_revisions'),
        KeyConditionExpression: 'proposalId = :p',
        ExpressionAttributeValues: { ':p': id },
        ScanIndexForward: true,
      }),
    );
    return (res.Items as ProposalPlanRevision[]) ?? [];
  }
  async getRevision(id: string, revision: number) {
    const { ddb, table } = await import('../config/aws.js');
    const { GetCommand } = await import('@aws-sdk/lib-dynamodb');
    const res = await ddb.send(
      new GetCommand({ TableName: table('proposal_plan_revisions'), Key: { proposalId: id, revision } }),
    );
    return (res.Item as ProposalPlanRevision) ?? null;
  }
  async findRevisionByOperationId(id: string, operationId: string) {
    const revs = await this.listRevisions(id);
    return revs.find((r) => r.operationId === operationId) ?? null;
  }
}

// ---------- Factory ----------

let cached: ProposalPlanRepository | null = null;

export function getProposalPlanRepository(): ProposalPlanRepository {
  if (cached) return cached;
  const provider = (process.env.PERSISTENCE_PROVIDER || 'file').toLowerCase();
  if (provider === 'dynamodb') {
    cached = new DynamoDbProposalPlanRepository();
  } else if (provider === 'memory') {
    cached = new InMemoryProposalPlanRepository();
  } else {
    const file =
      process.env.PROPOSAL_PLANS_STORE_FILE ||
      resolve(process.cwd(), 'data/proposal_plans.json');
    cached = new FileProposalPlanRepository(file);
  }
  return cached;
}

/** Test seam: reset the cached repository (used by unit tests). */
export function __resetProposalPlanRepository(): void {
  cached = null;
}
