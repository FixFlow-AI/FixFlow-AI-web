const { buildWonOutcomePrompt } = require('../../prompts/wonOutcomePrompt');
const { buildLostOutcomePrompt } = require('../../prompts/lostOutcomePrompt');
const { WonOutcomeSchema, WON_OUTCOME_JSON_SCHEMA } = require('../../schemas/wonOutcomeSchema');
const { LostOutcomeSchema, LOST_OUTCOME_JSON_SCHEMA } = require('../../schemas/lostOutcomeSchema');
const { generateStructuredJSON } = require('../llm/structuredGeneration');
const { getOwnedProposalWithJSON, calculateProposalConfidence } = require('./proposalAccess');
const { sendTransactionalMail } = require('../../utils/mailer');
const { NotFoundError } = require('../../utils/errors');

function buildMockWonOutcome(proposalJSON) {
  const phases = Array.isArray(proposalJSON.timeline) ? proposalJSON.timeline : [];
  const features = Array.isArray(proposalJSON.features) ? proposalJSON.features : [];
  const topFeature = features[0]?.title || 'core delivery scope';

  const checklist = [
    `Schedule the kickoff call and confirm owners for ${topFeature}.`,
    `Align on the first delivery milestone and review the proposal timeline with the client.`,
    `Create the shared project workspace and decision log for approvals and open questions.`,
    `Collect all required credentials, integrations, and environment access before implementation starts.`,
    `Review the highest-risk items from the proposal and assign mitigation owners.`,
    `Translate the approved scope into a sprint-ready backlog with acceptance criteria.`,
    `Confirm reporting cadence, demo checkpoints, and escalation contacts.`,
    `Document assumptions from discovery so scope changes can be handled cleanly.`,
    `Prepare implementation environments and QA workflows to match the proposed stack.`,
    `Lock the phase-one delivery plan around ${phases[0]?.phase || 'discovery'} and communicate next steps.`,
  ];

  return WonOutcomeSchema.parse({
    checklist,
    kickoffEmail: {
      subject: `Kickoff next steps for ${topFeature}`,
      body: `Hi team,\n\nWe’re excited to get started. Based on the approved proposal, our first focus will be ${phases[0]?.phase || 'discovery and delivery planning'} so we can move into execution with the right context and access in place.\n\nIn the kickoff session we’ll confirm stakeholders, timelines, priority scope, and the integrations or dependencies we need from your side. We’ll then share the finalized phase-one plan and cadence for demos and status updates.\n\nPlease send over any required access or scheduling preferences, and we’ll take it from there.\n\nBest,\nThe Proplytics delivery team`,
    },
  });
}

function buildMockLostOutcome(proposalJSON, lossReason = '') {
  const primaryRisk = Array.isArray(proposalJSON.risks) ? proposalJSON.risks[0] : null;
  const summary = proposalJSON.project_summary || 'the proposal';
  const reasonLine = lossReason ? `We understand that ${lossReason.toLowerCase()}. ` : '';

  return LostOutcomeSchema.parse({
    email1: {
      sendTiming: 'Same day',
      subject: 'Thank you for considering our proposal',
      body: `Hi,\n\nThank you again for reviewing our proposal. ${reasonLine}We appreciated the opportunity to think through the project with you.\n\nOne thing we still believe strongly is that ${summary.charAt(0).toLowerCase()}${summary.slice(1)}\n\nIf you’re open to it, we’d value a short conversation on what made the difference in your decision so we can keep improving.\n\nBest,\nThe Proplytics team`,
    },
    email2: {
      sendTiming: 'One week later',
      subject: 'A flexible option if timing or scope was the blocker',
      body: `Hi,\n\nI wanted to follow up with one practical thought. If the hesitation was around delivery risk or investment, we could restructure the work into a tighter first phase with a smaller commitment and clearer checkpoints.\n\nIn our original proposal we called out ${primaryRisk?.label || 'implementation risk'} and recommended ${primaryRisk?.mitigation || 'early validation before scaling scope'}. That same approach could be used to de-risk a leaner phase one.\n\nIf it would help, I’m happy to sketch an alternative option.\n\nBest,\nThe Proplytics team`,
    },
    email3: {
      sendTiming: 'One month later',
      subject: 'Sharing one idea if this project comes back into focus',
      body: `Hi,\n\nWanted to check in once more in case this initiative is resurfacing. We’ve continued seeing teams move faster when they start with a focused first release tied to one measurable outcome instead of trying to launch everything at once.\n\nIf it’s useful, I’d be happy to share a few lessons learned from similar delivery programs and how we’d scope the first milestone today.\n\nAll the best,\nThe Proplytics team`,
    },
  });
}

