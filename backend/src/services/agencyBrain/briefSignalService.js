const TECH_PATTERNS = {
  react: /\breact\b/i,
  'node.js': /\bnode(\.js)?\b/i,
  python: /\bpython\b/i,
  vue: /\bvue\b/i,
  nextjs: /\bnext\.?js\b/i,
  mobile: /\bmobile|ios|android|react native|flutter\b/i,
  ai: /\bai|machine learning|ml|llm|genai|ocr\b/i,
  analytics: /\banalytics|dashboard|reporting|insight|bi\b/i,
  integrations: /\bintegration|api|webhook|crm|erp|salesforce|hubspot\b/i,
};

const INDUSTRY_PATTERNS = {
  healthcare: /\bhealth|healthcare|clinic|patient|ehr|hipaa|medical\b/i,
  ecommerce: /\be-?commerce|shop|cart|checkout|retail|storefront\b/i,
  fintech: /\bfintech|bank|payment|wallet|kyc|trading\b/i,
  saas: /\bsaas|subscription|tenant|multi-tenant|b2b software\b/i,
  education: /\bedtech|education|learning|school|student|course\b/i,
  logistics: /\blogistics|fleet|delivery|warehouse|shipment|fulfillment\b/i,
};

function unique(items) {
  return [...new Set(items)];
}

function buildBriefSnapshot(text = '', maxLength = 4000) {
  return String(text || '').trim().slice(0, maxLength);
}

function detectTech(text = '') {
  return unique(
    Object.entries(TECH_PATTERNS)
      .filter(([, pattern]) => pattern.test(text))
      .map(([label]) => label)
  );
}

function detectIndustries(text = '') {
  return unique(
    Object.entries(INDUSTRY_PATTERNS)
      .filter(([, pattern]) => pattern.test(text))
      .map(([label]) => label)
  );
}

function extractKeywords(text = '', limit = 12) {
  const tokens = String(text || '')
    .toLowerCase()
    .match(/[a-z]{4,}/g) || [];
  const stopWords = new Set([
    'this', 'that', 'with', 'from', 'have', 'your', 'will', 'into', 'need', 'needs', 'must',
    'should', 'about', 'client', 'project', 'proposal', 'phase', 'scope', 'team', 'platform',
  ]);
  const frequency = new Map();

  tokens.forEach((token) => {
    if (stopWords.has(token)) return;
    frequency.set(token, (frequency.get(token) || 0) + 1);
  });

  return [...frequency.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([keyword]) => keyword);
}

function buildBriefSignals(text = '') {
  return {
    industries: detectIndustries(text),
    tech: detectTech(text),
    keywords: extractKeywords(text),
  };
}

function inferSignalsFromProposal(proposal = {}, proposalJSON = {}) {
  const fallbackText = [
    proposal.briefSnapshot,
    proposal.projectSummary,
    proposalJSON.project_summary,
    ...(proposalJSON.features || []).map((feature) => `${feature.title} ${feature.technical_approach}`),
  ]
    .filter(Boolean)
    .join(' ');

  const inferred = buildBriefSignals(fallbackText);

  if (proposal.briefSignals?.industries?.length || proposal.briefSignals?.tech?.length) {
    return {
      industries: unique([...(proposal.briefSignals.industries || []), ...inferred.industries]),
      tech: unique([...(proposal.briefSignals.tech || []), ...inferred.tech]),
      keywords: unique([...(proposal.briefSignals.keywords || []), ...inferred.keywords]).slice(0, 12),
    };
  }

  return inferred;
}

module.exports = {
  TECH_PATTERNS,
  INDUSTRY_PATTERNS,
  buildBriefSnapshot,
  buildBriefSignals,
  inferSignalsFromProposal,
  detectTech,
  detectIndustries,
};
