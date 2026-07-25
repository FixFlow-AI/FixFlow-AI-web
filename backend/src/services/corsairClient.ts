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
