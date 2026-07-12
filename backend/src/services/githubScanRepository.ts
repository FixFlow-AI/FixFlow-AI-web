import { readFile, writeFile, mkdir } from 'fs/promises';
import { dirname, resolve } from 'path';
import type {
  FreelancerProject,
  GithubProfileSnapshot,
  ProfileConfidence,
  ScanJob,
  VerifiedSkill,
} from '../types/github.js';

/**
 * Persistence for the GitHub onboarding scan (roles/01, 01a).
 *
 * Tables (see infra/dynamodb/create-tables):
 *   github_scan_jobs     PK jobId,        GSI FreelancerScansIndex (freelancerId, createdAt)
 *   freelancer_skills    PK freelancerId, SK skillName            (read-only, editable=false)
 *   freelancer_projects  PK freelancerId, SK projectId (=repoName)
 *   profile_confidence   PK freelancerId
 *
 * Provider via env PERSISTENCE_PROVIDER=dynamodb, else in-memory (dev/local).
 */

export interface FreelancerProfileData {
  skills: VerifiedSkill[];
  projects: FreelancerProject[];
  confidence: ProfileConfidence | null;
  latestJob: ScanJob | null;
  snapshot: GithubProfileSnapshot | null;
}

export interface GithubScanRepository {
  createJob(job: ScanJob): Promise<void>;
  getJob(jobId: string): Promise<ScanJob | null>;
  updateJob(jobId: string, patch: Partial<ScanJob>): Promise<ScanJob | null>;
  getLatestJob(freelancerId: string): Promise<ScanJob | null>;
  replaceSkills(freelancerId: string, skills: VerifiedSkill[]): Promise<void>;
  replaceProjects(freelancerId: string, projects: FreelancerProject[]): Promise<void>;
  saveConfidence(freelancerId: string, confidence: ProfileConfidence): Promise<void>;
  saveProfileSnapshot(freelancerId: string, snapshot: GithubProfileSnapshot): Promise<void>;
  getProfileSnapshot(freelancerId: string): Promise<GithubProfileSnapshot | null>;
  getProfile(freelancerId: string): Promise<FreelancerProfileData>;
}

// ---------- In-memory (default) ----------

class InMemoryGithubScanRepository implements GithubScanRepository {
  private jobs = new Map<string, ScanJob>();
  private skills = new Map<string, VerifiedSkill[]>();
  private projects = new Map<string, FreelancerProject[]>();
  private confidence = new Map<string, ProfileConfidence>();
  private snapshots = new Map<string, GithubProfileSnapshot>();

  async createJob(job: ScanJob) {
    this.jobs.set(job.jobId, job);
  }
  async getJob(jobId: string) {
    return this.jobs.get(jobId) ?? null;
  }
  async updateJob(jobId: string, patch: Partial<ScanJob>) {
    const job = this.jobs.get(jobId);
    if (!job) return null;
    const updated = { ...job, ...patch, updatedAt: new Date().toISOString() };
    this.jobs.set(jobId, updated);
    return updated;
  }
  async getLatestJob(freelancerId: string) {
    return (
      [...this.jobs.values()]
        .filter((j) => j.freelancerId === freelancerId)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0] ?? null
    );
  }
  async replaceSkills(freelancerId: string, skills: VerifiedSkill[]) {
    this.skills.set(freelancerId, skills);
  }
  async replaceProjects(freelancerId: string, projects: FreelancerProject[]) {
    this.projects.set(freelancerId, projects);
  }
  async saveConfidence(freelancerId: string, confidence: ProfileConfidence) {
    this.confidence.set(freelancerId, confidence);
  }
  async saveProfileSnapshot(freelancerId: string, snapshot: GithubProfileSnapshot) {
    this.snapshots.set(freelancerId, snapshot);
  }
  async getProfileSnapshot(freelancerId: string) {
    return this.snapshots.get(freelancerId) ?? null;
  }
  async getProfile(freelancerId: string): Promise<FreelancerProfileData> {
    return {
      skills: this.skills.get(freelancerId) ?? [],
      projects: this.projects.get(freelancerId) ?? [],
      confidence: this.confidence.get(freelancerId) ?? null,
      latestJob: await this.getLatestJob(freelancerId),
      snapshot: this.snapshots.get(freelancerId) ?? null,
    };
  }
}

// ---------- File-backed (default: durable across restarts) ----------

interface ScanStoreShape {
  jobs: Record<string, ScanJob>;
  skills: Record<string, VerifiedSkill[]>;
  projects: Record<string, FreelancerProject[]>;
  confidence: Record<string, ProfileConfidence>;
  snapshots: Record<string, GithubProfileSnapshot>;
}

/**
 * JSON-file persistence — mirrors the SeedFileUserRepository pattern so scan
 * analytics and the profile snapshot survive server restarts. A returning
 * freelancer sees their last analysis immediately, with no re-scan and no
 * GitHub API call. Writes are serialized to avoid interleaved corruption.
 */
class FileGithubScanRepository implements GithubScanRepository {
  private cache: ScanStoreShape | null = null;
  private writeChain: Promise<void> = Promise.resolve();

