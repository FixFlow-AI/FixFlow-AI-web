const crypto = require('crypto');
const { env } = require('../../config/env');
const FreelancerProfile = require('../../models/FreelancerProfile');
const Niche = require('../../models/Niche');
const { Lead, leadStatuses } = require('../../models/Lead');
const Escrow = require('../../models/Escrow');
const Invoice = require('../../models/Invoice');
const Credential = require('../../models/Credential');
const { BadRequestError, NotFoundError } = require('../../utils/errors');
const { discoverOpportunities, getSearchProviderStatus } = require('./opportunityDiscoveryService');
const { evaluateProjectMatch } = require('./profileMatchService');

const DEFAULT_AGENT_CONFIG = {
  leadHunter: true,
  outreachWriter: true,
  escrowWatcher: true,
  credentialMinter: false,
};

function stableSuffix(input = '') {
  return crypto.createHash('sha1').update(String(input)).digest('hex').slice(0, 10);
}

function countWords(text = '') {
  return String(text)
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
}

function extractPersonalizationTokens(text = '') {
  const tokens = new Set();
  const matcher = /\{\{([a-zA-Z][a-zA-Z0-9_]*)\}\}/g;
  let match = matcher.exec(text);

  while (match) {
    tokens.add(match[1]);
    match = matcher.exec(text);
  }

  return Array.from(tokens);
}

function normalizeAgentConfig(config = {}) {
  return {
    ...DEFAULT_AGENT_CONFIG,
    ...Object.fromEntries(
      Object.entries(config || {}).filter(([, value]) => typeof value === 'boolean')
    ),
  };
}

function buildGithubScanSnapshot(user = {}) {
  const login = (user.email || user.name || 'builder').split('@')[0].replace(/[^a-z0-9-]/gi, '-').toLowerCase();

  return {
    repos: [
      { name: `${login}/rag-proposal-engine`, language: 'JavaScript', commits: 284, stars: 38 },
      { name: `${login}/workflow-sse-api`, language: 'Node.js', commits: 191, stars: 24 },
      { name: `${login}/client-portal-os`, language: 'React', commits: 147, stars: 19 },
    ],
    languages: ['JavaScript', 'React', 'Node.js', 'MongoDB', 'AI workflows'],
    commits: 622,
    scannedAt: new Date().toISOString(),
  };
}

