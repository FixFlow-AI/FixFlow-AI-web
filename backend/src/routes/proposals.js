const express = require('express');
const { create: createJsonDiffPatch } = require('jsondiffpatch');
const { authMiddleware } = require('../middleware/auth');
const Proposal = require('../models/Proposal');
const {
  proposalExportSchema,
  proposalAssignmentSchema,
  versionCompareSchema,
} = require('../models/schemas');
const s3Service = require('../services/storage/s3');
const { generatePDF } = require('../services/export/pdfExport');
const { buildMarkdownExport, sanitizeDownloadName } = require('../services/export/formatters');
const { BadRequestError, ForbiddenError, NotFoundError } = require('../utils/errors');
const {
  getProposalAccessContext,
  getEditableProposal,
  getProposalJSONForRecord,
  listAccessibleProposals,
} = require('../services/proposal/proposalAccess');
const { ensureDeliveryPlan } = require('../services/proposal/deliveryPlanService');
const { createNotifications } = require('../services/notifications/notificationService');

const router = express.Router();
const diffPatcher = createJsonDiffPatch();

async function getOwnedProposal(userId, proposalId) {
  return getEditableProposal(userId, proposalId);
}

function getVersionNumber(proposal, requestedVersion) {
  if (!requestedVersion) {
    return proposal.versionCount;
  }

  const version = Number(requestedVersion);

  if (!Number.isInteger(version) || version < 1 || version > proposal.versionCount) {
    throw new NotFoundError('Requested version was not found');
  }

  return version;
}

router.get('/', authMiddleware, async (req, res, next) => {
  try {
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const limit = Math.min(50, Math.max(1, Number.parseInt(req.query.limit, 10) || 20));
    const scope = req.query.scope === 'workspace' ? 'workspace' : 'personal';

    const { proposals, total, workspace } = await listAccessibleProposals(req.user.userId, {
      scope,
      workspaceId: req.query.workspaceId || null,
      page,
      limit,
    });

    res.json({ proposals, total, page, limit, workspace });
  } catch (error) {
    next(error);
  }
});

router.get('/:id/versions', authMiddleware, async (req, res, next) => {
  try {
    const { proposal } = await getProposalAccessContext(req.user.userId, req.params.id);

    const versions = Array.from({ length: proposal.versionCount }, (_, index) => {
      const version = index + 1;
      return {
        version,
        s3Key: s3Service.makeProposalKey(proposal.userId, proposal.proposalId, version),
        createdAt: proposal.updatedAt,
      };
    });

    res.json({ versions, currentVersion: proposal.versionCount });
  } catch (error) {
    next(error);
  }
});

router.get('/:id/versions/compare', authMiddleware, async (req, res, next) => {
  try {
    const { proposal } = await getProposalAccessContext(req.user.userId, req.params.id);
    const { from, to } = versionCompareSchema.parse(req.query);
    const fromVersion = getVersionNumber(proposal, from);
    const toVersion = getVersionNumber(proposal, to);

    const [fromData, toData] = await Promise.all([
      s3Service.getProposalJSON(s3Service.makeProposalKey(proposal.userId, proposal.proposalId, fromVersion)).then(ensureDeliveryPlan),
      s3Service.getProposalJSON(s3Service.makeProposalKey(proposal.userId, proposal.proposalId, toVersion)).then(ensureDeliveryPlan),
    ]);

    const diff = diffPatcher.diff(fromData, toData) || {};
    res.json({ from: fromVersion, to: toVersion, diff });
  } catch (error) {
    next(error);
  }
});

router.get('/:id/versions/:version', authMiddleware, async (req, res, next) => {
  try {
    const { proposal, role, workspace } = await getProposalAccessContext(req.user.userId, req.params.id);
    const version = getVersionNumber(proposal, req.params.version);
    const s3Key = s3Service.makeProposalKey(proposal.userId, proposal.proposalId, version);
    const data = ensureDeliveryPlan(await s3Service.getProposalJSON(s3Key));

    res.json({
      ...proposal.toObject(),
      accessRole: role,
      workspace: workspace
        ? {
            id: workspace._id.toString(),
            name: workspace.name,
            slug: workspace.slug,
            plan: workspace.plan,
          }
        : null,
      requestedVersion: version,
      data,
    });
  } catch (error) {
    next(error);
  }
});

