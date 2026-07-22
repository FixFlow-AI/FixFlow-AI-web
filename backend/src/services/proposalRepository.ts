import { randomUUID } from 'crypto';
import { readFile, writeFile, mkdir } from 'fs/promises';
import { dirname, resolve } from 'path';
import type { Proposal } from '../types/ai.js';
import {
  ClientMatchVersionMismatchError,
  type ClientMatchWorkflow,
} from './clientMatchWorkflow.js';

/**
 * Persistence for parsed proposals + their confidence-grid evaluations.
 *
 * Provider via env:
 *   PERSISTENCE_PROVIDER = "dynamodb" → DynamoDB (proposals table)
 *   (anything else)                   → in-memory (dev/local)
 *
 * Table: <prefix>_proposals  (PK proposalId, GSI UserProposalsIndex: userId + createdAt)
 */

/**
 * The client's step-by-step approval workflow state for a proposal. Persisted
 * so the sequential proposal builder (Talent tab) restores exactly where the
 * user left off — which step is active and which sections have been approved.
 */
export interface ProposalWorkflow {
  activeStep: number; // 1-based index of the step the user is on (1..N)
  approvedSteps: number[]; // contiguous prefix of approved step numbers, e.g. [1,2,3]
  updatedAt: string; // ISO timestamp of the last change (for last-write-wins)
}

export interface StoredProposal {
  proposalId: string;
  userId: string;
  title: string;
  briefText: string;
  proposal: Proposal;
  degraded: boolean;
  pinned?: boolean;
  evaluation?: unknown; // ConfidenceGridResult, stored opaque to avoid a hard dep
  workflow?: ProposalWorkflow; // sequential approval state (see above)
  /** Client-owned shortlist, invitation, and selection state for this proposal. */
  clientMatchWorkflow?: ClientMatchWorkflow;
  createdAt: string;
  updatedAt: string;
}

export interface ProposalRepository {
  create(input: { userId: string; briefText: string; proposal: Proposal; degraded: boolean }): Promise<StoredProposal>;
  get(proposalId: string): Promise<StoredProposal | null>;
  listByUser(userId: string): Promise<StoredProposal[]>;
  setEvaluation(proposalId: string, evaluation: unknown): Promise<StoredProposal | null>;
  setWorkflow(proposalId: string, workflow: ProposalWorkflow): Promise<StoredProposal | null>;
  setClientMatchWorkflow(
    proposalId: string,
    workflow: ClientMatchWorkflow,
    expectedVersion?: number,
  ): Promise<StoredProposal | null>;
  updateTitle(proposalId: string, title: string): Promise<StoredProposal | null>;
  togglePin(proposalId: string, pinned?: boolean): Promise<StoredProposal | null>;
}


function deriveTitle(p: Proposal): string {
  return (p.project_summary || 'Untitled project').split('.')[0].slice(0, 80);
}

function sortProposals(proposals: StoredProposal[]): StoredProposal[] {
  return [...proposals].sort((a, b) => {
    if (Boolean(a.pinned) !== Boolean(b.pinned)) {
      return a.pinned ? -1 : 1;
    }
    return b.createdAt.localeCompare(a.createdAt);
  });
}

// ---------- In-memory ----------

class InMemoryProposalRepository implements ProposalRepository {
  private store = new Map<string, StoredProposal>();

  async create({
    userId,
    briefText,
    proposal,
    degraded,
  }: {
    userId: string;
    briefText: string;
    proposal: Proposal;
    degraded: boolean;
  }) {
    const now = new Date().toISOString();
    const sp: StoredProposal = {
      proposalId: randomUUID(),
      userId,
      title: deriveTitle(proposal),
      briefText,
      proposal,
      degraded,
      pinned: false,
      createdAt: now,
      updatedAt: now,
    };
    this.store.set(sp.proposalId, sp);
    return sp;
  }
  async get(id: string) {
    return this.store.get(id) ?? null;
  }
  async listByUser(userId: string) {
    const userItems = [...this.store.values()].filter((p) => p.userId === userId);
    return sortProposals(userItems);
  }
  async setEvaluation(id: string, evaluation: unknown) {
    const sp = this.store.get(id);
    if (!sp) return null;
    sp.evaluation = evaluation;
    sp.updatedAt = new Date().toISOString();
    return sp;
  }
  async setWorkflow(id: string, workflow: ProposalWorkflow) {
    const sp = this.store.get(id);
    if (!sp) return null;
    sp.workflow = workflow;
    sp.updatedAt = new Date().toISOString();
    return sp;
  }
  async setClientMatchWorkflow(id: string, workflow: ClientMatchWorkflow, expectedVersion?: number) {
    const sp = this.store.get(id);
    if (!sp) return null;
    const currentVersion = sp.clientMatchWorkflow?.version;
    if (expectedVersion === undefined ? currentVersion !== undefined : currentVersion !== expectedVersion) {
      throw new ClientMatchVersionMismatchError(expectedVersion ?? 0, currentVersion ?? 0);
    }
    sp.clientMatchWorkflow = workflow;
    sp.updatedAt = new Date().toISOString();
    return sp;
  }
  async updateTitle(id: string, title: string) {
    const sp = this.store.get(id);
    if (!sp) return null;
    sp.title = title.trim();
    sp.updatedAt = new Date().toISOString();
    return sp;
  }
  async togglePin(id: string, pinned?: boolean) {
    const sp = this.store.get(id);
    if (!sp) return null;
    sp.pinned = typeof pinned === 'boolean' ? pinned : !sp.pinned;
    sp.updatedAt = new Date().toISOString();
    return sp;
  }
}