function buildDemoSeed(user = {}) {
  const suffix = stableSuffix(user.userId || user._id || user.email || 'demo');
  const did = `did:fixflow:0x${suffix}`;
  const githubScan = buildGithubScanSnapshot(user);

  const niches = [
    {
      name: 'AI workflow engineering',
      depth: 91,
      rateCeiling: 155,
      tags: ['Gemini', 'SSE', 'Zod', 'product automation'],
      reasoning: 'Strong evidence across streaming proposal generation, schema repair, and authenticated product flows.',
      evidence: [
        { repo: githubScan.repos[0].name, commits: 284, stars: 38, signal: 'Structured LLM pipeline' },
        { repo: githubScan.repos[1].name, commits: 191, stars: 24, signal: 'SSE orchestration' },
      ],
      accepted: true,
    },
    {
      name: 'Freelancer SaaS dashboards',
      depth: 84,
      rateCeiling: 130,
      tags: ['React', 'analytics', 'collaboration'],
      reasoning: 'Repeated delivery of dashboard, portal, workspace, and analytics surfaces maps to high-value B2B build work.',
      evidence: [
        { repo: githubScan.repos[2].name, commits: 147, stars: 19, signal: 'Client-facing product shell' },
      ],
      accepted: true,
    },
    {
      name: 'Proposal and delivery intelligence',
      depth: 79,
      rateCeiling: 120,
      tags: ['brief scoring', 'estimation', 'delivery planning'],
      reasoning: 'BriefScore, TriProposal, ETA, and delivery-plan modules show a tight niche around scoping systems.',
      evidence: [
        { repo: githubScan.repos[0].name, commits: 102, stars: 16, signal: 'Proposal intelligence' },
      ],
      accepted: false,
    },
  ];

  const leads = [
    {
      status: 'qualified',
      score: 92,
      source: 'hn',
      company: {
        name: 'VectorForge Labs',
        stack: ['Next.js', 'Postgres', 'LangChain'],
        size: '11-50',
        mission: 'AI workflow platform for product teams',
      },
      role: 'AI Workflow Engineer',
      rateRange: [125, 175],
      reasoning: ['Matches accepted AI workflow niche', 'Needs streaming UX and schema-first output', 'Budget range supports senior rate'],
    },
    {
      status: 'new',
      score: 86,
      source: 'reddit',
      company: {
        name: 'Northstar Ops',
        stack: ['React', 'Node', 'MongoDB'],
        size: '51-200',
        mission: 'Internal operations dashboards for field teams',
      },
      role: 'Full-stack dashboard builder',
      rateRange: [95, 140],
      reasoning: ['Dashboard-heavy scope', 'Needs a clean MVP quickly', 'Strong React/Express fit'],
    },
    {
      status: 'contacted',
      score: 81,
      source: 'upwork',
      company: {
        name: 'ScopePilot',
        stack: ['Vite', 'Express', 'Gemini'],
        size: '1-10',
        mission: 'Proposal automation for agencies',
      },
      role: 'Proposal automation consultant',
      rateRange: [110, 150],
      reasoning: ['Direct overlap with proposal intelligence', 'Can reuse proven architecture', 'Founder-led buying motion'],
    },
    {
      status: 'replied',
      score: 74,
      source: 'direct',
      company: {
        name: 'LedgerBridge',
        stack: ['Solidity', 'React', 'Node'],
        size: '11-50',
        mission: 'Milestone payments for distributed teams',
      },
      role: 'Escrow UX prototype lead',
      rateRange: [100, 145],
      reasoning: ['Escrow/reputation roadmap match', 'Prototype-ready scope', 'Needs trust-centered product UI'],
    },
  ];

  return {
    profile: {
      did,
      walletAddresses: {
        fixflow: `0xff${suffix.slice(0, 8)}`,
        usdc: `0xusdc${suffix.slice(0, 6)}`,
        matic: `0xmatic${suffix.slice(0, 5)}`,
      },
      profiles: {
        upwork: {
          headline: 'AI workflow engineer for proposal, lead, and delivery systems',
          summary: 'I build schema-first AI workflows, responsive product dashboards, and delivery intelligence tools that turn messy briefs into client-ready execution systems.',
          rate: 140,
        },
        linkedin: {
          headline: 'Full-stack AI engineer building freelancer operating systems',
          about: 'Focused on practical AI product engineering: streaming generation, structured outputs, workflow dashboards, and trust layers for modern service businesses.',
        },
        personal: {
          tagline: 'AI-native delivery systems for serious builders',
          bio: 'I design and build clean, high-performance web products where AI workflows, human review, and business operations meet.',
        },
      },
      agentConfig: DEFAULT_AGENT_CONFIG,
      githubScan,
      onboardedAt: new Date(),
    },
    niches,
    leads,
    escrows: [
      {
        clientDid: `did:client:0x${suffix.slice(0, 8)}`,
        freelancerDid: did,
        totalAmount: 8400,
        currency: 'USDC',
        contractAddress: `0xescrow${suffix.slice(0, 8)}`,
        chain: 'Polygon Amoy',
        milestones: [
          { name: 'Discovery and architecture', amount: 2400, status: 'released', releasedAt: new Date(Date.now() - 86400000 * 4) },
          { name: 'MVP workflow build', amount: 3600, status: 'locked' },
          { name: 'Launch hardening', amount: 2400, status: 'pending' },
        ],
      },
    ],
    invoices: [
      { clientName: 'VectorForge Labs', amount: 2400, currency: 'USDC', status: 'paid', dueDate: new Date(Date.now() - 86400000 * 5) },
      { clientName: 'ScopePilot', amount: 1800, currency: 'USDC', status: 'pending', dueDate: new Date(Date.now() + 86400000 * 7) },
      { clientName: 'Northstar Ops', amount: 950, currency: 'USD', status: 'overdue', dueDate: new Date(Date.now() - 86400000 * 2) },
    ],
    credentials: [
      {
        skill: 'Schema-first AI workflows',
        proof: `zk:${suffix}:workflow`,
        issuerDid: 'did:fixflow:issuer',
        subjectDid: did,
        evidence: { escrowTx: `0xtx${suffix.slice(0, 8)}`, githubCommit: '9ac4f31', leadName: 'VectorForge Labs' },
        status: 'minted',
      },
      {
        skill: 'React delivery dashboards',
        proof: `zk:${suffix}:dashboard`,
        issuerDid: 'did:fixflow:issuer',
        subjectDid: did,
        evidence: { githubCommit: '41e8d29', leadName: 'Northstar Ops' },
        status: 'ready',
      },
    ],
  };
}

