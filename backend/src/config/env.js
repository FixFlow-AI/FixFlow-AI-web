const { z } = require('zod');

const envSchema = z.object({
  PORT: z.coerce.number().default(5000),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  MONGODB_URI: z.string().min(1, 'MONGODB_URI is required'),
  JWT_SECRET: z.string().min(16, 'JWT_SECRET must be at least 16 characters'),
  JWT_REFRESH_SECRET: z.string().min(16, 'JWT_REFRESH_SECRET must be at least 16 characters'),
  JWT_ACCESS_EXPIRY: z.string().default('15m'),
  JWT_REFRESH_EXPIRY: z.string().default('7d'),
  FRONTEND_URL: z.string().url().default('http://localhost:3001'),
  GITHUB_CLIENT_ID: z.string().default(''),
  GITHUB_CLIENT_SECRET: z.string().default(''),
  GITHUB_CALLBACK_URL: z.string().url().default('http://localhost:5000/api/auth/github/callback'),
  GITHUB_OAUTH_SCOPE: z.string().default('read:user user:email'),
  SMTP_HOST: z.string().default(''),
  SMTP_PORT: z.coerce.number().default(587),
  SMTP_SECURE: z
    .string()
    .default('false')
    .transform((value) => value.toLowerCase() === 'true'),
  SMTP_USER: z.string().default(''),
  SMTP_PASS: z.string().default(''),
  SMTP_FROM: z.string().default(''),
  GEMINI_API_KEY: z.string().default(''),
  GEMINI_MODEL: z.string().default('gemini-3-flash-preview'),
  GEMINI_FALLBACK_MODEL: z.string().default('gemini-3.1-flash-lite-preview'),
  GEMINI_MODEL_FALLBACKS: z.string().default('gemini-2.5-flash,gemini-2.5-flash-lite'),
  GEMINI_STRUCTURED_MODEL: z.string().default('gemini-3.1-flash-lite-preview'),
  GEMINI_STRUCTURED_FALLBACKS: z.string().default('gemini-2.5-flash-lite,gemini-3-flash-preview,gemini-2.5-flash'),
  GEMINI_MODEL_RPM_OVERRIDES: z.string().default(''),
  GEMINI_MAX_QUEUE_WAIT_MS: z.coerce.number().default(20_000),
  GEMINI_KEY_GUARD_MS: z.coerce.number().default(15 * 60 * 1000),
  AWS_REGION: z.string().default('us-east-1'),
  S3_BUCKET: z.string().default('fixflowai-assets-dev'),
  SLACK_CLIENT_ID: z.string().default(''),
  SLACK_CLIENT_SECRET: z.string().default(''),
  SLACK_REDIRECT_URI: z.string().url().default('http://localhost:5000/api/integrations/slack/callback'),
  SLACK_SCOPES: z.string().default('incoming-webhook'),
  INTEGRATION_SECRET: z.string().default(''),
  STREAM_TIMEOUT_MS: z.coerce.number().default(120000),
  PUPPETEER_EXECUTABLE_PATH: z.string().default(''),
  USE_FAKE_LLM: z
    .string()
    .default('false')
    .transform((value) => value.toLowerCase() === 'true'),
});

function validateEnv() {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    const formatted = result.error.issues
      .map((issue) => `  ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    console.error('❌ Invalid environment variables:\n' + formatted);
    process.exit(1);
  }

  return result.data;
}

const env = validateEnv();

module.exports = { env };
