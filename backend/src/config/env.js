const { z } = require('zod');

const envSchema = z.object({
  PORT: z.coerce.number().default(5000),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
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
  EMAIL_FROM_ADDRESS: z.string().default('hello@fixflowai.com'),
  EMAIL_FROM_NAME: z.string().default('FixFlowAI'),
  STRIPE_SECRET_KEY: z.string().default(''),
  STRIPE_WEBHOOK_SECRET: z.string().default(''),
  STRIPE_FREE_PRICE_ID: z.string().default(''),
  STRIPE_PRO_PRICE_ID: z.string().default(''),
  STRIPE_AGENCY_PRICE_ID: z.string().default(''),
  STRIPE_SOLO_PRICE_ID: z.string().default(''),
  GEMINI_API_KEY: z.string().default(''),
  GEMINI_MODEL: z.string().default('gemini-3-flash-preview'),
  GEMINI_FALLBACK_MODEL: z.string().default('gemini-3.1-flash-lite-preview'),
  GEMINI_MODEL_FALLBACKS: z.string().default('gemini-2.5-flash,gemini-2.5-flash-lite'),
  GEMINI_STRUCTURED_MODEL: z.string().default('gemini-3.1-flash-lite-preview'),
  GEMINI_STRUCTURED_FALLBACKS: z.string().default('gemini-2.5-flash-lite,gemini-3-flash-preview,gemini-2.5-flash'),
  GEMINI_MODEL_RPM_OVERRIDES: z.string().default(''),
  GEMINI_MAX_QUEUE_WAIT_MS: z.coerce.number().default(20_000),
  GEMINI_KEY_GUARD_MS: z.coerce.number().default(15 * 60 * 1000),
  LLM_PROVIDER_ORDER: z.string().default('gemini,openrouter,xai,ollama'),
  OPENROUTER_API_KEY: z.string().default(''),
  OPENROUTER_BASE_URL: z.string().url().default('https://openrouter.ai/api/v1'),
  OPENROUTER_MODEL: z.string().default('openrouter/auto'),
  OPENROUTER_MODEL_FALLBACKS: z.string().default(''),
  OPENROUTER_SITE_URL: z.string().url().default('http://localhost:3001'),
  OPENROUTER_APP_NAME: z.string().default('FixFlowAI'),
  XAI_API_KEY: z.string().default(''),
  XAI_BASE_URL: z.string().url().default('https://api.x.ai/v1'),
  XAI_MODEL: z.string().default('grok-4.20-reasoning'),
  XAI_MODEL_FALLBACKS: z.string().default(''),
  OLLAMA_API_KEY: z.string().default(''),
  OLLAMA_BASE_URL: z.string().url().default('https://ollama.com'),
  OLLAMA_MODEL: z.string().default('gpt-oss:120b'),
  OLLAMA_MODEL_FALLBACKS: z.string().default(''),
  OPPORTUNITY_SEARCH_PROVIDER_ORDER: z.string().default('apify,tavily,brave,serpapi'),
  TAVILY_API_KEY: z.string().default(''),
  BRAVE_SEARCH_API_KEY: z.string().default(''),
  SERPAPI_API_KEY: z.string().default(''),
  APIFY_API_TOKEN: z.string().default(''),
  APIFY_UPWORK_ACTOR_ID: z.string().default(''),
  APIFY_FIVERR_ACTOR_ID: z.string().default(''),
  APIFY_FREELANCER_ACTOR_ID: z.string().default(''),
  OPPORTUNITY_DISCOVERY_DEMO_FALLBACK: z
    .string()
    .default('true')
    .transform((value) => value.toLowerCase() === 'true'),
  ALLOW_DEMO_SEED: z
    .string()
    .default('false')
    .transform((value) => value.toLowerCase() === 'true'),
  BID_MATCH_THRESHOLD: z.coerce.number().default(70),
  AWS_REGION: z.string().default('us-east-1'),
  AWS_ACCESS_KEY_ID: z.string().default(''),
  AWS_SECRET_ACCESS_KEY: z.string().default(''),
  AWS_SESSION_TOKEN: z.string().default(''),
  DYNAMODB_TABLE_PREFIX: z.string().default('fixflowai'),
  DYNAMODB_ENDPOINT: z.string().default(''),
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
  ADMIN_ALERT_EMAIL: z.string().default('suvampersonal555@gmail.com'),
  RATE_LIMIT_MONITOR_ENABLED: z
    .string()
    .default('true')
    .transform((value) => value.toLowerCase() === 'true'),
  RATE_LIMIT_NEAR_THRESHOLD: z.coerce.number().default(0.85),
  RATE_LIMIT_ALERT_COOLDOWN_SEC: z.coerce.number().default(10 * 60),
  RATE_LIMIT_RESTORE_COOLDOWN_SEC: z.coerce.number().default(60),
  RATE_LIMIT_RETRY_MAX_ATTEMPTS: z.coerce.number().default(5),
  RATE_LIMIT_RETRY_BASE_DELAY_MS: z.coerce.number().default(1500),
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
