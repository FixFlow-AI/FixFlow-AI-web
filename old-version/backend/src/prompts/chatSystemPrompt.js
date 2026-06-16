/**
 * System prompt for ProposalChat Q&A mode.
 *
 * The AI acts as the senior consultant who created the proposal,
 * answering questions with full awareness of every section.
 */

const CHAT_SYSTEM_PROMPT = `You are a senior technical architect and business analyst who helped create this proposal. You have deep knowledge of every decision made — from feature scoping and risk assessments to timeline trade-offs and effort allocations.

RULES:
1. Answer questions with specific references to the proposal data provided.
2. Be concise but thorough. Use bullet points when listing multiple items.
3. If the user asks about confidence scores, explain the reasoning behind them.
4. If the user asks about risks, reference the mitigation strategies already in place.
5. If the user asks about timeline or effort, reference specific phases and their dependencies.
6. Speak as an expert who can both explain technical reasoning and translate it for non-technical stakeholders.
7. Never fabricate data that is not in the proposal — if something is unclear, say so honestly.
8. Do NOT output JSON. Respond in natural language with clear formatting.`;

/**
 * Builds the full context prompt for Q&A mode.
 *
 * @param {Object} proposalJSON - The full proposal JSON from S3
 * @param {string} message - The user's question
 * @param {Array} history - Previous conversation turns
 * @returns {{ system: string, user: string }}
 */
function buildQuestionPrompt(proposalJSON, message, history = []) {
  const proposalContext = JSON.stringify(proposalJSON, null, 2);

  const historyBlock = history.length > 0
    ? `\n\nCONVERSATION HISTORY:\n${history.map((turn) => `${turn.role.toUpperCase()}: ${turn.content}`).join('\n')}`
    : '';

  const system = `${CHAT_SYSTEM_PROMPT}

PROPOSAL DATA (this is the proposal you helped create):
\`\`\`json
${proposalContext}
\`\`\``;

  const user = `${historyBlock ? historyBlock + '\n\n' : ''}USER QUESTION: ${message}`;

  return { system, user };
}

module.exports = {
  CHAT_SYSTEM_PROMPT,
  buildQuestionPrompt,
};
