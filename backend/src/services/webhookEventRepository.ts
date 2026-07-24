import { readFile, writeFile, mkdir } from 'fs/promises';
import { dirname, resolve } from 'path';

/**
 * Idempotency store for inbound Razorpay webhook events.
 *
 * Razorpay retries webhooks until it receives a 2xx, so the same event can
 * arrive multiple times. Before processing an event we record its unique id
 * (the `x-razorpay-event-id` header, falling back to the payment id) and skip
 * any event we have already seen. This prevents duplicate FSM transitions and
 * double-spend on retries (gap §3.2.2 of the escrow implementation plan).
 *
 * Provider is selected via env, mirroring milestoneRepository:
 *   PERSISTENCE_PROVIDER = "dynamodb" → DynamoDbWebhookEventRepository
 *   PERSISTENCE_PROVIDER = "memory"   → InMemoryWebhookEventRepository
 *   (anything else / "file")          → FileWebhookEventRepository
 */
export interface WebhookEventRepository {
  /** Returns true if the event id has already been recorded as processed. */
  hasProcessed(eventId: string): Promise<boolean>;
  /** Records the event id so subsequent retries are treated as duplicates. */
  markProcessed(eventId: string): Promise<void>;
}

// ---------- In-memory (dev/local) ----------

class InMemoryWebhookEventRepository implements WebhookEventRepository {
  private seen = new Set<string>();
  async hasProcessed(eventId: string) {
    return this.seen.has(eventId);
  }
  async markProcessed(eventId: string) {
    this.seen.add(eventId);
  }
}

// ---------- File-backed (survives restarts) ----------

class FileWebhookEventRepository implements WebhookEventRepository {
  private cache: Record<string, string> | null = null;
  private writeChain: Promise<void> = Promise.resolve();

  constructor(private readonly filePath: string) {}

  private async load(): Promise<Record<string, string>> {
    if (this.cache) return this.cache;
    let events: Record<string, string>;
    try {
      const raw = await readFile(this.filePath, 'utf-8');
      const parsed = JSON.parse(raw);
      events = parsed?.events && typeof parsed.events === 'object' ? parsed.events : {};
    } catch {
      events = {};
    }
    this.cache = events;
    return events;
  }

  private persist(): Promise<void> {
    this.writeChain = this.writeChain.then(async () => {
      if (!this.cache) return;
      await mkdir(dirname(this.filePath), { recursive: true });
      await writeFile(this.filePath, JSON.stringify({ events: this.cache }, null, 2) + '\n', 'utf-8');
    });
    return this.writeChain;
  }

  async hasProcessed(eventId: string) {
    const s = await this.load();
    return Boolean(s[eventId]);
  }

  async markProcessed(eventId: string) {
    const s = await this.load();
    s[eventId] = new Date().toISOString();
    await this.persist();
  }
}

// ---------- DynamoDB ----------

class DynamoDbWebhookEventRepository implements WebhookEventRepository {
  async hasProcessed(eventId: string) {
    const { ddb, table } = await import('../config/aws.js');
    const { GetCommand } = await import('@aws-sdk/lib-dynamodb');
    const res = await ddb.send(
      new GetCommand({ TableName: table('processed_events'), Key: { eventId } }),
    );
    return Boolean(res.Item);
  }

  async markProcessed(eventId: string) {
    const { ddb, table } = await import('../config/aws.js');
    const { PutCommand } = await import('@aws-sdk/lib-dynamodb');
    // 30-day TTL (epoch seconds) so the dedup ledger self-prunes. The table's
    // TTL attribute must be configured as `ttl` in the IaC template.
    const ttl = Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60;
    await ddb.send(
      new PutCommand({
        TableName: table('processed_events'),
        Item: { eventId, processedAt: new Date().toISOString(), ttl },
        // Only write if it does not already exist (atomic guard against races).
        ConditionExpression: 'attribute_not_exists(eventId)',
      }),
    ).catch((err: any) => {
      // A ConditionalCheckFailed means another concurrent invocation already
      // recorded this event — that is the desired idempotent outcome.
      if (err?.name !== 'ConditionalCheckFailedException') throw err;
    });
  }
}

// ---------- Factory ----------

let cached: WebhookEventRepository | null = null;

export function getWebhookEventRepository(): WebhookEventRepository {
  if (cached) return cached;
  const provider = (process.env.PERSISTENCE_PROVIDER || 'file').toLowerCase();
  if (provider === 'dynamodb') {
    cached = new DynamoDbWebhookEventRepository();
  } else if (provider === 'memory') {
    cached = new InMemoryWebhookEventRepository();
  } else {
    const file =
      process.env.WEBHOOK_EVENTS_STORE_FILE ||
      resolve(process.cwd(), 'data/webhook_events.json');
    cached = new FileWebhookEventRepository(file);
  }
  return cached;
}
