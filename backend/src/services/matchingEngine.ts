/**
 * AI-006 — Freelancer ↔ Client Matching Engine.
 *
 * PURE scoring logic. It does not own or hardcode any data — the caller passes
 * in the freelancer roster (sourced from `freelancerRepository.ts`, which can be
 * a seed file, an HTTP API, or a future database). Scoring weights and skill
 * synonyms are configurable via environment variables so behaviour can be tuned
 * without code changes.
 */

export interface FreelancerProfile {
  id: string;
  name: string;
  title: string;
  skills: string[];
  githubLanguages: string[];
  domains: string[];
  rateMin: number; // per-milestone rate range (USD)
  rateMax: number;
  reputationScore: number; // 0-100 composite (from reputationCalculator in prod)
  available: boolean;
  activeEscrows: number;
  sbtCount: number;
}

export interface MatchResult {
  freelancerId: string;
  name: string;
  title: string;
  compositeScore: number;
  factorBreakdown: Record<string, number>;
  fitReasons: string[];
  skillGaps: string[];
  riskFlags: string[];
}

export interface MatchWeights {
  skillOverlap: number;
  githubSignal: number;
  domainExperience: number;
  budgetAlignment: number;
  reputation: number;
  availability: number;
  sbt: number;
}

const DEFAULT_WEIGHTS: MatchWeights = {
  skillOverlap: 0.25,
  githubSignal: 0.2,
  domainExperience: 0.15,
  budgetAlignment: 0.15,
  reputation: 0.1,
  availability: 0.1,
  sbt: 0.05,
};

const DEFAULT_SYNONYMS: Record<string, string> = {
  postgres: 'postgresql',
  js: 'javascript',
  ts: 'typescript',
  node: 'node.js',
  reactjs: 'react',
  next: 'next.js',
  k8s: 'kubernetes',
};