function serialize(doc) {
  if (!doc) {
    return null;
  }

  const value = doc?.toObject ? doc.toObject() : { ...doc };
  if (value._id) {
    value.id = value._id.toString();
    delete value._id;
  }
  if (value.userId?.toString) {
    value.userId = value.userId.toString();
  }
  delete value.__v;
  return value;
}

async function ensureFreelancerWorkspace(user) {
  const userId = user.userId || user._id?.toString();
  const existingProfile = await FreelancerProfile.findOne({ userId });

  if (env.NODE_ENV !== 'development' && !env.ALLOW_DEMO_SEED && !existingProfile) {
    throw new BadRequestError('Freelancer OS setup is not initialized. Run onboarding or enable explicit demo seeding in development.');
  }

  const seed = buildDemoSeed({ ...user, userId });
  let profile = existingProfile;

  if (!profile) {
    profile = await FreelancerProfile.create({ userId, ...seed.profile });
  }

  const [nicheCount, leadCount, escrowCount, invoiceCount, credentialCount] = await Promise.all([
    Niche.countDocuments({ userId }),
    Lead.countDocuments({ userId }),
    Escrow.countDocuments({ userId }),
    Invoice.countDocuments({ userId }),
    Credential.countDocuments({ userId }),
  ]);

  const createdLeads = [];
  if (nicheCount === 0) {
    await Niche.insertMany(seed.niches.map((item) => ({ ...item, userId })));
  }

  if (leadCount === 0) {
    const inserted = await Lead.insertMany(
      seed.leads.map((lead) => ({
        ...lead,
        userId,
        draftMessage: buildOutreachDraft(lead),
      }))
    );
    createdLeads.push(...inserted);
  }

  const leadForRelations = createdLeads[0] || (await Lead.findOne({ userId }).sort({ score: -1 }));

  if (escrowCount === 0) {
    await Escrow.insertMany(seed.escrows.map((item) => ({ ...item, userId, leadId: leadForRelations?._id || null })));
  }

  if (invoiceCount === 0) {
    await Invoice.insertMany(seed.invoices.map((item) => ({ ...item, userId, leadId: leadForRelations?._id || null })));
  }

  if (credentialCount === 0) {
    await Credential.insertMany(seed.credentials.map((item) => ({ ...item, userId })));
  }

  return profile;
}

function buildOutreachDraft(lead = {}) {
  const companyName = lead.company?.name || 'your team';
  const repoToken = '{{repo}}';
  const body = [
    'Hi {{firstName}},',
    `I noticed ${companyName} is pushing into ${lead.company?.mission || 'a workflow-heavy product area'}.`,
    `Your stack around ${(lead.company?.stack || []).slice(0, 3).join(', ') || 'modern web apps'} looks close to systems I have built: ${repoToken} with schema-first AI, reviewable outputs, and delivery dashboards.`,
    'If useful, I can map a two-week MVP path that gets the first workflow live without locking you into a heavy platform rewrite.',
  ].join(' ');

  return {
    subject: `${companyName} workflow MVP`,
    body,
    wordCount: countWords(body),
    tokens: extractPersonalizationTokens(body),
    tone: 'warm-direct',
  };
}

async function getCollections(user) {
  await ensureFreelancerWorkspace(user);
  const userId = user.userId || user._id?.toString();
  const [profile, niches, leads, escrows, invoices, credentials] = await Promise.all([
    FreelancerProfile.findOne({ userId }).lean(),
    Niche.find({ userId }).sort({ depth: -1 }).lean(),
    Lead.find({ userId }).sort({ score: -1, updatedAt: -1 }).lean(),
    Escrow.find({ userId }).sort({ createdAt: -1 }).lean(),
    Invoice.find({ userId }).sort({ dueDate: 1 }).lean(),
    Credential.find({ userId }).sort({ mintedAt: -1 }).lean(),
  ]);

  return {
    profile: serialize(profile),
    niches: niches.map(serialize),
    leads: leads.map(serialize),
    escrows: escrows.map(serialize),
    invoices: invoices.map(serialize),
    credentials: credentials.map(serialize),
  };
}