router.post('/:id/export', authMiddleware, async (req, res, next) => {
  try {
    const proposal = await getOwnedProposal(req.user.userId, req.params.id);
    const exportOptions = proposalExportSchema.parse(req.body);
    const { format } = exportOptions;
    const version = getVersionNumber(proposal, req.query.version || proposal.versionCount);
    const s3Key = s3Service.makeProposalKey(proposal.userId, proposal.proposalId, version);
    const proposalData = ensureDeliveryPlan(await s3Service.getProposalJSON(s3Key));
    const fileName = `${sanitizeDownloadName(proposal.title)}-v${version}`;

    if (format === 'pdf') {
      const pdfBuffer = await generatePDF(proposalData, exportOptions);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}.pdf"`);
      res.send(pdfBuffer);
      return;
    }

    if (format === 'md') {
      const markdown = buildMarkdownExport(proposalData, exportOptions);
      res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}.md"`);
      res.send(markdown);
      return;
    }

    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}.json"`);
    res.send(JSON.stringify(proposalData, null, 2));
  } catch (error) {
    next(error);
  }
});

router.patch('/:id/assignment', authMiddleware, async (req, res, next) => {
  try {
    const payload = proposalAssignmentSchema.parse(req.body);
    const { proposal, role, workspace } = await getProposalAccessContext(req.user.userId, req.params.id);

    if (!workspace) {
      throw new BadRequestError('Assignments are only available for workspace proposals.');
    }

    if (!['owner', 'editor'].includes(role)) {
      throw new ForbiddenError('Your workspace role does not allow assignment changes.');
    }

    if (payload.assignedTo && !workspace.members.some((member) => member.userId.toString() === payload.assignedTo)) {
      throw new BadRequestError('The selected assignee is not a workspace member.');
    }

    proposal.assignedTo = payload.assignedTo || null;
    await proposal.save();

    if (payload.assignedTo) {
      const proposalJSON = proposal.s3Key ? await getProposalJSONForRecord(proposal) : null;
      await createNotifications({
        userIds: [payload.assignedTo],
        workspace,
        proposalId: proposal.proposalId,
        type: 'assignment',
        title: 'Proposal assignment updated',
        body: `${proposal.title} has been assigned to you for delivery follow-up.`,
        deliveryDefaults: proposalJSON?.delivery_plan?.notificationDefaults,
      }).catch(() => null);
    }

    res.json({
      assignedTo: proposal.assignedTo ? proposal.assignedTo.toString() : null,
    });
  } catch (error) {
    next(error);
  }
});

router.get('/:id', authMiddleware, async (req, res, next) => {
  try {
    const { proposal, role, workspace } = await getProposalAccessContext(req.user.userId, req.params.id);

    if (!proposal.s3Key) {
      res.json({
        ...proposal.toObject(),
        accessRole: role,
        workspace: workspace
          ? {
              id: workspace._id.toString(),
              name: workspace.name,
              slug: workspace.slug,
              plan: workspace.plan,
            }
          : null,
        data: null,
      });
      return;
    }

    const data = await getProposalJSONForRecord(proposal);
    res.json({
      ...proposal.toObject(),
      accessRole: role,
      workspace: workspace
        ? {
            id: workspace._id.toString(),
            name: workspace.name,
            slug: workspace.slug,
            plan: workspace.plan,
          }
        : null,
      data,
    });
  } catch (error) {
    next(error);
  }
});

router.delete('/:id', authMiddleware, async (req, res, next) => {
  try {
    const proposal = await getOwnedProposal(req.user.userId, req.params.id);
    await s3Service.deleteProposalVersions(proposal.userId, proposal.proposalId, proposal.versionCount);
    await proposal.deleteOne();
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
