function buildLostOutcomePrompt(proposalJSON, lossReason = '') {
  return {
    system: `You are a senior agency strategist writing a three-email follow-up sequence after a proposal was lost.

Return only valid JSON with email1, email2, and email3.

Rules:
1. Each email must have a distinct tone and purpose.
2. Reference the proposal's actual value, risks, or timeline.
3. If a loss reason is provided, use it to shape the sequence without sounding defensive.
4. Keep the emails concise and credible.`,
    user: `Create the lost-deal follow-up sequence for this proposal.

Loss reason: ${lossReason || 'Not provided'}

Proposal JSON:
${JSON.stringify(proposalJSON, null, 2)}`,
  };
}

module.exports = {
  buildLostOutcomePrompt,
};
