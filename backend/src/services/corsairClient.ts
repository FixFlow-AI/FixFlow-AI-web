/**
 * Corsair — "unified integration layer for agents" (BuildX Corsair track).
 *
 * Corsair lets our agent act across a user's apps (Slack, Gmail, GitHub, …)
 * with scoped auth + human **permission approval gates** (open / cautious /
 * strict / readonly), signature-verified webhooks, and an MCP endpoint.
 * Docs: https://docs.corsair.dev  ·  Repo: https://github.com/corsairdev/corsair
 *
 * Design notes
 * ------------
 * - Corsair + its `@corsair-dev/*` plugin packages and `better-sqlite3` are
 *   OPTIONAL. They are loaded via *dynamic, non-literal* imports so the backend
 *   still builds and boots when they aren't installed. When the packages and
 *   Hub keys are present, Corsair activates automatically.
 * - This mirrors the codebase's existing "simulated mode" pattern (Razorpay /
 *   SES): never crash the app because an optional integration isn't configured.
 *
 * To ACTIVATE (see docs/specifications/buildx-prize-tracks/plans/01_corsair_track_plan.md):
 *   1. cd backend && npm install corsair @corsair-dev/slack @corsair-dev/github @corsair-dev/gmail better-sqlite3
 *   2. Create a project at https://hub.corsair.dev/dashboard, copy the API key + signing secret.
 *   3. openssl rand -base64 32   → CORSAIR_KEK
 *   4. Set env: CORSAIR_KEK, CORSAIR_DEV_API_KEY, CORSAIR_DEV_SIGNING_SECRET, APP_URL, CORSAIR_ENABLED=true
 */

import os from 'os';
import path from 'path';

const KEK = process.env.CORSAIR_KEK || '';
const API_KEY = process.env.CORSAIR_PROD_API_KEY || process.env.CORSAIR_DEV_API_KEY || '';
const SIGNING_SECRET = process.env.CORSAIR_PROD_SIGNING_SECRET || process.env.CORSAIR_DEV_SIGNING_SECRET || '';
const DB_FILE = process.env.CORSAIR_DB_FILE || path.join(os.tmpdir(), 'corsair.db');

let corsairLastError: string | null = null;

export function getCorsairError(): string | null {
  return corsairLastError;
}

/** Corsair is considered configured when the KEK + Hub keys are all present. */
export function isCorsairConfigured(): boolean {
  return (
    process.env.CORSAIR_ENABLED !== 'false' &&
    Boolean(KEK && API_KEY && SIGNING_SECRET)
  );
}

/**
 * Dynamic import with a *non-literal* specifier so TypeScript does not require
 * the (optional) package to be installed at compile time.
 */
async function optionalImport(pkg: string): Promise<any | null> {
  try {
    const name = pkg; // non-literal → tsc treats the module as `any`, no resolution error
    return await import(name);
  } catch (err) {
    console.warn(`[Corsair] optionalImport('${pkg}') failed:`, (err as Error).message);
    return null;
  }
}

/**
 * Corsair's SQLite schema. The `corsair` package uses Kysely over
 * better-sqlite3 but ships NO production migrator — `setupCorsair()` only
 * *warns* when tables are missing, so an empty DB file yields runtime errors
 * like "no such table: corsair_integrations". We create the schema ourselves
 * (idempotent, IF NOT EXISTS) before handing the DB to createCorsair.
 *
 * These four DDLs mirror the library's own test harness
 * (corsair/dist/tests.js → createTestDatabase); `corsair_permissions` is the
 * fifth table Corsair queries for the approval gate (cautious/strict modes) —
 * its columns match the library's permission insert (id, token, plugin,
 * endpoint, args, tenant_id, status, expires_at, created_at, updated_at).
 */
