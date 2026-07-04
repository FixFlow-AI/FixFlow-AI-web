# FixFlowAI - Relational Database Schema & Prisma Model Specifications

This document details the database architecture of **FixFlowAI**. It specifies the relational schema using **PostgreSQL** as the primary storage layer (with **Prisma ORM**) and **Redis** as the session, rate limiting, and job queue cache layer.

---

## 🗺️ 1. Entity-Relationship (ER) Diagram

The following diagram maps out the relational database layout for the Next-Gen PostgreSQL architecture:

```mermaid
erDiagram
    User ||--|| FreelancerProfile : "has (1:1)"
    User ||--o{ WorkspaceMember : "belongs to (1:N)"
    User ||--o{ Session : "owns (1:N)"
    User ||--o{ Proposal : "created by (1:N)"
    
    Workspace ||--o{ WorkspaceMember : "has members (1:N)"
    Workspace ||--o{ Proposal : "houses (1:N)"
    
    FreelancerProfile ||--o{ Lead : "manages (1:N)"
    FreelancerProfile ||--o{ Credential : "earns (1:N)"
    
    Lead ||--|| Escrow : "associated with (1:1)"
    
    Escrow ||--o{ Invoice : "splits into (1:N)"
    Escrow ||--o{ Credential : "proves (1:1)"
    
    Proposal ||--o{ ProposalComment : "has comments (1:N)"
```

---

## 🔗 2. Database Model Schema (schema.prisma)

This is the production-ready Prisma schema definition representing our PostgreSQL database:

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}

// ==========================================
// ENUMS
// ==========================================

enum Role {
  GUEST
  USER
  MANAGER
  ADMIN
  SUPER_ADMIN
}

enum Plan {
  FREE
  SOLO
  PRO
  AGENCY
  SCALE
  STANDARD
  ENTERPRISE
}

enum EntryMode {
  INDIVIDUAL
  TEAM
}

enum LeadStatus {
  NEW
  QUALIFIED
  CONTACTED
  REPLIED
  WON
  LOST
}

enum ProposalStatus {
  GENERATING
  READY
  FAILED
}

enum DealStatus {
  PENDING
  NEGOTIATING
  WON
  LOST
}

enum EscrowState {
  CREATED
  FUNDED
  RELEASED
  DISPUTED
}

enum InvoiceStatus {
  DRAFT
  UNPAID
  PAID
  REFUNDED
}

// ==========================================
// MODELS
// ==========================================

model User {
  id                      String            @id @default(uuid()) @db.Uuid
  email                   String            @unique
  passwordHash            String
  role                    Role              @default(USER)
  selectedPlan            Plan              @default(FREE)
  defaultEntryMode        EntryMode         @default(INDIVIDUAL)
  currentWorkspaceId      String?           @db.Uuid
  stripeCustomerId        String?           @unique
  subscriptionStatus      String            @default("none") // active, past_due, none
  tokenVersion            Int               @default(0)
  createdAt               DateTime          @default(now())
  updatedAt               DateTime          @updatedAt
  
  // Relations
  profile                 FreelancerProfile?
  sessions                Session[]
  workspaces              WorkspaceMember[]
  proposalsCreated        Proposal[]
  comments                ProposalComment[]

  @@index([email])
}

model FreelancerProfile {
  id              String       @id @db.Uuid
  did             String?      @unique
  walletAddresses Json?        // { native: string, usdc: string, matic: string }
  profiles        Json?        // Biographies/Headline feeds: { upwork: string, linkedin: string }
  agentConfig     Json         // { leadHunter: boolean, outreachWriter: boolean, escrowWatcher: boolean }
  githubScan      Json?        // { repos: array, languages: map, commits: number }
  onboardedAt     DateTime?
  createdAt       DateTime     @default(now())
  updatedAt       DateTime     @updatedAt

  // Relations
  user            User         @relation(fields: [id], references: [id], onDelete: Cascade)
  leads           Lead[]
  credentials     Credential[]
}

model Workspace {
  id                   String            @id @default(uuid()) @db.Uuid
  name                 String
  plan                 Plan              @default(FREE)
  notificationDefaults Json?             // Default notification preferences
  slack                Json?             // { connected: boolean, webhookUrl: string }
  createdAt            DateTime          @default(now())
  updatedAt            DateTime          @updatedAt

  // Relations
  members              WorkspaceMember[]
  proposals            Proposal[]
}

model WorkspaceMember {
  id          String    @id @default(uuid()) @db.Uuid
  workspaceId String    @db.Uuid
  userId      String    @db.Uuid
  role        String    @default("member")
  joinedAt    DateTime  @default(now())

  // Relations
  workspace   Workspace @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  user        User      @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([workspaceId, userId])
}

