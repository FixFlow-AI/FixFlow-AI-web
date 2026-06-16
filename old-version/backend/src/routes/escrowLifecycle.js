const express = require('express');
const { z } = require('zod');
const { authMiddleware } = require('../middleware/auth');
const Escrow = require('../models/Escrow');
const { NotFoundError, BadRequestError } = require('../utils/errors');

const router = express.Router();
router.use(authMiddleware);

const milestoneSchema = z.object({
  name: z.string().trim().min(1),
  amount: z.coerce.number().positive(),
  deadline: z.string().datetime().optional(),
});

const createEscrowSchema = z.object({
  sellerAddress: z.string().trim().min(6),
  token: z.string().trim().default('USDC'),
  chain: z.string().trim().default('Polygon Amoy'),
  milestones: z.array(milestoneSchema).min(1).max(10),
  contractAddress: z.string().trim().optional(),
});

router.post('/', async (req, res, next) => {
  try {
    const payload = createEscrowSchema.parse(req.body);
    const totalAmount = payload.milestones.reduce((sum, item) => sum + item.amount, 0);
    const escrow = await Escrow.create({
      userId: req.user.userId,
      buyerAddress: req.user.walletAddress || req.user.email,
      sellerAddress: payload.sellerAddress,
      currency: payload.token,
      chain: payload.chain,
      contractAddress: payload.contractAddress || '',
      totalAmount,
      state: 'CREATED',
      milestones: payload.milestones.map((item) => ({
        name: item.name,
        amount: item.amount,
        status: 'pending',
        deadline: item.deadline ? new Date(item.deadline) : null,
      })),
    });
    res.status(201).json({ escrow });
  } catch (error) {
    next(error);
  }
});

router.get('/', async (req, res, next) => {
  try {
    const escrows = await Escrow.find({ userId: req.user.userId }).sort({ createdAt: -1 }).lean();
    res.json({ escrows });
  } catch (error) {
    next(error);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const escrow = await Escrow.findOne({ _id: req.params.id, userId: req.user.userId });
    if (!escrow) throw new NotFoundError('Escrow not found');
    res.json({ escrow });
  } catch (error) {
    next(error);
  }
});

router.post('/:id/fund', async (req, res, next) => {
  try {
    const escrow = await Escrow.findOne({ _id: req.params.id, userId: req.user.userId });
    if (!escrow) throw new NotFoundError('Escrow not found');
    escrow.state = 'FUNDED';
    escrow.fundedAt = new Date();
    await escrow.save();
    res.json({ escrow });
  } catch (error) {
    next(error);
  }
});

router.post('/:id/milestones/:index/submit', async (req, res, next) => {
  try {
    const idx = Number(req.params.index);
    const escrow = await Escrow.findOne({ _id: req.params.id, userId: req.user.userId });
    if (!escrow) throw new NotFoundError('Escrow not found');
    if (!Number.isInteger(idx) || !escrow.milestones[idx]) throw new BadRequestError('Invalid milestone index');
    escrow.milestones[idx].status = 'locked';
    escrow.state = 'MILESTONE_SUBMITTED';
    await escrow.save();
    res.json({ escrow });
  } catch (error) {
    next(error);
  }
});

router.post('/:id/milestones/:index/approve', async (req, res, next) => {
  try {
    const idx = Number(req.params.index);
    const escrow = await Escrow.findOne({ _id: req.params.id, userId: req.user.userId });
    if (!escrow) throw new NotFoundError('Escrow not found');
    if (!Number.isInteger(idx) || !escrow.milestones[idx]) throw new BadRequestError('Invalid milestone index');
    escrow.milestones[idx].status = 'released';
    escrow.milestones[idx].releasedAt = new Date();
    escrow.state = escrow.milestones.every((item) => item.status === 'released') ? 'RELEASED' : 'MILESTONE_APPROVED';
    await escrow.save();
    res.json({ escrow });
  } catch (error) {
    next(error);
  }
});

router.post('/:id/dispute', async (req, res, next) => {
  try {
    const escrow = await Escrow.findOne({ _id: req.params.id, userId: req.user.userId });
    if (!escrow) throw new NotFoundError('Escrow not found');
    escrow.state = 'DISPUTED';
    await escrow.save();
    res.json({ escrow });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
