const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const Portal = require('../../models/Portal');
const Workspace = require('../../models/Workspace');
const { env } = require('../../config/env');
const { AppError, BadRequestError, NotFoundError, UnauthorizedError } = require('../../utils/errors');
const {
  getEditableProposal,
  getProposalAccessContext,
  getProposalById,
  getProposalJSONForRecord,
  getProposalOwner,
} = require('../proposal/proposalAccess');
const { sendTransactionalMail, isSmtpConfigured } = require('../../utils/mailer');

const PORTAL_SECTION_KEYS = ['summary', 'features', 'risks', 'timeline', 'effort', 'market', 'impact'];

function createSectionMetrics() {
  return PORTAL_SECTION_KEYS.reduce((metrics, section) => {
    metrics[section] = { views: 0, dwellMs: 0 };
    return metrics;
  }, {});
}

function buildShareUrl(shareToken) {
  return new URL(`/p/${shareToken}`, env.FRONTEND_URL).toString();
}

function sanitizePortal(portal) {
  if (!portal) {
    return null;
  }

  return {
    portalType: portal.portalType || 'single',
    proposalId: portal.proposalId,
    tripId: portal.tripId || '',
    proposalIds: portal.proposalIds || (portal.proposalId ? [portal.proposalId] : []),
    strategySelection: portal.strategySelection || [],
    shareToken: portal.shareToken,
    shareUrl: buildShareUrl(portal.shareToken),
    expiryAt: portal.expiryAt,
    pinEnabled: Boolean(portal.pinHash),
    viewCount: portal.viewCount,
    firstViewedAt: portal.firstViewedAt,
    lastViewedAt: portal.lastViewedAt,
    sectionMetrics: portal.sectionMetrics || createSectionMetrics(),
    latestFeedback: portal.feedback?.slice(-5).reverse() || [],
    dealRoomTierSelection: portal.dealRoomTierSelection || null,
    updatedAt: portal.updatedAt,
  };
}

function assertPortalActive(portal) {
  if (!portal) {
    throw new NotFoundError('Portal not found');
  }

  if (portal.expiryAt && portal.expiryAt.getTime() < Date.now()) {
    throw new AppError('Portal link has expired', 410);
  }
}

async function getPortalForProposal(userId, proposalId) {
  await getEditableProposal(userId, proposalId);
  const portal = await Portal.findOne({ proposalId, portalType: 'single' }).lean();
  return sanitizePortal(portal);
}

async function upsertPortal({ userId, proposalId, expiryDays, pinEnabled, pin }) {
  const { proposal } = await getProposalAccessContext(userId, proposalId);

  let portal = await Portal.findOne({ proposalId, portalType: 'single' });

  if (!portal) {
    portal = new Portal({
      proposalId,
      userId: proposal.userId,
      workspaceId: proposal.workspaceId || null,
      portalType: 'single',
      proposalIds: [proposalId],
      shareToken: crypto.randomUUID(),
      sectionMetrics: createSectionMetrics(),
    });
  }

  portal.expiryAt = expiryDays === 0 ? null : new Date(Date.now() + expiryDays * 24 * 60 * 60 * 1000);

  if (pinEnabled) {
    if (pin) {
      portal.pinHash = await bcrypt.hash(pin, 10);
    } else if (!portal.pinHash) {
      throw new BadRequestError('PIN is required the first time you enable portal protection.');
    }
  } else {
    portal.pinHash = '';
  }

  await portal.save();

  return sanitizePortal(portal.toObject());
}

async function getPortalByToken(shareToken) {
  const portal = await Portal.findOne({ shareToken });
  assertPortalActive(portal);
  return portal;
}

async function getPortalPublicMeta(shareToken) {
  const portal = await getPortalByToken(shareToken);
  if (portal.portalType === 'bundle') {
    const proposals = await Promise.all((portal.proposalIds || []).map((proposalId) => getProposalById(proposalId)));
    const primary = proposals[0];
    const owner = primary ? await getProposalOwner(primary.userId) : null;
    const workspace = primary?.workspaceId ? await Workspace.findById(primary.workspaceId).lean() : null;

    return {
      shareToken: portal.shareToken,
      portalType: 'bundle',
      proposalTitle: primary?.title || 'Proposal bundle',
      agencyName: workspace?.name || owner?.name || 'FixFlowAI',
      bundleStrategies: proposals.map((proposal) => ({
        proposalId: proposal.proposalId,
        title: proposal.title,
        strategy: proposal.strategy || 'standard',
      })),
      requiresPin: Boolean(portal.pinHash),
      expiryAt: portal.expiryAt,
      createdAt: portal.createdAt,
    };
  }

  const proposal = await getProposalById(portal.proposalId);
  const owner = await getProposalOwner(proposal.userId);
  const workspace = proposal.workspaceId ? await Workspace.findById(proposal.workspaceId).lean() : null;

  return {
    shareToken: portal.shareToken,
    portalType: 'single',
    proposalTitle: proposal.title,
    agencyName: workspace?.name || owner.name,
    requiresPin: Boolean(portal.pinHash),
    expiryAt: portal.expiryAt,
    createdAt: portal.createdAt,
  };
}