function num(envVal: string | undefined, fallback: number): number {
  const n = Number(envVal);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

/** Reads weights from env (MATCH_W_*), falling back to sensible defaults. */
export function getWeights(): MatchWeights {
  return {
    skillOverlap: num(process.env.MATCH_W_SKILL, DEFAULT_WEIGHTS.skillOverlap),
    githubSignal: num(process.env.MATCH_W_GITHUB, DEFAULT_WEIGHTS.githubSignal),
    domainExperience: num(process.env.MATCH_W_DOMAIN, DEFAULT_WEIGHTS.domainExperience),
    budgetAlignment: num(process.env.MATCH_W_BUDGET, DEFAULT_WEIGHTS.budgetAlignment),
    reputation: num(process.env.MATCH_W_REPUTATION, DEFAULT_WEIGHTS.reputation),
    availability: num(process.env.MATCH_W_AVAILABILITY, DEFAULT_WEIGHTS.availability),
    sbt: num(process.env.MATCH_W_SBT, DEFAULT_WEIGHTS.sbt),
  };
}

/** Merges default skill synonyms with an optional JSON map in MATCH_SKILL_SYNONYMS. */
function getSynonyms(): Record<string, string> {
  const extra = process.env.MATCH_SKILL_SYNONYMS;
  if (!extra) return DEFAULT_SYNONYMS;
  try {
    const parsed = JSON.parse(extra);
    const merged: Record<string, string> = { ...DEFAULT_SYNONYMS };
    for (const [k, v] of Object.entries(parsed)) {
      merged[String(k).toLowerCase()] = String(v).toLowerCase();
    }
    return merged;
  } catch {
    console.warn('[matchingEngine] MATCH_SKILL_SYNONYMS is not valid JSON; using defaults.');
    return DEFAULT_SYNONYMS;
  }
}

function makeNorm(synonyms: Record<string, string>) {
  return (s: string) => {
    const k = (s ?? '').trim().toLowerCase();
    return synonyms[k] ?? k;
  };
}

function jaccard(a: string[], b: string[], norm: (s: string) => string): number {
  const sa = new Set(a.map(norm));
  const sb = new Set(b.map(norm));
  if (sa.size === 0) return 0;
  let inter = 0;
  for (const x of sa) if (sb.has(x)) inter++;
  const union = new Set([...sa, ...sb]).size;
  return union === 0 ? 0 : (inter / union) * 100;
}

function budgetFit(budget: number | undefined, f: FreelancerProfile): number {
  if (!budget || budget <= 0) return 70; // neutral when unknown
  if (budget >= f.rateMin && budget <= f.rateMax) return 100;
  const nearest = budget < f.rateMin ? f.rateMin : f.rateMax;
  const diffPct = nearest > 0 ? Math.abs(budget - nearest) / nearest : 1;
  return Math.max(0, Math.round(100 - diffPct * 100));
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}

export interface MatchInput {
  requiredSkills: string[];
  budget?: number; // per-milestone budget in USD
  limit?: number;
  domains?: string[];
}

/**
 * Pure matching function. Scores the provided roster against the project input.
 * @param input    project requirements
 * @param roster   freelancer profiles (provided by the repository layer)
 */
export function generateShortlist(
  input: MatchInput,
  roster: FreelancerProfile[],
): { shortlist: MatchResult[]; totalCandidatesEvaluated: number } {
  const weights = getWeights();
  const norm = makeNorm(getSynonyms());

  const required = (input.requiredSkills ?? []).filter(Boolean);
  const requiredNorm = required.map(norm);
  const wantedDomains = (input.domains ?? []).map(norm);
  const limit = input.limit && input.limit > 0 ? input.limit : 5;

  const scored = (roster ?? []).map((f) => {
    const skillOverlap = jaccard(required, f.skills, norm);
    const ghHits = requiredNorm.filter((s) =>
      f.githubLanguages.map(norm).some((g) => g.includes(s) || s.includes(g)),
    ).length;
    const githubSignal = requiredNorm.length ? (ghHits / requiredNorm.length) * 100 : 60;
    const domainHits = wantedDomains.filter((d) => f.domains.map(norm).includes(d)).length;
    const domainExperience = wantedDomains.length
      ? (domainHits / wantedDomains.length) * 100
      : Math.min(100, f.domains.length * 30);
    const budgetAlignment = budgetFit(input.budget, f);
    const availability = f.available && f.activeEscrows < 2 ? 100 : f.available ? 50 : 0;
    const sbt = Math.min(100, f.sbtCount * 35);

    const factorBreakdown = {
      skillOverlap: round(skillOverlap),
      githubSignal: round(githubSignal),
      domainExperience: round(domainExperience),
      budgetAlignment: round(budgetAlignment),
      reputation: f.reputationScore,
      availability,
      sbtCredentials: sbt,
    };

    const compositeScore = round(
      skillOverlap * weights.skillOverlap +
        githubSignal * weights.githubSignal +
        domainExperience * weights.domainExperience +
        budgetAlignment * weights.budgetAlignment +
        f.reputationScore * weights.reputation +
        availability * weights.availability +
        sbt * weights.sbt,
    );

    const skillGaps = required.filter((s) => !f.skills.map(norm).includes(norm(s)));

    const fitReasons: string[] = [];
    if (skillOverlap >= 60) fitReasons.push(`Matches ${Math.round(skillOverlap)}% of the required skills`);
    if (f.reputationScore >= 85) fitReasons.push(`Strong reputation: ${f.reputationScore}/100 verified score`);
    if (budgetAlignment >= 90) fitReasons.push(`Rate range $${f.rateMin}-$${f.rateMax} fits the milestone budget`);
    if (domainHits > 0)
      fitReasons.push(
        `Direct experience in ${f.domains.filter((d) => wantedDomains.includes(norm(d))).join(', ')}`,
      );
    if (f.sbtCount > 0)
      fitReasons.push(`${f.sbtCount} verified Soulbound credential${f.sbtCount > 1 ? 's' : ''}`);
    if (fitReasons.length === 0) fitReasons.push('Available and verified, partial skill overlap');

    const riskFlags: string[] = [];
    if (!f.available || f.activeEscrows >= 2) riskFlags.push('Limited availability');
    if (skillGaps.length > 0) riskFlags.push(`${skillGaps.length} skill gap${skillGaps.length > 1 ? 's' : ''}`);

    return {
      freelancerId: f.id,
      name: f.name,
      title: f.title,
      compositeScore,
      factorBreakdown,
      fitReasons,
      skillGaps,
      riskFlags,
    } as MatchResult;
  });

  scored.sort((a, b) => b.compositeScore - a.compositeScore);

  return {
    shortlist: scored.slice(0, limit),
    totalCandidatesEvaluated: (roster ?? []).length,
  };
}
