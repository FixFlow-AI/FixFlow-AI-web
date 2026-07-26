import { readFile, writeFile, mkdir } from 'fs/promises';
import { dirname, resolve } from 'path';
import type { AutomationRecord } from './fixbotAgent.js';

/**
 * Durable store for FixBot's cross-app agent actions (Corsair track).
 *
 * The dashboard "Automations" card lists recent agent actions + their Corsair
 * permission status. Without persistence that history is lost on every restart
 * (Render spin-down, redeploy) — so we back it with the same provider seam used
 * by milestoneRepository / webhookEventRepository:
 *
 *   PERSISTENCE_PROVIDER = "dynamodb" → DynamoDbAutomationRepository (fixflow_automations)
 *   PERSISTENCE_PROVIDER = "memory"   → InMemoryAutomationRepository
 *   (anything else / "file")          → FileAutomationRepository
 *
 * All reads/writes are best-effort: fixbotAgent must never throw or block an
 * escrow response, so the callers wrap these in fire-and-forget guards.
 */
export interface AutomationRepository {
  /** Persist a single automation record. */
  save(record: AutomationRecord): Promise<void>;
  /** List records newest-first, optionally scoped to a tenant (proposalId). */
  list(tenantId?: string, limit?: number): Promise<AutomationRecord[]>;
}

const DEFAULT_LIMIT = 100;

function newestFirst(a: AutomationRecord, b: AutomationRecord): number {
  return b.createdAt.localeCompare(a.createdAt);
}

// ---------- In-memory (dev/local) ----------

class InMemoryAutomationRepository implements AutomationRepository {
  private records: AutomationRecord[] = [];
  async save(record: AutomationRecord) {
    this.records.unshift(record);
    if (this.records.length > DEFAULT_LIMIT) this.records.length = DEFAULT_LIMIT;
  }
  async list(tenantId?: string, limit = DEFAULT_LIMIT) {
    const all = tenantId ? this.records.filter((r) => r.tenantId === tenantId) : this.records;
    return all.slice().sort(newestFirst).slice(0, limit);
  }
}

// ---------- File-backed (survives restarts) ----------

class FileAutomationRepository implements AutomationRepository {
  private cache: AutomationRecord[] | null = null;
  private writeChain: Promise<void> = Promise.resolve();

  constructor(private readonly filePath: string) {}

  private async load(): Promise<AutomationRecord[]> {
    if (this.cache) return this.cache;
    let loaded: AutomationRecord[];
    try {
      const raw = await readFile(this.filePath, 'utf-8');
      const parsed = JSON.parse(raw);
      loaded = Array.isArray(parsed?.automations) ? parsed.automations : [];
    } catch {
      loaded = [];
    }
    this.cache = loaded;
    return loaded;
  }

  private persist(): Promise<void> {
    this.writeChain = this.writeChain.then(async () => {
      if (!this.cache) return;
      await mkdir(dirname(this.filePath), { recursive: true });
      await writeFile(
        this.filePath,
        JSON.stringify({ automations: this.cache }, null, 2) + '\n',
        'utf-8',
      );
    });
    return this.writeChain;
  }

  async save(record: AutomationRecord) {
    const list = await this.load();
    list.unshift(record);
    if (list.length > DEFAULT_LIMIT) list.length = DEFAULT_LIMIT;
    await this.persist();
  }

  async list(tenantId?: string, limit = DEFAULT_LIMIT) {
    const list = await this.load();
    const filtered = tenantId ? list.filter((r) => r.tenantId === tenantId) : list;
    return filtered.slice().sort(newestFirst).slice(0, limit);
  }
}

// ---------- DynamoDB ----------

class DynamoDbAutomationRepository implements AutomationRepository {
  async save(record: AutomationRecord) {
    const { ddb, table } = await import('../config/aws.js');
    const { PutCommand } = await import('@aws-sdk/lib-dynamodb');
    await ddb.send(
      new PutCommand({ TableName: table('automations'), Item: { ...record } }),
    );
  }

  async list(tenantId?: string, limit = DEFAULT_LIMIT) {
    const { ddb, table } = await import('../config/aws.js');
    const { QueryCommand, ScanCommand } = await import('@aws-sdk/lib-dynamodb');
    if (tenantId) {
      const res = await ddb.send(
        new QueryCommand({
          TableName: table('automations'),
          IndexName: 'TenantAutomationsIndex',
          KeyConditionExpression: 'tenantId = :t',
          ExpressionAttributeValues: { ':t': tenantId },
          ScanIndexForward: false, // newest (highest createdAt) first
          Limit: limit,
        }),
      );
      return (res.Items as AutomationRecord[]) ?? [];
    }
    const res = await ddb.send(new ScanCommand({ TableName: table('automations'), Limit: limit }));
    return ((res.Items as AutomationRecord[]) ?? []).slice().sort(newestFirst).slice(0, limit);
  }
}

// ---------- Factory ----------

let cached: AutomationRepository | null = null;

export function getAutomationRepository(): AutomationRepository {
  if (cached) return cached;
  const provider = (process.env.PERSISTENCE_PROVIDER || 'file').toLowerCase();
  if (provider === 'dynamodb') {
    cached = new DynamoDbAutomationRepository();
  } else if (provider === 'memory') {
    cached = new InMemoryAutomationRepository();
  } else {
    const file =
      process.env.AUTOMATIONS_STORE_FILE ||
      resolve(process.cwd(), 'data/automations.json');
    cached = new FileAutomationRepository(file);
  }
  return cached;
}