  constructor(private readonly filePath: string) {}

  private empty(): ScanStoreShape {
    return { jobs: {}, skills: {}, projects: {}, confidence: {}, snapshots: {} };
  }

  private async load(): Promise<ScanStoreShape> {
    if (this.cache) return this.cache;
    try {
      const raw = await readFile(this.filePath, 'utf-8');
      const parsed = JSON.parse(raw) as Partial<ScanStoreShape>;
      this.cache = { ...this.empty(), ...parsed };
    } catch {
      this.cache = this.empty();
    }
    return this.cache;
  }

  /** Serialize writes so concurrent segment saves never clobber the file. */
  private persist(): Promise<void> {
    this.writeChain = this.writeChain.then(async () => {
      if (!this.cache) return;
      await mkdir(dirname(this.filePath), { recursive: true });
      await writeFile(this.filePath, JSON.stringify(this.cache, null, 2) + '\n', 'utf-8');
    });
    return this.writeChain;
  }

  async createJob(job: ScanJob) {
    const s = await this.load();
    s.jobs[job.jobId] = job;
    await this.persist();
  }
  async getJob(jobId: string) {
    const s = await this.load();
    return s.jobs[jobId] ?? null;
  }
  async updateJob(jobId: string, patch: Partial<ScanJob>) {
    const s = await this.load();
    const job = s.jobs[jobId];
    if (!job) return null;
    const updated = { ...job, ...patch, updatedAt: new Date().toISOString() };
    s.jobs[jobId] = updated;
    await this.persist();
    return updated;
  }
  async getLatestJob(freelancerId: string) {
    const s = await this.load();
    return (
      Object.values(s.jobs)
        .filter((j) => j.freelancerId === freelancerId)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0] ?? null
    );
  }
  async replaceSkills(freelancerId: string, skills: VerifiedSkill[]) {
    const s = await this.load();
    s.skills[freelancerId] = skills;
    await this.persist();
  }
  async replaceProjects(freelancerId: string, projects: FreelancerProject[]) {
    const s = await this.load();
    s.projects[freelancerId] = projects;
    await this.persist();
  }
  async saveConfidence(freelancerId: string, confidence: ProfileConfidence) {
    const s = await this.load();
    s.confidence[freelancerId] = confidence;
    await this.persist();
  }
  async saveProfileSnapshot(freelancerId: string, snapshot: GithubProfileSnapshot) {
    const s = await this.load();
    s.snapshots[freelancerId] = snapshot;
    await this.persist();
  }
  async getProfileSnapshot(freelancerId: string) {
    const s = await this.load();
    return s.snapshots[freelancerId] ?? null;
  }
  async getProfile(freelancerId: string): Promise<FreelancerProfileData> {
    const s = await this.load();
    return {
      skills: s.skills[freelancerId] ?? [],
      projects: s.projects[freelancerId] ?? [],
      confidence: s.confidence[freelancerId] ?? null,
      latestJob: await this.getLatestJob(freelancerId),
      snapshot: s.snapshots[freelancerId] ?? null,
    };
  }
}

// ---------- DynamoDB ----------

class DynamoDbGithubScanRepository implements GithubScanRepository {
  async createJob(job: ScanJob) {
    const { ddb, table } = await import('../config/aws.js');
    const { PutCommand } = await import('@aws-sdk/lib-dynamodb');
    await ddb.send(new PutCommand({ TableName: table('github_scan_jobs'), Item: job }));
  }
  async getJob(jobId: string) {
    const { ddb, table } = await import('../config/aws.js');
    const { GetCommand } = await import('@aws-sdk/lib-dynamodb');
    const res = await ddb.send(
      new GetCommand({ TableName: table('github_scan_jobs'), Key: { jobId } }),
    );
    return (res.Item as ScanJob) ?? null;
  }
  async updateJob(jobId: string, patch: Partial<ScanJob>) {
    const current = await this.getJob(jobId);
    if (!current) return null;
    const updated = { ...current, ...patch, updatedAt: new Date().toISOString() };
    const { ddb, table } = await import('../config/aws.js');
    const { PutCommand } = await import('@aws-sdk/lib-dynamodb');
    await ddb.send(new PutCommand({ TableName: table('github_scan_jobs'), Item: updated }));
    return updated;
  }
  async getLatestJob(freelancerId: string) {
    const { ddb, table } = await import('../config/aws.js');
    const { QueryCommand } = await import('@aws-sdk/lib-dynamodb');
    const res = await ddb.send(
      new QueryCommand({
        TableName: table('github_scan_jobs'),
        IndexName: 'FreelancerScansIndex',
        KeyConditionExpression: 'freelancerId = :f',
        ExpressionAttributeValues: { ':f': freelancerId },
        ScanIndexForward: false,
        Limit: 1,
      }),
    );
    return (res.Items?.[0] as ScanJob) ?? null;
  }