async function verifyPortalAccess(shareToken, pin) {
  const portal = await getPortalByToken(shareToken);

  if (portal.pinHash) {
    const matches = pin ? await bcrypt.compare(pin, portal.pinHash) : false;

    if (!matches) {
      throw new UnauthorizedError('PIN verification failed');
    }
  }

  const now = new Date();
  portal.viewCount += 1;
  portal.lastViewedAt = now;
  portal.firstViewedAt = portal.firstViewedAt || now;
  await portal.save();

  if (portal.portalType === 'bundle') {
    const proposals = await Promise.all(
      (portal.proposalIds || []).map(async (proposalId) => {
        const proposal = await getProposalById(proposalId);
        const proposalJSON = await getProposalJSONForRecord(proposal);
        const owner = await getProposalOwner(proposal.userId);
        return {
          proposalId: proposal.proposalId,
          title: proposal.title,
          strategy: proposal.strategy || 'standard',
          data: proposalJSON,
          projectSummary: proposal.projectSummary,
          agencyName: owner.name,
          generatedAt: proposal.createdAt,
        };
      })
    );

    return {
      portal: sanitizePortal(portal.toObject()),
      bundle: {
        proposals: proposals.sort((a, b) => (portal.strategySelection || []).indexOf(a.strategy) - (portal.strategySelection || []).indexOf(b.strategy)),
      },
    };
  }

  const proposal = await getProposalById(portal.proposalId);
  const owner = await getProposalOwner(proposal.userId);
  const proposalJSON = await getProposalJSONForRecord(proposal);

  return {
    portal: sanitizePortal(portal.toObject()),
    proposal: {
      proposalId: proposal.proposalId,
      title: proposal.title,
      data: proposalJSON,
      projectSummary: proposal.projectSummary,
      agencyName: owner.name,
      generatedAt: proposal.createdAt,
    },
  };
}

async function recordPortalEvents(shareToken, events) {
  const portal = await getPortalByToken(shareToken);
  const metrics = portal.sectionMetrics || createSectionMetrics();

  for (const event of events) {
    const current = metrics[event.section] || { views: 0, dwellMs: 0 };
    current.views += Number(event.views || 0);
    current.dwellMs += Number(event.dwellMs || 0);
    metrics[event.section] = current;
  }

  portal.sectionMetrics = metrics;
  await portal.save();

  return sanitizePortal(portal.toObject());
}

async function submitPortalFeedback(shareToken, message) {
  const portal = await getPortalByToken(shareToken);
  const proposal = await getProposalById(portal.proposalId || portal.proposalIds?.[0]);
  const owner = await getProposalOwner(proposal.userId);
  const entry = {
    message,
    submittedAt: new Date(),
  };

  portal.feedback = [...(portal.feedback || []), entry];
  await portal.save();

  if (isSmtpConfigured()) {
    await sendTransactionalMail({
      to: owner.email,
      subject: `Client feedback on ${proposal.title}`,
      text: `A client submitted feedback on ${proposal.title}.\n\n${message}\n\nOpen proposal: ${new URL(`/proposal/${proposal.proposalId}`, env.FRONTEND_URL).toString()}`,
      html: `
        <div style="font-family: Arial, sans-serif; color: #0f172a;">
          <h2 style="margin-bottom: 12px;">Client feedback received</h2>
          <p style="margin-bottom: 16px;">Proposal: <strong>${proposal.title}</strong></p>
          <div style="padding: 16px; border-radius: 12px; background: #f8fafc; border: 1px solid #e2e8f0; white-space: pre-wrap;">${message}</div>
          <p style="margin-top: 16px;"><a href="${new URL(`/proposal/${proposal.proposalId}`, env.FRONTEND_URL).toString()}">Open proposal in FixFlowAI</a></p>
        </div>
      `,
    });
  }

  return {
    success: true,
    feedback: entry,
  };
}

async function upsertBundlePortal({
  userId,
  tripId,
  proposalIds,
  strategySelection,
  expiryDays,
  pinEnabled,
  pin,
  workspaceId = null,
}) {
  let portal = await Portal.findOne({ tripId, portalType: 'bundle' });

  if (!portal) {
    portal = new Portal({
      portalType: 'bundle',
      tripId,
      userId,
      workspaceId,
      proposalIds,
      strategySelection,
      shareToken: crypto.randomUUID(),
      sectionMetrics: createSectionMetrics(),
    });
  }

  portal.proposalIds = proposalIds;
  portal.strategySelection = strategySelection;
  portal.expiryAt = expiryDays === 0 ? null : new Date(Date.now() + expiryDays * 24 * 60 * 60 * 1000);

  if (pinEnabled) {
    if (pin) {
      portal.pinHash = await bcrypt.hash(pin, 10);
    } else if (!portal.pinHash) {
      throw new BadRequestError('PIN is required the first time you enable portal protection.');
    }
  } else {
    portal.pinHash = '';
  }

  await portal.save();

  return sanitizePortal(portal.toObject());
}

module.exports = {
  PORTAL_SECTION_KEYS,
  buildShareUrl,
  createSectionMetrics,
  getPortalForProposal,
  getPortalByToken,
  upsertPortal,
  getPortalPublicMeta,
  verifyPortalAccess,
  recordPortalEvents,
  submitPortalFeedback,
  upsertBundlePortal,
};
