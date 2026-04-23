/**
 * System prompt for ProposalChat mutation mode.
 *
 * The AI regenerates ONLY the targeted section of the proposal,
 * returning strict JSON that matches the section's Zod schema.
 */

const { SECTION_JSON_KEYS } = require('../schemas/sectionSchemas');

const MUTATION_SYSTEM_PROMPT = `You are a senior technical architect and business analyst. You are modifying a specific section of an existing proposal based on the user's request.

CRITICAL RULES:
1. Output ONLY valid JSON — no markdown, no commentary, no code fences, no explanations.
2. Return the complete replacement data for the specified section.
3. Maintain consistency with the rest of the proposal (referenced in context).
4. If the mutation would logically affect other sections, note this in a brief "mutation_summary" field.
5. Be precise and practical in your changes.`;

/**
 * Schema descriptions for each section, used to guide the LLM output.
 */
const SECTION_SCHEMA_DESCRIPTIONS = {
  features: `Return a JSON array of feature objects. Each object must have:
  - title (string)
  - description (string)
  - technical_approach (string)
  - complexity ("High" | "Medium" | "Low")
  - confidence ("High" | "Medium" | "Low")
  - confidence_pct (number 0-100)
  - area (string)`,

  risks: `Return a JSON array of risk objects. Each object must have:
  - label (string)
  - severity (number 0-100)
  - mitigation (string)
  - category (string)`,

  timeline: `Return a JSON array of timeline phase objects. Each object must have:
  - phase (string)
  - duration (string, e.g. "2 weeks")
  - tasks (array of strings, at least 1)
  - dependencies (array of strings, can be empty)`,

  effort: `Return a JSON array of effort allocation objects. Each object must have:
  - label (string)
  - percentage (number 0-100, all percentages should sum to ~100)
  - timeframe (string)
  - description (string)`,

  market: `Return a JSON array of market signal objects. Each object must have:
  - title (string)
  - description (string)
  - trend ("up" | "down" | "stable")
  - relevance (number 0-100)`,

  impact: `Return a JSON array of business impact objects. Each object must have:
  - title (string)
  - description (string)
  - impact_score (number 0-100)
  - category (string)`,

  summary: `Return a JSON object with a single key "project_summary" containing a string (2-4 sentences summarizing the project approach).`,
};

/**
 * Builds the full context prompt for mutation mode.
 *
 * Only the targeted section + proposal summary are injected to keep the context lean.
 *
 * @param {Object} proposalJSON - The full proposal JSON from S3
 * @param {string} message - The user's mutation request
 * @param {string} targetSection - The section to mutate
 * @param {Array} history - Previous conversation turns
 * @returns {{ system: string, user: string }}
 */
function buildMutationPrompt(proposalJSON, message, targetSection, history = []) {
  const jsonKey = SECTION_JSON_KEYS[targetSection] || targetSection;
  const currentSectionData = proposalJSON[jsonKey];
  const schemaDescription = SECTION_SCHEMA_DESCRIPTIONS[targetSection] || '';

  // Lean context: project summary + target section only
  const proposalSummary = {
    project_summary: proposalJSON.project_summary,
    total_features: proposalJSON.features?.length || 0,
    total_risks: proposalJSON.risks?.length || 0,
    total_phases: proposalJSON.timeline?.length || 0,
  };

  const historyBlock = history.length > 0
    ? `\nCONVERSATION HISTORY:\n${history.map((turn) => `${turn.role.toUpperCase()}: ${turn.content}`).join('\n')}\n`
    : '';

  const system = `${MUTATION_SYSTEM_PROMPT}

TARGET SECTION: "${targetSection}"

OUTPUT SCHEMA:
${schemaDescription}

PROPOSAL OVERVIEW:
${JSON.stringify(proposalSummary, null, 2)}

CURRENT "${targetSection}" DATA:
\`\`\`json
${JSON.stringify(currentSectionData, null, 2)}
\`\`\``;

  const user = `${historyBlock}MUTATION REQUEST: ${message}

Remember: Return ONLY the new JSON for the "${targetSection}" section. No markdown, no commentary.`;

  return { system, user };
}

module.exports = {
  MUTATION_SYSTEM_PROMPT,
  SECTION_SCHEMA_DESCRIPTIONS,
  buildMutationPrompt,
};
