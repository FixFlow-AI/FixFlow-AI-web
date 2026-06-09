const { Router } = require('express');
const { z } = require('zod');
const ContactInquiry = require('../models/ContactInquiry');

const router = Router();

const contactSchema = z.object({
  name: z
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
  message: z
    .string()
    .trim()
    .min(10, 'Message must be at least 10 characters')
    .max(1500, 'Message must be 1500 characters or less'),
});

router.post('/', async (req, res) => {
  try {
    const parsed = contactSchema.safeParse(req.body);

    if (!parsed.success) {
      const firstIssue = parsed.error.issues[0]?.message || 'Validation failed';
      return res.status(400).json({
        success: false,
        message: firstIssue,
      });
    }

    const { name, email, message } = parsed.data;
    const userAgent = (req.headers['user-agent'] || '').slice(0, 500);

    await ContactInquiry.create({
      name,
      email,
      message,
      userAgent,
      source: 'waitlist-landing-page',
      status: 'unread',
    });

    return res.status(201).json({
      success: true,
      message: 'Thank you. Your message has been received. We will get back to you shortly.',
    });
  } catch (error) {
    console.error('Contact form submission error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Something went wrong. Please try again.',
    });
  }
});

module.exports = router;
