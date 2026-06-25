# FixFlowAI — Agent Rules & Conventions

> You are working on **FixFlowAI**, a trust-first, AI-powered freelancing operating system. Every line of code you write must uphold the platform's core promise: **verifiable skills, guaranteed payments, zero-noise hiring.**

---

## Identity & Mission

FixFlowAI replaces resume-based freelancer profiles with **evidence-based vetting** (scanning GitHub repos and commits) and secures delivery using **milestone-based escrow payments** powered by finite state machines. It serves both **freelancers** (protected payments, transparent earnings, game-proof reputation) and **clients** (trust-first hiring, zero-noise shortlists, one workspace from brief to delivery).

---

## Tech Stack (Non-Negotiable)

| Layer | Technology | Notes |
|-------|-----------|-------|
| **Frontend** | React 18 + Vite 5 | JSX components, Zustand state, Tailwind CSS |
| **Backend** | Node.js + Express.js | ES Modules (`"type": "module"`), TypeScript 5.4+ strict mode |
| **AI/LLM** | Google Gemini via `@google/genai` | Structured JSON output with Zod validation |
| **Validation** | Zod | Schema-first. Define schemas BEFORE implementation |
| **Database** | PostgreSQL (Prisma ORM) + DynamoDB | Relational for core data, DynamoDB for proposals/settings |
| **Real-time** | WebSocket (`ws`) | Vector clocks, LWW conflict resolution |
| **Payments** | Razorpay (fiat escrow) | Webhook-driven milestone releases |
| **Web3** | Polygon (Soulbound DIDs) | ERC-721 metadata for reputation tokens |
| **Infra** | AWS Serverless | Lambda, Amplify, S3, DynamoDB On-Demand |

---

## Mandatory Coding Conventions

### Language & Modules
- **ES Modules only.** Use `import/export`. Never use `require()`.
- **TypeScript strict mode** for all new backend files. Use `.ts` extension.
- Mixed `.js`/`.ts` is allowed for legacy files, but new code MUST be TypeScript.

### Naming
- **Functions**: `camelCase` — e.g., `parseBrief()`, `sanitizeAndPatchBrief()`
- **Types/Interfaces**: `PascalCase` — e.g., `Proposal`, `BriefOutputSchema`
- **Constants**: `UPPER_SNAKE_CASE` for enum-like values
- **Files**: `{feature}{Type}.{ts|js}` — e.g., `briefParser.ts`, `syncServer.ts`
- **Spec docs**: `{topic}_{subcategory}.md` — e.g., `system_design.md`
- **AI features**: `ai_{number}_{feature_name}.md` — e.g., `ai_001_semantic_brief_parsing.md`

### Architecture Principles (ALWAYS Follow)
1. **Schema-first validation**: ALL external data passes through Zod schemas before processing.
2. **Finite State Machines**: Use FSMs for any state transitions (escrow, milestones, workflows). Never bypass FSM boundaries.
3. **Immutable audit trails**: State changes generate SHA-256 chained hashes. Never mutate audit history.
4. **Optimistic concurrency**: Use version fields to prevent race conditions on shared resources.
5. **Fallback mechanisms**: Every LLM call, API call, and external integration MUST have a sanitization/fallback path. The app must NEVER crash from malformed input.
6. **Multi-agent orchestration**: Run parallel LLM calls with consensus scoring. Never rely on a single LLM response for critical decisions.

### Error Handling Philosophy
```
RULE: The application must NEVER crash.
- LLM returns garbage? → sanitizeAndPatch with safe defaults.
- API key invalid? → Return structured fallback response.
- Schema validation fails? → Log error, patch missing fields, continue.
- WebSocket disconnects? → Queue operations, retry with exponential backoff.
- Payment webhook fails? → Idempotent retry with audit log entry.
```

### Import Organization
```typescript
// 1. Node.js built-ins
import crypto from 'crypto';

// 2. Third-party packages
import { z } from 'zod';
import { GoogleGenAI } from '@google/genai';
import express from 'express';

// 3. Internal modules (relative paths with .js extension for ESM)
import { parseBrief, ProposalSchema } from './briefParser.js';
import { EscrowMilestone } from './escrowStateMachine.js';
```

### LLM Integration Pattern (Standard Template)
```typescript
// 1. Define Zod schema FIRST
const OutputSchema = z.object({ /* ... */ });

// 2. Configure Gemini with native JSON schema constraint
const response = await ai.models.generateContent({
  model: 'gemini-2.5-pro',
  contents: userPrompt,
  config: {
    temperature: 0.1,  // Low for structured output
    systemInstruction: systemPrompt,
    responseMimeType: 'application/json',
    responseSchema: { /* JSON Schema matching Zod */ }
  }
});

// 3. Parse with Zod + fallback
try {
  return OutputSchema.parse(JSON.parse(response.text || ''));
} catch (error) {
  console.error('LLM parse failed, applying fallback:', error);
  return sanitizeAndPatch(response);
}
```

### Git Commit Messages
```
feat(skills): add brief parser schema validation
fix(escrow): prevent double-release in concurrent transitions
refactor(sync): extract vector clock logic into utility
docs(specs): update AI-002 confidence grid specification
test(grid): add edge case for sub-75 confidence self-correction
```

---

## Feature Implementation Workflow

When implementing ANY new feature, ALWAYS trace through:

```
UVP (Product Strategy)
  ↓ maps to
API Endpoint (Architecture Specs)
  ↓ implements via
Core Subsystem (Skills module in backend/src/skills/)
  ↓ operates on
Data Model (Database Design / Zod Schema)
```

1. Check `/docs/specifications/` for existing design docs FIRST.
2. Define Zod schemas before writing implementation.
3. Route through appropriate skill modules — don't bypass FSM or validation.
4. Update relevant specification docs when changing architecture.
5. Add tests to `backend/src/test/` for all new features.

---

## Directory Awareness

```
backend/src/skills/   → 9 core backend modules (briefParser, confidenceGrid, escrowStateMachine, etc.)
frontend/src/skills/  → 1 frontend module (optimisticSync)
frontend/src/sections/ → 9 dashboard tab UI panels
frontend/src/store/    → Zustand global state controllers
frontend/src/components/ → Reusable glassmorphic UI components
docs/specifications/   → All architecture, AI feature, and strategy specs
```

---

## Quality Gates

Before any code is considered complete:
- [ ] Zod schema defined and tested
- [ ] Fallback/sanitization path implemented
- [ ] FSM transitions validated (if applicable)
- [ ] Audit trail generated (if state-changing)
- [ ] TypeScript strict mode passes
- [ ] Specification docs updated (if architectural change)
