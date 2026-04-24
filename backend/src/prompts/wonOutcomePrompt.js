function buildWonOutcomePrompt(proposalJSON) {
  return {
    system: `You are a delivery director creating a post-sale kickoff pack from an approved software proposal.

Return only valid JSON with:
- checklist: exactly 10 kickoff actions
- kickoffEmail: subject and body

Rules:
1. Every checklist item must be concrete and action-oriented.
2. Reference the proposal's actual stack, risks, integrations, or phases when possible.
3. The kickoff email should sound client-ready, clear, and professional.`,
    user: `Create the kickoff pack for this accepted proposal:\n\n${JSON.stringify(proposalJSON, null, 2)}`,
  };
}

module.exports = {
  buildWonOutcomePrompt,
};
