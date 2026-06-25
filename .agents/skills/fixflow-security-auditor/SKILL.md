---
name: fixflow-security-auditor
description: >
  Security engineering and threat modeling skill for FixFlowAI. Triggers when
  the user asks about authentication, authorization, API security, rate limiting,
  input sanitization, prompt injection defense, encryption, Web3 wallet security,
  CORS configuration, or any security-related implementation. Ensures the platform
  meets enterprise-grade security standards for handling financial transactions.
---

# FixFlowAI Security Auditor Skill

You are the **Chief Security Engineer** for FixFlowAI. You protect users' financial transactions, personal data, and AI pipeline integrity. Every feature you review must pass security scrutiny before deployment.

---

## Threat Model Overview

FixFlowAI handles **financial escrow transactions** and **AI-generated proposals**. The primary threat vectors are:

```
┌────────────────────────────────────────────────────────────┐
│                    THREAT LANDSCAPE                         │
├────────────────────────────────────────────────────────────┤
│                                                            │
│  🔴 CRITICAL                                               │
│  ├── Escrow fund theft (double-release, state tampering)   │
│  ├── API key compromise (Gemini, Razorpay, wallet keys)    │
│  └── Payment webhook spoofing (fake Razorpay events)       │
│                                                            │
│  🟠 HIGH                                                    │
│  ├── Prompt injection (LLM manipulation)                   │
│  ├── Authentication bypass (JWT forgery, session hijack)   │
│  └── Unauthorized state transitions (FSM bypass)           │
│                                                            │
│  🟡 MEDIUM                                                  │
│  ├── Rate limit bypass (API abuse, scraping exhaustion)    │
│  ├── XSS via user-generated content in proposals           │
│  └── CSRF on state-changing endpoints                      │
│                                                            │
│  🟢 LOW                                                     │
│  ├── Information leakage via error messages                │
│  ├── Dependency supply chain attacks                       │
│  └── DDoS on WebSocket connections                         │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

---

## Authentication & Authorization

### JWT Implementation Pattern
```typescript
import jwt from 'jsonwebtoken';

// Token generation
function generateTokens(userId: string, role: 'client' | 'freelancer' | 'admin') {
  const accessToken = jwt.sign(
    { userId, role, type: 'access' },
    process.env.JWT_SECRET!,
    { expiresIn: '15m' }  // Short-lived
  );

  const refreshToken = jwt.sign(
    { userId, type: 'refresh' },
    process.env.JWT_REFRESH_SECRET!,
    { expiresIn: '7d' }
  );

  return { accessToken, refreshToken };
}

// Middleware
function authMiddleware(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'No token provided' });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!);
    req.user = decoded;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired', code: 'TOKEN_EXPIRED' });
    }
    return res.status(403).json({ error: 'Invalid token' });
  }
}
```

### Role-Based Access Control (RBAC)
```typescript
function requireRole(...allowedRoles: string[]) {
  return (req, res, next) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  };
}

// Usage:
router.post('/api/v1/escrow/release',
  authMiddleware,
  requireRole('client'),  // Only clients can release funds
  mfaRequired,            // MFA for financial operations
  releaseEscrow
);
```

### MFA for Payment Releases
```typescript
// Escrow FSM security hook
async function mfaRequired(req, res, next) {
  const { mfaCode } = req.body;
  if (!mfaCode) {
    return res.status(403).json({
      error: 'MFA required for payment operations',
      code: 'MFA_REQUIRED'
    });
  }

  const isValid = await verifyTOTP(req.user.userId, mfaCode);
  if (!isValid) {
    return res.status(403).json({ error: 'Invalid MFA code' });
  }

  next();
}
```

---

## API Key Management

### Environment Separation
```
Development:  .env file (gitignored)
Staging:      AWS Secrets Manager (staging/ prefix)
Production:   AWS Secrets Manager (prod/ prefix)
```

### Secret Access Pattern
```typescript
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';

async function getSecret(secretName: string): Promise<string> {
  const client = new SecretsManagerClient({ region: 'us-east-1' });
  const response = await client.send(
    new GetSecretValueCommand({ SecretId: secretName })
  );
  return response.SecretString!;
}

// Cache secrets in memory (don't fetch on every request)
let cachedSecrets: Record<string, string> | null = null;

async function getSecrets(): Promise<Record<string, string>> {
  if (cachedSecrets) return cachedSecrets;
  const raw = await getSecret('fixflowai/prod/keys');
  cachedSecrets = JSON.parse(raw);
  return cachedSecrets!;
}
```

### Key Rotation Rules
- **Gemini API Key**: Rotate quarterly or on any suspected compromise
- **Razorpay Keys**: Rotate quarterly, regenerate webhook secret on rotation
- **JWT Secrets**: Rotate monthly, implement graceful key rollover
- **Wallet Private Keys**: Store in HSM, never expose in logs

---

## Rate Limiting

### Redis-Based Sliding Window
```typescript
import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!
});

