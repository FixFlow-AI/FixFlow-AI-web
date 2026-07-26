import { readFile, writeFile, mkdir } from 'fs/promises';
import { dirname, resolve } from 'path';

/**
 * Persistence seam for the BINDU track — "a marketplace of verifiable agents."
 *
 * FixFlowAI's Confidence-Grid personas (Auditor, Feasibility, Optimizer,
 * Matching) become **DID-identified A2A agents** that exchange verifiable
 * messages to reach a hiring decision. The Python `ai-service` runs the agent
 * logic (and, once Bindu is installed there, mints real DIDs); the TypeScript
 * backend stays the system of record and owns these three DynamoDB tables:
 *
 *   agent_identities  — the DID registry (one row per agent)
 *   a2a_messages      — append-only verifiable A2A message trace per evaluation
 *   agent_skills      — capabilities each agent advertises (Bindu skills system)
 *
 * Provider selected via env (mirrors milestoneRepository):
 *   PERSISTENCE_PROVIDER = "dynamodb" → DynamoDbAgentRegistryRepository
 *   PERSISTENCE_PROVIDER = "memory"   → InMemoryAgentRegistryRepository
 *   (anything else / "file")          → FileAgentRegistryRepository
 */

/** Origin of an agent's identity: in-process fallback vs. a real Bindu DID. */
export type AgentMode = 'inproc' | 'bindu';

export interface AgentIdentity {
  agentId: string; // e.g. "auditor"
  did: string; // e.g. "did:fixflow:auditor" (real did:key when Bindu is active)
  name: string;
  role: string;
  fingerprint: string; // stable public-key fingerprint (sha256 of the DID for inproc)
  mode: AgentMode;
  createdAt: string;
}

export interface A2AMessage {
  evaluationId: string;
  messageSeq: number; // monotonic order within an evaluation
  fromAgent: string; // agentId
  fromDid: string;
  toAgent: string; // agentId or "broadcast"
  kind: string; // e.g. "audit.findings", "feasibility.findings", "optimizer.decision"
  summary: string;
  signature: string; // sha256(evaluationId|seq|fromDid|kind|summary) — verifiable envelope stub
  createdAt: string;
}

export interface AgentSkill {
  agentId: string;
  skillName: string; // e.g. "proposal.audit"
  description: string;
  createdAt: string;
}

export interface AgentRegistryRepository {
  registerIdentity(identity: AgentIdentity): Promise<void>;
  getIdentity(agentId: string): Promise<AgentIdentity | null>;
  listIdentities(): Promise<AgentIdentity[]>;
  registerSkill(skill: AgentSkill): Promise<void>;
  listSkills(agentId?: string): Promise<AgentSkill[]>;
  appendMessage(message: A2AMessage): Promise<void>;
  listMessages(evaluationId: string): Promise<A2AMessage[]>;
}

// ---------- In-memory (dev/local) ----------

class InMemoryAgentRegistryRepository implements AgentRegistryRepository {
  private identities = new Map<string, AgentIdentity>();
  private skills = new Map<string, AgentSkill>(); // key: `${agentId}#${skillName}`
  private messages = new Map<string, A2AMessage[]>(); // key: evaluationId

  async registerIdentity(i: AgentIdentity) {
    this.identities.set(i.agentId, i);
  }
  async getIdentity(agentId: string) {
    return this.identities.get(agentId) ?? null;
  }
  async listIdentities() {
    return [...this.identities.values()];
  }
  async registerSkill(s: AgentSkill) {
    this.skills.set(`${s.agentId}#${s.skillName}`, s);
  }
  async listSkills(agentId?: string) {
    const all = [...this.skills.values()];
    return agentId ? all.filter((s) => s.agentId === agentId) : all;
  }
  async appendMessage(m: A2AMessage) {
    const chain = this.messages.get(m.evaluationId) ?? [];
    chain.push(m);
    this.messages.set(m.evaluationId, chain);
  }
  async listMessages(evaluationId: string) {
    return [...(this.messages.get(evaluationId) ?? [])].sort((a, b) => a.messageSeq - b.messageSeq);
  }
}

// ---------- File-backed (survives restarts) ----------

interface AgentStoreShape {
  identities: Record<string, AgentIdentity>;
  skills: Record<string, AgentSkill>;
  messages: Record<string, A2AMessage[]>;
}

class FileAgentRegistryRepository implements AgentRegistryRepository {
  private cache: AgentStoreShape | null = null;
  private writeChain: Promise<void> = Promise.resolve();

  constructor(private readonly filePath: string) {}

  private empty(): AgentStoreShape {
    return { identities: {}, skills: {}, messages: {} };
  }

