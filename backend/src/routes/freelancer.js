const express = require('express');
const { z } = require('zod');
const { authMiddleware } = require('../middleware/auth');
const Niche = require('../models/Niche');
const { Lead } = require('../models/Lead');
const Escrow = require('../models/Escrow');
const Invoice = require('../models/Invoice');
const Credential = require('../models/Credential');
const FreelancerProfile = require('../models/FreelancerProfile');
const {
  buildDemoSeed,
  draftForLead,
  ensureFreelancerWorkspace,
  generateProfiles,
  getCollections,
  getFlowboard,
  scanGithub,
  sendLeadDraft,
  serialize,
  setNicheAccepted,
  updateAgentConfig,
  updateLead,
  updateProfiles,
} = require('../services/freelancer/freelancerService');
const { BadRequestError, NotFoundError } = require('../utils/errors');

const router = express.Router();

const booleanPatchSchema = z.object({
  accepted: z.boolean(),
});

const leadPatchSchema = z.object({
  status: z.enum(['new', 'qualified', 'contacted', 'replied', 'won', 'lost']).optional(),
  reasoning: z.array(z.string().trim().min(1)).optional(),
});

const profilesPatchSchema = z.object({
  upwork: z
    .object({
      headline: z.string().trim().max(200).optional(),
      summary: z.string().trim().max(5000).optional(),
      rate: z.coerce.number().min(0).max(1000).optional(),
    })
    .optional(),
  linkedin: z
    .object({
      headline: z.string().trim().max(200).optional(),
      about: z.string().trim().max(5000).optional(),
    })
    .optional(),
  personal: z
    .object({
      tagline: z.string().trim().max(200).optional(),
      bio: z.string().trim().max(5000).optional(),
    })
    .optional(),
});

const agentConfigSchema = z.object({
  leadHunter: z.boolean().optional(),
  outreachWriter: z.boolean().optional(),
  escrowWatcher: z.boolean().optional(),
  credentialMinter: z.boolean().optional(),
});

function userFromRequest(req) {
  return {
    ...req.user,
    userId: req.user.userId,
  };
}

router.use(authMiddleware);

router.get('/flowboard', async (req, res, next) => {
  try {
    res.json(await getFlowboard(userFromRequest(req)));
  } catch (error) {
    next(error);
  }
});

router.post('/github/scan', async (req, res, next) => {
  try {
    res.json(await scanGithub(userFromRequest(req)));
  } catch (error) {
    next(error);
  }
});

router.get('/niches', async (req, res, next) => {
  try {
    const { niches } = await getCollections(userFromRequest(req));
    res.json({ niches });
  } catch (error) {
    next(error);
  }
});

router.post('/niches/analyze', async (req, res, next) => {
  try {
    const user = userFromRequest(req);
    await ensureFreelancerWorkspace(user);
    const seed = buildDemoSeed(user);

    await Niche.deleteMany({ userId: user.userId });

    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    res.flushHeaders?.();

    const sendEvent = (type, payload = {}) => {
      res.write(`data: ${JSON.stringify({ type, ...payload })}\n\n`);
    };

    const keepAlive = setInterval(() => res.write(': keepalive\n\n'), 20000);

    try {
      sendEvent('started');

      for (const nicheSeed of seed.niches) {
        const niche = await Niche.create({ ...nicheSeed, userId: user.userId });
        sendEvent('niche', { niche: serialize(niche) });
      }

      sendEvent('complete');
    } finally {
      clearInterval(keepAlive);
      res.end();
    }
  } catch (error) {
    if (res.headersSent) {
      res.write(`data: ${JSON.stringify({ type: 'error', message: error.message })}\n\n`);
      res.end();
      return;
    }
    next(error);
  }
});

router.patch('/niches/:id', async (req, res, next) => {
  try {
    const payload = booleanPatchSchema.parse(req.body);
    res.json({ niche: await setNicheAccepted(req.user.userId, req.params.id, payload.accepted) });
  } catch (error) {
    next(error);
  }
});

router.get('/profiles', async (req, res, next) => {
  try {
    const { profile } = await getCollections(userFromRequest(req));
    res.json({ profile });
  } catch (error) {
    next(error);
  }
});

router.patch('/profiles', async (req, res, next) => {
  try {
    await ensureFreelancerWorkspace(userFromRequest(req));
    const payload = profilesPatchSchema.parse(req.body);
    res.json({ profiles: await updateProfiles(req.user.userId, payload) });
  } catch (error) {
    next(error);
  }
});

router.post('/profiles/generate', async (req, res, next) => {
  try {
    res.json({ profiles: await generateProfiles(userFromRequest(req)) });
  } catch (error) {
    next(error);
  }
});