async function generateWonOutcome(proposalJSON) {
  const { system, user } = buildWonOutcomePrompt(proposalJSON);
  const raw = await generateStructuredJSON({
    system,
    user,
    jsonSchema: WON_OUTCOME_JSON_SCHEMA,
    temperature: 0.2,
    maxOutputTokens: 2500,
  });
  return WonOutcomeSchema.parse(JSON.parse(raw));
}

async function generateLostOutcome(proposalJSON, lossReason) {
  const { system, user } = buildLostOutcomePrompt(proposalJSON, lossReason);
  const raw = await generateStructuredJSON({
    system,
    user,
    jsonSchema: LOST_OUTCOME_JSON_SCHEMA,
    temperature: 0.35,
    maxOutputTokens: 3200,
  });
  return LostOutcomeSchema.parse(JSON.parse(raw));
}

async function generateOutcome({ userId, proposalId, dealStatus, lossReason = '' }) {
  const { proposal, proposalJSON } = await getOwnedProposalWithJSON(userId, proposalId);

  if (dealStatus === 'won' && proposal.wonOutcome) {
    return { dealStatus, outcome: proposal.wonOutcome };
  }

  if (dealStatus === 'lost' && proposal.lostOutcome && (!lossReason || lossReason === proposal.lossReason)) {
    return { dealStatus, outcome: proposal.lostOutcome };
  }

  let outcome;

  if (dealStatus === 'won') {
    try {
      outcome = await generateWonOutcome(proposalJSON);
    } catch {
      outcome = buildMockWonOutcome(proposalJSON);
    }

    proposal.wonOutcome = outcome;
    proposal.lostOutcome = null;
  } else {
    try {
      outcome = await generateLostOutcome(proposalJSON, lossReason);
    } catch {
      outcome = buildMockLostOutcome(proposalJSON, lossReason);
    }

    proposal.lostOutcome = outcome;
    proposal.lossReason = lossReason || proposal.lossReason || '';
  }

  proposal.dealStatus = dealStatus;
  proposal.dealStatusUpdatedAt = new Date();
  await proposal.save();

  return {
    dealStatus,
    outcome,
    confidenceScore: calculateProposalConfidence(proposalJSON),
  };
}

function getOutcomeEmailPayload(proposal, emailKey) {
  if (emailKey === 'kickoff') {
    const payload = proposal.wonOutcome?.kickoffEmail;
    if (!payload) throw new NotFoundError('Kickoff email is not available');
    return payload;
  }

  const payload = proposal.lostOutcome?.[emailKey];
  if (!payload) {
    throw new NotFoundError('Requested follow-up email is not available');
  }

  return payload;
}

async function sendOutcomeEmail({ userId, proposalId, recipientEmail, emailKey }) {
  const { proposal } = await getOwnedProposalWithJSON(userId, proposalId);
  const email = getOutcomeEmailPayload(proposal, emailKey);

  await sendTransactionalMail({
    to: recipientEmail,
    subject: email.subject,
    text: email.body,
    html: `<div style="font-family: Arial, sans-serif; color: #0f172a; white-space: pre-wrap;">${email.body}</div>`,
  });

  return { success: true };
}

module.exports = {
  generateOutcome,
  sendOutcomeEmail,
  buildMockWonOutcome,
  buildMockLostOutcome,
};
