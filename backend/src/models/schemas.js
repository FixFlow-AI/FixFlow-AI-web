const { z } = require('zod');

const registerSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
  name: z
    .string()
    .min(2, 'Name must be at least 2 characters')
    .max(50, 'Name must not exceed 50 characters'),
  plan: z.enum(['free', 'standard', 'pro']).optional().default('free'),
  defaultEntryMode: z.enum(['individual', 'team']).optional().default('individual'),
  teamPlanPreference: z.enum(['free', 'standard', 'pro']).optional().default('free'),
});

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
  entryMode: z.enum(['individual', 'team']).nullable().optional().default(null),
});

const refreshSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});

const githubExchangeSchema = z.object({
  code: z.string().min(1, 'GitHub authorization code is required'),
  state: z.string().optional(),
});

const forgotPasswordRequestSchema = z.object({
  email: z.string().email('Invalid email address'),
});

const forgotPasswordVerifySchema = z.object({
  email: z.string().email('Invalid email address'),
  otp: z.string().regex(/^\d{6}$/, 'OTP must be a 6-digit code'),
  newPassword: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
});

const proposalGenerateSchema = z
  .object({
    briefText: z.string().trim().max(150000, 'Brief must be under 150000 characters').optional().default(''),
    fileKey: z.string().trim().max(1024).nullable().optional().default(null),
    proposalId: z.string().trim().max(128).nullable().optional().default(null),
    briefScore: z.unknown().nullable().optional().default(null),
    calibrationContext: z.string().trim().max(20000).optional().default(''),
    strategy: z.enum(['lean', 'standard', 'premium']).optional().default('standard'),
    tripId: z.string().trim().max(128).nullable().optional().default(null),
    workspaceId: z.string().trim().max(128).nullable().optional().default(null),
  })
  .refine((data) => data.briefText || data.fileKey, {
    message: 'Provide a brief or upload a file',
    path: ['briefText'],
  });

const briefScoreRequestSchema = z
  .object({
    briefText: z.string().trim().max(150000, 'Brief must be under 150000 characters').optional().default(''),
    fileKey: z.string().trim().max(1024).nullable().optional().default(null),
  })
  .refine((data) => data.briefText || data.fileKey, {
    message: 'Provide a brief or upload a file',
    path: ['briefText'],
  });

const uploadUrlSchema = z.object({
  fileName: z.string().trim().min(1, 'fileName is required'),
  fileType: z.string().trim().min(1, 'fileType is required'),
});

const proposalExportSchema = z.object({
  format: z.enum(['pdf', 'json', 'md']).default('pdf'),
});

const versionCompareSchema = z.object({
  from: z.coerce.number().int().min(1),
  to: z.coerce.number().int().min(1),
});

const proposalChatSchema = z.object({
  message: z.string().trim().min(1, 'Message is required').max(5000, 'Message must be under 5000 characters'),
  intent: z.enum(['question', 'mutate']).default('question'),
  targetSection: z.string().trim().nullable().optional().default(null),
  history: z.array(
    z.object({
      role: z.enum(['user', 'assistant']),
      content: z.string(),
    })
  ).optional().default([]),
});

const portalSections = ['summary', 'features', 'risks', 'timeline', 'effort', 'market', 'impact'];

const portalUpsertSchema = z
  .object({
    expiryDays: z.union([z.literal(0), z.literal(7), z.literal(30)]).default(7),
    pinEnabled: z.boolean().default(false),
    pin: z.string().regex(/^\d{4}$/, 'PIN must be exactly 4 digits').nullable().optional().default(null),
  });

const portalVerifySchema = z.object({
  pin: z.string().regex(/^\d{4}$/, 'PIN must be exactly 4 digits').nullable().optional().default(null),
});

const portalEventSchema = z.object({
  events: z
    .array(
      z.object({
        section: z.enum(portalSections),
        dwellMs: z.coerce.number().min(0).max(600000).default(0),
        views: z.coerce.number().int().min(0).max(25).default(1),
      })
    )
    .min(1)
    .max(50),
});

const portalFeedbackSchema = z.object({
  message: z.string().trim().min(5, 'Feedback must be at least 5 characters').max(5000),
});

const dealStatusSchema = z.object({
  dealStatus: z.enum(['pending', 'negotiating', 'won', 'lost']),
  lossReason: z.string().trim().max(1000).optional().default(''),
});

const outcomeRequestSchema = z.object({
  dealStatus: z.enum(['won', 'lost']),
  lossReason: z.string().trim().max(1000).optional().default(''),
});

const outcomeSendSchema = z.object({
  recipientEmail: z.string().email('Recipient email is invalid'),
  emailKey: z.string().trim().min(1).max(32),
});

const workspaceCreateSchema = z.object({
  name: z.string().trim().min(2).max(120),
  plan: z.enum(['free', 'standard', 'pro']).optional().default('free'),
});

const workspaceUpdateSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  plan: z.enum(['free', 'standard', 'pro']).optional(),
  defaultEntryMode: z.enum(['individual', 'team']).optional(),
});

const workspaceInviteSchema = z.object({
  email: z.string().email('Invalid email address'),
  role: z.enum(['editor', 'viewer']),
});

const proposalCommentCreateSchema = z.object({
  section: z.enum(['summary', 'features', 'risks', 'timeline', 'effort', 'market', 'impact']),
  type: z.enum(['review', 'approval', 'question', 'edit_note']).default('review'),
  body: z.string().trim().min(2).max(5000),
});

const proposalCommentResolveSchema = z.object({
  resolved: z.boolean(),
});

const proposalPresenceSchema = z.object({
  workspaceId: z.string().trim().max(128).nullable().optional().default(null),
});

const tripBundlePortalSchema = z.object({
  proposalIds: z.array(z.string().trim().min(1)).min(1).max(3),
  expiryDays: z.union([z.literal(0), z.literal(7), z.literal(30)]).default(7),
  pinEnabled: z.boolean().default(false),
  pin: z.string().regex(/^\d{4}$/, 'PIN must be exactly 4 digits').nullable().optional().default(null),
});

const proposalEtaSchema = z.object({
  briefText: z.string().trim().max(150000).optional().default(''),
  fileKey: z.string().trim().max(1024).nullable().optional().default(null),
  strategy: z.enum(['lean', 'standard', 'premium']).optional().default('standard'),
  isTriMode: z.boolean().optional().default(false),
  workspaceId: z.string().trim().max(128).nullable().optional().default(null),
});

const chatEtaSchema = z.object({
  proposalId: z.string().trim().min(1, 'proposalId is required'),
  message: z.string().trim().max(5000).optional().default(''),
  intent: z.enum(['question', 'mutate']).optional().default('question'),
  targetSection: z.string().trim().nullable().optional().default(null),
});

module.exports = {
  registerSchema,
  loginSchema,
  refreshSchema,
  githubExchangeSchema,
  forgotPasswordRequestSchema,
  forgotPasswordVerifySchema,
  proposalGenerateSchema,
  briefScoreRequestSchema,
  uploadUrlSchema,
  proposalExportSchema,
  versionCompareSchema,
  proposalChatSchema,
  portalSections,
  portalUpsertSchema,
  portalVerifySchema,
  portalEventSchema,
  portalFeedbackSchema,
  dealStatusSchema,
  outcomeRequestSchema,
  outcomeSendSchema,
  workspaceCreateSchema,
  workspaceUpdateSchema,
  workspaceInviteSchema,
  proposalCommentCreateSchema,
  proposalCommentResolveSchema,
  proposalPresenceSchema,
  tripBundlePortalSchema,
  proposalEtaSchema,
  chatEtaSchema,
};
