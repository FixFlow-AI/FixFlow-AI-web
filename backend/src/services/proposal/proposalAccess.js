const Proposal = require('../../models/Proposal');
const User = require('../../models/User');
const Workspace = require('../../models/Workspace');
const s3Service = require('../storage/s3');
const { ensureDeliveryPlan } = require('./deliveryPlanService');
const { ForbiddenError, NotFoundError } = require('../../utils/errors');
const { assertWorkspaceMembership, buildWorkspaceSummary } = require('../workspace/workspaceService');

async function getAccessibleProposal(userId, proposalId, allowedRoles = null) {
  const proposal = await Proposal.findOne({ proposalId });
  if (!proposal) {
    throw new NotFoundError('Proposal not found');
  }

  if (!proposal.workspaceId) {
    if (proposal.userId.toString() !== userId.toString()) {
      throw new NotFoundError('Proposal not found');
    }

    if (allowedRoles && !allowedRoles.includes('owner')) {
      throw new ForbiddenError('Your access level does not allow this action.');
    }

    return {
      proposal,
      role: 'owner',
      workspace: null,
    };
  }

  const { workspace, member } = await assertWorkspaceMembership(userId, proposal.workspaceId, allowedRoles);

  return {
    proposal,
    role: member.role,
    workspace,
  };
}

async function getOwnedProposal(userId, proposalId) {
  const { proposal } = await getAccessibleProposal(userId, proposalId, ['owner', 'editor', 'viewer']);
  return proposal;
}

async function getEditableProposal(userId, proposalId) {
  const { proposal } = await getAccessibleProposal(userId, proposalId, ['owner', 'editor']);
  return proposal;
}

async function getProposalAccessContext(userId, proposalId) {
  return getAccessibleProposal(userId, proposalId, ['owner', 'editor', 'viewer']);
}

async function listAccessibleProposals(userId, { scope = 'personal', workspaceId = null, page = 1, limit = 20 } = {}) {
  const skip = (page - 1) * limit;

  async function attachCreators(proposals = []) {
    const creatorIds = [...new Set(proposals.map((proposal) => (proposal.createdBy || proposal.userId)?.toString()).filter(Boolean))];
    const creators = await User.find({ _id: { $in: creatorIds } }).lean();
    const creatorMap = new Map(creators.map((creator) => [creator._id.toString(), creator]));

    return proposals.map((proposal) => ({
      ...proposal,
      createdBy: proposal.createdBy || proposal.userId
        ? {
            id: (proposal.createdBy || proposal.userId).toString(),
            name: creatorMap.get((proposal.createdBy || proposal.userId).toString())?.name || 'Proposal owner',
            email: creatorMap.get((proposal.createdBy || proposal.userId).toString())?.email || '',
          }
        : null,
    }));
  }

  if (scope === 'workspace') {
    let resolvedWorkspaceId = workspaceId;

    if (!resolvedWorkspaceId) {
      const workspace = await Workspace.findOne({ 'members.userId': userId }).sort({ updatedAt: -1 });
      resolvedWorkspaceId = workspace?._id || null;
    }

    if (!resolvedWorkspaceId) {
      return {
        proposals: [],
        total: 0,
        workspace: null,
      };
    }

    const { workspace } = await assertWorkspaceMembership(userId, resolvedWorkspaceId, ['owner', 'editor', 'viewer']);
    const [proposals, total] = await Promise.all([
      Proposal.find({ workspaceId: resolvedWorkspaceId })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Proposal.countDocuments({ workspaceId: resolvedWorkspaceId }),
    ]);

    return {
      proposals: await attachCreators(proposals).then((records) => records.map((proposal) => ({
        ...proposal,
        workspace: buildWorkspaceSummary(workspace, userId),
      }))),
      total,
      workspace,
    };
  }

  const query = { userId, workspaceId: null };
  const [proposals, total] = await Promise.all([
    Proposal.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Proposal.countDocuments(query),
  ]);

  return {
    proposals: await attachCreators(proposals),
    total,
    workspace: null,
  };
}

