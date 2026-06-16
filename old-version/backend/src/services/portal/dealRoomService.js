const DealRoomAnnotation = require('../../models/DealRoomAnnotation');
const Workspace = require('../../models/Workspace');
const { BadRequestError } = require('../../utils/errors');
const { getPortalByToken } = require('./portalService');
const { getProposalById } = require('../proposal/proposalAccess');
const {
  buildProposalRecipientIds,
  createNotifications,
} = require('../notifications/notificationService');

function serializeAnnotation(annotation) {
  const value = annotation?.toObject ? annotation.toObject() : { ...annotation };
  return {
    id: value._id?.toString?.() || value.id,
    portalToken: value.portalToken,
    proposalId: value.proposalId,
    workspaceId: value.workspaceId ? value.workspaceId.toString() : null,
    sectionName: value.sectionName,
    comment: value.comment,
    type: value.type,
    clientEmail: value.clientEmail || '',
    createdAt: value.createdAt,
  };
}

function resolveProposalId(portal, requestedProposalId = '') {
  const allowedIds = portal.portalType === 'bundle' ? portal.proposalIds || [] : [portal.proposalId];
  const proposalId = requestedProposalId || allowedIds[0];
  if (!allowedIds.includes(proposalId)) {
    throw new BadRequestError('Proposal is not part of this portal.');
  }
  return proposalId;
}

async function listAnnotations(portalToken) {
  const portal = await getPortalByToken(portalToken);
  const proposalIds = portal.portalType === 'bundle' ? portal.proposalIds || [] : [portal.proposalId];
  const annotations = await DealRoomAnnotation.find({
    portalToken,
    proposalId: { $in: proposalIds },
  }).sort({ createdAt: -1 });

  return {
    annotations: annotations.map(serializeAnnotation),
  };
}

async function createAnnotation(portalToken, payload) {
  const portal = await getPortalByToken(portalToken);
  const proposalId = resolveProposalId(portal, payload.proposalId);
  const proposal = await getProposalById(proposalId);
  const workspace = proposal.workspaceId ? await Workspace.findById(proposal.workspaceId) : null;

  const annotation = await DealRoomAnnotation.create({
    portalToken,
    proposalId,
    workspaceId: proposal.workspaceId || null,
    sectionName: payload.sectionName,
    comment: payload.comment,
    type: payload.type,
    clientEmail: payload.clientEmail || '',
  });

  await createNotifications({
    userIds: buildProposalRecipientIds({ proposal, workspace }),
    workspace,
    proposalId,
    type: 'comment',
    title: 'Client annotation received',
    body: `A client left a ${payload.type} on the ${payload.sectionName} section of ${proposal.title}.`,
    metadata: {
      section: payload.sectionName,
      annotationType: payload.type,
      clientEmail: payload.clientEmail || '',
    },
  }).catch(() => null);

  return {
    annotation: serializeAnnotation(annotation),
  };
}

async function getTierSelection(portalToken) {
  const portal = await getPortalByToken(portalToken);
  return {
    tierSelection: portal.dealRoomTierSelection || null,
  };
}

async function setTierSelection(portalToken, payload) {
  const portal = await getPortalByToken(portalToken);
  const proposalId = resolveProposalId(portal, payload.proposalId);
  const proposal = await getProposalById(proposalId);
  const workspace = proposal.workspaceId ? await Workspace.findById(proposal.workspaceId) : null;

  portal.dealRoomTierSelection = {
    proposalId,
    strategy: payload.strategy,
    clientEmail: payload.clientEmail || '',
    selectedAt: new Date(),
  };
  await portal.save();

  await createNotifications({
    userIds: buildProposalRecipientIds({ proposal, workspace }),
    workspace,
    proposalId,
    type: 'approval',
    title: 'Client selected a proposal tier',
    body: `A client selected the ${payload.strategy} strategy for ${proposal.title}.`,
    metadata: {
      strategy: payload.strategy,
      clientEmail: payload.clientEmail || '',
    },
  }).catch(() => null);

  return {
    tierSelection: portal.dealRoomTierSelection,
  };
}

async function listAnnotationsForProposal(proposalId) {
  const annotations = await DealRoomAnnotation.find({ proposalId }).sort({ createdAt: -1 });
  return {
    annotations: annotations.map(serializeAnnotation),
  };
}

module.exports = {
  createAnnotation,
  getTierSelection,
  listAnnotations,
  listAnnotationsForProposal,
  setTierSelection,
};
