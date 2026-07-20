import { readFile } from 'fs/promises';
import { resolve } from 'path';
import type { FreelancerProfile } from './matchingEngine.js';

/**
 * Data-access seam for freelancer profiles.
 *
 * The matching engine (matchingEngine.ts) is a PURE scoring function — it never
 * owns data. This repository is the single place that decides WHERE profiles
 * come from, chosen at runtime via environment variables:
 *
 *   FREELANCER_PROVIDER = "seed" (default) | "http"
 *   FREELANCER_API_URL  = required when provider is "http"
 *   FREELANCER_SEED_FILE = optional path override for the seed JSON
 *
 * To plug in a real database later, implement `FreelancerRepository` (e.g. a
 * PrismaFreelancerRepository) and return it from `getFreelancerRepository()`.
 * No other file needs to change.
 */
export interface FreelancerRepository {
  listActiveFreelancers(): Promise<FreelancerProfile[]>;
}

/** Accepts either a bare array or an object of shape `{ freelancers: [...] }`. */
function coerceRoster(data: unknown): FreelancerProfile[] {
  if (Array.isArray(data)) return data as FreelancerProfile[];
  if (data && typeof data === 'object' && Array.isArray((data as any).freelancers)) {
    return (data as any).freelancers as FreelancerProfile[];
  }
  return [];
}

/** Reads profiles from a JSON seed file. Used for local dev / demos. */
class SeedFileRepository implements FreelancerRepository {
  constructor(private readonly filePath: string) {}

  async listActiveFreelancers(): Promise<FreelancerProfile[]> {
    try {
      const raw = await readFile(this.filePath, 'utf-8');
      return coerceRoster(JSON.parse(raw));
    } catch (err) {
      console.warn(
        `[freelancerRepository] Seed file unavailable at ${this.filePath}: ${(err as Error).message}. Returning empty roster.`,
      );
      return [];
    }
  }
}

/** Fetches profiles from an external HTTP API (your service or a DB-backed gateway). */
class HttpRepository implements FreelancerRepository {
  constructor(private readonly url: string) {}

  async listActiveFreelancers(): Promise<FreelancerProfile[]> {
    const res = await fetch(this.url);
    if (!res.ok) {
      throw new Error(`Freelancer API at ${this.url} responded ${res.status}`);
    }
    return coerceRoster(await res.json());
  }
}

/** Queries profiles directly from DynamoDB tables. */
class DynamoDbFreelancerRepository implements FreelancerRepository {
  async listActiveFreelancers(): Promise<FreelancerProfile[]> {
    const { ddb, table } = await import('../config/aws.js');
    const { ScanCommand, QueryCommand } = await import('@aws-sdk/lib-dynamodb');

    // 1. Try querying the dedicated freelancers table first
    try {
      const rosterRes = await ddb.send(new ScanCommand({ TableName: table('freelancers') }));
      if (rosterRes.Items && rosterRes.Items.length > 0) {
        return rosterRes.Items as FreelancerProfile[];
      }
    } catch {
      /* Fallback to user scanning */
    }

    // 2. Fallback to scanning users with role = 'freelancer'
    const usersRes = await ddb.send(
      new ScanCommand({
        TableName: table('users'),
        FilterExpression: '#r = :r',
        ExpressionAttributeNames: { '#r': 'role' },
        ExpressionAttributeValues: { ':r': 'freelancer' },
      }),
    );
    const freelancers = usersRes.Items ?? [];
    if (freelancers.length === 0) return [];

    const profiles = await Promise.all(
      freelancers.map(async (u) => {
        const [skillsRes, snapRes, confRes] = await Promise.all([
          ddb.send(
            new QueryCommand({
              TableName: table('freelancer_skills'),
              KeyConditionExpression: 'freelancerId = :f',
              ExpressionAttributeValues: { ':f': u.userId || u.id },
            }),
          ),
          ddb.send(
            new QueryCommand({
              TableName: table('profile_snapshots'),
              KeyConditionExpression: 'freelancerId = :f',
              ExpressionAttributeValues: { ':f': u.userId || u.id },
            }),
          ),
          ddb.send(
            new QueryCommand({
              TableName: table('profile_confidence'),
              KeyConditionExpression: 'freelancerId = :f',
              ExpressionAttributeValues: { ':f': u.userId || u.id },
            }),
          ),
        ]);

        const skills = (skillsRes.Items ?? []).map((s: any) => s.skillName || s.name);
        const snapshot = snapRes.Items?.[0] as any;
        const languages = snapshot?.languages ? Object.keys(snapshot.languages) : [];
        const confidence = confRes.Items?.[0] as any;

        return {
          id: u.userId || u.id,
          name: u.name || u.githubUsername || 'Freelancer',
          title: u.title || 'Full Stack Engineer',
          skills,
          githubLanguages: languages,
          domains: u.domains || ['software'],
          rateMin: u.rateMin ?? 50,
          rateMax: u.rateMax ?? 150,
          reputationScore: confidence?.score ?? 85,
          available: u.available ?? true,
          activeEscrows: u.activeEscrows ?? 0,
          sbtCount: u.sbtCount ?? 1,
        } as FreelancerProfile;
      }),
    );

    return profiles;
  }
}

let cached: FreelancerRepository | null = null;

export function getFreelancerRepository(): FreelancerRepository {
  if (cached) return cached;

  const provider = (
    process.env.PERSISTENCE_PROVIDER ||
    process.env.FREELANCER_PROVIDER ||
    'seed'
  ).toLowerCase();

  if (provider === 'dynamodb') {
    cached = new DynamoDbFreelancerRepository();
  } else if (provider === 'http') {
    const url = process.env.FREELANCER_API_URL;
    if (!url) {
      throw new Error('FREELANCER_PROVIDER=http requires FREELANCER_API_URL to be set.');
    }
    cached = new HttpRepository(url);
  } else {
    const file =
      process.env.FREELANCER_SEED_FILE ||
      resolve(process.cwd(), 'data/freelancers.seed.json');
    cached = new SeedFileRepository(file);
  }

  return cached;
}