model Lead {
  id                 String            @id @default(uuid()) @db.Uuid
  userId             String            @db.Uuid
  status             LeadStatus        @default(NEW)
  score              Int               @default(0)
  source             String
  sourceUrl          String?
  projectDescription String            @db.Text
  budget             Json?             // { amount: number, rate: "fixed"|"hourly", currency: string }
  matchDetails       Json?             // { skillsMatched: string[], skillsMissing: string[], githubEvidence: string[] }
  bid                Json?             // { status: string, draftProposalId: string }
  company            Json?             // { name: string, size: number, stack: string[] }
  draftMessage       Json?             // { subject: string, body: string }
  createdAt          DateTime          @default(now())
  updatedAt          DateTime          @updatedAt

  // Relations
  freelancer         FreelancerProfile @relation(fields: [userId], references: [id], onDelete: Cascade)
  escrow             Escrow?
}

model Proposal {
  id               String            @id @default(uuid()) @db.Uuid
  s3Key            String
  projectSummary   String            @db.Text
  status           ProposalStatus    @default(GENERATING)
  strategy         String            @default("standard")
  workspaceId      String            @db.Uuid
  createdBy        String            @db.Uuid
  dealStatus       DealStatus        @default(PENDING)
  briefScore       Json?             // { scope: number, technical: number, timeline: number }
  versionCount     Int               @default(1)
  chatTimingStats  Json?             // { views: number, lastViewed: Date }
  createdAt        DateTime          @default(now())
  updatedAt        DateTime          @updatedAt

  // Relations
  workspace        Workspace         @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  creator          User              @relation(fields: [createdBy], references: [id], onDelete: Cascade)
  comments         ProposalComment[]
}

model ProposalComment {
  id         String   @id @default(uuid()) @db.Uuid
  proposalId String   @db.Uuid
  senderId   String   @db.Uuid
  section    String
  text       String   @db.Text
  createdAt  DateTime @default(now())

  // Relations
  proposal   Proposal @relation(fields: [proposalId], references: [id], onDelete: Cascade)
  sender     User     @relation(fields: [senderId], references: [id], onDelete: Cascade)
}

model Escrow {
  id                 String      @id @default(uuid()) @db.Uuid
  leadId             String      @unique @db.Uuid
  clientDid          String?
  freelancerDid      String?
  buyerAddress       String?
  sellerAddress      String?
  state              EscrowState @default(CREATED)
  totalAmount        Decimal     @db.Decimal(12, 2)
  currency           String      @default("USDC")
  milestones         Json        // [{ id: string, title: string, percentage: number, approved: boolean }]
  razorpayPaymentId  String?
  contractAddress    String?
  chain              String?     // Polygon Amoy, Polygon Mainnet
  createdAt          DateTime    @default(now())
  updatedAt          DateTime    @updatedAt

  // Relations
  lead               Lead        @relation(fields: [leadId], references: [id], onDelete: Cascade)
  invoices           Invoice[]
  credential         Credential?
}

model Credential {
  id           String            @id @default(uuid()) @db.Uuid
  freelancerId String            @db.Uuid
  escrowId     String            @unique @db.Uuid
  tokenId      String?
  tokenUri     String?
  mintedAt     DateTime          @default(now())

  // Relations
  freelancer   FreelancerProfile @relation(fields: [freelancerId], references: [id], onDelete: Cascade)
  escrow       Escrow            @relation(fields: [escrowId], references: [id], onDelete: Cascade)
}

model Invoice {
  id          String        @id @default(uuid()) @db.Uuid
  escrowId    String        @db.Uuid
  milestoneId String
  amount      Decimal       @db.Decimal(12, 2)
  status      InvoiceStatus @default(DRAFT)
  releasedAt  DateTime?

  // Relations
  escrow      Escrow        @relation(fields: [escrowId], references: [id], onDelete: Cascade)
}

