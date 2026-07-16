import { readFile, writeFile, mkdir } from 'fs/promises';
import { dirname, resolve } from 'path';
import type { Milestone, AuditTrailBlock } from '../skills/escrowStateMachine.js';

/**
 * Persistence seam for escrow milestones + their cryptographic audit chain.
 *
 * Provider selected via env:
 *   PERSISTENCE_PROVIDER = "dynamodb"  → DynamoDbMilestoneRepository
 *   (anything else)                    → InMemoryMilestoneRepository (dev/local)
 *
 * The FSM logic stays in escrowStateMachine.ts (pure). escrowService.ts
 * orchestrates this repository with that logic.
 */
export interface MilestoneRepository {
  create(milestone: Milestone): Promise<void>;
  get(id: string): Promise<Milestone | null>;
  list(proposalId?: string): Promise<Milestone[]>;
  save(milestone: Milestone): Promise<void>;
  getAuditBlocks(milestoneId: string): Promise<AuditTrailBlock[]>;
  appendAuditBlock(block: AuditTrailBlock): Promise<void>;
}

// ---------- In-memory (default for local dev) ----------

class InMemoryMilestoneRepository implements MilestoneRepository {
  private milestones = new Map<string, Milestone>();
  private chains = new Map<string, AuditTrailBlock[]>();

  async create(m: Milestone) {
    this.milestones.set(m.id, m);
    this.chains.set(m.id, []);
  }
  async get(id: string) {
    return this.milestones.get(id) ?? null;
  }
  async list(proposalId?: string) {
    const all = [...this.milestones.values()];
    return proposalId ? all.filter((m) => m.proposalId === proposalId) : all;
  }
  async save(m: Milestone) {
    this.milestones.set(m.id, m);
  }
  async getAuditBlocks(milestoneId: string) {
    return [...(this.chains.get(milestoneId) ?? [])].sort((a, b) => a.index - b.index);
  }
  async appendAuditBlock(block: AuditTrailBlock) {
    const chain = this.chains.get(block.milestoneId) ?? [];
    chain.push(block);
    this.chains.set(block.milestoneId, chain);
  }
}

// ---------- DynamoDB ----------

class DynamoDbMilestoneRepository implements MilestoneRepository {
  // The table's partition key is `milestoneId`; the domain object uses `id`.
  private toItem(m: Milestone) {
    return { ...m, milestoneId: m.id };
  }
  async create(m: Milestone) {
    const { ddb, table } = await import('../config/aws.js');
    const { PutCommand } = await import('@aws-sdk/lib-dynamodb');
    await ddb.send(new PutCommand({ TableName: table('milestones'), Item: this.toItem(m) }));
  }
  async get(id: string) {
    const { ddb, table } = await import('../config/aws.js');
    const { GetCommand } = await import('@aws-sdk/lib-dynamodb');
    const res = await ddb.send(
      new GetCommand({ TableName: table('milestones'), Key: { milestoneId: id } }),
    );
    return (res.Item as Milestone) ?? null;
  }
  async list(proposalId?: string) {
    const { ddb, table } = await import('../config/aws.js');
    const { QueryCommand, ScanCommand } = await import('@aws-sdk/lib-dynamodb');
    if (proposalId) {
      const res = await ddb.send(
        new QueryCommand({
          TableName: table('milestones'),
          IndexName: 'ProposalMilestonesIndex',
          KeyConditionExpression: 'proposalId = :p',
          ExpressionAttributeValues: { ':p': proposalId },
        }),
      );
      return (res.Items as Milestone[]) ?? [];
    }
    const res = await ddb.send(new ScanCommand({ TableName: table('milestones') }));
    return (res.Items as Milestone[]) ?? [];
  }
  async save(m: Milestone) {
    const { ddb, table } = await import('../config/aws.js');
    const { PutCommand } = await import('@aws-sdk/lib-dynamodb');
    await ddb.send(new PutCommand({ TableName: table('milestones'), Item: this.toItem(m) }));
  }
  async getAuditBlocks(milestoneId: string) {
    const { ddb, table } = await import('../config/aws.js');
    const { QueryCommand } = await import('@aws-sdk/lib-dynamodb');
    const res = await ddb.send(
      new QueryCommand({
        TableName: table('audit_blocks'),
        KeyConditionExpression: 'milestoneId = :m',
        ExpressionAttributeValues: { ':m': milestoneId },
        ScanIndexForward: true, // ascending by blockIndex
      }),
    );
    return (res.Items as AuditTrailBlock[]) ?? [];
  }
  async appendAuditBlock(block: AuditTrailBlock) {
    const { ddb, table } = await import('../config/aws.js');
    const { PutCommand } = await import('@aws-sdk/lib-dynamodb');
    // audit_blocks PK=milestoneId, SK=blockIndex
    await ddb.send(
      new PutCommand({
        TableName: table('audit_blocks'),
        Item: { ...block, blockIndex: block.index },
      }),
    );
  }
}

