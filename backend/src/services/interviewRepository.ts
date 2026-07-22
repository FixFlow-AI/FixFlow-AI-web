import { readFile, writeFile, mkdir } from 'fs/promises';
import { dirname, resolve } from 'path';
import type {
  InterviewQuestionSet,
  JobApplication,
  InterviewSession,
  ProctorEvent,
} from '../types/interview.js';

/**
 * Persistence for the proctored interview-gate feature.
 *
 * Same swappable tri-provider pattern as githubScanRepository:
 *   PERSISTENCE_PROVIDER=dynamodb → DynamoDB
 *   PERSISTENCE_PROVIDER=memory   → in-memory (tests)
 *   (default)                     → durable JSON file (local dev)
 *
 * Tables (see infra/dynamodb/create-tables):
 *   interview_question_sets  PK jobId
 *   job_applications         PK jobId, SK freelancerId, GSI FreelancerApplicationsIndex(freelancerId, createdAt)
 *   interview_sessions       PK sessionId, GSI ApplicationSessionsIndex(applicationId, startedAt)
 *   interview_events         PK sessionId, SK eventSeq (Number)
 */

export interface InterviewRepository {
  // question sets (client-authored)
  saveQuestionSet(set: InterviewQuestionSet): Promise<void>;
  getQuestionSet(jobId: string): Promise<InterviewQuestionSet | null>;

  // applications
  createApplication(app: JobApplication): Promise<void>;
  getApplication(jobId: string, freelancerId: string): Promise<JobApplication | null>;
  updateApplication(
    jobId: string,
    freelancerId: string,
    patch: Partial<JobApplication>,
  ): Promise<JobApplication | null>;
  listApplicationsByFreelancer(freelancerId: string): Promise<JobApplication[]>;
  listApplicationsByJob(jobId: string): Promise<JobApplication[]>;

  // sessions
  createSession(session: InterviewSession): Promise<void>;
  getSession(sessionId: string): Promise<InterviewSession | null>;
  updateSession(sessionId: string, patch: Partial<InterviewSession>): Promise<InterviewSession | null>;

  // proctoring events (append-only)
  appendEvent(
    sessionId: string,
    event: Omit<ProctorEvent, 'sessionId' | 'eventSeq' | 'ts'>,
  ): Promise<ProctorEvent>;
  listEvents(sessionId: string): Promise<ProctorEvent[]>;
}

// Monotonic-within-process sequence for proctor events (SK). Sortable by time,
// disambiguated by a rolling counter so same-millisecond events never collide.
let seqCounter = 0;
function nextEventSeq(): number {
  seqCounter = (seqCounter + 1) % 1000;
  return Date.now() * 1000 + seqCounter;
}

// ─────────────────────────── In-memory ───────────────────────────

class InMemoryInterviewRepository implements InterviewRepository {
  private sets = new Map<string, InterviewQuestionSet>();
  private apps = new Map<string, JobApplication>(); // key `${jobId}#${freelancerId}`
  private sessions = new Map<string, InterviewSession>();
  private events = new Map<string, ProctorEvent[]>();

  private appKey(jobId: string, freelancerId: string) {
    return `${jobId}#${freelancerId}`;
  }

  async saveQuestionSet(set: InterviewQuestionSet) {
    this.sets.set(set.jobId, set);
  }
  async getQuestionSet(jobId: string) {
    return this.sets.get(jobId) ?? null;
  }
  async createApplication(app: JobApplication) {
    this.apps.set(this.appKey(app.jobId, app.freelancerId), app);
  }
  async getApplication(jobId: string, freelancerId: string) {
    return this.apps.get(this.appKey(jobId, freelancerId)) ?? null;
  }
  async updateApplication(jobId: string, freelancerId: string, patch: Partial<JobApplication>) {
    const key = this.appKey(jobId, freelancerId);
    const cur = this.apps.get(key);
    if (!cur) return null;
    const next = { ...cur, ...patch, updatedAt: new Date().toISOString() };
    this.apps.set(key, next);
    return next;
  }
  async listApplicationsByFreelancer(freelancerId: string) {
    return [...this.apps.values()].filter((a) => a.freelancerId === freelancerId);
  }
  async listApplicationsByJob(jobId: string) {
    return [...this.apps.values()].filter((a) => a.jobId === jobId);
  }
  async createSession(session: InterviewSession) {
    this.sessions.set(session.sessionId, session);
  }
  async getSession(sessionId: string) {
    return this.sessions.get(sessionId) ?? null;
  }
  async updateSession(sessionId: string, patch: Partial<InterviewSession>) {
    const cur = this.sessions.get(sessionId);
    if (!cur) return null;
    const next = { ...cur, ...patch, updatedAt: new Date().toISOString() };
    this.sessions.set(sessionId, next);
    return next;
  }
  async appendEvent(sessionId: string, event: Omit<ProctorEvent, 'sessionId' | 'eventSeq' | 'ts'>) {
    const full: ProctorEvent = { ...event, sessionId, eventSeq: nextEventSeq(), ts: new Date().toISOString() };
    const list = this.events.get(sessionId) ?? [];
    list.push(full);
    this.events.set(sessionId, list);
    return full;
  }
  async listEvents(sessionId: string) {
    return [...(this.events.get(sessionId) ?? [])].sort((a, b) => a.eventSeq - b.eventSeq);
  }
}

