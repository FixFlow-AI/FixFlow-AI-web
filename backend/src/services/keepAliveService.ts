import { getAiServiceUrl, getPublicAiServiceUrl } from './aiClient.js';

/**
 * Background Keep-Alive Service.
 * Runs every 10 minutes (600,000 ms) to keep the Python AI microservice
 * and Node backend warm on Render Free / Starter instances, preventing
 * cold starts and spin-down inactivity.
 */
let timer: NodeJS.Timeout | null = null;
const WARMUP_INTERVAL_MS = 10 * 60 * 1000; // 10 minutes

async function pingServices(): Promise<void> {
  // 1. Ping AI Service /health. Try the private hostport first (cheap, no
  //    egress), then fall back to the public HTTPS URL — the private network
  //    path connects directly to the container and fails outright if it's
  //    asleep (free-tier spin-down), since it bypasses the public edge that
  //    would otherwise wake it back up.
  const aiUrls = [getAiServiceUrl(), getPublicAiServiceUrl()].filter(
    (u, idx, self) => Boolean(u) && self.indexOf(u) === idx,
  );
  for (const aiUrl of aiUrls) {
    try {
      const res = await fetch(`${aiUrl}/health`, {
        headers: { 'User-Agent': 'FixFlowAI-KeepAlive/1.0' },
      });
      if (res.ok) {
        console.log(`[KeepAlive] Warmed up AI service at ${aiUrl}/health (${res.status} OK)`);
        break;
      }
      console.warn(`[KeepAlive] AI service warmup at ${aiUrl} returned status ${res.status}`);
    } catch (err) {
      console.warn(`[KeepAlive] AI service warmup ping failed for ${aiUrl}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  // 2. Ping Backend Self (if public URL is provided via env var e.g. RENDER_EXTERNAL_URL or BACKEND_SELF_URL)
  const selfUrl = (process.env.RENDER_EXTERNAL_URL || process.env.BACKEND_SELF_URL || '').trim().replace(/\/+$/, '');
  if (selfUrl) {
    try {
      const res = await fetch(`${selfUrl}/api/health`, {
        headers: { 'User-Agent': 'FixFlowAI-KeepAlive/1.0' },
      });
      if (res.ok) {
        console.log(`[KeepAlive] Warmed up backend self at ${selfUrl}/api/health (${res.status} OK)`);
      }
    } catch (err) {
      console.warn(`[KeepAlive] Backend self warmup ping failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  // 3. Ping the frontend so the whole stack stays warm. A Render static site is
  //    CDN-served and does not sleep, but if the frontend is ever a web service
  //    this keeps it awake too. Pings every configured origin (comma-separated
  //    KEEP_ALIVE_FRONTEND_URL, falling back to PLATFORM_URL).
  const frontendRaw =
    process.env.KEEP_ALIVE_FRONTEND_URL || process.env.PLATFORM_URL || '';
  const frontendUrls = frontendRaw
    .split(',')
    .map((u) => u.trim().replace(/\/+$/, ''))
    .filter(Boolean);
  for (const url of frontendUrls) {
    try {
      const res = await fetch(`${url}/`, {
        headers: { 'User-Agent': 'FixFlowAI-KeepAlive/1.0' },
      });
      if (res.ok) {
        console.log(`[KeepAlive] Warmed up frontend at ${url}/ (${res.status} OK)`);
      } else {
        console.warn(`[KeepAlive] Frontend warmup at ${url} returned status ${res.status}`);
      }
    } catch (err) {
      console.warn(`[KeepAlive] Frontend warmup ping failed for ${url}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
}

export function startKeepAliveService(): void {
  if (timer) return; // Already running

  console.log('[KeepAlive] Initializing 10-minute automated warmup timer...');

  // Run an initial ping after a short 10-second delay on boot
  setTimeout(() => {
    void pingServices();
  }, 10000);

  // Schedule recurring ping every 10 minutes
  timer = setInterval(() => {
    void pingServices();
  }, WARMUP_INTERVAL_MS);

  if (timer && typeof timer.unref === 'function') {
    timer.unref();
  }
}

export function stopKeepAliveService(): void {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}