async function getProposalById(proposalId) {
  const proposal = await Proposal.findOne({ proposalId });

  if (!proposal) {
    throw new NotFoundError('Proposal not found');
  }

  return proposal;
}

function getEmbeddedProposalJSON(proposal, version = null) {
  if (!proposal) {
    return null;
  }

  const requestedVersion = version ? Number(version) : Number(proposal.versionCount || 0);
  const versions = Array.isArray(proposal.proposalVersions) ? proposal.proposalVersions : [];
  const matchingVersion = versions.find((entry) => Number(entry.version) === requestedVersion);

  if (matchingVersion?.data) {
    return matchingVersion.data;
  }

  if ((!version || requestedVersion === Number(proposal.versionCount || 0)) && proposal.proposalData) {
    return proposal.proposalData;
  }

  return null;
}

function upsertEmbeddedProposalVersion(proposal, version, data, s3Key = '') {
  const versionNumber = Number(version);
  const versions = Array.isArray(proposal.proposalVersions) ? proposal.proposalVersions : [];
  const existing = versions.find((entry) => Number(entry.version) === versionNumber);

  if (existing) {
    existing.s3Key = s3Key || existing.s3Key || '';
    existing.data = data;
    existing.createdAt = existing.createdAt || new Date();
  } else {
    versions.push({
      version: versionNumber,
      s3Key,
      data,
      createdAt: new Date(),
    });
  }

  proposal.proposalVersions = versions.sort((a, b) => Number(a.version) - Number(b.version));
  proposal.proposalData = data;

  proposal.markModified?.('proposalVersions');
  proposal.markModified?.('proposalData');
}

function buildUnavailableProposalJSON(proposal, version = null) {
  return ensureDeliveryPlan({
    project_summary:
      proposal?.projectSummary ||
      'Proposal content is unavailable because its object storage copy could not be found.',
    features: [],
    timeline: [],
    effort: [],
    pricing: [],
    risks: [
      {
        title: 'Proposal content unavailable',
        description:
          'The proposal metadata exists in MongoDB, but the stored proposal JSON is missing from object storage.',
        mitigation: 'Regenerate or revise this proposal to recreate the stored JSON payload.',
        severity: 'high',
      },
    ],
    confidence_notes: [
      'This fallback response keeps the API available while storage is repaired.',
    ],
    storage_unavailable: true,
    requested_version: version ? Number(version) : Number(proposal?.versionCount || 0),
  });
}

async function getProposalJSONForRecord(proposal, version = null) {
  const embeddedData = getEmbeddedProposalJSON(proposal, version);
  const versionNumber = version ? Number(version) : Number(proposal?.versionCount || 0);
  const s3Key = version
    ? s3Service.makeProposalKey(proposal.userId, proposal.proposalId, versionNumber)
    : proposal?.s3Key;

  if (!s3Key && !embeddedData) {
    throw new NotFoundError('Proposal data not yet available');
  }

  if (s3Key) {
    try {
      return ensureDeliveryPlan(await s3Service.getProposalJSON(s3Key));
    } catch (error) {
      if (!s3Service.isRecoverableStorageError(error) || !embeddedData) {
        if (s3Service.isRecoverableStorageError(error)) {
          return buildUnavailableProposalJSON(proposal, version);
        }

        throw error;
      }

      if (process.env.NODE_ENV !== 'production') {
        console.warn(
          `S3 proposal read failed for ${s3Key}: ${error.Code || error.name || error.message}. ` +
            'Using MongoDB fallback proposal data.'
        );
      }
    }
  }

  return ensureDeliveryPlan(embeddedData);
}

async function getOwnedProposalWithJSON(userId, proposalId) {
  const proposal = await getEditableProposal(userId, proposalId);
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
  getAccessibleProposal,
  getOwnedProposal,
  getEditableProposal,
  getProposalAccessContext,
  listAccessibleProposals,
  getProposalById,
  getProposalJSONForRecord,
  getEmbeddedProposalJSON,
  upsertEmbeddedProposalVersion,
  getOwnedProposalWithJSON,
  getProposalOwner,
  calculateProposalConfidence,
};
