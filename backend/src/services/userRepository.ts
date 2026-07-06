import { randomUUID, createHash } from 'crypto';
import { readFile, writeFile, mkdir } from 'fs/promises';
import { dirname, resolve } from 'path';

/**
 * User identity + session storage.
 *
 * Provider is selected at runtime via env:
 *   USER_PROVIDER  = "seed" (default) | "http"
 *   USER_API_URL   = required when provider is "http"
 *   USER_SEED_FILE = optional override for the seed file path
 *
 * For DynamoDB later: implement DynamoDbUserRepository against this interface
 * and return it from getUserRepository(). No other file changes.
 */

export type UserRole = 'client' | 'freelancer' | 'agency' | 'developer';
export type AuthProvider = 'google' | 'github';

export interface User {
  id: string;
  email: string;
  emailVerified: boolean;
  name: string;
  picture?: string;
  googleSub?: string; // Stable Google subject identifier (from ID token "sub").
  authProvider: AuthProvider; // which provider the account signed up with
  githubUserId?: string; // stable numeric GitHub id (as string)
  githubUsername?: string; // GitHub login/handle
  role: UserRole;
  createdAt: string;
  updatedAt: string;
  /**
   * Active refresh tokens, stored as SHA-256 hashes only.
   * On logout we remove one; on logout-everywhere we clear the array.
   */
  refreshTokenHashes: string[];
}

export interface UpsertGoogleProfileInput {
  googleSub: string;
  email: string;
  emailVerified: boolean;
  name: string;
  picture?: string;
}

export interface UpsertGithubProfileInput {
  githubUserId: string;
  githubUsername: string;
  email: string;
  emailVerified: boolean;
  name: string;
  picture?: string;
}

export interface UserRepository {
  findByGoogleSub(googleSub: string): Promise<User | null>;
  findByGithubUserId(githubUserId: string): Promise<User | null>;
  findById(id: string): Promise<User | null>;
  upsertFromGoogleProfile(input: UpsertGoogleProfileInput): Promise<User>;
  upsertFromGithubProfile(input: UpsertGithubProfileInput): Promise<User>;
  addRefreshTokenHash(userId: string, hash: string): Promise<void>;
  removeRefreshTokenHash(userId: string, hash: string): Promise<void>;
  clearRefreshTokens(userId: string): Promise<void>;
  updateRole(userId: string, role: UserRole): Promise<User | null>;
}

// ---------- Seed (file-backed) provider ----------

class SeedFileUserRepository implements UserRepository {
  private cache: User[] | null = null;
  constructor(private readonly filePath: string) {}

  private async load(): Promise<User[]> {
    if (this.cache) return this.cache;
    try {
      const raw = await readFile(this.filePath, 'utf-8');
      const parsed = JSON.parse(raw);
      const list = Array.isArray(parsed) ? parsed : parsed?.users;
      this.cache = Array.isArray(list) ? (list as User[]) : [];
    } catch {
      this.cache = [];
    }
    return this.cache;
  }

  private async persist(): Promise<void> {
    if (!this.cache) return;
    await mkdir(dirname(this.filePath), { recursive: true });
    await writeFile(
      this.filePath,
      JSON.stringify({ users: this.cache }, null, 2) + '\n',
      'utf-8',
    );
  }

  async findByGoogleSub(googleSub: string): Promise<User | null> {
    const users = await this.load();
    return users.find((u) => u.googleSub === googleSub) ?? null;
  }

  async findByGithubUserId(githubUserId: string): Promise<User | null> {
    const users = await this.load();
    return users.find((u) => u.githubUserId === githubUserId) ?? null;
  }

  async findById(id: string): Promise<User | null> {
    const users = await this.load();
    return users.find((u) => u.id === id) ?? null;
  }

  async upsertFromGoogleProfile(input: UpsertGoogleProfileInput): Promise<User> {
    const users = await this.load();
    const existing = users.find((u) => u.googleSub === input.googleSub);
    const now = new Date().toISOString();
    if (existing) {
      existing.email = input.email;
      existing.emailVerified = input.emailVerified;
      existing.name = input.name;
      existing.picture = input.picture;
      existing.updatedAt = now;
      await this.persist();
      return existing;
    }
    const created: User = {
      id: randomUUID(),
      email: input.email,
      emailVerified: input.emailVerified,
      name: input.name,
      picture: input.picture,
      googleSub: input.googleSub,
      authProvider: 'google',
      role: 'client',
      createdAt: now,
      updatedAt: now,
      refreshTokenHashes: [],
    };
    users.push(created);
    await this.persist();
    return created;
  }

