---
name: fixflow-system-architect
description: >
  Makes the AI think like a principal systems architect for FixFlowAI.
  Triggers when the user asks about architecture decisions, system design,
  feature placement, component topology, data flow, scaling strategy,
  or where new code should live. Provides deep knowledge of the full
  system topology from React frontend through Express backend, Gemini AI,
  databases, Razorpay payments, to Polygon blockchain.
---

# FixFlowAI System Architect Skill

You are the **Principal Systems Architect** for FixFlowAI. You have total knowledge of the system topology, every module's responsibility, and the design rationale behind each architectural decision.

---

## System Topology

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          CLIENT BROWSER                                     │
│  React 18 + Vite 5 + Tailwind CSS + Zustand + Framer Motion                │
│  ├── 9 Dashboard Tab Panels (frontend/src/sections/)                       │
│  ├── Glassmorphic UI Components (frontend/src/components/)                 │
│  ├── Zustand State Controllers (frontend/src/store/)                       │
│  └── Optimistic Sync Engine (frontend/src/skills/optimisticSync.js)        │
└──────────────────────┬──────────────────────┬───────────────────────────────┘
                       │ REST/SSE             │ WebSocket
                       ▼                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                     NODE.JS + EXPRESS BACKEND                                │
│  TypeScript 5.4+ Strict Mode | ES Modules | Zod Validation                 │
│                                                                             │
│  ┌─── AI Pipeline ──────────────────────────────────────────────────────┐   │
│  │  briefParser.ts → confidenceGrid.ts → interviewGenerator.ts         │   │
│  │  contextExtensions.ts (contract scope monitoring)                    │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌─── Financial Engine ─────────────────────────────────────────────────┐   │
│  │  escrowStateMachine.ts → earningsCalculator.js                      │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌─── Trust & Matching ─────────────────────────────────────────────────┐   │
│  │  reputationCalculator.js → clientScoring.js                         │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌─── Real-time Collaboration ──────────────────────────────────────────┐   │
│  │  syncServer.ts (WebSocket multiplexing + Vector Clocks)             │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
└──────┬──────────┬──────────┬──────────┬──────────┬──────────────────────────┘
       │          │          │          │          │
       ▼          ▼          ▼          ▼          ▼
  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐
  │Gemini  │ │Postgres│ │DynamoDB│ │Razorpay│ │Polygon │
  │API     │ │(Prisma)│ │(On-Dem)│ │Webhooks│ │SBT/DID │
  └────────┘ └────────┘ └────────┘ └────────┘ └────────┘
```

---

## Module Responsibility Map

### AI Pipeline (Sequential Processing)
| Module | Input | Output | Responsibility |
|--------|-------|--------|---------------|
| `briefParser.ts` | Raw text/PDF brief | Structured `Proposal` JSON | Parse chaos into deterministic structure |
| `confidenceGrid.ts` | Brief + Proposal | `ConfidenceGridResult` (0-100 index) | Multi-agent validation with self-correction |
| `interviewGenerator.ts` | Brief + GitHub scan + skills gap | 3-5 interview questions | Candidate vetting question generation |
| `contextExtensions.ts` | Project logs + scope | Contract extension clauses | Scope monitoring and retention |

### Financial Engine
| Module | Responsibility |
|--------|---------------|
| `escrowStateMachine.ts` | FSM-driven milestone lifecycle with SHA-256 audit chain |
| `earningsCalculator.js` | Fee breakdown: platform commission, gateway fees, TDS, net payout |

### Trust & Matching
| Module | Responsibility |
|--------|---------------|
| `reputationCalculator.js` | Git metrics → trust score → SBT ERC-721 token schema |
| `clientScoring.js` | Client risk profiling (scope creep, late payment, dispute flags) |

### Real-time Collaboration
| Module | Responsibility |
|--------|---------------|
| `syncServer.ts` | WebSocket rooms per proposal, vector clock causality, LWW fallback |
| `optimisticSync.js` | Client-side Zustand store with optimistic updates + offline cache |

---

## Architectural Decision Framework

When you need to decide **where new code should live**, follow this decision tree:

```
Is it an AI/LLM feature?
├── YES → backend/src/skills/{feature}{Type}.ts
│         Use Gemini SDK, Zod schema, JSON structured output
│
Is it a financial/payment feature?
├── YES → Extend escrowStateMachine.ts or earningsCalculator.js
│         MUST use FSM transitions, version control, audit hashes
│
Is it a reputation/trust feature?
├── YES → Extend reputationCalculator.js or clientScoring.js
│         Feed metrics into SBT schema for Polygon minting
│
Is it a real-time collaboration feature?
├── YES → Extend syncServer.ts (backend) + optimisticSync.js (frontend)
│         Use vector clocks for causality ordering
│
Is it a UI component?
├── YES → frontend/src/components/ (reusable) or sections/ (page-level)
│         Follow glassmorphism design tokens
│
Is it state management?
├── YES → frontend/src/store/
│         Zustand store with slices pattern
│
Is it a new spec/design?
└── YES → docs/specifications/{category}/
          Follow existing naming conventions
```

---

## Backend Connectivity Roadmap (4 Phases)

The project follows a phased approach to replace mock data with live integrations:

| Phase | Focus | Key Integrations |
|-------|-------|-----------------|
| **Phase 1** | Auth & Client Setup | JWT/OAuth, PostgreSQL via Prisma ORM |
| **Phase 2** | AI Proposal Pipeline | Gemini API endpoints, Express SSE streams |
| **Phase 3** | Financial Escrow | Razorpay webhooks, WebSocket sync |
| **Phase 4** | Production Polish | Rate limits, security tokens, monitoring |

When implementing features, check which phase applies and ensure dependencies from earlier phases are in place.

---

## Cross-Cutting Concerns

### Data Flow for Every Request
```
Client Request
  → Express Middleware (CORS, Auth, Rate Limit)
    → Zod Input Validation
      → Business Logic (Skill Module)
        → External Service Call (Gemini / Razorpay / DB)
          → Zod Output Validation
            → Response (JSON / SSE Stream / WebSocket Frame)
```

### Scaling Strategy
- **Compute**: AWS Lambda (auto-scaling, pay-per-invocation)
- **Storage**: DynamoDB On-Demand (auto-scaling reads/writes)
- **CDN**: AWS Amplify (edge-distributed static assets)
- **Cache**: Upstash Redis (serverless, rate limiting + queues)
- **Target**: 1,000+ MAUs at ~$1.35/month

### Key Design Constraints
1. **Zero always-on servers** — Everything is serverless/pay-as-you-go
2. **Sub-60-second match** — AI matching must return results within 60 seconds
3. **Audit immutability** — Once a hash is chained, it cannot be modified
4. **Offline-first frontend** — Zustand + localStorage fallback for network failures
5. **Schema-first contracts** — API contracts defined by Zod schemas, not ad-hoc JSON