// ---------- DynamoDB ----------

class DynamoDbProposalRepository implements ProposalRepository {
  async create({ userId, briefText, proposal, degraded }: { userId: string; briefText: string; proposal: Proposal; degraded:boolean }) {
    const { ddb, table } = await import('../config/aws.js');
    const { PutCommand } = await import('@aws-sdk/lib-dynamodb');
    const now = new Date().toISOString();
    const sp: StoredProposal = {
      proposalId: randomUUID(),
      userId,
      title: deriveTitle(proposal),
      briefText,
      proposal,
      degraded,
      pinned: false,
      createdAt: now,
      updatedAt: now,
    };
    await ddb.send(new PutCommand({ TableName: table('proposals'), Item: sp }));
    return sp;
  }
  async get(id: string) {
    const { ddb, table } = await import('../config/aws.js');
    const { GetCommand } = await import('@aws-sdk/lib-dynamodb');
    const res = await ddb.send(
      new GetCommand({ TableName: table('proposals'), Key: { proposalId: id } }),
    );
    return (res.Item as StoredProposal) ?? null;
  }
  async listByUser(userId: string) {
    const { ddb, table } = await import('../config/aws.js');
    const { QueryCommand } = await import('@aws-sdk/lib-dynamodb');
    const res = await ddb.send(
      new QueryCommand({
        TableName: table('proposals'),
        IndexName: 'UserProposalsIndex',
        KeyConditionExpression: 'userId = :u',
        ExpressionAttributeValues: { ':u': userId },
        ScanIndexForward: false, // newest first
      }),
    );
    const items = (res.Items as StoredProposal[]) ?? [];
    return sortProposals(items);
  }
  async setEvaluation(id: string, evaluation: unknown) {
    const sp = await this.get(id);
    if (!sp) return null;
    sp.evaluation = evaluation;
    sp.updatedAt = new Date().toISOString();
    const { ddb, table } = await import('../config/aws.js');
    const { PutCommand } = await import('@aws-sdk/lib-dynamodb');
    await ddb.send(new PutCommand({ TableName: table('proposals'), Item: sp }));
    return sp;
  }
  async setWorkflow(id: string, workflow: ProposalWorkflow) {
    const sp = await this.get(id);
    if (!sp) return null;
    sp.workflow = workflow;
    sp.updatedAt = new Date().toISOString();
    const { ddb, table } = await import('../config/aws.js');
    const { PutCommand } = await import('@aws-sdk/lib-dynamodb');
    await ddb.send(new PutCommand({ TableName: table('proposals'), Item: sp }));
    return sp;
  }
  async setClientMatchWorkflow(id: string, workflow: ClientMatchWorkflow, expectedVersion?: number) {
    const sp = await this.get(id);
    if (!sp) return null;
    const currentVersion = sp.clientMatchWorkflow?.version;
    if (expectedVersion === undefined ? currentVersion !== undefined : currentVersion !== expectedVersion) {
      throw new ClientMatchVersionMismatchError(expectedVersion ?? 0, currentVersion ?? 0);
    }
    sp.clientMatchWorkflow = workflow;
    sp.updatedAt = new Date().toISOString();
    const { ddb, table } = await import('../config/aws.js');
    const { PutCommand } = await import('@aws-sdk/lib-dynamodb');
    try {
      await ddb.send(
        new PutCommand({
          TableName: table('proposals'),
          Item: sp,
          ConditionExpression:
            expectedVersion === undefined
              ? 'attribute_not_exists(#workflow)'
              : '#workflow.#version = :expectedVersion',
          ExpressionAttributeNames: { '#workflow': 'clientMatchWorkflow', '#version': 'version' },
          ExpressionAttributeValues:
            expectedVersion === undefined ? undefined : { ':expectedVersion': expectedVersion },
        }),
      );
    } catch (error) {
      if ((error as { name?: string }).name === 'ConditionalCheckFailedException') {
        throw new ClientMatchVersionMismatchError(expectedVersion ?? 0, currentVersion ?? 0);
      }
      throw error;
    }
    return sp;
  }
  async updateTitle(id: string, title: string) {
    const sp = await this.get(id);
    if (!sp) return null;
    sp.title = title.trim();
    sp.updatedAt = new Date().toISOString();
    const { ddb, table } = await import('../config/aws.js');
    const { PutCommand } = await import('@aws-sdk/lib-dynamodb');
    await ddb.send(new PutCommand({ TableName: table('proposals'), Item: sp }));
    return sp;
  }
  async togglePin(id: string, pinned?: boolean) {
    const sp = await this.get(id);
    if (!sp) return null;
    sp.pinned = typeof pinned === 'boolean' ? pinned : !sp.pinned;
    sp.updatedAt = new Date().toISOString();
    const { ddb, table } = await import('../config/aws.js');
    const { PutCommand } = await import('@aws-sdk/lib-dynamodb');
    await ddb.send(new PutCommand({ TableName: table('proposals'), Item: sp }));
    return sp;
  }
}

