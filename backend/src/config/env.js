const { z } = require('zod');

const envSchema = z.object({
  PORT: z.coerce.number().default(5000),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  FRONTEND_URL: z.string().url().default('http://localhost:3001'),
  AWS_REGION: z.string().default('us-east-1'),
  AWS_ACCESS_KEY_ID: z.string().default(''),
  AWS_SECRET_ACCESS_KEY: z.string().default(''),
  AWS_SESSION_TOKEN: z.string().default(''),
  DYNAMODB_TABLE_PREFIX: z.string().default('fixflowai'),
  DYNAMODB_ENDPOINT: z.string().default(''),
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
