const Proposal = require('../../models/Proposal');
const User = require('../../models/User');
const s3Service = require('../storage/s3');
const { NotFoundError } = require('../../utils/errors');

async function getOwnedProposal(userId, proposalId) {
  const proposal = await Proposal.findOne({ proposalId, userId });

  if (!proposal) {
    throw new NotFoundError('Proposal not found');
  }

  return proposal;
}

async function getProposalById(proposalId) {
  const proposal = await Proposal.findOne({ proposalId });

  if (!proposal) {
    throw new NotFoundError('Proposal not found');
  }

  return proposal;
}

async function getProposalJSONForRecord(proposal) {
  if (!proposal?.s3Key) {
    throw new NotFoundError('Proposal data not yet available');
  }

  return s3Service.getProposalJSON(proposal.s3Key);
}

async function getOwnedProposalWithJSON(userId, proposalId) {
  const proposal = await getOwnedProposal(userId, proposalId);
  const proposalJSON = await getProposalJSONForRecord(proposal);
  return { proposal, proposalJSON };
}

async function getProposalOwner(userId) {
  const user = await User.findById(userId).lean();

  if (!user) {
    throw new NotFoundError('Proposal owner not found');
  }

  return user;
}

function calculateProposalConfidence(proposalJSON = {}) {
  const features = Array.isArray(proposalJSON.features) ? proposalJSON.features : [];

  if (!features.length) {
    return 0;
  }

  const total = features.reduce((sum, feature) => sum + Number(feature.confidence_pct || 0), 0);
  return Math.round(total / features.length);
}

module.exports = {
  getOwnedProposal,
  getProposalById,
  getProposalJSONForRecord,
  getOwnedProposalWithJSON,
  getProposalOwner,
  calculateProposalConfidence,
};