// ---------- File-backed (survives restarts) ----------

class FileProposalRepository implements ProposalRepository {
  private cache: StoredProposal[] | null = null;
  private writeChain: Promise<void> = Promise.resolve();

  constructor(private readonly filePath: string) {}

  private async load(): Promise<StoredProposal[]> {
    if (this.cache) return this.cache;
    try {
      const raw = await readFile(this.filePath, 'utf-8');
      const parsed = JSON.parse(raw);
      const list = Array.isArray(parsed) ? parsed : parsed?.proposals;
      this.cache = Array.isArray(list) ? (list as StoredProposal[]) : [];
    } catch {
      this.cache = [];
    }
    return this.cache;
  }

  private persist(): Promise<void> {
    this.writeChain = this.writeChain.then(async () => {
      if (!this.cache) return;
      await mkdir(dirname(this.filePath), { recursive: true });
      await writeFile(this.filePath, JSON.stringify({ proposals: this.cache }, null, 2) + '\n', 'utf-8');
    });
    return this.writeChain;
  }

  async create({
    userId,
    briefText,
    proposal,
    degraded,
  }: {
    userId: string;
    briefText: string;
    proposal: Proposal;
    degraded: boolean;
  }) {
    const list = await this.load();
    const now = new Date().toISOString();
    const sp: StoredProposal = {
      proposalId: randomUUID(),
      userId,
      title: deriveTitle(proposal),
      briefText,
      proposal,
      degraded,
      pinned: false,
      createdAt: now,
      updatedAt: now,
    };
    list.push(sp);
    await this.persist();
    return sp;
  }

  async get(id: string) {
    const list = await this.load();
    return list.find((p) => p.proposalId === id) ?? null;
  }

  async listByUser(userId: string) {
    const list = await this.load();
    const items = list.filter((p) => p.userId === userId);
    return sortProposals(items);
  }

  async setEvaluation(id: string, evaluation: unknown) {
    const list = await this.load();
    const sp = list.find((p) => p.proposalId === id);
    if (!sp) return null;
    sp.evaluation = evaluation;
    sp.updatedAt = new Date().toISOString();
    await this.persist();
    return sp;
  }

  async setWorkflow(id: string, workflow: ProposalWorkflow) {
    const list = await this.load();
    const sp = list.find((p) => p.proposalId === id);
    if (!sp) return null;
    sp.workflow = workflow;
    sp.updatedAt = new Date().toISOString();
    await this.persist();
    return sp;
  }

  async setClientMatchWorkflow(id: string, workflow: ClientMatchWorkflow, expectedVersion?: number) {
    const list = await this.load();
    const sp = list.find((p) => p.proposalId === id);
    if (!sp) return null;
    const currentVersion = sp.clientMatchWorkflow?.version;
    if (expectedVersion === undefined ? currentVersion !== undefined : currentVersion !== expectedVersion) {
      throw new ClientMatchVersionMismatchError(expectedVersion ?? 0, currentVersion ?? 0);
    }
    sp.clientMatchWorkflow = workflow;
    sp.updatedAt = new Date().toISOString();
    await this.persist();
    return sp;
  }

  async updateTitle(id: string, title: string) {
    const list = await this.load();
    const sp = list.find((p) => p.proposalId === id);
    if (!sp) return null;
    sp.title = title.trim();
    sp.updatedAt = new Date().toISOString();
    await this.persist();
    return sp;
  }

  async togglePin(id: string, pinned?: boolean) {
    const list = await this.load();
    const sp = list.find((p) => p.proposalId === id);
    if (!sp) return null;
    sp.pinned = typeof pinned === 'boolean' ? pinned : !sp.pinned;
    sp.updatedAt = new Date().toISOString();
    await this.persist();
    return sp;
  }
}

// ---------- Factory ----------

let cached: ProposalRepository | null = null;

export function getProposalRepository(): ProposalRepository {
  if (cached) return cached;
  const provider = (process.env.PERSISTENCE_PROVIDER || 'file').toLowerCase();
  if (provider === 'dynamodb') {
    cached = new DynamoDbProposalRepository();
  } else if (provider === 'memory') {
    cached = new InMemoryProposalRepository();
  } else {
    const file =
      process.env.PROPOSALS_STORE_FILE ||
      resolve(process.cwd(), 'data/proposals.json');
    cached = new FileProposalRepository(file);
  }
  return cached;
}
