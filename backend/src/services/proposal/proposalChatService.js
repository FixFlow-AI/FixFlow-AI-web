/**
 * ProposalChat Service
 *
 * Core logic: fetch proposal from S3, build prompts, manage conversation context.
 */

const s3Service = require('../storage/s3');
const { buildQuestionPrompt } = require('../../prompts/chatSystemPrompt');
const { buildMutationPrompt } = require('../../prompts/mutationPrompt');
const { NotFoundError } = require('../../utils/errors');
const { getProposalAccessContext } = require('./proposalAccess');
const { ensureDeliveryPlan } = require('./deliveryPlanService');

const MAX_HISTORY_TURNS = 6;

/**
 * Fetch the proposal record and its latest JSON from S3.
 *
 * @param {string} userId
 * @param {string} proposalId
 * @returns {Promise<{ proposal: Object, proposalJSON: Object }>}
 */
async function fetchProposalContext(userId, proposalId) {
  const { proposal, role } = await getProposalAccessContext(userId, proposalId);

  if (!proposal.s3Key) {
    throw new NotFoundError('Proposal data not yet available');
  }

  const proposalJSON = ensureDeliveryPlan(await s3Service.getProposalJSON(proposal.s3Key));

  return { proposal, proposalJSON, role };
}

/**
 * Truncate conversation history to keep within token limits.
 *
 * @param {Array} history - Array of { role, content } objects
 * @param {number} maxTurns - Maximum number of turns to keep
 * @returns {Array}
 */
function truncateHistory(history = [], maxTurns = MAX_HISTORY_TURNS) {
  if (!Array.isArray(history)) return [];

  // Keep only the most recent turns
  if (history.length > maxTurns * 2) {
    return history.slice(-maxTurns * 2);
  }

  return history;
}

/**
 * Build the Gemini prompt based on intent.
 *
 * @param {Object} proposalJSON - Full proposal JSON from S3
 * @param {string} message - User's message
 * @param {Array} history - Conversation history
 * @param {string} intent - 'question' or 'mutate'
 * @param {string|null} targetSection - Section to mutate (for mutation intent)
 * @returns {{ system: string, user: string }}
 */
function buildChatPrompt(proposalJSON, message, history, intent, targetSection) {
  const truncatedHistory = truncateHistory(history);

  if (intent === 'mutate' && targetSection) {
    return buildMutationPrompt(proposalJSON, message, targetSection, truncatedHistory);
  }

  return buildQuestionPrompt(proposalJSON, message, truncatedHistory);
}

module.exports = {
  fetchProposalContext,
  truncateHistory,
  buildChatPrompt,
};