// ---------- File-backed (survives restarts) ----------

interface MilestoneStoreShape {
  milestones: Record<string, Milestone>;
  chains: Record<string, AuditTrailBlock[]>;
}

class FileMilestoneRepository implements MilestoneRepository {
  private cache: MilestoneStoreShape | null = null;
  private writeChain: Promise<void> = Promise.resolve();

  constructor(private readonly filePath: string) {}

  private empty(): MilestoneStoreShape {
    return { milestones: {}, chains: {} };
  }

  private async load(): Promise<MilestoneStoreShape> {
    if (this.cache) return this.cache;
    try {
      const raw = await readFile(this.filePath, 'utf-8');
      const parsed = JSON.parse(raw);
      this.cache = {
        milestones: parsed.milestones || {},
        chains: parsed.chains || {},
      };
    } catch {
      this.cache = this.empty();
    }
    return this.cache;
  }

  private persist(): Promise<void> {
    this.writeChain = this.writeChain.then(async () => {
      if (!this.cache) return;
      await mkdir(dirname(this.filePath), { recursive: true });
      await writeFile(this.filePath, JSON.stringify(this.cache, null, 2) + '\n', 'utf-8');
    });
    return this.writeChain;
  }

  async create(m: Milestone) {
    const s = await this.load();
    s.milestones[m.id] = m;
    s.chains[m.id] = [];
    await this.persist();
  }

  async get(id: string) {
    const s = await this.load();
    return s.milestones[id] ?? null;
  }

  async list(proposalId?: string) {
    const s = await this.load();
    const all = Object.values(s.milestones);
    return proposalId ? all.filter((m) => m.proposalId === proposalId) : all;
  }

  async save(m: Milestone) {
    const s = await this.load();
    s.milestones[m.id] = m;
    await this.persist();
  }

  async getAuditBlocks(milestoneId: string) {
    const s = await this.load();
    return [...(s.chains[milestoneId] || [])].sort((a, b) => a.index - b.index);
  }

  async appendAuditBlock(block: AuditTrailBlock) {
    const s = await this.load();
    const chain = s.chains[block.milestoneId] || [];
    chain.push(block);
    s.chains[block.milestoneId] = chain;
    await this.persist();
  }
}

// ---------- Factory ----------

let cached: MilestoneRepository | null = null;

export function getMilestoneRepository(): MilestoneRepository {
  if (cached) return cached;
  const provider = (process.env.PERSISTENCE_PROVIDER || 'file').toLowerCase();
  if (provider === 'dynamodb') {
    cached = new DynamoDbMilestoneRepository();
  } else if (provider === 'memory') {
    cached = new InMemoryMilestoneRepository();
  } else {
    const file =
      process.env.MILESTONES_STORE_FILE ||
      resolve(process.cwd(), 'data/milestones.json');
    cached = new FileMilestoneRepository(file);
  }
  return cached;
}
