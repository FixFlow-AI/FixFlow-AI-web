/**
 * TypeScript mirrors of the Python `ai-service` GitHub-scan schemas
 * (ai-service/app/schemas/github.py). Kept in sync field-for-field so the
 * gateway can persist and re-emit scan results without re-deriving anything.
 */

export interface SkillEvidence {
  repo: string;
  signal: string;
  detail: string;
}

export interface VerifiedSkill {
  name: string;
  category: 'language' | 'framework' | 'tool' | 'domain';
  confidence: number;
  evidence: SkillEvidence[];
  source: 'github_scan';
  editable: false;
}

export interface FreelancerProject {
  repoName: string;
  summary: string;
  domain?: string | null;
  stack: string[];
  stars: number;
  commitShare: number;
  lastActiveAt?: string | null;
  rankScore: number;
}

export interface ExperienceSignals {
  totalCommits: number;          // commits AUTHORED by the user (measured, not all authors)
  reposAnalyzed: number;
  activeYears: number;
  avgStars: number;
  collaborationRepos: number;    // others' repos where the user authored commits
  documentationQuality: number;
  linesAuthored?: number;        // net lines the user wrote (top repos, best-effort)
  pullRequests?: number;         // PRs opened in the trailing year
  accountAgeYears?: number;      // GitHub account tenure
  followers?: number;
}

export interface ConfidenceFactorBreakdown {
  skillBreadthDepth: number;
  projectStrength: number;
  recency: number;
  contributionVolume: number;
  documentation: number;
}

export interface ProfileConfidence {
  score: number;
  band: 'emerging' | 'developing' | 'match_ready';
  factorBreakdown: ConfidenceFactorBreakdown;
}

export type SegmentState = 'pending' | 'running' | 'done' | 'fallback' | 'error';

export interface SegmentStatus {
  skills: SegmentState;
  projects: SegmentState;
  experience: SegmentState;
}

/** Full result returned by the AI service `/ai/github/scan`. */
export interface GithubScanResult {
  githubUsername: string;
  reposDiscovered: number;
  reposAnalyzed: number;
  languages: Record<string, number>;
  skills: VerifiedSkill[];
  projects: FreelancerProject[];
  experience: ExperienceSignals;
  confidence: ProfileConfidence;
  segmentStatus: SegmentStatus;
  scannedAt: string;
}

export type ScanJobStatus = 'queued' | 'running' | 'partial' | 'complete' | 'failed';

/** Persisted scan-job record (github_scan_jobs table). */
export interface ScanJob {
  jobId: string;
  freelancerId: string;
  githubUsername: string;
  status: ScanJobStatus;
  segmentStatus: SegmentStatus;
  reposDiscovered: number;
  reposAnalyzed: number;
  languages?: Record<string, number>;
  experience?: ExperienceSignals | null;
  confidence?: ProfileConfidence | null;
  error?: string | null;
  createdAt: string;
  updatedAt: string;
  finishedAt?: string | null;
}

/** A single SSE frame from the scan stream. */
export interface ScanStreamEvent {
  event: 'scan_started' | 'segment_ready' | 'scan_complete' | 'scan_error';
  data: any;
}