async function getFlowboard(user) {
  const data = await getCollections(user);
  const acceptedNiches = data.niches.filter((niche) => niche.accepted);
  const qualifiedLeads = data.leads.filter((lead) => ['qualified', 'contacted', 'replied'].includes(lead.status));
  const eligibleLeads = data.leads.filter((lead) => lead.match?.eligible || lead.score >= env.BID_MATCH_THRESHOLD);
  const activeEscrows = data.escrows.filter((escrow) =>
    escrow.milestones.some((milestone) => milestone.status === 'locked')
  );
  const escrowBalance = data.escrows.reduce((sum, escrow) => {
    const locked = escrow.milestones
      .filter((milestone) => milestone.status === 'locked')
      .reduce((total, milestone) => total + Number(milestone.amount || 0), 0);
    return sum + locked;
  }, 0);

  return {
    ...data,
    metrics: {
      nicheDepth: Math.round(acceptedNiches.reduce((sum, niche) => sum + niche.depth, 0) / Math.max(acceptedNiches.length, 1)),
      qualifiedLeads: qualifiedLeads.length,
      averageLeadScore: Math.round(data.leads.reduce((sum, lead) => sum + lead.score, 0) / Math.max(data.leads.length, 1)),
      eligibleLeads: eligibleLeads.length,
      escrowBalance,
      reputationScore: Math.min(99, 70 + data.credentials.length * 8 + acceptedNiches.length * 3),
      activeAgents: Object.values(data.profile.agentConfig || {}).filter(Boolean).length,
    },
    discovery: {
      providers: getSearchProviderStatus(),
      bidThreshold: env.BID_MATCH_THRESHOLD,
      eligibleLeads: eligibleLeads.length,
      lastDiscoveredAt: data.leads
        .map((lead) => lead.discoveredAt)
        .filter(Boolean)
        .sort()
        .at(-1) || null,
    },
    tasks: [
      { id: 'task-niche', label: 'Accept or tune top niche positioning', status: acceptedNiches.length >= 2 ? 'done' : 'open' },
      { id: 'task-discovery', label: 'Run live opportunity discovery', status: eligibleLeads.length ? 'done' : 'open' },
      { id: 'task-outreach', label: 'Review high-score outreach draft', status: qualifiedLeads.length ? 'open' : 'waiting' },
      { id: 'task-escrow', label: 'Confirm next escrow milestone', status: activeEscrows.length ? 'open' : 'waiting' },
    ],
  };
}

async function setNicheAccepted(userId, nicheId, accepted) {
  const niche = await Niche.findOneAndUpdate(
    { _id: nicheId, userId },
    { accepted: Boolean(accepted) },
    { new: true }
  );

  if (!niche) {
    throw new NotFoundError('Niche not found');
  }

  return serialize(niche);
}

async function updateLead(userId, leadId, updates = {}) {
  const allowed = {};
  if (updates.status) {
    if (!leadStatuses.includes(updates.status)) {
      throw new BadRequestError('Invalid lead status');
    }
    allowed.status = updates.status;
  }
  if (Array.isArray(updates.reasoning)) allowed.reasoning = updates.reasoning;

  const lead = await Lead.findOneAndUpdate({ _id: leadId, userId }, allowed, { new: true });
  if (!lead) {
    throw new NotFoundError('Lead not found');
  }
  return serialize(lead);
}

async function draftForLead(userId, leadId) {
  const lead = await Lead.findOne({ _id: leadId, userId });
  if (!lead) {
    throw new NotFoundError('Lead not found');
  }

  lead.draftMessage = buildOutreachDraft(lead.toObject());
  await lead.save();
  return serialize(lead).draftMessage;
}

async function sendLeadDraft(userId, leadId) {
  const lead = await Lead.findOne({ _id: leadId, userId });
  if (!lead) {
    throw new NotFoundError('Lead not found');
  }

  const threshold = Number(lead.match?.threshold || env.BID_MATCH_THRESHOLD || 70);
  const matchScore = Number(lead.match?.score || lead.score || 0);
  if (matchScore < threshold) {
    throw new BadRequestError(`Bid blocked: this opportunity is ${matchScore}% matched, below the ${threshold}% eligibility threshold.`);
  }

  if ((lead.draftMessage?.wordCount || 0) > 150) {
    throw new BadRequestError('Outreach draft must be 150 words or fewer before sending');
  }

  lead.status = 'contacted';
  lead.lastContactedAt = new Date();
  lead.bid = {
    ...(lead.bid?.toObject?.() || lead.bid || {}),
    status: 'submitted',
    submittedAt: lead.lastContactedAt,
  };
  await lead.save();
  return { ok: true, sentAt: lead.lastContactedAt };
}