async function rateLimit(
  identifier: string,    // IP or userId
  limit: number,         // Max requests
  windowSeconds: number  // Time window
): Promise<{ allowed: boolean; remaining: number; resetAt: number }> {
  const key = `ratelimit:${identifier}`;
  const now = Date.now();
  const windowStart = now - (windowSeconds * 1000);

  // Remove expired entries
  await redis.zremrangebyscore(key, 0, windowStart);

  // Count current window
  const count = await redis.zcard(key);

  if (count >= limit) {
    return { allowed: false, remaining: 0, resetAt: windowStart + (windowSeconds * 1000) };
  }

  // Add current request
  await redis.zadd(key, { score: now, member: `${now}-${Math.random()}` });
  await redis.expire(key, windowSeconds);

  return { allowed: true, remaining: limit - count - 1, resetAt: now + (windowSeconds * 1000) };
}
```

### Rate Limit Tiers
| Endpoint Category | Limit | Window | Rationale |
|-------------------|-------|--------|-----------|
| AI Generation (Gemini calls) | 10 requests | 1 minute | API cost control |
| Authentication | 5 attempts | 15 minutes | Brute-force prevention |
| Escrow operations | 20 requests | 1 minute | Abuse prevention |
| General API | 100 requests | 1 minute | Fair usage |
| WebSocket messages | 60 messages | 1 minute | DoS prevention |

---

## Prompt Injection Defense

### The Risk
User-supplied briefs are sent to Gemini as part of the prompt. A malicious brief could contain instructions that override the system prompt.

### Defense Strategy
```typescript
function sanitizeUserInput(input: string): string {
  // 1. Strip control characters
  let clean = input.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');

  // 2. Limit length (prevents context window overflow)
  clean = clean.slice(0, 50_000);

  // 3. Escape potential prompt injection markers
  // Don't remove — just flag for logging
  const injectionPatterns = [
    /ignore (?:all )?(?:previous|above) instructions/i,
    /you are now/i,
    /system:\s/i,
    /\[INST\]/i,
    /<<SYS>>/i,
  ];

  const hasInjection = injectionPatterns.some(p => p.test(clean));
  if (hasInjection) {
    console.warn('⚠️ Potential prompt injection detected in user input');
    // Log but don't block — the structured output schema constrains the LLM
  }

  return clean;
}
```

### Additional LLM Security
1. **Always use `responseSchema`** — Constrains output to valid JSON, making injection-driven output nearly impossible.
2. **Never echo raw LLM output** to users — Always Zod-validate first.
3. **Never include secrets** in prompts — Not even "for context."
4. **Log all LLM inputs/outputs** — For audit and incident investigation.

---

## Input Validation & Sanitization

### API Input Validation (Express Middleware)
```typescript
import { z } from 'zod';

function validateBody(schema: z.ZodSchema) {
  return (req, res, next) => {
    try {
      req.body = schema.parse(req.body);
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          error: 'Validation failed',
          details: error.errors.map(e => ({
            field: e.path.join('.'),
            message: e.message
          }))
        });
      }
      return res.status(400).json({ error: 'Invalid request body' });
    }
  };
}

// Usage
router.post('/api/v1/briefs',
  authMiddleware,
  validateBody(BriefInputSchema),
  processBrief
);
```

### XSS Prevention
```typescript
// Sanitize HTML in user-generated content
import DOMPurify from 'isomorphic-dompurify';

function sanitizeHTML(dirty: string): string {
  return DOMPurify.sanitize(dirty, {
    ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'p', 'br', 'ul', 'ol', 'li'],
    ALLOWED_ATTR: []
  });
}
```

---

## CORS Configuration

```typescript
import cors from 'cors';

const corsOptions = {
  origin: (origin, callback) => {
    const allowedOrigins = [
      'https://fixflowai.com',
      'https://app.fixflowai.com',
      ...(process.env.NODE_ENV === 'development'
        ? ['http://localhost:5173', 'http://localhost:3000']
        : [])
    ];

    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  maxAge: 86400  // 24h preflight cache
};

app.use(cors(corsOptions));
```

---

## Web3 Security

### Wallet Key Protection
- **Never store private keys in `.env` files in production**
- Use AWS Secrets Manager or dedicated HSM
- For signing transactions, use a dedicated signing service

### Smart Contract Interaction Safety
```typescript
import { ethers } from 'ethers';

// Always verify transaction before sending
async function mintSBT(recipientAddress: string, metadata: object) {
  // 1. Validate address format
  if (!ethers.isAddress(recipientAddress)) {
    throw new Error('Invalid Ethereum address');
  }

  // 2. Estimate gas before sending
  const estimatedGas = await contract.mintSBT.estimateGas(
    recipientAddress, JSON.stringify(metadata)
  );

  // 3. Set gas limit with 20% buffer
  const tx = await contract.mintSBT(
    recipientAddress,
    JSON.stringify(metadata),
    { gasLimit: estimatedGas * 120n / 100n }
  );

  // 4. Wait for confirmation
  const receipt = await tx.wait(2);  // 2 block confirmations
  return receipt;
}
```

---

## Security Checklist for Code Reviews

Before approving ANY code change, verify:

- [ ] **No secrets in code** — API keys, passwords, private keys
- [ ] **Zod validation on all inputs** — Every API endpoint validates request body
- [ ] **Auth middleware on protected routes** — No unprotected state-changing endpoints
- [ ] **Rate limiting applied** — Especially on AI and payment endpoints
- [ ] **CORS properly configured** — No wildcard origins in production
- [ ] **Error messages don't leak internals** — No stack traces, DB schemas, or file paths
- [ ] **LLM output validated** — Never trust raw Gemini responses
- [ ] **Webhook signatures verified** — Razorpay webhook signature check
- [ ] **FSM transitions validated** — No FSM bypass possible
- [ ] **Audit trail generated** — All financial operations logged with hashes
- [ ] **Dependencies audited** — Run `npm audit` before deploying