router.get('/leads', async (req, res, next) => {
  try {
    const { leads } = await getCollections(userFromRequest(req));
    const status = typeof req.query.status === 'string' ? req.query.status : '';
    res.json({ leads: status ? leads.filter((lead) => lead.status === status) : leads });
  } catch (error) {
    next(error);
  }
});

router.patch('/leads/:id', async (req, res, next) => {
  try {
    const payload = leadPatchSchema.parse(req.body);
    res.json({ lead: await updateLead(req.user.userId, req.params.id, payload) });
  } catch (error) {
    next(error);
  }
});

router.post('/leads/:id/draft', async (req, res, next) => {
  try {
    res.json({ draftMessage: await draftForLead(req.user.userId, req.params.id) });
  } catch (error) {
    next(error);
  }
});

router.post('/leads/:id/send', async (req, res, next) => {
  try {
    res.json(await sendLeadDraft(req.user.userId, req.params.id));
  } catch (error) {
    next(error);
  }
});

router.get('/outreach', async (req, res, next) => {
  try {
    const { leads } = await getCollections(userFromRequest(req));
    res.json({
      leads: leads.filter((lead) => ['new', 'qualified', 'contacted', 'replied'].includes(lead.status)),
    });
  } catch (error) {
    next(error);
  }
});

router.get('/escrows', async (req, res, next) => {
  try {
    const { escrows, invoices } = await getCollections(userFromRequest(req));
    res.json({ escrows, invoices });
  } catch (error) {
    next(error);
  }
});

router.post('/escrows/:id/release/:msIdx', async (req, res, next) => {
  try {
    await ensureFreelancerWorkspace(userFromRequest(req));
    const escrow = await Escrow.findOne({ _id: req.params.id, userId: req.user.userId });
    if (!escrow) throw new NotFoundError('Escrow not found');

    const milestoneIndex = Number(req.params.msIdx);
    if (!Number.isInteger(milestoneIndex) || !escrow.milestones[milestoneIndex]) {
      throw new BadRequestError('Milestone not found');
    }

    escrow.milestones[milestoneIndex].status = 'released';
    escrow.milestones[milestoneIndex].releasedAt = new Date();
    await escrow.save();

    res.json({ txHash: `0xrelease${escrow._id.toString().slice(-8)}`, escrow: serialize(escrow) });
  } catch (error) {
    next(error);
  }
});

router.post('/escrows/:id/dispute', async (req, res, next) => {
  try {
    await ensureFreelancerWorkspace(userFromRequest(req));
    const escrow = await Escrow.findOne({ _id: req.params.id, userId: req.user.userId });
    if (!escrow) throw new NotFoundError('Escrow not found');

    const locked = escrow.milestones.find((milestone) => milestone.status === 'locked');
    if (locked) {
      locked.status = 'disputed';
      await escrow.save();
    }

    res.json({ ok: true, escrow: serialize(escrow) });
  } catch (error) {
    next(error);
  }
});

router.get('/invoices', async (req, res, next) => {
  try {
    await ensureFreelancerWorkspace(userFromRequest(req));
    const invoices = await Invoice.find({ userId: req.user.userId }).sort({ dueDate: 1 }).lean();
    res.json({ invoices: invoices.map(serialize) });
  } catch (error) {
    next(error);
  }
});

router.get('/credentials', async (req, res, next) => {
  try {
    await ensureFreelancerWorkspace(userFromRequest(req));
    const credentials = await Credential.find({ userId: req.user.userId }).sort({ mintedAt: -1 }).lean();
    res.json({ credentials: credentials.map(serialize) });
  } catch (error) {
    next(error);
  }
});

router.post('/credentials/mint', async (req, res, next) => {
  try {
    await ensureFreelancerWorkspace(userFromRequest(req));
    const profile = await FreelancerProfile.findOne({ userId: req.user.userId }).lean();
    const payload = z.object({ skill: z.string().trim().min(2).max(120).optional() }).parse(req.body || {});

    const credential = await Credential.create({
      userId: req.user.userId,
      skill: payload.skill || 'Verified Freelancer OS delivery',
      proof: `zk:${Date.now().toString(36)}:manual`,
      issuerDid: 'did:fixflow:issuer',
      subjectDid: profile?.did || '',
      evidence: { escrowTx: '', githubCommit: 'manual', leadName: 'FixFlowAI' },
      status: 'minted',
    });

    res.status(201).json({ credential: serialize(credential) });
  } catch (error) {
    next(error);
  }
});

router.patch('/settings/agents', async (req, res, next) => {
  try {
    await ensureFreelancerWorkspace(userFromRequest(req));
    const payload = agentConfigSchema.parse(req.body);
    res.json({ agentConfig: await updateAgentConfig(req.user.userId, payload) });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
