import { randomUUID } from 'crypto';
import type { Proposal } from '../skills/briefParser.js';

/**
 * Persistence for parsed proposals + their confidence-grid evaluations.
 *
 * Provider via env:
 *   PERSISTENCE_PROVIDER = "dynamodb" → DynamoDB (proposals table)
 *   (anything else)                   → in-memory (dev/local)
 *
 * Table: <prefix>_proposals  (PK proposalId, GSI UserProposalsIndex: userId + createdAt)
 */

export interface StoredProposal {
  proposalId: string;
  userId: string;
  title: string;
  briefText: string;
  proposal: Proposal;
  evaluation?: unknown; // ConfidenceGridResult, stored opaque to avoid a hard dep
  createdAt: string;
  updatedAt: string;
}

export interface ProposalRepository {
  create(input: { userId: string; briefText: string; proposal: Proposal }): Promise<StoredProposal>;
  get(proposalId: string): Promise<StoredProposal | null>;
  listByUser(userId: string): Promise<StoredProposal[]>;
  setEvaluation(proposalId: string, evaluation: unknown): Promise<StoredProposal | null>;
}

function deriveTitle(p: Proposal): string {
  return (p.project_summary || 'Untitled project').split('.')[0].slice(0, 80);
}

// ---------- In-memory ----------

class InMemoryProposalRepository implements ProposalRepository {
  private store = new Map<string, StoredProposal>();

  async create({ userId, briefText, proposal }: { userId: string; briefText: string; proposal: Proposal }) {
    const now = new Date().toISOString();
    const sp: StoredProposal = {
      proposalId: randomUUID(),
      userId,
      title: deriveTitle(proposal),
      briefText,
      proposal,
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
    return [...this.store.values()]
      .filter((p) => p.userId === userId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
  async setEvaluation(id: string, evaluation: unknown) {
    const sp = this.store.get(id);
    if (!sp) return null;
    sp.evaluation = evaluation;
    sp.updatedAt = new Date().toISOString();
    return sp;
  }
}

// ---------- DynamoDB ----------

class DynamoDbProposalRepository implements ProposalRepository {
  async create({ userId, briefText, proposal }: { userId: string; briefText: string; proposal: Proposal }) {
    const { ddb, table } = await import('../config/aws.js');
    const { PutCommand } = await import('@aws-sdk/lib-dynamodb');
    const now = new Date().toISOString();
    const sp: StoredProposal = {
      proposalId: randomUUID(),
      userId,
      title: deriveTitle(proposal),
      briefText,
      proposal,
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
    return (res.Items as StoredProposal[]) ?? [];
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
}

// ---------- Factory ----------

let cached: ProposalRepository | null = null;

export function getProposalRepository(): ProposalRepository {
  if (cached) return cached;
  const provider = (process.env.PERSISTENCE_PROVIDER || '').toLowerCase();
  cached = provider === 'dynamodb'
    ? new DynamoDbProposalRepository()
    : new InMemoryProposalRepository();
  return cached;
}