function buildGeneratedProfiles(niches = []) {
  const primary = niches.find((niche) => niche.accepted) || niches[0] || { name: 'AI product engineering', rateCeiling: 120 };
  const secondary = niches.find((niche) => niche.id !== primary.id) || niches[1] || primary;

  return {
    upwork: {
      headline: `${primary.name} specialist for production MVPs`,
      summary: `I help teams turn complex briefs into working systems across ${primary.name.toLowerCase()}, ${secondary.name.toLowerCase()}, and delivery dashboards. My focus is clean architecture, measurable scope, and fast iteration.`,
      rate: primary.rateCeiling,
    },
    linkedin: {
      headline: `Full-stack AI engineer focused on ${primary.name}`,
      about: `Building practical AI workflows, client portals, lead pipelines, and delivery intelligence systems for startup teams that need clarity and speed.`,
    },
    personal: {
      tagline: `${primary.name} for startup teams`,
      bio: `I design and build calm, high-performance systems that connect AI generation, human review, lead operations, and delivery tracking.`,
    },
  };
}

async function generateProfiles(user) {
  const userId = user.userId || user._id?.toString();
  const data = await getCollections(user);
  const profiles = buildGeneratedProfiles(data.niches);

  const profile = await FreelancerProfile.findOneAndUpdate(
    { userId },
    { profiles, onboardedAt: new Date() },
    { new: true }
  );

  return serialize(profile).profiles;
}

async function updateProfiles(userId, profiles = {}) {
  const current = await FreelancerProfile.findOne({ userId });

  if (!current) {
    throw new NotFoundError('Freelancer profile not found');
  }

  const existingProfiles = current.profiles?.toObject?.() || current.profiles || {};
  current.profiles = {
    ...existingProfiles,
    ...profiles,
  };
  await current.save();

  return serialize(current).profiles;
}

async function updateAgentConfig(userId, agentConfig = {}) {
  const normalized = normalizeAgentConfig(agentConfig);
  const profile = await FreelancerProfile.findOneAndUpdate(
    { userId },
    { agentConfig: normalized },
    { new: true }
  );

  if (!profile) {
    throw new NotFoundError('Freelancer profile not found');
  }

  return serialize(profile).agentConfig;
}

async function scanGithub(user) {
  const userId = user.userId || user._id?.toString();
  await ensureFreelancerWorkspace(user);
  const githubScan = buildGithubScanSnapshot(user);
  const profile = await FreelancerProfile.findOneAndUpdate(
    { userId },
    { githubScan },
    { new: true }
  );

  return serialize(profile).githubScan;
}

async function discoverLeads(user, options = {}) {
  await ensureFreelancerWorkspace(user);
  const result = await discoverOpportunities(user, options);

  return {
    ...result,
    leads: result.leads.map(serialize),
  };
}

async function matchClientProject(user, project = {}) {
  await ensureFreelancerWorkspace(user);
  const userId = user.userId || user._id?.toString();
  const [profile, niches] = await Promise.all([
    FreelancerProfile.findOne({ userId }).lean(),
    Niche.find({ userId }).sort({ depth: -1 }).lean(),
  ]);

  return evaluateProjectMatch(project, profile || {}, niches || []);
}

module.exports = {
  DEFAULT_AGENT_CONFIG,
  buildDemoSeed,
  buildGithubScanSnapshot,
  buildGeneratedProfiles,
  buildOutreachDraft,
  countWords,
  discoverLeads,
  draftForLead,
  ensureFreelancerWorkspace,
  extractPersonalizationTokens,
  generateProfiles,
  getCollections,
  getFlowboard,
  getSearchProviderStatus,
  matchClientProject,
  normalizeAgentConfig,
  scanGithub,
  sendLeadDraft,
  serialize,
  setNicheAccepted,
  updateAgentConfig,
  updateLead,
  updateProfiles,
};
