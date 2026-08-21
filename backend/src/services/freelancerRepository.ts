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

/**
 * Merge rosters so the shortlist contains BOTH seeded sample profiles and real
 * platform members. Later sources win on an `id` collision, and real platform
 * records are always passed last — a seeded row must never mask a real user,
 * because only real users have an account that can accept an invitation.
 */
function mergeRosters(...rosters: FreelancerProfile[][]): FreelancerProfile[] {
  const byId = new Map<string, FreelancerProfile>();
  for (const roster of rosters) {
    for (const profile of roster) {
      if (!profile?.id) continue;
      byId.set(profile.id, profile);
    }
  }
  return [...byId.values()];
}

/** Tag every profile in a roster with its provenance. */
function tagSource(
  roster: FreelancerProfile[],
  source: 'platform' | 'sample',
): FreelancerProfile[] {
  return roster.map((profile) => ({ ...profile, source }));
}

/** Reads profiles from a JSON seed file. Used for local dev / demos. */
class SeedFileRepository implements FreelancerRepository {
  constructor(private readonly filePath: string) {}

  async listActiveFreelancers(): Promise<FreelancerProfile[]> {
    try {
      const raw = await readFile(this.filePath, 'utf-8');
      // Seed profiles have no user account, so they are always 'sample'.
      return tagSource(coerceRoster(JSON.parse(raw)), 'sample');
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
  /**
   * Returns seeded sample profiles AND real registered freelancers together.
   *
   * This used to be either/or: if the seeded `freelancers` table had any rows it
   * returned early, so real platform members were never scored and could never
   * be hired (they also have no email on a seeded id, which broke the invitation
   * handshake). Both sources are now merged, with real users taking precedence.
   */
  async listActiveFreelancers(): Promise<FreelancerProfile[]> {
    const [sample, platform] = await Promise.all([
      this.listSampleRoster(),
      this.listPlatformFreelancers(),
    ]);

    const merged = mergeRosters(sample, platform);
    console.log(
      `[freelancerRepository] Roster: ${platform.length} platform member(s) + ${sample.length} sample profile(s) → ${merged.length} scored.`,
    );
    return merged;
  }

  /** Seeded demo roster from the `freelancers` table. Never blocks matching. */
  private async listSampleRoster(): Promise<FreelancerProfile[]> {
    try {
      const { ddb, table } = await import('../config/aws.js');
      const { ScanCommand } = await import('@aws-sdk/lib-dynamodb');
      const res = await ddb.send(new ScanCommand({ TableName: table('freelancers') }));
      return tagSource((res.Items ?? []) as FreelancerProfile[], 'sample');
    } catch (err) {
      console.warn(
        `[freelancerRepository] Sample roster unavailable: ${(err as Error).message}`,
      );
      return [];
    }
  }

  /** Real registered freelancers, built from their account + GitHub scan data. */
  private async listPlatformFreelancers(): Promise<FreelancerProfile[]> {
    try {
      return await this.scanPlatformFreelancers();
    } catch (err) {
      console.warn(
        `[freelancerRepository] Platform freelancers unavailable: ${(err as Error).message}`,
      );
      return [];
    }
  }

  private async scanPlatformFreelancers(): Promise<FreelancerProfile[]> {
    const { ddb, table } = await import('../config/aws.js');
    const { ScanCommand, QueryCommand } = await import('@aws-sdk/lib-dynamodb');

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

    // Each lookup is individually fault-tolerant. A freelancer who has signed up
    // but not been scanned yet (or a missing optional table) must still appear in
    // the roster — previously any single rejection dropped EVERY real freelancer.
    const queryItems = async (tableName: string, freelancerId: string) => {
      try {
        const res = await ddb.send(
          new QueryCommand({
            TableName: table(tableName),
            KeyConditionExpression: 'freelancerId = :f',
            ExpressionAttributeValues: { ':f': freelancerId },
          }),
        );
        return res.Items ?? [];
      } catch {
        return [];
      }
    };

    const profiles = await Promise.all(
      freelancers.map(async (u) => {
        const freelancerId = u.userId || u.id;
        const [skillItems, snapItems, confItems] = await Promise.all([
          queryItems('freelancer_skills', freelancerId),
          queryItems('profile_snapshots', freelancerId),
          queryItems('profile_confidence', freelancerId),
        ]);

        const skills = skillItems
          .map((s: any) => s.skillName || s.name)
          .filter(Boolean);
        const snapshot = snapItems[0] as any;
        const languages = snapshot?.languages ? Object.keys(snapshot.languages) : [];
        const confidence = confItems[0] as any;

        return {
          id: freelancerId,
          name: u.name || u.githubUsername || 'Freelancer',
          title: u.title || snapshot?.headline || 'Full Stack Engineer',
          // Verified skills come from the GitHub scan. Fall back to detected
          // languages so a freshly-scanned profile is still matchable.
          skills: skills.length > 0 ? skills : languages,
          githubLanguages: languages,
          domains: u.domains || ['software'],
          rateMin: u.rateMin ?? 50,
          rateMax: u.rateMax ?? 150,
          reputationScore: confidence?.score ?? 85,
          available: u.available ?? true,
          activeEscrows: u.activeEscrows ?? 0,
          sbtCount: u.sbtCount ?? 1,
          // Real account: reachable by email and able to accept an invitation.
          source: 'platform' as const,
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