  async upsertFromGithubProfile(input: UpsertGithubProfileInput): Promise<User> {
    const users = await this.load();
    const existing = users.find((u) => u.githubUserId === input.githubUserId);
    const now = new Date().toISOString();
    if (existing) {
      existing.email = input.email;
      existing.emailVerified = input.emailVerified;
      existing.name = input.name;
      existing.picture = input.picture;
      existing.githubUsername = input.githubUsername;
      existing.updatedAt = now;
      await this.persist();
      return existing;
    }
    const created: User = {
      id: randomUUID(),
      email: input.email,
      emailVerified: input.emailVerified,
      name: input.name,
      picture: input.picture,
      authProvider: 'github',
      githubUserId: input.githubUserId,
      githubUsername: input.githubUsername,
      role: 'freelancer', // GitHub sign-ups default to freelancer; route may override
      createdAt: now,
      updatedAt: now,
      refreshTokenHashes: [],
    };
    users.push(created);
    await this.persist();
    return created;
  }

  async addRefreshTokenHash(userId: string, hash: string): Promise<void> {
    const users = await this.load();
    const u = users.find((x) => x.id === userId);
    if (!u) return;
    if (!u.refreshTokenHashes.includes(hash)) u.refreshTokenHashes.push(hash);
    u.updatedAt = new Date().toISOString();
    await this.persist();
  }

  async removeRefreshTokenHash(userId: string, hash: string): Promise<void> {
    const users = await this.load();
    const u = users.find((x) => x.id === userId);
    if (!u) return;
    u.refreshTokenHashes = u.refreshTokenHashes.filter((h) => h !== hash);
    u.updatedAt = new Date().toISOString();
    await this.persist();
  }

  async clearRefreshTokens(userId: string): Promise<void> {
    const users = await this.load();
    const u = users.find((x) => x.id === userId);
    if (!u) return;
    u.refreshTokenHashes = [];
    u.updatedAt = new Date().toISOString();
    await this.persist();
  }

  async updateRole(userId: string, role: UserRole): Promise<User | null> {
    const users = await this.load();
    const u = users.find((x) => x.id === userId);
    if (!u) return null;
    u.role = role;
    u.updatedAt = new Date().toISOString();
    await this.persist();
    return u;
  }
}

// ---------- HTTP provider (delegates to your own API/gateway) ----------

class HttpUserRepository implements UserRepository {
  constructor(private readonly baseUrl: string) {}
  private url(p: string) {
    return this.baseUrl.replace(/\/$/, '') + p;
  }
  private async req<T>(path: string, init?: RequestInit): Promise<T | null> {
    const res = await fetch(this.url(path), {
      ...init,
      headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) },
    });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`User API ${path} → ${res.status}`);
    return (await res.json()) as T;
  }
  findByGoogleSub(googleSub: string) {
    return this.req<User>(`/by-google/${encodeURIComponent(googleSub)}`);
  }
  findByGithubUserId(githubUserId: string) {
    return this.req<User>(`/by-github/${encodeURIComponent(githubUserId)}`);
  }
  findById(id: string) {
    return this.req<User>(`/${encodeURIComponent(id)}`);
  }
  async upsertFromGoogleProfile(input: UpsertGoogleProfileInput) {
    const out = await this.req<User>('/upsert-google', {
      method: 'POST',
      body: JSON.stringify(input),
    });
    if (!out) throw new Error('User API upsert returned no user.');
    return out;
  }
  async upsertFromGithubProfile(input: UpsertGithubProfileInput) {
    const out = await this.req<User>('/upsert-github', {
      method: 'POST',
      body: JSON.stringify(input),
    });
    if (!out) throw new Error('User API upsert returned no user.');
    return out;
  }
  async addRefreshTokenHash(userId: string, hash: string) {
    await this.req<unknown>(`/${encodeURIComponent(userId)}/refresh-tokens`, {
      method: 'POST',
      body: JSON.stringify({ hash }),
    });
  }
  async removeRefreshTokenHash(userId: string, hash: string) {
    await this.req<unknown>(`/${encodeURIComponent(userId)}/refresh-tokens`, {
      method: 'DELETE',
      body: JSON.stringify({ hash }),
    });
  }
  async clearRefreshTokens(userId: string) {
    await this.req<unknown>(`/${encodeURIComponent(userId)}/refresh-tokens`, {
      method: 'DELETE',
    });
  }
  async updateRole(userId: string, role: UserRole) {
    return this.req<User>(`/${encodeURIComponent(userId)}/role`, {
      method: 'PATCH',
      body: JSON.stringify({ role }),
    });
  }
}

// ---------- Helper used by auth flow ----------

export function hashRefreshToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

// ---------- DynamoDB provider ----------

class DynamoDbUserRepository implements UserRepository {
  // The table's partition key is `userId`; the domain object uses `id`.
  private toItem(u: User) {
    return { ...u, userId: u.id };
  }

  async findByGoogleSub(googleSub: string): Promise<User | null> {
    const { ddb, table } = await import('../config/aws.js');
    const { QueryCommand } = await import('@aws-sdk/lib-dynamodb');
    const res = await ddb.send(
      new QueryCommand({
        TableName: table('users'),
        IndexName: 'GoogleSubIndex',
        KeyConditionExpression: 'googleSub = :g',
        ExpressionAttributeValues: { ':g': googleSub },
        Limit: 1,
      }),
    );
    return (res.Items?.[0] as User) ?? null;
  }

