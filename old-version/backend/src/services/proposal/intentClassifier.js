/**
 * Server-side intent classifier.
 *
 * Provides a fallback classification when the client-side heuristic
 * may have misclassified the user's intent.
 */

const MUTATE_VERBS = [
  'add', 'remove', 'reduce', 'increase', 'change', 'rewrite',
  'update', 'cut', 'compress', 'replace', 'rebuild', 'make it',
  'modify', 'delete', 'insert', 'swap', 'merge', 'split',
  'shorten', 'extend', 'expand', 'simplify', 'restructure',
];

const QUESTION_WORDS = [
  'why', 'how', 'what', 'explain', 'tell me', 'describe',
  'what if', 'can you', 'could you', 'is there', 'are there',
  'when', 'where', 'which', 'who',
];

const SECTION_KEYWORDS = {
  timeline: ['timeline', 'phase', 'week', 'schedule', 'deadline', 'duration', 'sprint'],
  features: ['feature', 'requirement', 'functionality', 'scope', 'capability'],
  risks: ['risk', 'concern', 'mitigation', 'issue', 'threat', 'vulnerability'],
  effort: ['effort', 'estimate', 'hours', 'budget', 'cost', 'resource', 'allocation'],
  summary: ['summary', 'introduction', 'overview', 'executive', 'description'],
  market: ['market', 'trend', 'competitor', 'industry', 'signal'],
  impact: ['impact', 'business', 'value', 'roi', 'benefit'],
};

/**
 * Classify intent from message text.
 *
 * @param {string} message
 * @returns {{ intent: 'question' | 'mutate', targetSection: string | null }}
 */
function classifyIntent(message) {
  const lower = message.toLowerCase().trim();

  // Check for mutation verbs
  const hasMutateVerb = MUTATE_VERBS.some((verb) => {
    const regex = new RegExp(`\\b${verb.replace(/\s+/g, '\\s+')}\\b`, 'i');
    return regex.test(lower);
  });

  // Check for question words
  const hasQuestionWord = QUESTION_WORDS.some((word) => {
    const regex = new RegExp(`\\b${word.replace(/\s+/g, '\\s+')}\\b`, 'i');
    return regex.test(lower);
  });

  // Determine intent: mutation verbs take priority if both are present
  const intent = hasMutateVerb && !hasQuestionWord ? 'mutate' : (hasMutateVerb ? 'mutate' : 'question');

  // Extract target section
  const targetSection = extractTargetSection(lower);

  return { intent, targetSection };
}

/**
 * Extract the target section from message text.
 *
 * @param {string} lowerMessage - Lowercased message
 * @returns {string | null}
 */
function extractTargetSection(lowerMessage) {
  for (const [section, keywords] of Object.entries(SECTION_KEYWORDS)) {
    for (const keyword of keywords) {
      if (lowerMessage.includes(keyword)) {
        return section;
      }
    }
  }
  return null;
}

/**
 * Detect if a "question" response is actually JSON (mutation misclassification).
 *
 * @param {string} responseStart - First ~100 chars of the LLM response
 * @returns {boolean}
 */
function shouldReclassifyAsMutation(responseStart) {
  const trimmed = responseStart.trim();
  return trimmed.startsWith('{') || trimmed.startsWith('[');
}

module.exports = {
  classifyIntent,
  extractTargetSection,
  shouldReclassifyAsMutation,
};
