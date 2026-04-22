const express = require('express');
const { create: createJsonDiffPatch } = require('jsondiffpatch');
const { authMiddleware } = require('../middleware/auth');
const Proposal = require('../models/Proposal');
const {
  proposalExportSchema,
  versionCompareSchema,
} = require('../models/schemas');
const s3Service = require('../services/storage/s3');
const { generatePDF } = require('../services/export/pdfExport');
const { buildMarkdownExport, sanitizeDownloadName } = require('../services/export/formatters');
const { NotFoundError } = require('../utils/errors');

const router = express.Router();
const diffPatcher = createJsonDiffPatch();

async function getOwnedProposal(userId, proposalId) {
  const proposal = await Proposal.findOne({ proposalId, userId });

  if (!proposal) {
    throw new NotFoundError('Proposal not found');
  }

  return proposal;
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
    const skip = (page - 1) * limit;

    const [proposals, total] = await Promise.all([
      Proposal.find({ userId: req.user.userId })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Proposal.countDocuments({ userId: req.user.userId }),
    ]);

    res.json({ proposals, total, page, limit });
  } catch (error) {
    next(error);
  }
});

router.get('/:id/versions', authMiddleware, async (req, res, next) => {
  try {
    const proposal = await getOwnedProposal(req.user.userId, req.params.id);

    const versions = Array.from({ length: proposal.versionCount }, (_, index) => {
      const version = index + 1;
      return {
        version,
        s3Key: s3Service.makeProposalKey(req.user.userId, proposal.proposalId, version),
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
    const proposal = await getOwnedProposal(req.user.userId, req.params.id);
    const { from, to } = versionCompareSchema.parse(req.query);
    const fromVersion = getVersionNumber(proposal, from);
    const toVersion = getVersionNumber(proposal, to);

    const [fromData, toData] = await Promise.all([
      s3Service.getProposalJSON(s3Service.makeProposalKey(req.user.userId, proposal.proposalId, fromVersion)),
      s3Service.getProposalJSON(s3Service.makeProposalKey(req.user.userId, proposal.proposalId, toVersion)),
    ]);

    const diff = diffPatcher.diff(fromData, toData) || {};
    res.json({ from: fromVersion, to: toVersion, diff });
  } catch (error) {
    next(error);
  }
});

router.get('/:id/versions/:version', authMiddleware, async (req, res, next) => {
  try {
    const proposal = await getOwnedProposal(req.user.userId, req.params.id);
    const version = getVersionNumber(proposal, req.params.version);
    const s3Key = s3Service.makeProposalKey(req.user.userId, proposal.proposalId, version);
    const data = await s3Service.getProposalJSON(s3Key);

    res.json({
      ...proposal.toObject(),
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
    const { format } = proposalExportSchema.parse(req.body);
    const version = getVersionNumber(proposal, req.query.version || proposal.versionCount);
    const s3Key = s3Service.makeProposalKey(req.user.userId, proposal.proposalId, version);
    const proposalData = await s3Service.getProposalJSON(s3Key);
    const fileName = `${sanitizeDownloadName(proposal.title)}-v${version}`;

    if (format === 'pdf') {
      const pdfBuffer = await generatePDF(proposalData);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}.pdf"`);
      res.send(pdfBuffer);
      return;
    }

    if (format === 'md') {
      const markdown = buildMarkdownExport(proposalData);
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

router.get('/:id', authMiddleware, async (req, res, next) => {
  try {
    const proposal = await getOwnedProposal(req.user.userId, req.params.id);

    if (!proposal.s3Key) {
      res.json({ ...proposal.toObject(), data: null });
      return;
    }

    const data = await s3Service.getProposalJSON(proposal.s3Key);
    res.json({ ...proposal.toObject(), data });
  } catch (error) {
    next(error);
  }
});

router.delete('/:id', authMiddleware, async (req, res, next) => {
  try {
    const proposal = await getOwnedProposal(req.user.userId, req.params.id);
    await s3Service.deleteProposalVersions(req.user.userId, proposal.proposalId, proposal.versionCount);
    await proposal.deleteOne();
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
