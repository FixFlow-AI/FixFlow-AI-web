import { getGithubScanRepository } from './githubScanRepository.js';
import type { GithubProfileSnapshot } from '../types/github.js';

/**
 * GitHub profile snapshot capture (roles/01a).
 *
 * Runs ONCE at first sign-up (in the background) to store the freelancer's
 * public profile facts + their profile README (the special `user/user` repo).
 * This gives two things:
 *   1. Grounding context for the AI analysis (a good README/bio describes what
 *      the developer actually does — far richer than repo metadata alone).
 *   2. An instant profile view that survives restarts, so a returning user sees
 *      their data without re-hitting the GitHub API.
 *
 * Everything here is best-effort: a failure never blocks login.
 */

const GITHUB_API = 'https://api.github.com';
const MAX_README_CHARS = 8000; // plenty for context; keeps the store lean

function ghHeaders(token: string, accept = 'application/vnd.github+json') {
  return {
    Authorization: `Bearer ${token}`,
    Accept: accept,
    'User-Agent': 'FixFlowAI',
  };
}

/** Fetch the raw profile README markdown (user/user repo). Null if none. */
async function fetchProfileReadme(username: string, token: string): Promise<string | undefined> {
  try {
    const res = await fetch(`${GITHUB_API}/repos/${username}/${username}/readme`, {
      headers: ghHeaders(token, 'application/vnd.github.raw+json'),
    });
    if (res.status !== 200) return undefined;
    const text = await res.text();
    return text ? text.slice(0, MAX_README_CHARS) : undefined;
  } catch {
    return undefined;
  }
}

/** Fetch the public profile + README and return a snapshot (no persistence). */
export async function fetchProfileSnapshot(
  username: string,
  accessToken: string,
): Promise<GithubProfileSnapshot | null> {
  try {
    const res = await fetch(`${GITHUB_API}/users/${username}`, {
      headers: ghHeaders(accessToken),
    });
    if (!res.ok) {
      console.error(`[profileSnapshot] GitHub /users/${username} → ${res.status}`);
      return null;
    }
    const p: any = await res.json();
    const readme = await fetchProfileReadme(username, accessToken);
    return {
      githubUsername: username,
      name: p?.name ?? undefined,
      avatarUrl: p?.avatar_url ?? undefined,
      bio: p?.bio ?? undefined,
      company: p?.company ?? undefined,
      location: p?.location ?? undefined,
      blog: p?.blog ?? undefined,
      publicRepos: typeof p?.public_repos === 'number' ? p.public_repos : undefined,
      followers: typeof p?.followers === 'number' ? p.followers : undefined,
      following: typeof p?.following === 'number' ? p.following : undefined,
      accountCreatedAt: p?.created_at ?? undefined,
      readme,
      fetchedAt: new Date().toISOString(),
    };
  } catch (err) {
    console.error('[profileSnapshot] fetch failed:', err);
    return null;
  }
}

/** Fetch and persist the snapshot for a freelancer. Returns it (or null). */
export async function captureProfileSnapshot(
  freelancerId: string,
  username: string,
  accessToken: string,
): Promise<GithubProfileSnapshot | null> {
  const snapshot = await fetchProfileSnapshot(username, accessToken);
  if (!snapshot) return null;
  try {
    await getGithubScanRepository().saveProfileSnapshot(freelancerId, snapshot);
    console.log(
      `[profileSnapshot] ✅ stored for ${username} (readme: ${snapshot.readme ? 'yes' : 'no'}, publicRepos: ${snapshot.publicRepos ?? '?'})`,
    );
  } catch (err) {
    console.error('[profileSnapshot] persist failed:', err);
  }
  return snapshot;
}
