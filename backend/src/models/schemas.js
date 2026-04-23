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
});

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
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

module.exports = {
  registerSchema,
  loginSchema,
  refreshSchema,
  githubExchangeSchema,
  forgotPasswordRequestSchema,
  forgotPasswordVerifySchema,
  proposalGenerateSchema,
  uploadUrlSchema,
  proposalExportSchema,
  versionCompareSchema,
};