  /** Delete all rows for a freelancer in a composite-key table, then put the new set. */
  private async replaceRows(
    suffix: string,
    freelancerId: string,
    sortKey: string,
    items: Array<Record<string, any>>,
  ) {
    const { ddb, table } = await import('../config/aws.js');
    const { QueryCommand, BatchWriteCommand } = await import('@aws-sdk/lib-dynamodb');
    const tableName = table(suffix);

    const existing = await ddb.send(
      new QueryCommand({
        TableName: tableName,
        KeyConditionExpression: 'freelancerId = :f',
        ExpressionAttributeValues: { ':f': freelancerId },
        ProjectionExpression: `freelancerId, ${sortKey}`,
      }),
    );
    const deletes = (existing.Items ?? []).map((it) => ({
      DeleteRequest: { Key: { freelancerId, [sortKey]: it[sortKey] } },
    }));
    const puts = items.map((it) => ({ PutRequest: { Item: { ...it, freelancerId } } }));

    // BatchWrite caps at 25 requests per call.
    const all = [...deletes, ...puts];
    for (let i = 0; i < all.length; i += 25) {
      const chunk = all.slice(i, i + 25);
      if (chunk.length === 0) continue;
      await ddb.send(new BatchWriteCommand({ RequestItems: { [tableName]: chunk } }));
    }
  }

  async replaceSkills(freelancerId: string, skills: VerifiedSkill[]) {
    await this.replaceRows(
      'freelancer_skills',
      freelancerId,
      'skillName',
      skills.map((s) => ({ ...s, skillName: s.name })),
    );
  }
  async replaceProjects(freelancerId: string, projects: FreelancerProject[]) {
    await this.replaceRows(
      'freelancer_projects',
      freelancerId,
      'projectId',
      projects.map((p) => ({ ...p, projectId: p.repoName })),
    );
  }
  async saveConfidence(freelancerId: string, confidence: ProfileConfidence) {
    const { ddb, table } = await import('../config/aws.js');
    const { PutCommand } = await import('@aws-sdk/lib-dynamodb');
    await ddb.send(
      new PutCommand({
        TableName: table('profile_confidence'),
        Item: { freelancerId, ...confidence, computedAt: new Date().toISOString() },
      }),
    );
  }
  async saveProfileSnapshot(freelancerId: string, snapshot: GithubProfileSnapshot) {
    const { ddb, table } = await import('../config/aws.js');
    const { PutCommand } = await import('@aws-sdk/lib-dynamodb');
    await ddb.send(
      new PutCommand({
        TableName: table('profile_snapshots'),
        Item: { freelancerId, ...snapshot },
      }),
    );
  }
  async getProfileSnapshot(freelancerId: string) {
    const { ddb, table } = await import('../config/aws.js');
    const { GetCommand } = await import('@aws-sdk/lib-dynamodb');
    const res = await ddb.send(
      new GetCommand({ TableName: table('profile_snapshots'), Key: { freelancerId } }),
    );
    return (res.Item as GithubProfileSnapshot) ?? null;
  }
  async getProfile(freelancerId: string): Promise<FreelancerProfileData> {
    const { ddb, table } = await import('../config/aws.js');
    const { QueryCommand, GetCommand } = await import('@aws-sdk/lib-dynamodb');
    const [skillsRes, projectsRes, confRes, snapRes, latestJob] = await Promise.all([
      ddb.send(
        new QueryCommand({
          TableName: table('freelancer_skills'),
          KeyConditionExpression: 'freelancerId = :f',
          ExpressionAttributeValues: { ':f': freelancerId },
        }),
      ),
      ddb.send(
        new QueryCommand({
          TableName: table('freelancer_projects'),
          KeyConditionExpression: 'freelancerId = :f',
          ExpressionAttributeValues: { ':f': freelancerId },
        }),
      ),
      ddb.send(
        new GetCommand({ TableName: table('profile_confidence'), Key: { freelancerId } }),
      ),
      ddb.send(
        new GetCommand({ TableName: table('profile_snapshots'), Key: { freelancerId } }),
      ),
      this.getLatestJob(freelancerId),
    ]);
    return {
      skills: (skillsRes.Items as VerifiedSkill[]) ?? [],
      projects: (projectsRes.Items as FreelancerProject[]) ?? [],
      confidence: (confRes.Item as ProfileConfidence) ?? null,
      latestJob,
      snapshot: (snapRes.Item as GithubProfileSnapshot) ?? null,
    };
  }
}

// ---------- Factory ----------

let cached: GithubScanRepository | null = null;

export function getGithubScanRepository(): GithubScanRepository {
  if (cached) return cached;
  const provider = (process.env.PERSISTENCE_PROVIDER || 'file').toLowerCase();
  if (provider === 'dynamodb') {
    cached = new DynamoDbGithubScanRepository();
  } else if (provider === 'memory') {
    cached = new InMemoryGithubScanRepository();
  } else {
    // Default: durable JSON file so analytics survive restarts (no re-scan needed).
    const file =
      process.env.GITHUB_SCAN_STORE_FILE ||
      resolve(process.cwd(), 'data/github_scans.json');
    cached = new FileGithubScanRepository(file);
  }
  return cached;
}
