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
  /**
   * Where the profile came from:
   *   'platform' — a real registered freelancer. `id` is their userId, so they
   *                can receive an invitation email and accept it.
   *   'sample'   — seeded demo profile with no user account. Useful to keep the
   *                shortlist populated, but it can never reply to an invitation.
   * Undefined is treated as 'sample' (safer default for legacy rows).
   */
  source?: 'platform' | 'sample';
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
  /** 'primary' = ranked shortlist; 'supplementary' = added for team coverage. */
  matchType?: 'primary' | 'supplementary';
  /** For supplementary picks: which otherwise-uncovered required skills they cover. */
  coversSkills?: string[];
  /** Carried through from the profile so the client knows who can actually reply. */
  source?: 'platform' | 'sample';
}

/** Skill-coverage summary for the shortlist, used to decide if a team is needed. */
export interface ShortlistCoverage {
  requiredSkills: string[];
  coveredSkills: string[];
  uncoveredSkills: string[];
  coveragePct: number;
  strongCandidateCount: number;
  /** True when the shortlist alone is unlikely to deliver (few strong fits or gaps remain). */
  teamRecommended: boolean;
}

export interface ShortlistOutput {
  shortlist: MatchResult[];
  /** Complementary freelancers that, together with the shortlist, cover the project. */
  supplementary: MatchResult[];
  coverage: ShortlistCoverage;
  totalCandidatesEvaluated: number;
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
  // An unset OR empty/whitespace env var must fall back — not coerce to 0.
  // (Number('') === 0, which previously zeroed out weights and broke scoring.)
  if (envVal === undefined || String(envVal).trim() === '') return fallback;
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
): ShortlistOutput {
  const weights = getWeights();
  const norm = makeNorm(getSynonyms());

  const required = (input.requiredSkills ?? []).filter(Boolean);
  const requiredNorm = required.map(norm);
  const wantedDomains = (input.domains ?? []).map(norm);
  const limit = input.limit && input.limit > 0 ? input.limit : 10;

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
      source: f.source ?? 'sample',
    } as MatchResult;
  });

  scored.sort((a, b) => b.compositeScore - a.compositeScore);

  const totalCandidatesEvaluated = (roster ?? []).length;
  const profById = new Map((roster ?? []).map((f) => [f.id, f]));

  const strongMin = num(process.env.MATCH_STRONG_MIN, 45);
  const minStrong = Math.max(1, Math.round(num(process.env.MATCH_MIN_STRONG, 3)));
  const strongCandidateCount = scored.filter((m) => m.compositeScore >= strongMin).length;

  // The shortlist = the *suitable* candidates (strong fit) who can solve the
  // problem, capped at `limit` (top 10). If none clear the bar, fall back to the
  // top few so the client is never shown an empty list.
  const strong = scored.filter((m) => m.compositeScore >= strongMin);
  const primary = (strong.length > 0 ? strong : scored.slice(0, Math.min(limit, 3))).slice(0, limit);
  const shortlist: MatchResult[] = primary.map((m) => ({ ...m, matchType: 'primary' as const }));

  // ── Skill coverage across the shortlist (can the team collectively deliver?) ──
  const normToLabel = new Map<string, string>();
  required.forEach((label) => {
    const k = norm(label);
    if (!normToLabel.has(k)) normToLabel.set(k, label);
  });

  const covered = new Set<string>();
  for (const m of shortlist) {
    const f = profById.get(m.freelancerId);
    if (!f) continue;
    const fSkills = new Set(f.skills.map(norm));
    for (const rk of requiredNorm) if (fSkills.has(rk)) covered.add(rk);
  }
  const uncoveredSkills = [...normToLabel.keys()]
    .filter((k) => !covered.has(k))
    .map((k) => normToLabel.get(k) as string);
  const coveredSkills = [...covered].map((k) => normToLabel.get(k) ?? k);
  const coveragePct = requiredNorm.length
    ? Math.round((covered.size / new Set(requiredNorm).size) * 100)
    : 100;

  // Fewer suitable freelancers than we'd want, or open skill gaps → recommend a team.
  const teamRecommended =
    strongCandidateCount < minStrong || (requiredNorm.length > 0 && uncoveredSkills.length > 0);

  // ── Supplementary picks: complementary freelancers to complete the project ──
  // When the shortlist can't deliver alone, surface additional profiles that
  // cover the remaining skill gaps (or, if coverage is already full but strong
  // fits are scarce, the next best available candidates) so a viable team can
  // be formed instead of leaving the client stuck.
  let supplementary: MatchResult[] = [];
  if (teamRecommended) {
    const shortlistIds = new Set(shortlist.map((m) => m.freelancerId));
    const suppLimit = Math.max(1, Math.round(num(process.env.MATCH_SUPP_LIMIT, 5)));
    const pool = scored.filter((m) => !shortlistIds.has(m.freelancerId));

    const ranked = pool
      .map((m) => {
        const f = profById.get(m.freelancerId);
        const fSkills = new Set((f?.skills ?? []).map(norm));
        const coversSkills = uncoveredSkills.filter((label) => fSkills.has(norm(label)));
        return { m, coversCount: coversSkills.length, coversSkills };
      })
      // With open gaps, require covering ≥1; otherwise allow the next top scorers.
      .filter((x) => (uncoveredSkills.length > 0 ? x.coversCount > 0 : true))
      .sort((a, b) => b.coversCount - a.coversCount || b.m.compositeScore - a.m.compositeScore)
      .slice(0, suppLimit);

    supplementary = ranked.map(({ m, coversSkills }) => ({
      ...m,
      matchType: 'supplementary' as const,
      coversSkills,
      fitReasons:
        coversSkills.length > 0
          ? [`Complements the team — covers: ${coversSkills.join(', ')}`, ...m.fitReasons]
          : ['Additional capacity to help deliver the project', ...m.fitReasons],
    }));
  }

  return {
    shortlist,
    supplementary,
    coverage: {
      requiredSkills: required,
      coveredSkills,
      uncoveredSkills,
      coveragePct,
      strongCandidateCount,
      teamRecommended,
    },
    totalCandidatesEvaluated,
  };
}
