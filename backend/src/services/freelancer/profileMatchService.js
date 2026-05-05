const { env } = require('../../config/env');

const SKILL_ALIASES = {
  javascript: ['js', 'node', 'node.js', 'express', 'vite'],
  typescript: ['ts'],
  react: ['react.js', 'jsx', 'vite'],
  mongodb: ['mongo', 'mongoose'],
  postgresql: ['postgres', 'postgresql', 'pg'],
  artificialintelligence: ['ai', 'llm', 'genai', 'generativeai', 'gemini', 'grok', 'openrouter'],
  workflowautomation: ['automation', 'workflow', 'sse', 'agent', 'agents'],
  solidity: ['smartcontract', 'escrow', 'web3'],
};

function normalizeToken(value = '') {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9+#.]+/g, '')
    .replace(/\./g, '');
}

function tokenize(value = '') {
  return String(value || '')
    .split(/[^a-zA-Z0-9+#.]+/)
    .map(normalizeToken)
    .filter((token) => token.length >= 2);
}

function expandSkill(skill) {
  const normalized = normalizeToken(skill);
  const aliases = SKILL_ALIASES[normalized] || [];
  return [normalized, ...aliases.map(normalizeToken)].filter(Boolean);
}

function unique(values = []) {
  return [...new Set(values.filter(Boolean))];
}

function collectGithubEvidence(githubScan = {}) {
  const repos = Array.isArray(githubScan.repos) ? githubScan.repos : [];
  const languages = Array.isArray(githubScan.languages) ? githubScan.languages : [];

  const repoTokens = repos.flatMap((repo) => [
    ...tokenize(repo.name),
    ...tokenize(repo.language),
    ...tokenize(repo.signal),
  ]);

  return {
    repoLabels: repos.map((repo) => repo.name).filter(Boolean),
    skills: unique([
      ...languages.flatMap((item) => expandSkill(item)),
      ...repoTokens,
    ]),
  };
}

function collectProfileSignals(profile = {}, niches = []) {
  const github = collectGithubEvidence(profile.githubScan || {});
  const nicheSignals = niches.flatMap((niche) => [
    ...tokenize(niche.name),
    ...(Array.isArray(niche.tags) ? niche.tags.flatMap(tokenize) : []),
    ...tokenize(niche.reasoning),
  ]);

  const profileText = [
    profile.profiles?.upwork?.headline,
    profile.profiles?.upwork?.summary,
    profile.profiles?.linkedin?.headline,
    profile.profiles?.linkedin?.about,
    profile.profiles?.personal?.tagline,
    profile.profiles?.personal?.bio,
  ].filter(Boolean).join(' ');

  return {
    github,
    skills: unique([
      ...github.skills,
      ...nicheSignals,
      ...tokenize(profileText),
    ]),
  };
}

function collectProjectRequirements(project = {}) {
  const explicitStack = Array.isArray(project.stack)
    ? project.stack
    : Array.isArray(project.company?.stack)
      ? project.company.stack
      : [];

  const text = [
    project.title,
    project.role,
    project.description,
    project.projectDescription,
    project.company?.mission,
    explicitStack.join(' '),
  ].filter(Boolean).join(' ');

  const tokens = unique([
    ...explicitStack.flatMap((item) => expandSkill(item)),
    ...tokenize(text),
  ]);

  const filtered = tokens.filter((token) => (
    token.length >= 3 &&
    !['the', 'and', 'for', 'with', 'project', 'developer', 'needed', 'build', 'client'].includes(token)
  ));

  return unique(filtered).slice(0, 18);
}

function findMatchedSkills(requiredSkills, profileSkills) {
  const profileSet = new Set(profileSkills);
  const matched = [];
  const missing = [];

  for (const skill of requiredSkills) {
    const variants = expandSkill(skill);
    const hasMatch = variants.some((variant) => profileSet.has(variant));
    if (hasMatch) {
      matched.push(skill);
    } else {
      missing.push(skill);
    }
  }

  return { matched: unique(matched), missing: unique(missing) };
}

function findGithubEvidence(matchedSkills, github = {}) {
  const evidence = [];
  const repoLabels = github.repoLabels || [];

  for (const skill of matchedSkills.slice(0, 4)) {
    const normalized = normalizeToken(skill);
    const repo = repoLabels.find((label) => tokenize(label).includes(normalized)) || repoLabels[0];
    if (repo) {
      evidence.push(`${skill} evidence in ${repo}`);
    }
  }

  return unique(evidence).slice(0, 4);
}

function evaluateProjectMatch(project = {}, profile = {}, niches = [], options = {}) {
  const threshold = Number(options.threshold ?? env.BID_MATCH_THRESHOLD ?? 70);
  const signals = collectProfileSignals(profile, niches);
  const requiredSkills = collectProjectRequirements(project);
  const { matched, missing } = findMatchedSkills(requiredSkills, signals.skills);
  const overlap = requiredSkills.length ? matched.length / requiredSkills.length : 0;
  const acceptedNicheNames = niches.filter((niche) => niche.accepted).map((niche) => niche.name).join(' ');
  const projectText = [
    project.title,
    project.role,
    project.description,
    project.projectDescription,
    project.company?.mission,
  ].join(' ').toLowerCase();
  const nicheBoost = tokenize(acceptedNicheNames).some((token) => projectText.includes(token)) ? 12 : 0;
  const githubBoost = Math.min(18, findGithubEvidence(matched, signals.github).length * 5);
  const score = Math.max(0, Math.min(100, Math.round(overlap * 70 + nicheBoost + githubBoost)));
  const eligible = score >= threshold;

  return {
    score,
    threshold,
    eligible,
    skillsMatched: matched.slice(0, 8),
    skillsMissing: missing.slice(0, 8),
    githubEvidence: findGithubEvidence(matched, signals.github),
    rationale: [
      `${Math.round(overlap * 100)}% of detected project signals overlap with freelancer evidence.`,
      eligible
        ? `Bid gate passed at ${score}% against the ${threshold}% threshold.`
        : `Bid gate blocked at ${score}% against the ${threshold}% threshold.`,
      ...(nicheBoost ? ['Accepted niche positioning overlaps the client requirement.'] : []),
    ],
    evaluatedAt: new Date(),
  };
}

module.exports = {
  collectProjectRequirements,
  collectProfileSignals,
  evaluateProjectMatch,
  normalizeToken,
};