  private async load(): Promise<AgentStoreShape> {
    if (this.cache) return this.cache;
    try {
      const raw = await readFile(this.filePath, 'utf-8');
      const parsed = JSON.parse(raw);
      this.cache = {
        identities: parsed.identities || {},
        skills: parsed.skills || {},
        messages: parsed.messages || {},
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

  async registerIdentity(i: AgentIdentity) {
    const s = await this.load();
    s.identities[i.agentId] = i;
    await this.persist();
  }
  async getIdentity(agentId: string) {
    const s = await this.load();
    return s.identities[agentId] ?? null;
  }
  async listIdentities() {
    const s = await this.load();
    return Object.values(s.identities);
  }
  async registerSkill(skill: AgentSkill) {
    const s = await this.load();
    s.skills[`${skill.agentId}#${skill.skillName}`] = skill;
    await this.persist();
  }
  async listSkills(agentId?: string) {
    const s = await this.load();
    const all = Object.values(s.skills);
    return agentId ? all.filter((sk) => sk.agentId === agentId) : all;
  }
  async appendMessage(m: A2AMessage) {
    const s = await this.load();
    const chain = s.messages[m.evaluationId] || [];
    chain.push(m);
    s.messages[m.evaluationId] = chain;
    await this.persist();
  }
  async listMessages(evaluationId: string) {
    const s = await this.load();
    return [...(s.messages[evaluationId] || [])].sort((a, b) => a.messageSeq - b.messageSeq);
  }
}

// ---------- DynamoDB ----------

class DynamoDbAgentRegistryRepository implements AgentRegistryRepository {
  async registerIdentity(i: AgentIdentity) {
    const { ddb, table } = await import('../config/aws.js');
    const { PutCommand } = await import('@aws-sdk/lib-dynamodb');
    await ddb.send(new PutCommand({ TableName: table('agent_identities'), Item: { ...i } }));
  }
  async getIdentity(agentId: string) {
    const { ddb, table } = await import('../config/aws.js');
    const { GetCommand } = await import('@aws-sdk/lib-dynamodb');
    const res = await ddb.send(
      new GetCommand({ TableName: table('agent_identities'), Key: { agentId } }),
    );
    return (res.Item as AgentIdentity) ?? null;
  }
  async listIdentities() {
    const { ddb, table } = await import('../config/aws.js');
    const { ScanCommand } = await import('@aws-sdk/lib-dynamodb');
    const res = await ddb.send(new ScanCommand({ TableName: table('agent_identities') }));
    return (res.Items as AgentIdentity[]) ?? [];
  }
  async registerSkill(skill: AgentSkill) {
    const { ddb, table } = await import('../config/aws.js');
    const { PutCommand } = await import('@aws-sdk/lib-dynamodb');
    await ddb.send(new PutCommand({ TableName: table('agent_skills'), Item: { ...skill } }));
  }
  async listSkills(agentId?: string) {
    const { ddb, table } = await import('../config/aws.js');
    const { QueryCommand, ScanCommand } = await import('@aws-sdk/lib-dynamodb');
    if (agentId) {
      const res = await ddb.send(
        new QueryCommand({
          TableName: table('agent_skills'),
          KeyConditionExpression: 'agentId = :a',
          ExpressionAttributeValues: { ':a': agentId },
        }),
      );
      return (res.Items as AgentSkill[]) ?? [];
    }
    const res = await ddb.send(new ScanCommand({ TableName: table('agent_skills') }));
    return (res.Items as AgentSkill[]) ?? [];
  }
  async appendMessage(m: A2AMessage) {
    const { ddb, table } = await import('../config/aws.js');
    const { PutCommand } = await import('@aws-sdk/lib-dynamodb');
    await ddb.send(new PutCommand({ TableName: table('a2a_messages'), Item: { ...m } }));
  }
  async listMessages(evaluationId: string) {
    const { ddb, table } = await import('../config/aws.js');
    const { QueryCommand } = await import('@aws-sdk/lib-dynamodb');
    const res = await ddb.send(
      new QueryCommand({
        TableName: table('a2a_messages'),
        KeyConditionExpression: 'evaluationId = :e',
        ExpressionAttributeValues: { ':e': evaluationId },
        ScanIndexForward: true, // ascending by messageSeq
      }),
    );
    return (res.Items as A2AMessage[]) ?? [];
  }
}

// ---------- Factory ----------

let cached: AgentRegistryRepository | null = null;

export function getAgentRegistryRepository(): AgentRegistryRepository {
  if (cached) return cached;
  const provider = (process.env.PERSISTENCE_PROVIDER || 'file').toLowerCase();
  if (provider === 'dynamodb') {
    cached = new DynamoDbAgentRegistryRepository();
  } else if (provider === 'memory') {
    cached = new InMemoryAgentRegistryRepository();
  } else {
    const file =
      process.env.AGENT_REGISTRY_STORE_FILE ||
      resolve(process.cwd(), 'data/agent_registry.json');
    cached = new FileAgentRegistryRepository(file);
  }
  return cached;
}
