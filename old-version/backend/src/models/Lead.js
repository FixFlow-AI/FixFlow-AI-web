const { createDynamoModel } = require('../db/dynamoModel');

const leadStatuses = ['new', 'qualified', 'contacted', 'replied', 'won', 'lost'];
const leadSources = [
  'reddit',
  'hn',
  'upwork',
  'fiverr',
  'freelancer',
  'peopleperhour',
  'contra',
  'guru',
  'wellfound',
  'linkedin',
  'direct',
  'github',
  'tavily',
  'brave',
  'serpapi',
  'apify',
  'manual',
  'unknown',
];

function buildDraftMessageDefaults() {
  return {
    subject: '',
    body: '',
    wordCount: 0,
    tokens: [],
    tone: 'warm-direct',
  };
}

function buildMatchDefaults() {
  return {
    score: 0,
    threshold: 70,
    eligible: false,
    skillsMatched: [],
    skillsMissing: [],
    githubEvidence: [],
    rationale: [],
    evaluatedAt: null,
  };
}

function buildBidDefaults() {
  return {
    status: 'not_ready',
    draft: '',
    submittedAt: null,
  };
}

function buildCompanyDefaults() {
  return {
    name: '',
    stack: [],
    size: '',
    logo: '',
    mission: '',
  };
}

const Lead = createDynamoModel({
  modelName: 'Lead',
  defaults: () => ({
    status: 'new',
    score: 0,
    source: 'direct',
    sourceUrl: '',
    externalId: '',
    discoveredAt: null,
    projectDescription: '',
    budget: {},
    match: buildMatchDefaults(),
    bid: buildBidDefaults(),
    reasoning: [],
    company: buildCompanyDefaults(),
    rateRange: [0, 0],
    draftMessage: buildDraftMessageDefaults(),
    lastContactedAt: null,
  }),
});

module.exports = {
  Lead,
  leadSources,
  leadStatuses,
};