model Session {
  id               String    @id @default(uuid()) @db.Uuid
  userId           String    @db.Uuid
  refreshTokenHash String
  userAgent        String
  ipAddress        String
  device           String?
  browser          String?
  country          String?
  fingerprint      String?
  expiresAt        DateTime?
  revokedAt        DateTime?
  lastUsedAt       DateTime  @default(now())
  replayDetectedAt DateTime?
  createdAt        DateTime  @default(now())
  updatedAt        DateTime  @updatedAt

  // Relations
  user             User      @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
}
```

---

## 🏎️ 3. Redis Transient Schema Reference

FixFlow AI relies on **Redis** for managing transient runtime data structures including user sessions, rate limiting, and scraper job queues.

### A. Session Store Layout
* **Key Pattern**: `session:<sessionId>`
* **Type**: Hash
* **TTL**: Dynamic (typically matches the Refresh Token lifespan, e.g., 30 days; initialized as permanent if no automatic expiry is desired).
* **Fields**:
  - `userId`: String
  - `device`: String
  - `browser`: String
  - `ipAddress`: String
  - `country`: String
  - `fingerprint`: Hex String
  - `lastActivity`: ISO String

### B. Rate Limiting sliding windows
* **Key Pattern**: `ratelimit:<action>:<identifier>` (e.g. `ratelimit:login:usr_123`, `ratelimit:api:198.51.100.42`)
* **Type**: Sorted Set (ZSET)
* **TTL**: Matches the window cooldown (e.g. 60 seconds to 10 minutes).
* **Description**: Uses a Redis transaction containing `ZADD`, `ZREMRANGEBYSCORE`, and `ZCARD` to execute high-precision rate-limiting without race conditions.

### C. BullMQ Scraper Jobs Queue
* **Key Pattern**: `bull:scraping-queue:*`
* **Type**: Hybrid (Lists, Sets, and Hashes)
* **TTL**: 7 Days (for completed job histories).
* **Description**: Handles job registration, locking, and concurrency tracking for active Apify/Tavily scraping tasks.

---

## 🧩 4. Entity Mappings for Extra Problem-Resolution Modules

The newly implemented calculation and AI generation modules map directly to the PostgreSQL Prisma schemas as follows:

### A. Transparent Earnings Engine (`earningsCalculator.js`)
*   **Prisma Mapping**: Pre-populates and validates splits in the `Escrow` (`totalAmount`) and `Invoice` (`amount`) entities.
*   **Attributes Generated**: Calculates `platformFee`, `paymentGatewayFee`, `withholdingTax`, `netFreelancerEarnings`, and `totalClientCheckout` using the `User` (`selectedPlan`) and `Escrow` base variables.

### B. Client Behavior Scoring & Risk Classifier (`clientScoring.js`)
*   **Prisma Mapping**: Reads client historical transactions from `Escrow` (completed milestones history) to compute metrics.
*   **Attributes Updated**: Flags `Lead` (`company`) with behavior metrics and assigns risk indicators (`SCOPE_CREEP_RISK`, `LATE_PAYER_RISK`, `HIGH_DISPUTE_RISK`, `PREMIUM_CLIENT`).

### C. Multi-Dimensional Reputation Engine (`reputationCalculator.js`)
*   **Prisma Mapping**: Aggregates raw transactional history from `Escrow` and `Invoice` milestones for a given freelancer.
*   **Attributes Updated**: Synthesizes reputation metrics to construct the `tokenUri` JSON schema stored in the `Credential` table representing the Polygon SBT minting metadata.

### D. Dynamic Interview Vetting Generator (`interviewGenerator.ts`)
*   **Prisma Mapping**: Reads `Lead` (`projectDescription`, `matchDetails` (`skillsMissing`)), and the `FreelancerProfile` (`githubScan`) JSON data.
*   **Attributes Generated**: Outputs technical vetting questions, rationales, and expected keywords, which are stored in the matching pipeline to screen candidates.

### E. Contextual Contract Extensions (`contextExtensions.ts`)
*   **Prisma Mapping**: Vectorizes and analyzes completed deliverables in `Escrow` and history logs to draft follow-up scopes.
*   **Attributes Generated**: Generates `suggestedMilestones` and draft proposal content used to initialize a new `Proposal` in the corresponding `Workspace`.

---

## 🧱 5. Extended Schema — Role-Based Platform (Client / Freelancer / Developer)

The three-role platform adds new entities on top of the base schema above. These are **non-breaking additions** (new models + new nullable fields); the existing Client flow is unchanged.

**Authoritative definitions:** [`../roles/04_schema_and_api_changes.md`](../roles/04_schema_and_api_changes.md)

New/changed models introduced there:

| Model / change | Purpose | Spec |
|---|---|---|
| `User.authProvider`, `githubUsername`, `githubUserId` | Support GitHub-only freelancer login | [roles/00](../roles/00_role_architecture_overview.md) |
| `GithubScanJob` | Track multi-segment deep GitHub scan progress | [roles/01](../roles/01_freelancer_github_onboarding.md) |
| `FreelancerSkill` (`editable=false`) | Tamper-proof, code-verified skills | [roles/01](../roles/01_freelancer_github_onboarding.md) |
| `FreelancerProject` | Verified top projects / work experience | [roles/01](../roles/01_freelancer_github_onboarding.md) |
| `ProfileConfidence` | Profile confidence score + band | [roles/02](../roles/02_freelancer_confidence_growth_plan.md) |
| `GrowthPlan` + `GrowthItem` | AI growth plan with timelines | [roles/02](../roles/02_freelancer_confidence_growth_plan.md) |
| `DevProject` + `DevProjectMember` + `DevTask` | Developer multi-project workspace | [roles/03](../roles/03_developer_workspace_and_projects.md) |

> Implementation note: the live code uses the repository pattern (DynamoDB/seed/in-memory), not live Prisma. Each new entity needs both a Prisma model (target) and a `*Repository.ts` mirroring `proposalRepository.ts`.