// ─────────────────────────── File-backed ───────────────────────────

interface InterviewStoreShape {
  sets: Record<string, InterviewQuestionSet>;
  apps: Record<string, JobApplication>; // key `${jobId}#${freelancerId}`
  sessions: Record<string, InterviewSession>;
  events: Record<string, ProctorEvent[]>;
}

class FileInterviewRepository implements InterviewRepository {
  private cache: InterviewStoreShape | null = null;
  private writeChain: Promise<void> = Promise.resolve();

  constructor(private readonly filePath: string) {}

  private empty(): InterviewStoreShape {
    return { sets: {}, apps: {}, sessions: {}, events: {} };
  }
  private appKey(jobId: string, freelancerId: string) {
    return `${jobId}#${freelancerId}`;
  }
  private async load(): Promise<InterviewStoreShape> {
    if (this.cache) return this.cache;
    try {
      const raw = await readFile(this.filePath, 'utf-8');
      this.cache = { ...this.empty(), ...(JSON.parse(raw) as Partial<InterviewStoreShape>) };
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

  async saveQuestionSet(set: InterviewQuestionSet) {
    const s = await this.load();
    s.sets[set.jobId] = set;
    await this.persist();
  }
  async getQuestionSet(jobId: string) {
    return (await this.load()).sets[jobId] ?? null;
  }
  async createApplication(app: JobApplication) {
    const s = await this.load();
    s.apps[this.appKey(app.jobId, app.freelancerId)] = app;
    await this.persist();
  }
  async getApplication(jobId: string, freelancerId: string) {
    return (await this.load()).apps[this.appKey(jobId, freelancerId)] ?? null;
  }
  async updateApplication(jobId: string, freelancerId: string, patch: Partial<JobApplication>) {
    const s = await this.load();
    const key = this.appKey(jobId, freelancerId);
    const cur = s.apps[key];
    if (!cur) return null;
    const next = { ...cur, ...patch, updatedAt: new Date().toISOString() };
    s.apps[key] = next;
    await this.persist();
    return next;
  }
  async listApplicationsByFreelancer(freelancerId: string) {
    const s = await this.load();
    return Object.values(s.apps).filter((a) => a.freelancerId === freelancerId);
  }
  async listApplicationsByJob(jobId: string) {
    const s = await this.load();
    return Object.values(s.apps).filter((a) => a.jobId === jobId);
  }
  async createSession(session: InterviewSession) {
    const s = await this.load();
    s.sessions[session.sessionId] = session;
    await this.persist();
  }
  async getSession(sessionId: string) {
    return (await this.load()).sessions[sessionId] ?? null;
  }
  async updateSession(sessionId: string, patch: Partial<InterviewSession>) {
    const s = await this.load();
    const cur = s.sessions[sessionId];
    if (!cur) return null;
    const next = { ...cur, ...patch, updatedAt: new Date().toISOString() };
    s.sessions[sessionId] = next;
    await this.persist();
    return next;
  }
  async appendEvent(sessionId: string, event: Omit<ProctorEvent, 'sessionId' | 'eventSeq' | 'ts'>) {
    const s = await this.load();
    const full: ProctorEvent = { ...event, sessionId, eventSeq: nextEventSeq(), ts: new Date().toISOString() };
    (s.events[sessionId] = s.events[sessionId] ?? []).push(full);
    await this.persist();
    return full;
  }
  async listEvents(sessionId: string) {
    const s = await this.load();
    return [...(s.events[sessionId] ?? [])].sort((a, b) => a.eventSeq - b.eventSeq);
  }
}

// ─────────────────────────── DynamoDB ───────────────────────────

class DynamoDbInterviewRepository implements InterviewRepository {
  async saveQuestionSet(set: InterviewQuestionSet) {
    const { ddb, table } = await import('../config/aws.js');
    const { PutCommand } = await import('@aws-sdk/lib-dynamodb');
    await ddb.send(new PutCommand({ TableName: table('interview_question_sets'), Item: set }));
  }
  async getQuestionSet(jobId: string) {
    const { ddb, table } = await import('../config/aws.js');
    const { GetCommand } = await import('@aws-sdk/lib-dynamodb');
    const res = await ddb.send(
      new GetCommand({ TableName: table('interview_question_sets'), Key: { jobId } }),
    );
    return (res.Item as InterviewQuestionSet) ?? null;
  }

  async createApplication(app: JobApplication) {
    const { ddb, table } = await import('../config/aws.js');
    const { PutCommand } = await import('@aws-sdk/lib-dynamodb');
    await ddb.send(new PutCommand({ TableName: table('job_applications'), Item: app }));
  }
  async getApplication(jobId: string, freelancerId: string) {
    const { ddb, table } = await import('../config/aws.js');
    const { GetCommand } = await import('@aws-sdk/lib-dynamodb');
    const res = await ddb.send(
      new GetCommand({ TableName: table('job_applications'), Key: { jobId, freelancerId } }),
    );
    return (res.Item as JobApplication) ?? null;
  }
  async updateApplication(jobId: string, freelancerId: string, patch: Partial<JobApplication>) {
    const current = await this.getApplication(jobId, freelancerId);
    if (!current) return null;
    const updated = { ...current, ...patch, updatedAt: new Date().toISOString() };
    const { ddb, table } = await import('../config/aws.js');
    const { PutCommand } = await import('@aws-sdk/lib-dynamodb');
    await ddb.send(new PutCommand({ TableName: table('job_applications'), Item: updated }));
    return updated;
  }
  async listApplicationsByFreelancer(freelancerId: string) {
    const { ddb, table } = await import('../config/aws.js');
    const { QueryCommand } = await import('@aws-sdk/lib-dynamodb');
    const res = await ddb.send(
      new QueryCommand({
        TableName: table('job_applications'),
        IndexName: 'FreelancerApplicationsIndex',
        KeyConditionExpression: 'freelancerId = :f',
        ExpressionAttributeValues: { ':f': freelancerId },
        ScanIndexForward: false,
      }),
    );
    return (res.Items as JobApplication[]) ?? [];
  }
  async listApplicationsByJob(jobId: string) {
    const { ddb, table } = await import('../config/aws.js');
    const { QueryCommand } = await import('@aws-sdk/lib-dynamodb');
    const res = await ddb.send(
      new QueryCommand({
        TableName: table('job_applications'),
        KeyConditionExpression: 'jobId = :j',
        ExpressionAttributeValues: { ':j': jobId },
      }),
    );
    return (res.Items as JobApplication[]) ?? [];
  }

  async createSession(session: InterviewSession) {
    const { ddb, table } = await import('../config/aws.js');
    const { PutCommand } = await import('@aws-sdk/lib-dynamodb');
    await ddb.send(new PutCommand({ TableName: table('interview_sessions'), Item: session }));
  }
  async getSession(sessionId: string) {
    const { ddb, table } = await import('../config/aws.js');
    const { GetCommand } = await import('@aws-sdk/lib-dynamodb');
    const res = await ddb.send(
      new GetCommand({ TableName: table('interview_sessions'), Key: { sessionId } }),
    );
    return (res.Item as InterviewSession) ?? null;
  }
  async updateSession(sessionId: string, patch: Partial<InterviewSession>) {
    const current = await this.getSession(sessionId);
    if (!current) return null;
    const updated = { ...current, ...patch, updatedAt: new Date().toISOString() };
    const { ddb, table } = await import('../config/aws.js');
    const { PutCommand } = await import('@aws-sdk/lib-dynamodb');
    await ddb.send(new PutCommand({ TableName: table('interview_sessions'), Item: updated }));
    return updated;
  }

  async appendEvent(sessionId: string, event: Omit<ProctorEvent, 'sessionId' | 'eventSeq' | 'ts'>) {
    const full: ProctorEvent = { ...event, sessionId, eventSeq: nextEventSeq(), ts: new Date().toISOString() };
    const { ddb, table } = await import('../config/aws.js');
    const { PutCommand } = await import('@aws-sdk/lib-dynamodb');
    await ddb.send(new PutCommand({ TableName: table('interview_events'), Item: full }));
    return full;
  }
  async listEvents(sessionId: string) {
    const { ddb, table } = await import('../config/aws.js');
    const { QueryCommand } = await import('@aws-sdk/lib-dynamodb');
    const res = await ddb.send(
      new QueryCommand({
        TableName: table('interview_events'),
        KeyConditionExpression: 'sessionId = :s',
        ExpressionAttributeValues: { ':s': sessionId },
        ScanIndexForward: true,
      }),
    );
    return (res.Items as ProctorEvent[]) ?? [];
  }
}

// ─────────────────────────── Factory ───────────────────────────

let cached: InterviewRepository | null = null;

export function getInterviewRepository(): InterviewRepository {
  if (cached) return cached;
  const provider = (process.env.PERSISTENCE_PROVIDER || 'file').toLowerCase();
  if (provider === 'dynamodb') {
    cached = new DynamoDbInterviewRepository();
  } else if (provider === 'memory') {
    cached = new InMemoryInterviewRepository();
  } else {
    const file =
      process.env.INTERVIEW_STORE_FILE || resolve(process.cwd(), 'data/interviews.json');
    cached = new FileInterviewRepository(file);
  }
  return cached;
}
