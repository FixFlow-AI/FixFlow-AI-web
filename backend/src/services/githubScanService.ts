import { EventEmitter } from 'events';
import { randomUUID } from 'crypto';
import { openGithubScanStream } from './aiClient.js';
import { getGithubScanRepository } from './githubScanRepository.js';
import type {
  ExperienceSignals,
  ProfileConfidence,
  ScanJob,
  SegmentStatus,
} from '../types/github.js';

/**
 * Orchestrates a freelancer's GitHub scan (roles/01, 01a).
 *
 * Design:
 *   - The GitHub OAuth access token is passed in at login and used ONLY here,
 *     server-to-server, to open the AI service's streaming scan. It is held in
 *     an in-memory map for the lifetime of the scan, then discarded — never
 *     persisted, never sent to the browser.
 *   - A background task consumes the AI service SSE, persists each segment as
 *     it arrives, and re-publishes events on an in-process bus.
 *   - The browser SSE route subscribes to that bus (plus a snapshot of any
 *     already-finished segments), so the dashboard reveals segments live.
 *
 * NOTE: the event bus is in-process. On a single Render instance this is exactly
 * right. For multi-instance you'd swap the bus for Redis pub/sub.
 */

const scanBus = new EventEmitter();
scanBus.setMaxListeners(0);

interface PendingToken {
  token: string;
  expiresAt: number;
}
const pendingTokens = new Map<string, PendingToken>();
const TOKEN_TTL_MS = 10 * 60 * 1000; // a scan should never outlive this

function stashToken(jobId: string, token: string): void {
  pendingTokens.set(jobId, { token, expiresAt: Date.now() + TOKEN_TTL_MS });
}
function dropToken(jobId: string): void {
  pendingTokens.delete(jobId);
}

function emptySegmentStatus(): SegmentStatus {
  return { skills: 'pending', projects: 'pending', experience: 'pending' };
}

/** Subscribe a listener to a job's live events. Returns an unsubscribe fn. */
export function subscribeToScan(
  jobId: string,
  listener: (evt: { event: string; data: any }) => void,
): () => void {
  scanBus.on(jobId, listener);
  return () => scanBus.off(jobId, listener);
}

/**
 * Create a scan job, stash the token, and kick off the background scan.
 * Returns the jobId immediately (non-blocking) so login can respond fast.
 */
export async function enqueueGithubScan(
  freelancerId: string,
  githubUsername: string,
  accessToken: string,
): Promise<string> {
  const repo = getGithubScanRepository();
  const now = new Date().toISOString();
  const jobId = `ghscan_${randomUUID()}`;
  const job: ScanJob = {
    jobId,
    freelancerId,
    githubUsername,
    status: 'queued',
    segmentStatus: emptySegmentStatus(),
    reposDiscovered: 0,
    reposAnalyzed: 0,
    createdAt: now,
    updatedAt: now,
  };
  await repo.createJob(job);
  stashToken(jobId, accessToken);

  // Fire-and-forget: never block the login response on the scan.
  void runScan(jobId, freelancerId, githubUsername).catch((err) => {
    // eslint-disable-next-line no-console
    console.error(`[githubScan] job ${jobId} crashed:`, err);
  });

  return jobId;
}

/** Parse a raw SSE body stream and invoke `onEvent` per frame. */
async function consumeSSE(
  res: Response,
  onEvent: (event: string, data: any) => Promise<void>,
): Promise<void> {
  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let sep: number;
    while ((sep = buffer.indexOf('\n\n')) !== -1) {
      const frame = buffer.slice(0, sep);
      buffer = buffer.slice(sep + 2);
      let event = 'message';
      const dataLines: string[] = [];
      for (const line of frame.split('\n')) {
        if (line.startsWith('event:')) event = line.slice(6).trim();
        else if (line.startsWith('data:')) dataLines.push(line.slice(5).trim());
      }
      if (dataLines.length === 0) continue;
      let data: any = null;
      try {
        data = JSON.parse(dataLines.join('\n'));
      } catch {
        data = { raw: dataLines.join('\n') };
      }
      await onEvent(event, data);
    }
  }
}

/** The background scan: stream from the AI service, persist, and re-publish. */
async function runScan(
  jobId: string,
  freelancerId: string,
  githubUsername: string,
): Promise<void> {
  const repo = getGithubScanRepository();
  const pending = pendingTokens.get(jobId);
  const accessToken = pending?.token;

  const segmentStatus = emptySegmentStatus();
  const publish = (event: string, data: any) => scanBus.emit(jobId, { event, data });

  try {
    await repo.updateJob(jobId, { status: 'running' });

    // Feed the previously stored profile README/bio as grounding context so the
    // AI has real knowledge of what the developer does before it analyzes repos.
    const snapshot = await repo.getProfileSnapshot(freelancerId);

    const res = await openGithubScanStream({
      githubUsername,
      accessToken,
      profileReadme: snapshot?.readme,
      profileBio: snapshot?.bio,
    });

    await consumeSSE(res, async (event, data) => {
      if (event === 'scan_started') {
        await repo.updateJob(jobId, {
          status: 'running',
          reposDiscovered: data.reposDiscovered ?? 0,
          reposAnalyzed: data.reposAnalyzed ?? 0,
        });
        publish(event, data);
        return;
      }

      if (event === 'segment_ready') {
        const segment: keyof SegmentStatus = data.segment;
        segmentStatus[segment] = data.state ?? 'done';
        if (segment === 'skills') {
          await repo.replaceSkills(freelancerId, data.payload ?? []);
        } else if (segment === 'projects') {
          await repo.replaceProjects(freelancerId, data.payload ?? []);
        } else if (segment === 'experience') {
          await repo.updateJob(jobId, {
            experience: data.payload as ExperienceSignals,
          });
        }
        await repo.updateJob(jobId, { status: 'partial', segmentStatus });
        publish(event, data);
        return;
      }

      if (event === 'scan_complete') {
        const confidence = data.confidence as ProfileConfidence;
        if (confidence) {
          // Preserve the prior score so the UI can show a "vs last scan" delta.
          const prior = await repo.getProfile(freelancerId);
          const priorScore = prior.confidence?.score;
          if (typeof priorScore === 'number') confidence.previousScore = priorScore;
          await repo.saveConfidence(freelancerId, confidence);
        }
        await repo.updateJob(jobId, {
          status: 'complete',
          segmentStatus: data.segmentStatus ?? segmentStatus,
          languages: data.languages ?? {},
          confidence: confidence ?? null,
          reposDiscovered: data.reposDiscovered ?? 0,
          reposAnalyzed: data.reposAnalyzed ?? 0,
          finishedAt: new Date().toISOString(),
        });

        if (typeof (repo as any).syncFreelancerRoster === 'function') {
          await (repo as any).syncFreelancerRoster(freelancerId);
        }

        publish(event, data);
        return;
      }

      if (event === 'scan_error') {
        await repo.updateJob(jobId, {
          status: 'failed',
          error: data.error ?? 'scan failed',
          finishedAt: new Date().toISOString(),
        });
        publish(event, data);
        return;
      }
    });

    // If the stream ended without an explicit complete, close it out.
    const job = await repo.getJob(jobId);
    if (job && job.status !== 'complete' && job.status !== 'failed') {
      await repo.updateJob(jobId, { status: 'complete', finishedAt: new Date().toISOString() });
      publish('scan_complete', { segmentStatus });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await repo.updateJob(jobId, {
      status: 'failed',
      error: message,
      finishedAt: new Date().toISOString(),
    });
    publish('scan_error', { error: message });
  } finally {
    dropToken(jobId);
  }
}