const CORSAIR_SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS corsair_integrations (
  id TEXT PRIMARY KEY,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  name TEXT NOT NULL,
  config TEXT NOT NULL,
  dek TEXT NULL
);
CREATE TABLE IF NOT EXISTS corsair_accounts (
  id TEXT PRIMARY KEY,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  tenant_id TEXT NOT NULL,
  integration_id TEXT NOT NULL,
  config TEXT NOT NULL,
  dek TEXT NULL
);
CREATE TABLE IF NOT EXISTS corsair_entities (
  id TEXT PRIMARY KEY,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  account_id TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  version TEXT NOT NULL,
  data TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS corsair_events (
  id TEXT PRIMARY KEY,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  account_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  payload TEXT NOT NULL,
  status TEXT
);
CREATE TABLE IF NOT EXISTS corsair_permissions (
  id TEXT PRIMARY KEY,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  token TEXT NOT NULL,
  plugin TEXT NOT NULL,
  endpoint TEXT NOT NULL,
  args TEXT NOT NULL,
  tenant_id TEXT NOT NULL,
  status TEXT NOT NULL,
  expires_at INTEGER NULL
);
`;

/**
 * Idempotently create Corsair's tables on a better-sqlite3 Database instance.
 * Safe to run on every boot; existing tables are left untouched.
 */
function ensureCorsairSchema(db: any): void {
  db.exec(CORSAIR_SCHEMA_SQL);
}

let cached: any | null = null;
let initTried = false;

/**
 * Returns a configured Corsair instance, or null when Corsair isn't installed /
 * configured (callers then fall back to simulated behavior). Initialized once.
 */
export async function getCorsair(): Promise<any | null> {
  if (cached) return cached;
  if (initTried) return cached;
  initTried = true;

  if (!isCorsairConfigured()) {
    corsairLastError = 'Missing CORSAIR_KEK or Hub API keys (CORSAIR_PROD_API_KEY / CORSAIR_DEV_API_KEY) in environment.';
    console.warn(`[Corsair] ${corsairLastError}`);
    return null;
  }

  const corsairMod = await optionalImport('corsair');
  const sqliteMod = await optionalImport('better-sqlite3');
  if (!corsairMod?.createCorsair || !sqliteMod?.default) {
    const missing = [];
    if (!corsairMod?.createCorsair) missing.push('corsair');
    if (!sqliteMod?.default) missing.push('better-sqlite3');
    corsairLastError = `Packages missing or failed to import on server: ${missing.join(', ')}.`;
    console.warn(`[Corsair] ${corsairLastError}`);
    return null;
  }

  // Load whichever plugin packages are installed; each is optional.
  const plugins: any[] = [];
  const slackMod = await optionalImport('@corsair-dev/slack');
  if (slackMod?.slack) plugins.push(slackMod.slack());
  const githubMod = await optionalImport('@corsair-dev/github');
  if (githubMod?.github) plugins.push(githubMod.github({ authType: 'managed' }));
  const gmailMod = await optionalImport('@corsair-dev/gmail');
  if (gmailMod?.gmail) plugins.push(gmailMod.gmail());

  if (plugins.length === 0) {
    corsairLastError = 'No @corsair-dev/* plugin packages (@corsair-dev/slack, @corsair-dev/github, @corsair-dev/gmail) available.';
    console.warn(`[Corsair] ${corsairLastError}`);
    return null;
  }

  try {
    const Database = sqliteMod.default;
    const db = new Database(DB_FILE);
    // Create Corsair's schema before use — the package has no runtime migrator,
    // so without this the first query fails with "no such table: corsair_*".
    ensureCorsairSchema(db);
    cached = corsairMod.createCorsair({
      plugins,
      database: db,
      kek: KEK,
      hub: { projectApiKey: API_KEY, signingSecret: SIGNING_SECRET },
      // Multi-tenancy: each proposal/workspace gets isolated credentials + perms.
      multiTenancy: true,
    });
    console.log(`[Corsair] Initialized with ${plugins.length} plugin(s) at DB path: ${DB_FILE}`);
    corsairLastError = null;
    return cached;
  } catch (err) {
    corsairLastError = `Corsair init failed: ${(err as Error).message}`;
    console.error(`[Corsair] ${corsairLastError}`);
    cached = null;
    return null;
  }
}

/**
 * Returns a tenant-scoped Corsair client (isolated creds/permissions per
 * proposal), or null when Corsair is unavailable.
 */
export async function getCorsairForTenant(tenantId: string): Promise<any | null> {
  const c = await getCorsair();
  if (!c) return null;
  try {
    return typeof c.withTenant === 'function' ? c.withTenant(tenantId) : c;
  } catch {
    return c;
  }
}

/**
 * Attempts to expose the Corsair request handler for Express. Corsair follows
 * the better-auth pattern; depending on SDK version this is `toNodeHandler`.
 * Returns null if unavailable (route simply isn't mounted).
 */
export async function getCorsairNodeHandler(): Promise<any | null> {
  const c = await getCorsair();
  if (!c) return null;
  const mod = await optionalImport('corsair');
  if (mod?.toNodeHandler) {
    try {
      return mod.toNodeHandler(c, { basePath: '/api/corsair' });
    } catch {
      return null;
    }
  }
  return null;
}
