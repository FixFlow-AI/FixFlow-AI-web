const crypto = require('crypto');
const { env } = require('../../config/env');
const FreelancerProfile = require('../../models/FreelancerProfile');
const Niche = require('../../models/Niche');
const { Lead } = require('../../models/Lead');
const { evaluateProjectMatch } = require('./profileMatchService');

const MARKETPLACE_DOMAINS = [
  'upwork.com',
  'freelancer.com',
  'fiverr.com',
  'peopleperhour.com',
  'contra.com',
  'guru.com',
  'wellfound.com',
];

const SKILL_HINTS = [
  'react',
  'node',
  'node.js',
  'express',
  'mongodb',
  'postgres',
  'next.js',
  'vite',
  'typescript',
  'javascript',
  'ai',
  'llm',
  'gemini',
  'openrouter',
  'grok',
  'automation',
  'dashboard',
  'sse',
  'api',
  'solidity',
];

function parseList(raw = '') {
  return String(raw || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function getSearchProviderStatus() {
  const apifyActors = [env.APIFY_UPWORK_ACTOR_ID, env.APIFY_FIVERR_ACTOR_ID, env.APIFY_FREELANCER_ACTOR_ID].filter(Boolean);
  const providers = [
    {
      id: 'apify',
      label: 'Apify marketplace actors',
      configured: Boolean(env.APIFY_API_TOKEN && apifyActors.length),
      detail: apifyActors.length ? `${apifyActors.length} actor${apifyActors.length === 1 ? '' : 's'} configured` : 'No marketplace actor ids configured',
    },
    {
      id: 'tavily',
      label: 'Tavily Search API',
      configured: Boolean(env.TAVILY_API_KEY),
      detail: 'Single-key AI search over targeted marketplace domains',
    },
    {
      id: 'brave',
      label: 'Brave Search API',
      configured: Boolean(env.BRAVE_SEARCH_API_KEY),
      detail: 'Independent web index with domain-targeted search',
    },
    {
      id: 'serpapi',
      label: 'SerpApi',
      configured: Boolean(env.SERPAPI_API_KEY),
      detail: 'Google-backed fallback, not preferred for the primary loop',
    },
  ];
  const order = parseList(env.OPPORTUNITY_SEARCH_PROVIDER_ORDER);

  return (order.length ? order : providers.map((provider) => provider.id))
    .map((id, index) => {
      const provider = providers.find((item) => item.id === id);
      return provider ? { ...provider, order: index + 1 } : null;
    })
    .filter(Boolean);
}

function stableExternalId(value = '') {
  return crypto.createHash('sha1').update(String(value || '')).digest('hex').slice(0, 16);
}

function countWords(text = '') {
  return String(text).trim().split(/\s+/).filter(Boolean).length;
}

function getHost(url = '') {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

function detectSource(url = '', fallback = 'unknown') {
  const host = getHost(url);
  if (/upwork/i.test(host)) return 'upwork';
  if (/fiverr/i.test(host)) return 'fiverr';
  if (/freelancer/i.test(host)) return 'freelancer';
  if (/peopleperhour/i.test(host)) return 'peopleperhour';
  if (/contra/i.test(host)) return 'contra';
  if (/guru/i.test(host)) return 'guru';
  if (/wellfound|angel/i.test(host)) return 'wellfound';
  return fallback;
}

function cleanTitle(value = '') {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .replace(/\s*[-|]\s*(Upwork|Freelancer|Fiverr|PeoplePerHour|Contra|Guru).*$/i, '')
    .trim()
    .slice(0, 160);
}

function inferStack(text = '', fallback = []) {
  const haystack = String(text || '').toLowerCase();
  const detected = SKILL_HINTS.filter((skill) => haystack.includes(skill.toLowerCase()));
  return [...new Set([...(Array.isArray(fallback) ? fallback : []), ...detected])].slice(0, 8);
}

function inferRateRange(budget = {}, profile = {}) {
  const profileRate = Number(profile.profiles?.upwork?.rate || 0);
  if (Array.isArray(budget.rateRange) && budget.rateRange.length === 2) {
    return budget.rateRange.map((value) => Number(value) || 0);
  }

  const min = Number(budget.min || budget.hourlyMin || 0);
  const max = Number(budget.max || budget.hourlyMax || 0);
  if (min || max) {
    return [min || Math.max(25, max - 30), max || min + 40];
  }

  const anchor = profileRate || 120;
  return [Math.max(35, anchor - 25), anchor + 35];
}

function buildDiscoveryDraft(project, match) {
  const companyName = project.company?.name || 'your team';
  const topEvidence = match.githubEvidence?.[0] || 'my recent GitHub work';
  const body = [
    'Hi {{firstName}},',
    `I found your ${project.role || 'project'} and it maps closely to ${topEvidence}.`,
    `The strongest overlap is around ${(match.skillsMatched || []).slice(0, 3).join(', ') || 'the requested stack'}, so I can propose a focused delivery plan instead of a generic bid.`,
    'I can share a short implementation path, risks, and first milestone estimate if this is still open.',
  ].join(' ');

  return {
    subject: `${companyName} project fit`,
    body,
    wordCount: countWords(body),
    tokens: ['firstName'],
    tone: 'warm-direct',
  };
}

function buildBidDraft(project, match) {
  return [
    `I am a strong fit for ${project.role || 'this project'} because your requirements match ${match.score}% of my GitHub-backed delivery evidence.`,
    `Relevant proof: ${(match.githubEvidence || []).slice(0, 2).join('; ') || 'recent React/Node delivery work'}.`,
    `I would start with a short scope map, confirm the main acceptance criteria, then ship the highest-risk workflow first so you can review real progress early.`,
  ].join(' ');
}

function normalizeOpportunity(raw = {}, providerId = 'unknown', profile = {}) {
  const url = raw.url || raw.link || raw.jobUrl || raw.projectUrl || raw.href || '';
  const title = cleanTitle(raw.title || raw.name || raw.jobTitle || raw.projectTitle || raw.position || 'Client project');
  const description = String(raw.description || raw.content || raw.snippet || raw.text || raw.summary || '').trim();
  const source = detectSource(url, raw.source || providerId);
  const host = getHost(url);
  const companyName = raw.client?.name || raw.clientName || raw.companyName || raw.company?.name || host || 'Marketplace client';
  const stack = inferStack(`${title} ${description}`, raw.skills || raw.tags || raw.stack);
  const budget = raw.budget || {
    min: raw.minHourlyRate || raw.hourlyMin || raw.minBudget || raw.budgetMin,
    max: raw.maxHourlyRate || raw.hourlyMax || raw.maxBudget || raw.budgetMax,
    currency: raw.currency || 'USD',
    raw: raw.price || raw.amount || raw.info || '',
  };

  return {
    externalId: raw.id || raw.jobId || raw.projectId || stableExternalId(`${providerId}:${url}:${title}:${description}`),
    source,
    sourceUrl: url,
    discoveredAt: raw.postedAt ? new Date(raw.postedAt) : new Date(),
    company: {
      name: cleanTitle(companyName) || 'Marketplace client',
      stack,
      size: raw.client?.size || raw.companySize || '',
      mission: description.slice(0, 220) || title,
    },
    role: title,
    projectDescription: description,
    budget,
    rateRange: inferRateRange(budget, profile),
  };
}

function buildQuery(profile = {}, niches = [], override = '') {
  if (override) {
    return override;
  }

  const accepted = niches.filter((niche) => niche.accepted);
  const nicheTerms = accepted.flatMap((niche) => [niche.name, ...(niche.tags || [])]);
  const languages = profile.githubScan?.languages || [];
  const terms = [...new Set([...nicheTerms, ...languages])]
    .filter(Boolean)
    .slice(0, 8)
    .join(' ');

  return `${terms || 'React Node AI automation'} freelance project client requirements`;
}

async function fetchJson(url, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);

  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    const text = await response.text();
    if (!response.ok) {
      throw new Error(`${response.status} ${response.statusText}: ${text.slice(0, 300)}`);
    }
    return text ? JSON.parse(text) : {};
  } finally {
    clearTimeout(timeout);
  }
}

async function searchTavily(query, limit) {
  const payload = await fetchJson('https://api.tavily.com/search', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${env.TAVILY_API_KEY}`,
    },
    body: JSON.stringify({
      query: `${query} (${MARKETPLACE_DOMAINS.map((domain) => `site:${domain}`).join(' OR ')})`,
      search_depth: 'basic',
      max_results: limit,
      include_answer: false,
      include_raw_content: false,
    }),
  });

  return (payload.results || []).map((item) => ({
    title: item.title,
    url: item.url,
    content: item.content,
    score: item.score,
  }));
}

async function searchBrave(query, limit) {
  const params = new URLSearchParams({
    q: `${query} ${MARKETPLACE_DOMAINS.map((domain) => `site:${domain}`).join(' OR ')}`,
    count: String(Math.min(limit, 20)),
    search_lang: 'en',
    safesearch: 'moderate',
  });
  const payload = await fetchJson(`https://api.search.brave.com/res/v1/web/search?${params.toString()}`, {
    headers: {
      Accept: 'application/json',
      'X-Subscription-Token': env.BRAVE_SEARCH_API_KEY,
    },
  });

  return (payload.web?.results || []).map((item) => ({
    title: item.title,
    url: item.url,
    content: item.description,
  }));
}

