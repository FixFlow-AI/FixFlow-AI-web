# FixFlowAI — Backend Connectivity Roadmap

> A detailed, process-oriented guide for connecting every frontend surface to its corresponding backend subsystem. This document explains **what** needs to happen, **why**, and **in what order** — without writing implementation code.

---

## Table of Contents

1. [Current State Analysis](#-1-current-state-analysis)
2. [Architecture Gap Map](#-2-architecture-gap-map)
3. [End-to-End Data Flow Overview](#-3-end-to-end-data-flow-overview)
4. [Phase 1 — Foundation Layer](#-phase-1--foundation-layer-weeks-12)
5. [Phase 2 — Core Intelligence Pipeline](#-phase-2--core-intelligence-pipeline-weeks-34)
6. [Phase 3 — Financial & Trust Layer](#-phase-3--financial--trust-layer-weeks-56)
7. [Phase 4 — Real-Time & Polish](#-phase-4--real-time--polish-weeks-78)
8. [API Client Architecture](#-api-client-architecture)
9. [Environment & Configuration Strategy](#-environment--configuration-strategy)
10. [Error Handling & Resilience Patterns](#-error-handling--resilience-patterns)
11. [Testing & Verification Strategy](#-testing--verification-strategy)
12. [Cross-Reference Links](#-cross-reference-links)

---

## 🔍 1. Current State Analysis

### What Exists Today

| Layer | Status | Details |
|:---|:---:|:---|
| **Frontend UI** | ✅ Built & Wired | 9 dashboard tabs, landing page, login/signup flows — fully wired with **real API data** (retaining try/catch graceful alerts) |
| **Zustand Store** | ✅ Built & Integrated | Single `useLandingStore.js` managing page routing, active user, tokens, and active proposal state |
| **Backend Skills** | ✅ Built (Python) | Core AI skills migrated to Python `ai-service`, while FSM, matching, and telemetry stay in TS |
| **API Contracts** | ✅ Fully Implemented | All REST endpoints in `erd_and_api_contracts.md` are active and handled in `index.ts` |
| **Database Schema** | ✅ Implemented (DynamoDB) | Replaced PostgreSQL/Prisma with high-performance DynamoDB repository pattern (`PERSISTENCE_PROVIDER=dynamodb`) |
| **WebSocket Sync** | ✅ Built & Integrated | Connected to client editor pages in the frontend for live coordination |
| **HTTP Server** | ✅ Fully Operational | Express server in `backend/src/index.ts` with all REST routes |
| **Database Repos** | ✅ Complete | Users, Proposals, and Milestones persist in DynamoDB repositories |
| **Redis / BullMQ** | ❌ Missing | Not yet implemented; reserved for AI-005 background crawling |
| **Auth System** | ✅ Complete | Google ID token verification and dev login are fully operational |

### The Core Integration

```
┌──────────────┐         API CALLS (Bearer Token)         ┌──────────────────┐
│              │ ───────────────────────────────────────► │   TS Backend     │
│   Frontend   │                                          │  (REST/Gateway)  │
│  (React/Vite)│ ◄─────────────────────────────────────── │                  │
└──────────────┘         Real Persistent JSON             └──────────────────┘
                                                                │      ▲
                                                  internal HTTP │      │ validated JSON
                                                                ▼      │
                                                          ┌──────────────────┐
                                                          │ Python AI Service│
                                                          │   (Stateless)    │
                                                          └──────────────────┘
```

---

## 🗺️ 2. Architecture Gap Map

The following diagram maps every frontend component to its required backend connection, highlighting what is **missing** (red) vs. **ready** (green):

```mermaid
graph LR
    classDef ready fill:#22c55e,stroke:#16a34a,stroke-width:2px,color:#fff
    classDef missing fill:#ef4444,stroke:#dc2626,stroke-width:2px,color:#fff
    classDef partial fill:#eab308,stroke:#ca8a04,stroke-width:2px,color:#000

    subgraph Frontend Components
        Login["Login.jsx"]:::ready
        Signup["Signup.jsx"]:::ready
        Brief["BriefIntelligence.jsx"]:::ready
        Proposal["ProposalGenerator.jsx"]:::ready
        Confidence["EvidenceConfidence.jsx"]:::ready
        Agreement["AgreementComposer.jsx"]:::ready
        Milestone["MilestoneFunds.jsx"]:::ready
        Delivery["DeliveryControl.jsx"]:::ready
        Outcome["OutcomeEvidence.jsx"]:::ready
        Overview["Overview.jsx"]:::ready
        Onboard["RoleOnboarding.jsx"]:::ready
    end

    subgraph Infrastructure
        AuthAPI["Auth API Routes"]:::ready
        DynamoDB["DynamoDB Persistence"]:::ready
        RedisLayer["Redis + BullMQ (AI-005)"]:::missing
        S3Store["S3 File Storage"]:::ready
    end

    subgraph Backend Skills & Services
        BriefParser["brief_parser.py (Python)"]:::ready
        ConfGrid["confidence_grid.py (Python)"]:::ready
        EscrowFSM["escrowStateMachine.ts (TS)"]:::ready
        SyncSrv["syncServer.ts (TS)"]:::ready
        EarnCalc["earningsCalculator.js (TS)"]:::ready
        RepCalc["reputationCalculator.js (TS)"]:::ready
        ClientScore["clientScoring.js (TS)"]:::ready
        Interview["interview.py (Python)"]:::ready
        CtxExt["extensions.py (Python)"]:::ready
    end

    Login -->|"POST /api/auth/google"| AuthAPI
    Signup -->|"POST /api/auth/dev-login"| AuthAPI
    Brief -->|"POST /api/proposals/parse"| BriefParser
    Proposal -->|"GET /api/proposals/:id"| DynamoDB
    Confidence -->|"Auditor + Feasibility agents"| ConfGrid
    Agreement -->|"POST /api/escrow/milestones"| EscrowFSM
    Milestone -->|"POST /api/escrow/milestones/:id/transition"| EscrowFSM
    Milestone -->|"Fee calculation"| EarnCalc
    Delivery -->|"WebSocket /sync"| SyncSrv
    Outcome -->|"Reputation metrics"| RepCalc
    Onboard -->|"GitHub connector"| DynamoDB
    Overview -->|"Client scores"| ClientScore
```

---

## 🔄 3. End-to-End Data Flow Overview

This sequence diagram traces a complete user journey from login through milestone payout, showing every system boundary crossing:

```mermaid
sequenceDiagram
    autonumber
    actor User as Frontend User
    participant FE as React App (Zustand)
    participant API as Express API Server
    participant Redis as Redis Cache
    participant DB as PostgreSQL (Prisma)
    participant Gemini as Google Gemini API
    participant WS as WebSocket Sync Server
    participant Pay as Razorpay / Polygon

    rect rgb(59, 130, 246, 0.1)
        Note over User, DB: Phase 1 — Authentication
        User->>FE: Enter email + password
        FE->>API: POST /api/auth/login
        API->>Redis: Check rate limit (sliding window)
        API->>DB: Verify credentials (bcrypt compare)
        DB-->>API: User record
        API->>Redis: Store session metadata
        API-->>FE: Set httpOnly cookies + CSRF token
        FE->>FE: Zustand login() → redirect to dashboard
    end

    rect rgb(234, 179, 8, 0.1)
        Note over User, Gemini: Phase 2 — Brief Parsing & Proposal
        User->>FE: Paste client brief text
        FE->>API: POST /api/proposals { brief, workspaceId }
        API->>Gemini: parseBrief(briefText) → structured JSON
        Gemini-->>API: Proposal object (Zod-validated)
        API->>DB: INSERT Proposal record
        API-->>FE: SSE stream chunks → proposal_done event
        FE->>FE: setGeneratedProposal() + render cards
    end

    rect rgb(168, 85, 247, 0.1)
        Note over FE, Gemini: Phase 2b — Confidence Grid
        FE->>API: POST /api/proposals/:id/evaluate
        API->>Gemini: runAuditorAgent() ‖ runFeasibilityAgent()
        Gemini-->>API: AuditorEvaluation + FeasibilityEvaluation
        API->>API: Calculate confidenceIndex (mean of 4 scores)
        alt confidenceIndex < 75
            API->>Gemini: optimizeProposal(issues)
            Gemini-->>API: Revised Proposal
        end
        API->>DB: UPDATE Proposal (briefScore, versionCount)
        API-->>FE: Evaluation results JSON
    end

    rect rgb(34, 197, 94, 0.1)
        Note over User, Pay: Phase 3 — Escrow & Payments
        User->>FE: Accept proposal → create escrow
        FE->>API: POST /api/escrows { leadId, milestones }
        API->>API: calculateEarningsBreakdown()
        API->>Pay: Create Virtual Account (Razorpay)
        Pay-->>API: Payment coordinates
        API->>DB: INSERT Escrow record
        API-->>FE: Escrow created + fee breakdown
        
        Note over User, Pay: Milestone Approval
        User->>FE: Approve milestone completion
        FE->>API: POST /api/escrows/:id/milestones/:mid/approve
        API->>API: EscrowFSM.transitionState() + MFA verify
        API->>Pay: Trigger payout release
        API->>DB: Audit trail block + Invoice record
        API-->>FE: Milestone approved + payout status
    end

    rect rgb(100, 116, 139, 0.1)
        Note over FE, WS: Phase 4 — Real-Time Collaboration
        FE->>WS: WebSocket connect → /sync
        WS-->>FE: sync_response (initial state)
        FE->>WS: mutation { field, value, vectorClock }
        WS->>WS: Conflict resolution (LWW)
        WS-->>FE: mutation_broadcast (to other clients)
    end
```

---

## 🏗️ Phase 1 — Foundation Layer (Weeks 1–2)

> **Goal**: Stand up the HTTP server, database, authentication, and the `apiClient` utility so every subsequent phase has infrastructure to build on.

### Step 1.1 — Create the Express Entry Point

**What needs to happen**: Create `backend/src/index.ts` that initializes Express, applies middleware (cors, helmet, cookie-parser, JSON body parser), and starts listening on a configurable port.

**Why this comes first**: Without an HTTP server, no frontend request can reach any backend skill. Every other phase depends on this.

**Process**:
1. Create `backend/src/index.ts` — import Express, dotenv, and cors
2. Apply global middleware stack: CORS (restrict origin to `http://localhost:5173` in dev), JSON parser with 10MB limit, cookie-parser for httpOnly refresh tokens
3. Mount route groups under `/api/auth`, `/api/proposals`, `/api/escrows`, `/api/leads`, `/api/freelancer`, `/api/portals`
4. Add a health-check endpoint at `GET /api/health` returning `{ status: "ok", timestamp }` — the frontend Overview dashboard can poll this
5. Bind the WebSocket upgrade handler from `SyncServer` to the same HTTP server instance

**Key Decision**: Use a modular router structure (`backend/src/routes/`) rather than dumping all routes into `index.ts`. Each route file imports the corresponding skill module.

```
backend/src/
├── index.ts                  ← NEW: Express entry + middleware
├── routes/
│   ├── auth.ts               ← NEW: login, register, refresh, logout
│   ├── proposals.ts          ← NEW: create, stream, evaluate
│   ├── escrows.ts            ← NEW: create, approve milestone
│   ├── leads.ts              ← NEW: list, update status
│   ├── freelancer.ts         ← NEW: profile, github-scan
│   └── portals.ts            ← NEW: create portal, telemetry
├── middleware/
│   ├── authenticate.ts       ← NEW: JWT verification middleware
│   ├── rateLimiter.ts        ← NEW: Redis sliding window
│   └── csrfProtection.ts     ← NEW: Double-submit cookie validation
├── skills/                   ← EXISTING (no changes needed)
│   ├── briefParser.ts
│   ├── confidenceGrid.ts
│   └── ...
└── test/
```

---

### Step 1.2 — Initialize Prisma & Database Schema

**What needs to happen**: Install Prisma, define `schema.prisma` that mirrors the ERD from `erd_and_api_contracts.md`, and run the first migration.

**Process**:
1. Run `npx prisma init` inside `backend/` — this creates `prisma/schema.prisma` and `.env`
2. Translate each entity from the ERD (User, FreelancerProfile, Workspace, Lead, Proposal, Escrow, Invoice, Credential, Session) into Prisma models
3. Define relations: `User 1:1 FreelancerProfile`, `User 1:N Session`, `Workspace 1:N Proposal`, `Lead 1:1 Escrow`, etc.
4. Configure PostgreSQL connection string in `.env`: `DATABASE_URL="postgresql://user:pass@localhost:5432/fixflowai"`
5. Run `npx prisma migrate dev --name init` to generate and apply the migration
6. Generate the Prisma client: `npx prisma generate`

**Key Decision**: Use UUIDs as primary keys (matching the ERD spec) with `@default(uuid())` annotations. Store JSON columns (walletAddresses, agentConfig, githubScan) as `Json` type.

```mermaid
erDiagram
    User ||--|| FreelancerProfile : "1:1 extends"
    User ||--o{ Session : "1:N owns"
    User ||--o{ Proposal : "1:N creates"
    Lead ||--|| Escrow : "1:1 binds"
    Escrow ||--o{ Invoice : "1:N records"
    FreelancerProfile ||--o{ Credential : "1:N earns"
```

---

### Step 1.3 — Implement Authentication Routes

**What needs to happen**: Create the four auth endpoints (`register`, `login`, `refresh`, `logout`) that the frontend Login and Signup components will call instead of their current `setTimeout` mock.

**Process**:
1. **Register** (`POST /api/auth/register`):
   - Validate request body with Zod (email, password, name, role, selectedPlan)
   - Hash password with bcrypt (12 salt rounds)
   - Insert User record via Prisma
   - Generate JWT access token (15min expiry) + refresh token (7d expiry)
   - Set `ff_refresh` as httpOnly, Secure, SameSite=Strict cookie
   - Return user object + access token + CSRF token in body

2. **Login** (`POST /api/auth/login`):
   - Check Redis rate limit (5 req/min per IP)
   - Verify email exists → bcrypt.compare password
   - Generate tokens identical to Register flow
   - Store session record in DB (userId, refreshTokenHash, userAgent, IP)

3. **Refresh** (`POST /api/auth/refresh`):
   - Extract refresh token from cookie
   - Verify against stored hash in Session table
   - Rotate both tokens (old refresh invalidated)

4. **Logout** (`POST /api/auth/logout`):
   - Revoke session in DB (`revokedAt = NOW()`)
   - Clear httpOnly cookie on response

**Frontend Changes Required**:
- `Login.jsx`: Replace `setTimeout` mock with `fetch('/api/auth/login', ...)` → on success, call `login(email, role)` from response data
- `Signup.jsx`: Same pattern with `/api/auth/register`
- `useLandingStore.js`: Add `accessToken` and `csrfToken` fields to store; update `login()` to accept server response

```mermaid
sequenceDiagram
    participant FE as Login.jsx
    participant Store as useLandingStore
    participant API as /api/auth/login
    participant Redis as Rate Limiter
    participant DB as PostgreSQL

    FE->>API: POST { email, password }
    API->>Redis: ZRANGEBYSCORE (sliding window check)
    Redis-->>API: Under limit ✓
    API->>DB: SELECT User WHERE email
    DB-->>API: User record + passwordHash
    API->>API: bcrypt.compare(password, hash)
    API->>DB: INSERT Session
    API-->>FE: { user, accessToken, csrfToken } + Set-Cookie
    FE->>Store: login(user.email, user.role)
    Store-->>FE: Re-render → Dashboard
```

---

### Step 1.4 — Build the Frontend API Client

**What needs to happen**: Create a centralized `apiClient` utility in the frontend that handles base URL configuration, automatic access token injection, CSRF header attachment, token refresh on 401, and error normalization.

**Process**:
1. Create `frontend/src/services/apiClient.js`
2. Wrap the native `fetch` API with a helper that:
   - Prepends `VITE_API_BASE_URL` to every request path
   - Attaches `Authorization: Bearer <token>` from Zustand store
   - Attaches `X-CSRF-Token` header on mutating requests (POST, PATCH, DELETE)
   - Intercepts `401` responses → automatically calls `/api/auth/refresh` → retries the original request once
   - Throws normalized error objects with `status`, `message`, and `field` for form-level errors
3. Create `frontend/src/services/authService.js` — exports `loginUser()`, `registerUser()`, `refreshToken()`, `logoutUser()`

**Why a dedicated client**: Without this, every dashboard component would duplicate fetch logic, token management, and error handling. A single utility ensures consistent behavior across all 9+ dashboard tabs.

---

## 🧠 Phase 2 — Core Intelligence Pipeline (Weeks 3–4)

> **Goal**: Connect the AI-powered proposal generation pipeline from brief submission through confidence evaluation.

### Step 2.1 — Brief Parsing API Route

**What needs to happen**: Create `POST /api/proposals` route that accepts the client brief text, invokes `parseBrief()` from `briefParser.ts`, persists the proposal to PostgreSQL, and streams the result back via Server-Sent Events.

**Process**:
1. Route receives `{ workspaceId, brief, strategy }` in request body
2. Authenticate the request (JWT middleware)
3. Create a Proposal record in DB with status `"generating"`
4. Call `parseBrief(brief, apiKey)` — this hits Gemini and returns a validated `Proposal` object
5. Upload the JSON blob to S3 (or local filesystem in dev) and store the `s3Key` on the record
6. Update Proposal status to `"draft"`
7. Return the proposal ID and structured data

**SSE Streaming Alternative**:
- For the streaming UX (`GET /api/proposals/:id/stream`), the backend would send progressive `proposal_chunk` events as sections are generated
- The frontend `ProposalGenerator.jsx` replaces its `setInterval` mock with an `EventSource` listener
- On receiving the `proposal_done` event, the component calls `setGeneratedProposal(fullJSON)` and renders the cards

```mermaid
graph TD
    subgraph Frontend
        A["BriefIntelligence.jsx<br/>User pastes brief text"]
        B["ProposalGenerator.jsx<br/>Streams proposal sections"]
    end

    subgraph Backend Route
        C["POST /api/proposals<br/>Validates & persists"]
        D["GET /api/proposals/:id/stream<br/>SSE event source"]
    end

    subgraph Skill Module
        E["briefParser.ts<br/>parseBrief()"]
        F["Zod Schema Validation<br/>ProposalSchema.parse()"]
        G["sanitizeAndPatchBrief()<br/>Fallback heuristics"]
    end

    subgraph External
        H["Google Gemini API<br/>gemini-3.5-flash"]
    end

    subgraph Storage
        I["PostgreSQL<br/>Proposal table"]
        J["S3 Bucket<br/>Proposal JSON blob"]
    end

    A -->|"Submit brief"| C
    C -->|"Call skill"| E
    E -->|"LLM request"| H
    H -->|"JSON response"| F
    F -->|"Valid ✓"| C
    F -->|"Invalid ✗"| G
    G -->|"Patched output"| C
    C -->|"Save"| I
    C -->|"Upload"| J
    C -->|"Start stream"| D
    D -->|"EventSource"| B
```

---

### Step 2.2 — Confidence Grid Evaluation Route

**What needs to happen**: Create `POST /api/proposals/:id/evaluate` that runs the dual-agent evaluation (Auditor + Feasibility) and optionally triggers self-correction.

**Process**:
1. Fetch the Proposal JSON from DB/S3
2. Run `runAuditorAgent()` and `runFeasibilityAgent()` in **parallel** (Promise.all) — this is the key performance optimization
3. Compute the `confidenceIndex` as the arithmetic mean of the 4 scores
4. If `confidenceIndex < 75`, automatically call `optimizeProposal()` with the combined issues list
5. Update the Proposal record with `briefScore` (the evaluation object) and increment `versionCount` if optimized
6. Return the full `ConfidenceGridResult` to the frontend

**Frontend Changes Required**:
- `EvidenceConfidence.jsx`: Replace hardcoded score displays with actual API response data
- Add a "Re-evaluate" button that re-triggers the endpoint
- Show the optimization status ("Self-correcting… ⚡") if the threshold triggers

```mermaid
graph LR
    subgraph Parallel Execution
        A["runAuditorAgent()"] -->|"budget_alignment<br/>deliverable_coverage"| C["Merge Results"]
        B["runFeasibilityAgent()"] -->|"technical_feasibility<br/>timeline_realism"| C
    end

    C -->|"Mean of 4 scores"| D{"confidenceIndex ≥ 75?"}
    D -->|"Yes ✓"| E["Return ConfidenceGridResult<br/>optimized: false"]
    D -->|"No ✗"| F["optimizeProposal()<br/>Feed back issues"]
    F --> G["Return ConfidenceGridResult<br/>optimized: true"]
```

---

### Step 2.3 — Interview Generation Route

**What needs to happen**: Create `POST /api/interviews/generate` that takes a brief, GitHub scan data, and missing skills, then returns custom interview questions.

**Process**:
1. Accept `{ briefText, githubScan, missingSkills }` in request body
2. Call `generateInterviewQuestions()` from `interviewGenerator.ts`
3. Return the array of questions with rationales and expected keywords

**Frontend Integration Point**: This connects to the freelancer vetting flow after a lead has been matched. The `Overview.jsx` or a future "Talent Screening" tab would consume this endpoint.

---

## 💰 Phase 3 — Financial & Trust Layer (Weeks 5–6)

> **Goal**: Connect escrow creation, milestone state management, earnings calculations, and reputation scoring to real backend persistence.

### Step 3.1 — Escrow Lifecycle Routes

**What needs to happen**: Create routes for the full escrow lifecycle that bridge the frontend `MilestoneFunds.jsx` and `AgreementComposer.jsx` components to the `escrowStateMachine.ts` skill.

**Endpoints needed**:
| Method | Path | Purpose | Skill Used |
|:---|:---|:---|:---|
| `POST` | `/api/escrows` | Create escrow + milestones | `EscrowStateMachine` + `earningsCalculator` |
| `GET` | `/api/escrows/:id` | Fetch escrow details | Prisma query |
| `POST` | `/api/escrows/:id/milestones/:mid/approve` | Approve + trigger payout | `EscrowFSM.transitionState()` |
| `POST` | `/api/escrows/:id/milestones/:mid/fund` | Record deposit received | Webhook handler |
| `POST` | `/api/escrows/:id/dispute` | Raise dispute | `EscrowFSM` → `Dispute` state |

**Process for Milestone Approval**:
1. Authenticate request + verify MFA token (`X-MFA-Token` header)
2. Fetch Escrow + Milestone from DB
3. Call `EscrowStateMachine.transitionState()` with version check (optimistic concurrency)
4. If transition succeeds → trigger Razorpay payout via their Route Transfer API
5. Generate SHA-256 audit trail block and persist to DB
6. Calculate fee breakdown using `earningsCalculator.calculateEarningsBreakdown()`
7. Create Invoice record
8. Return updated milestone state + payout confirmation

**Frontend Changes Required**:
- `MilestoneFunds.jsx`: Replace `fundMilestone()` / `releaseMilestone()` Zustand actions with API calls
- `AgreementComposer.jsx`: Replace `signAgreement()` mock with escrow creation API call
- `useLandingStore.js`: Milestones state should be fetched from API on dashboard load, not hardcoded

```mermaid
stateDiagram-v2
    [*] --> Draft
    Draft --> Pending_Deposit: Client initiates escrow
    Pending_Deposit --> Active: Payment confirmed (webhook)
    Pending_Deposit --> Draft: Payment cancelled
    Active --> In_Review: Freelancer submits deliverable
    Active --> Dispute: Either party raises dispute
    In_Review --> Approved: Client approves (+ MFA)
    In_Review --> Revision_Requested: Client requests changes
    In_Review --> Dispute: Either party raises dispute
    Revision_Requested --> In_Review: Freelancer resubmits
    Revision_Requested --> Dispute: Either party raises dispute
    Approved --> Funds_Released: Payout processed
    Dispute --> Approved: Arbitrator resolves for freelancer
    Dispute --> Funds_Released: Arbitrator resolves + releases
    Dispute --> Draft: Arbitrator resets
    Dispute --> Pending_Deposit: Arbitrator resets with re-deposit
    Funds_Released --> [*]
```

---

### Step 3.2 — Earnings & Fee Display

**What needs to happen**: When creating or viewing an escrow, the frontend needs to display the full fee breakdown (platform fee, gateway fee, TDS, net earnings, client checkout total).

**Process**:
1. The `POST /api/escrows` route already calls `calculateEarningsBreakdown()` during creation
2. The response includes the `feeBreakdown` object
3. The frontend `MilestoneFunds.jsx` renders this breakdown in its "Fee Transparency" section
4. No additional route is needed — the calculation is inline during escrow creation

**The calculation chain**:
```
grossAmount = ₹24,500
    │
    ├── platformFee = grossAmount × commissionRate(plan)
    │     └── FREE: 10% │ SOLO: 5% │ PRO: 3% │ AGENCY: 2%
    │
    ├── paymentGatewayFee = (grossAmount × 2%) + ₹3
    │
    ├── withholdingTax = grossAmount × tdsRate(country)
    │     └── IN: 1% │ Others: 0%
    │
    ├── netFreelancerEarnings = gross - platform - gateway - tax
    │
    └── totalClientCheckout = gross + (gross × 1.5%)
```

---

### Step 3.3 — Reputation & SBT Minting Pipeline

**What needs to happen**: After all milestones in an escrow are released, compute the freelancer's updated reputation score and mint a Soulbound Token on Polygon.

**Process**:
1. When the final milestone transitions to `Funds_Released`, the API detects all milestones are complete
2. Fetch the freelancer's escrow history from DB
3. Call `calculateReputationMetrics(escrowHistory)` → returns composite score, on-time rate, etc.
4. Call `buildSBTMetadata(metrics, freelancerDid)` → returns ERC-721 JSON
5. Upload metadata JSON to IPFS (Pinata or similar)
6. Call the Polygon smart contract's `mint()` function via Ethers.js with the token URI
7. Store the `Credential` record in DB (tokenId, tokenUri, mintedAt)
8. Push a notification to the freelancer's dashboard

**Frontend Integration**:
- `OutcomeEvidence.jsx`: Displays reputation metrics and SBT status
- Add a "Verified Credential" badge component that links to Polygonscan

---

### Step 3.4 — Client Scoring Integration

**What needs to happen**: The `clientScoring.js` module needs to be called whenever a freelancer views a client's profile or when displaying the lead kanban board.

**Process**:
1. Create `GET /api/clients/:clientId/score` route
2. Fetch the client's milestone history from the Escrow/Invoice tables
3. Call `calculateClientScore(clientHistory)` → returns composite score + risk labels
4. Return the score data to the frontend

**Frontend Integration**:
- `Overview.jsx`: Show risk badges (`SCOPE_CREEP_RISK`, `LATE_PAYER_RISK`, `PREMIUM_CLIENT`) next to client names
- The lead kanban board can color-code cards based on client composite score

---

## ⚡ Phase 4 — Real-Time & Polish (Weeks 7–8)

> **Goal**: Activate the WebSocket collaboration layer, implement contract extensions, add Redis caching, and finalize the notification system.

### Step 4.1 — Activate WebSocket Collaboration

**What needs to happen**: Connect the existing `OptimisticSyncCoordinator` (frontend) to the `SyncServer` (backend) within the dashboard's collaborative editing views.

**Current State**: Both modules are fully built and tested independently. The gap is **integration** — no dashboard component currently instantiates the `useOptimisticSync` hook.

**Process**:
1. In the Express entry point, bind the `SyncServer` to the HTTP server's upgrade event (the `SyncServer` constructor already handles this at path `/sync`)
2. In `ProposalGenerator.jsx` or a new `CollaborativeEditor.jsx` component, call the `useOptimisticSync()` hook:
   - `wsUrl`: `ws://localhost:3001/sync` (configurable via env)
   - `proposalId`: From the URL or Zustand store
   - `clientId`: From the authenticated user ID
   - `role`: From the user's role
3. Wire the `mutate()` function to form inputs (e.g., editing a feature description triggers `mutate("features.0.description", newValue)`)
4. Display the `isConnected` status indicator in the UI (green/red dot)
5. Show presence indicators (which collaborators are currently in the room)

```mermaid
graph TD
    subgraph "Client A (Freelancer)"
        A1["useOptimisticSync() hook"]
        A2["Local Zustand State"]
        A3["UI renders immediately"]
    end

    subgraph "Server"
        S1["SyncServer<br/>Room: proposal_abc"]
        S2["Vector Clock<br/>{clientA: 3, clientB: 2}"]
        S3["Conflict Resolver<br/>(LWW fallback)"]
    end

    subgraph "Client B (Client)"
        B1["useOptimisticSync() hook"]
        B2["Local Zustand State"]
        B3["UI renders immediately"]
    end

    A1 -->|"1. mutate(field, value)"| A2
    A2 -->|"2. Instant render"| A3
    A1 -->|"3. WS: mutation msg"| S1
    S1 -->|"4. Apply + merge clocks"| S2
    S2 -->|"5. Check conflicts"| S3
    S3 -->|"6. mutation_broadcast"| B1
    B1 -->|"7. Apply remote mutation"| B2
    B2 -->|"8. Re-render"| B3
    S1 -->|"9. ack"| A1
```

---

### Step 4.2 — Contract Extensions Integration

**What needs to happen**: Connect the `contextExtensions.ts` skill to a "Suggest Extension" button in the delivery dashboard.

**Process**:
1. Create `POST /api/proposals/:id/extensions` route
2. Fetch completed deliverables from the Proposal + Escrow records
3. Accept a `chatSummary` string from the request body (or auto-generate from stored conversation)
4. Call `generateContractExtensions(completedDeliverables, chatSummary, apiKey)`
5. Return the extension reasoning, suggested milestones, and the pre-drafted offer message

**Frontend Integration**:
- `DeliveryControl.jsx`: Add a "Suggest Next Phase" button
- Display the suggested milestones in a modal with accept/modify/reject options
- If accepted, create a new Escrow with the suggested milestones

---

### Step 4.3 — Redis Caching & Background Jobs

**What needs to happen**: Add Redis for three critical functions: session caching, rate limiting, and background job processing.

**Process**:
1. Install `ioredis` and `bullmq` in the backend
2. Create a Redis connection singleton at `backend/src/lib/redis.ts`
3. **Rate Limiting**: Implement a sliding window counter using Redis ZSET for the auth and proposal endpoints
4. **Session Cache**: Cache active user sessions in Redis with TTL matching JWT expiry (15 min), avoiding DB reads on every authenticated request
5. **Background Jobs**: Create a BullMQ queue for long-running tasks:
   - GitHub profile scanning (triggered by `/api/freelancer/github-scan`)
   - Proposal generation (moves to async worker instead of blocking the HTTP response)
   - SBT minting (blockchain transactions can take 10-30 seconds)

```mermaid
graph LR
    subgraph "Request Path (Fast)"
        A["HTTP Request"] --> B["Rate Limit Check<br/>(Redis ZSET)"]
        B --> C["Session Verify<br/>(Redis Cache Hit?)"]
        C -->|"Hit"| D["Proceed to Handler"]
        C -->|"Miss"| E["DB Lookup → Cache Fill"]
        E --> D
    end

    subgraph "Background Path (Async)"
        F["Handler enqueues job"] --> G["BullMQ Queue<br/>(Redis-backed)"]
        G --> H["Worker Process"]
        H --> I["GitHub Scan / Gemini Call / Polygon Mint"]
        I --> J["Update DB + Notify via SSE"]
    end
```

---

### Step 4.4 — Notification System

**What needs to happen**: Implement in-app notifications for key events, matching the `NotificationDefaults` schema already defined in the `DeliveryPlanSchema`.

**Events to notify**:
| Event | Recipient | Trigger |
|:---|:---|:---|
| `invite` | Team member | Added to workspace |
| `comment` | Proposal participants | New comment on proposal section |
| `approval` | Freelancer | Milestone approved by client |
| `assignment` | Freelancer | New lead assigned |
| `goal_completed` | All workspace members | Delivery week goals met |
| `backlog_moved` | Project lead | Task moved to backlog |

**Process**:
1. Create a `Notification` table in Prisma (id, userId, type, title, body, read, createdAt)
2. When trigger events occur in their respective route handlers, insert a notification record
3. Create `GET /api/notifications` endpoint (paginated, filtered by read/unread)
4. Use SSE or the existing WebSocket channel to push real-time notification alerts
5. Frontend: Add a notification bell icon in the dashboard sidebar with unread count badge

---

## 🔌 API Client Architecture

The frontend needs a clean separation between UI components and data fetching. This is the recommended service layer structure:

```
frontend/src/
├── services/
│   ├── apiClient.js           ← Base fetch wrapper + auth + CSRF
│   ├── authService.js         ← login, register, refresh, logout
│   ├── proposalService.js     ← create, stream, evaluate, list
│   ├── escrowService.js       ← create, approve, fund, dispute
│   ├── leadService.js         ← list, update status
│   ├── freelancerService.js   ← profile, github scan
│   └── notificationService.js ← list, mark read
├── store/
│   ├── useLandingStore.js     ← EXISTING (landing page state)
│   ├── useAuthStore.js        ← NEW: tokens, user, session
│   ├── useProposalStore.js    ← NEW: proposals, active proposal
│   ├── useEscrowStore.js      ← NEW: escrows, milestones, fees
│   └── useNotificationStore.js← NEW: notifications, unread count
```

**Pattern**: Each service file exports async functions that call `apiClient`. Each store file uses Zustand to manage the state returned by services. Dashboard components import from stores, never from services directly.

```mermaid
graph TD
    subgraph "Component Layer"
        C1["MilestoneFunds.jsx"]
        C2["ProposalGenerator.jsx"]
        C3["Login.jsx"]
    end

    subgraph "Store Layer (Zustand)"
        S1["useEscrowStore"]
        S2["useProposalStore"]
        S3["useAuthStore"]
    end

    subgraph "Service Layer"
        SV1["escrowService.js"]
        SV2["proposalService.js"]
        SV3["authService.js"]
    end

    subgraph "Transport"
        T["apiClient.js<br/>(fetch + auth + retry)"]
    end

    subgraph "Backend"
        B["Express API Routes"]
    end

    C1 --> S1
    C2 --> S2
    C3 --> S3
    S1 --> SV1
    S2 --> SV2
    S3 --> SV3
    SV1 --> T
    SV2 --> T
    SV3 --> T
    T --> B
```

---

## ⚙️ Environment & Configuration Strategy

### Backend `.env` File

```
# Server
PORT=3001
NODE_ENV=development
CORS_ORIGIN=http://localhost:5173

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/fixflowai

# Redis
REDIS_URL=redis://localhost:6379

# Auth
JWT_ACCESS_SECRET=<random-256-bit-secret>
JWT_REFRESH_SECRET=<different-random-256-bit-secret>
JWT_ACCESS_EXPIRY=15m
JWT_REFRESH_EXPIRY=7d

# Google AI
GEMINI_API_KEY=<your-gemini-api-key>

# Payments
RAZORPAY_KEY_ID=<razorpay-key>
RAZORPAY_KEY_SECRET=<razorpay-secret>

# Web3
POLYGON_RPC_URL=https://polygon-rpc.com
POLYGON_PRIVATE_KEY=<deployer-wallet-key>
SBT_CONTRACT_ADDRESS=<deployed-contract-address>

# Storage
AWS_S3_BUCKET=fixflowai-proposals
AWS_REGION=ap-south-1
```

### Frontend `.env` File

```
VITE_API_BASE_URL=http://localhost:3001
VITE_WS_URL=ws://localhost:3001/sync
```

**Key Principle**: The frontend should **never** contain API keys or secrets. All sensitive operations route through the backend. The frontend only knows the API base URL and WebSocket URL.

---

## 🛡️ Error Handling & Resilience Patterns

### Backend Error Handling

Every route handler should follow this pattern:

1. **Validate inputs** with Zod → return `400` with field-level errors
2. **Authenticate** via JWT middleware → return `401` if expired/missing
3. **Authorize** by checking user role/ownership → return `403` if forbidden
4. **Execute business logic** (call skill module) → catch and classify errors:
   - `VersionMismatchError` from EscrowFSM → `409 Conflict`
   - `InvalidTransitionError` → `400 Bad Request`
   - `MFARequiredError` → `403 Forbidden`
   - Gemini API failures → graceful fallback (skills already implement this)
   - Database errors → `500 Internal Server Error`
5. **Return structured error** JSON: `{ error: string, code: string, details?: object }`

### Frontend Error Handling

The `apiClient` should normalize all errors into a consistent shape:

```
{
  status: 401,
  code: "TOKEN_EXPIRED",
  message: "Your session has expired. Please log in again.",
  field: null
}
```

Components should display:
- **Field-level errors** inline next to the relevant input
- **General errors** in a toast notification
- **Auth errors** should trigger redirect to login
- **Network errors** should show an offline banner with retry option

---

## 🧪 Testing & Verification Strategy

### Phase 1 Verification
- [ ] `GET /api/health` returns `200 OK`
- [ ] `POST /api/auth/register` creates User in DB, returns valid JWT
- [ ] `POST /api/auth/login` authenticates and sets cookies
- [ ] Frontend Login.jsx successfully logs in via API (no more setTimeout)
- [ ] Rate limiting blocks after 5 rapid login attempts
- [ ] Prisma migrations apply cleanly on fresh database

### Phase 2 Verification
- [ ] `POST /api/proposals` calls `parseBrief()` and persists result
- [ ] SSE stream delivers proposal chunks to frontend
- [ ] `POST /api/proposals/:id/evaluate` runs both agents in parallel
- [ ] Self-correction triggers when confidence < 75
- [ ] Frontend renders actual Gemini-generated proposal (not mock text)

### Phase 3 Verification
- [ ] `POST /api/escrows` creates escrow with fee breakdown
- [ ] Milestone state transitions follow FSM rules (no invalid transitions)
- [ ] Version mismatch throws `409 Conflict`
- [ ] MFA-required transitions fail without `X-MFA-Token`
- [ ] Frontend MilestoneFunds.jsx displays real escrow data
- [ ] Reputation metrics compute correctly from escrow history

### Phase 4 Verification
- [ ] WebSocket connect at `/sync` → `sync_response` received
- [ ] Two browser tabs can collaboratively edit a proposal in real-time
- [ ] Conflict resolution correctly applies LWW
- [ ] Contract extension suggestions generate with correct reasoning
- [ ] Notifications appear in real-time via SSE/WebSocket
- [ ] Background jobs process without blocking HTTP responses

---

## 📎 Cross-Reference Links

| Document | Path |
|:---|:---|
| System Design & Architecture | [system_design.md](../architecture/system_design.md) |
| ERD & API Contracts | [erd_and_api_contracts.md](../architecture/erd_and_api_contracts.md) |
| Database Design | [database_design.md](../architecture/database_design.md) |
| Security Architecture | [security_architecture.md](../architecture/security_architecture.md) |
| Core Skills Manual | [skills.md](../core_subsystems/skills.md) |
| Frontend Implementation Guide | [frontend_implementation_guide.md](../frontend/frontend_implementation_guide.md) |
| Frontend Roadmap | [frontend_roadmap.md](../frontend/frontend_roadmap.md) |
| Frontend Gaps & Requirements | [frontend_gaps_and_requirements.md](../frontend/frontend_gaps_and_requirements.md) |
| Extra Implementation Roadmap | [extra_implementation_roadmap.md](../core_subsystems/extra_implementation_roadmap.md) |
