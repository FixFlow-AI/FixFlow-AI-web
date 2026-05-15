const { Router } = require('express');
const { z } = require('zod');
const WaitlistEntry = require('../models/WaitlistEntry');

const router = Router();

const VALID_ROLES = ['Freelancer', 'Client', 'Developer'];

const waitlistSchema = z.object({
  username: z
    .string()
    .trim()
    .min(1, 'Name is required')
    .max(80, 'Name must be 80 characters or less'),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email('Please provide a valid email')
    .max(254, 'Email must be 254 characters or less'),
  role: z.enum(VALID_ROLES, {
    errorMap: () => ({ message: 'Role must be Freelancer, Client, or Developer' }),
  }),
  comment: z
    .string()
    .trim()
    .max(1000, 'Comment must be 1000 characters or less')
    .optional()
    .default(''),
});

router.post('/', async (req, res) => {
  try {
    const parsed = waitlistSchema.safeParse(req.body);

    if (!parsed.success) {
      const firstIssue = parsed.error.issues[0]?.message || 'Validation failed';
      return res.status(400).json({
        success: false,
        message: firstIssue,
      });
    }

    const { username, email, role, comment } = parsed.data;

    // Check for duplicate email
    const existing = await WaitlistEntry.findOne({ email });
    if (existing) {
      return res.status(200).json({
        success: true,
        message: 'You are already on the waitlist.',
      });
    }

    // Capture user agent safely
    const userAgent = (req.headers['user-agent'] || '').slice(0, 500);

    await WaitlistEntry.create({
      username,
      email,
      role,
      comment,
      userAgent,
      source: 'waitlist-landing-page',
      status: 'new',
    });

    return res.status(201).json({
      success: true,
      message: 'Thank you for joining the Fix Flow AI waitlist.',
    });
  } catch (error) {
    console.error('Waitlist submission error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Something went wrong. Please try again.',
    });
  }
});

module.exports = router;
