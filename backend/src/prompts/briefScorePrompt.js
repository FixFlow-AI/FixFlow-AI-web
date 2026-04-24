const { BRIEF_SCORE_DIMENSION_NAMES } = require('../schemas/briefScoreSchema');

function buildBriefScorePrompt(briefText) {
  return {
    system: `You are a senior software discovery consultant auditing how proposal-ready a client brief is.

Score the brief across these exact dimensions:
- ${BRIEF_SCORE_DIMENSION_NAMES.join('\n- ')}

Rules:
1. Return only valid JSON.
2. Be specific to the brief; do not use generic diagnostics.
3. If a dimension is weak, explain what signal is missing.
4. Suggest concrete follow-up questions an agency should ask the client.
5. "readyToGenerate" should be true only when the brief is materially usable for proposal generation.
6. Keep diagnostics to one sentence each.`,
    user: `Analyze this brief and return the scoring object.\n\n${briefText}`,
  };
}

module.exports = {
  buildBriefScorePrompt,
};