async function searchSerpApi(query, limit) {
  const params = new URLSearchParams({
    engine: 'google',
    q: `${query} ${MARKETPLACE_DOMAINS.map((domain) => `site:${domain}`).join(' OR ')}`,
    num: String(Math.min(limit, 10)),
    api_key: env.SERPAPI_API_KEY,
  });
  const payload = await fetchJson(`https://serpapi.com/search.json?${params.toString()}`);

  return (payload.organic_results || []).map((item) => ({
    title: item.title,
    url: item.link,
    content: item.snippet,
  }));
}

function normalizeActorId(actorId = '') {
  return String(actorId || '').replace('/', '~');
}

async function searchApify(query, limit) {
  const actors = [
    { source: 'upwork', id: env.APIFY_UPWORK_ACTOR_ID },
    { source: 'fiverr', id: env.APIFY_FIVERR_ACTOR_ID },
    { source: 'freelancer', id: env.APIFY_FREELANCER_ACTOR_ID },
  ].filter((actor) => actor.id);

  const perActor = Math.max(1, Math.ceil(limit / Math.max(actors.length, 1)));
  const results = [];

  for (const actor of actors) {
    const actorId = normalizeActorId(actor.id);
    const payload = await fetchJson(
      `https://api.apify.com/v2/acts/${actorId}/run-sync-get-dataset-items?token=${env.APIFY_API_TOKEN}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query,
          searchQuery: query,
          keyword: query,
          maxItems: perActor,
          maxResults: perActor,
        }),
      }
    );

    results.push(...(Array.isArray(payload) ? payload : []).map((item) => ({ ...item, source: actor.source })));
  }

  return results;
}

function buildDemoResults(profile = {}) {
  const languages = profile.githubScan?.languages || ['React', 'Node.js', 'AI workflows'];
  return [
    {
      title: 'Build an AI lead discovery dashboard with proposal automation',
      url: 'https://www.upwork.com/jobs/demo-ai-lead-discovery',
      content: `Client needs ${languages.slice(0, 3).join(', ')} experience, GitHub proof, API integrations, and a dashboard for matching leads to bids.`,
      skills: languages.slice(0, 5),
      clientName: 'Demo Upwork Client',
      budget: { min: 80, max: 140, currency: 'USD' },
    },
    {
      title: 'Freelancer marketplace matching engine for vetted developers',
      url: 'https://www.freelancer.com/projects/demo-matching-engine',
      content: 'Need a full-stack engineer to score GitHub profiles, filter eligible bidders at 70%, and create a client project marketplace.',
      skills: ['React', 'Node.js', 'MongoDB', 'GitHub', 'AI'],
      clientName: 'Demo Marketplace Buyer',
      budget: { min: 100, max: 160, currency: 'USD' },
    },
  ];
}

async function runProvider(providerId, query, limit) {
  if (providerId === 'apify') return searchApify(query, limit);
  if (providerId === 'tavily') return searchTavily(query, limit);
  if (providerId === 'brave') return searchBrave(query, limit);
  if (providerId === 'serpapi') return searchSerpApi(query, limit);
  return [];
}

async function upsertOpportunityLead(userId, project, profile, niches) {
  const match = evaluateProjectMatch(project, profile, niches);
  const draftMessage = buildDiscoveryDraft(project, match);
  const bidDraft = buildBidDraft(project, match);
  const status = match.eligible ? 'qualified' : 'new';
  const existing = await Lead.findOne({
    userId,
    $or: [
      { externalId: project.externalId },
      ...(project.sourceUrl ? [{ sourceUrl: project.sourceUrl }] : []),
    ],
  });

  const update = {
    ...project,
    userId,
    status: existing?.status || status,
    score: match.score,
    reasoning: match.rationale,
    match,
    draftMessage,
    bid: {
      status: match.eligible ? 'ready' : 'not_ready',
      draft: bidDraft,
      submittedAt: existing?.bid?.submittedAt || null,
    },
  };

  const lead = existing
    ? await Lead.findByIdAndUpdate(existing._id, update, { new: true })
    : await Lead.create(update);

  return lead;
}

async function discoverOpportunities(user, options = {}) {
  const userId = user.userId || user._id?.toString();
  const limit = Math.max(1, Math.min(Number(options.limit || 8), 20));
  const [profile, niches] = await Promise.all([
    FreelancerProfile.findOne({ userId }).lean(),
    Niche.find({ userId }).sort({ depth: -1 }).lean(),
  ]);

  const query = buildQuery(profile || {}, niches || [], options.query);
  const providerStatus = getSearchProviderStatus();
  const orderedProviders = providerStatus.filter((provider) => provider.configured);
  const providerErrors = [];
  let providerUsed = null;
  let rawResults = [];

  for (const provider of orderedProviders) {
    try {
      rawResults = await runProvider(provider.id, query, limit);
      providerUsed = provider.id;
      if (rawResults.length) {
        break;
      }
    } catch (error) {
      providerErrors.push({ provider: provider.id, message: error.message });
    }
  }

  if (!rawResults.length && env.OPPORTUNITY_DISCOVERY_DEMO_FALLBACK) {
    rawResults = buildDemoResults(profile || {});
    providerUsed = providerUsed || 'demo';
  }

  const normalized = rawResults
    .slice(0, limit)
    .map((item) => normalizeOpportunity(item, providerUsed || 'unknown', profile || {}));

  const leads = [];
  for (const project of normalized) {
    leads.push(await upsertOpportunityLead(userId, project, profile || {}, niches || []));
  }

  return {
    query,
    provider: providerUsed || null,
    providers: providerStatus,
    providerErrors,
    leads,
    savedCount: leads.length,
    eligibleCount: leads.filter((lead) => lead.match?.eligible).length,
    searchedAt: new Date().toISOString(),
  };
}

module.exports = {
  buildQuery,
  detectSource,
  discoverOpportunities,
  getSearchProviderStatus,
  normalizeOpportunity,
};