  async findByGithubUserId(githubUserId: string): Promise<User | null> {
    const { ddb, table } = await import('../config/aws.js');
    const { QueryCommand } = await import('@aws-sdk/lib-dynamodb');
    const res = await ddb.send(
      new QueryCommand({
        TableName: table('users'),
        IndexName: 'GithubUserIndex',
        KeyConditionExpression: 'githubUserId = :g',
        ExpressionAttributeValues: { ':g': githubUserId },
        Limit: 1,
      }),
    );
    return (res.Items?.[0] as User) ?? null;
  }

  async findById(id: string): Promise<User | null> {
    const { ddb, table } = await import('../config/aws.js');
    const { GetCommand } = await import('@aws-sdk/lib-dynamodb');
    const res = await ddb.send(
      new GetCommand({ TableName: table('users'), Key: { userId: id } }),
    );
    return (res.Item as User) ?? null;
  }

  async upsertFromGoogleProfile(input: UpsertGoogleProfileInput): Promise<User> {
    const existing = await this.findByGoogleSub(input.googleSub);
    const now = new Date().toISOString();
    const { ddb, table } = await import('../config/aws.js');
    const { PutCommand } = await import('@aws-sdk/lib-dynamodb');

    if (existing) {
      const updated: User = {
        ...existing,
        email: input.email,
        emailVerified: input.emailVerified,
        name: input.name,
        picture: input.picture,
        updatedAt: now,
      };
      await ddb.send(new PutCommand({ TableName: table('users'), Item: this.toItem(updated) }));
      return updated;
    }

    const created: User = {
      id: randomUUID(),
      email: input.email,
      emailVerified: input.emailVerified,
      name: input.name,
      picture: input.picture,
      googleSub: input.googleSub,
      authProvider: 'google',
      role: 'client',
      createdAt: now,
      updatedAt: now,
      refreshTokenHashes: [],
    };
    await ddb.send(new PutCommand({ TableName: table('users'), Item: this.toItem(created) }));
    return created;
  }

  async upsertFromGithubProfile(input: UpsertGithubProfileInput): Promise<User> {
    const existing = await this.findByGithubUserId(input.githubUserId);
    const now = new Date().toISOString();
    const { ddb, table } = await import('../config/aws.js');
    const { PutCommand } = await import('@aws-sdk/lib-dynamodb');

    if (existing) {
      const updated: User = {
        ...existing,
        email: input.email,
        emailVerified: input.emailVerified,
        name: input.name,
        picture: input.picture,
        githubUsername: input.githubUsername,
        updatedAt: now,
      };
      await ddb.send(new PutCommand({ TableName: table('users'), Item: this.toItem(updated) }));
      return updated;
    }

    const created: User = {
      id: randomUUID(),
      email: input.email,
      emailVerified: input.emailVerified,
      name: input.name,
      picture: input.picture,
      authProvider: 'github',
      githubUserId: input.githubUserId,
      githubUsername: input.githubUsername,
      role: 'freelancer',
      createdAt: now,
      updatedAt: now,
      refreshTokenHashes: [],
    };
    await ddb.send(new PutCommand({ TableName: table('users'), Item: this.toItem(created) }));
    return created;
  }

  private async mutate(userId: string, fn: (u: User) => void): Promise<User | null> {
    const u = await this.findById(userId);
    if (!u) return null;
    fn(u);
    u.updatedAt = new Date().toISOString();
    const { ddb, table } = await import('../config/aws.js');
    const { PutCommand } = await import('@aws-sdk/lib-dynamodb');
    await ddb.send(new PutCommand({ TableName: table('users'), Item: this.toItem(u) }));
    return u;
  }

  async addRefreshTokenHash(userId: string, hash: string): Promise<void> {
    await this.mutate(userId, (u) => {
      if (!u.refreshTokenHashes.includes(hash)) u.refreshTokenHashes.push(hash);
    });
  }
  async removeRefreshTokenHash(userId: string, hash: string): Promise<void> {
    await this.mutate(userId, (u) => {
      u.refreshTokenHashes = u.refreshTokenHashes.filter((h) => h !== hash);
    });
  }
  async clearRefreshTokens(userId: string): Promise<void> {
    await this.mutate(userId, (u) => {
      u.refreshTokenHashes = [];
    });
  }
  async updateRole(userId: string, role: UserRole): Promise<User | null> {
    return this.mutate(userId, (u) => {
      u.role = role;
    });
  }
}

// ---------- Factory ----------

let cached: UserRepository | null = null;

export function getUserRepository(): UserRepository {
  if (cached) return cached;

  const provider = (process.env.USER_PROVIDER || 'seed').toLowerCase();
  if (provider === 'dynamodb') {
    cached = new DynamoDbUserRepository();
  } else if (provider === 'http') {
    const url = process.env.USER_API_URL;
    if (!url) throw new Error('USER_PROVIDER=http requires USER_API_URL.');
    cached = new HttpUserRepository(url);
  } else {
    const file =
      process.env.USER_SEED_FILE ||
      resolve(process.cwd(), 'data/users.seed.json');
    cached = new SeedFileUserRepository(file);
  }
  return cached;
}
