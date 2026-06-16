# FixFlowAI Platform Brief for LLM Review

## Purpose of This Document

This document is written so another LLM can quickly understand what FixFlowAI is, what functionality already exists in the codebase, how the main workflows operate, and what product gaps should be reviewed to make the platform more startup-ready.

Use this file as the high-level context document before asking an LLM to inspect the repository and propose improvements. The codebase is the source of truth; this document summarizes the current product surface and points the model toward the most important areas to evaluate.

---

## One-Line Product Definition

FixFlowAI is an AI-native proposal, delivery, and freelancer operating system that turns messy client briefs into structured technical proposals, tracks the full proposal lifecycle, supports team collaboration, exposes secure client portals, and extends into freelancer lead generation, outreach, escrow tracking, and reputation workflows.

---

## Product Positioning

FixFlowAI started as a schema-first AI proposal generator for agencies and freelancers. Its core idea is that proposal work is not just a writing task. It is a structured analysis task:

- Understand an unstructured client brief.
- Score whether the brief has enough detail.
- Extract features, risks, timelines, effort, confidence, and delivery phases.
- Generate a structured proposal that can be rendered, revised, shared, exported, and tracked.
- Learn from won/lost outcomes and previous proposal patterns.

The platform has evolved beyond "brief to proposal" into a broader operating layer for service businesses:

- Agency proposal intelligence.
- Multi-strategy proposal generation.
- Client portals and proposal analytics.
- Workspace collaboration.
- Freelancer lead discovery and outreach.
- Milestone escrow and credential/reputation concepts.

The strongest product thesis is:

> FixFlowAI is the operating system between lead intake and paid delivery for AI-era agencies and expert freelancers.

---

## Current Tech Stack

### Frontend

- React 18 with Vite.
- JavaScript/JSX.
- React Router for app routes.
- Zustand for local auth, proposal, workspace, agency brain, and theme state.
- TanStack React Query for server state.
- Tailwind CSS for styling.
- Framer Motion for transitions and UI motion.
- Three.js / React Three Fiber / Drei for landing-page visual elements.
- Lucide React for icons.
- React Hot Toast for notifications.

### Backend

- Node.js with Express 5.
- MongoDB with Mongoose.
- JWT auth with access/refresh token flow.
- bcrypt password hashing.
- GitHub OAuth support.
- Zod validation.
- Server-Sent Events for streaming generation and chat responses.
- AWS S3 for uploaded briefs and versioned proposal JSON.
- Puppeteer for PDF export.
- jsondiffpatch for proposal version comparison.
- Nodemailer for email-dependent flows.
- Helmet, CORS middleware, and rate limiting.

### AI Providers

The LLM layer is provider-aware:

- Gemini is the primary provider.
- OpenRouter, xAI, and Ollama-compatible providers are represented as fallback options.
- Provider status is exposed for the freelancer area.
- Gemini model fallback, quota cooldown, guard handling, and key failure reporting exist in the backend.

### Blockchain / Escrow

- A Solidity contract exists at `contracts/src/FixFlowEscrow.sol`.
- It currently defines escrow states, role-based arbitrator access, pausing, and key events.
- The on-chain escrow layer should be treated as early/prototype infrastructure, not a complete payment protocol yet.

---

## High-Level Application Map

### Public Routes

- `/` - Landing page.
- `/login` - User login.
- `/register` - User registration.
- `/p/:token` - Public client proposal portal.
- `/join/:token` - Workspace invite redemption.

### Authenticated Core Routes

- `/dashboard` - Proposal dashboard.
- `/new` - New proposal intake and generation.
- `/proposal/:id` - Proposal workspace.
- `/analytics` - Proposal performance analytics.
- `/agency-brain` - Agency pattern intelligence.
- `/tri/:tripId` - TriProposal comparison view.
- `/workspace` - Team workspace proposal feed.
- `/workspace/settings` - Workspace members, roles, plan, and invite settings.
- `/settings` - User profile/theme settings.
- `/help` - In-app help.

### Authenticated Freelancer OS Routes

- `/freelancer` - Freelancer operating dashboard.
- `/freelancer/onboarding` - GitHub scan/onboarding.
- `/freelancer/niches` - AI niche analysis.
- `/freelancer/leads` - AI-scored lead pipeline.
- `/freelancer/outreach` - Outreach queue and draft review.
- `/freelancer/escrows` - Escrow and invoice tracker.
- `/freelancer/identity` - DID/credential vault.
- `/freelancer/settings` - Freelancer agent toggles.

---

## Core Platform Workflows

## 1. Brief Intake and Proposal Generation

Primary route: `/new`  
Backend route: `POST /api/generate`

The user can create a proposal from pasted brief text or uploaded files. The backend hydrates the input, checks length, builds prompt context, streams the LLM output, validates the result, stores a versioned proposal, and returns stream events to the frontend.

Important implementation pieces:

- `backend/src/routes/generate.js`
- `backend/src/services/brief/briefHydrationService.js`
- `backend/src/services/llm/promptBuilder.js`
- `backend/src/services/llm/client.js`
- `backend/src/services/llm/jsonValidator.js`
- `backend/src/services/proposal/deliveryPlanService.js`
- `backend/src/services/storage/s3.js`
- `src/hooks/useStreamingProposal.js`
- `src/pages/NewProposal.jsx`
- `src/pages/ProposalResult.jsx`

Key capabilities:

- Text brief input.
- PDF/DOCX/TXT upload through signed S3 upload URLs.
- Brief hydration from S3.
- Schema-first prompt construction.
- SSE streaming.
- JSON validation and repair.
- S3 proposal version storage.
- MongoDB proposal metadata.
- Workspace-aware proposal creation.
- Strategy-aware generation for TriProposal.
- Agency Brain calibration context injection where allowed by plan.

Why this matters:

FixFlowAI does not primarily generate a long text document. It generates structured proposal data first, then renders that data into an interactive proposal workspace.

---

## 2. BriefScore Preflight

Primary route: `/new`  
Backend route: `/api/brief/*`

BriefScore evaluates the quality of the client brief before generation. It helps users understand whether the brief has enough detail to produce a reliable proposal.

Important implementation pieces:

- `backend/src/routes/briefScore.js`
- `backend/src/services/brief/briefScoreService.js`
- `backend/src/prompts/briefScorePrompt.js`
- `backend/src/schemas/briefScoreSchema.js`
- `src/hooks/useBriefScore.js`
- `src/components/briefScore/*`

Typical dimensions:

- Scope clarity.
- Timeline clarity.
- Budget clarity.
- Technical specificity.
- Stakeholder clarity.
- Success criteria.
- Missing signals.
- Improvement suggestions.

Startup-level value:

BriefScore can become the intake quality gate for serious agency workflows. It reduces garbage-in/garbage-out generation and gives users concrete ways to improve the brief before spending model tokens.

---

## 3. Proposal Workspace

Primary route: `/proposal/:id`  
Backend route: `/api/proposals/:id`

The proposal workspace is the main review and delivery surface. It loads the stored proposal JSON, renders structured sections, supports version history, exports, sharing, collaboration, and post-generation editing.

Important implementation pieces:

- `src/pages/ProposalResult.jsx`
- `src/components/proposal/*`
- `src/components/proposalChat/*`
- `src/components/comments/*`
- `src/components/winloss/*`
- `backend/src/routes/proposals.js`
- `backend/src/routes/proposalChat.js`
- `backend/src/routes/proposalComments.js`
- `backend/src/routes/proposalPlanning.js`
- `backend/src/routes/proposalPresence.js`

Key capabilities:

- Structured proposal rendering.
- Confidence and risk cards.
- Effort and ETA cards.
- Delivery plan section.
- Revision history.
- Version comparison using JSON diffs.
- PDF, Markdown, and JSON export.
- Section-level comments.
- Approval badges.
- Presence tracking.
- Deal status management.
- Won/lost outcome generation.
- Chat-based proposal Q&A and mutation.

---

## 4. Confidence Grid and Structured Proposal Intelligence

The Confidence Grid is one of the platform's signature product ideas. Instead of showing AI output as a black-box document, FixFlowAI exposes confidence, complexity, risk, and effort signals inside the proposal UI.

Frontend pieces:

- `src/components/proposal/ConfidenceCard.jsx`
- `src/components/proposal/ConfidenceBar.jsx`
- `src/components/proposal/RiskCard.jsx`
- `src/components/proposal/EffortCard.jsx`
- `src/components/proposal/DeliveryPlanSection.jsx`

Core idea:

- Every generated recommendation should be reviewable.
- Users should see which parts of the AI output are high-confidence and which need human validation.
- Confidence data should guide review effort, pricing discussion, and client clarification.

Startup-level opportunity:

This can become a defensible product feature if the scoring becomes measurable over time:

- Compare initial confidence against won/lost outcomes.
- Track which feature categories cause scope creep.
- Use historical delivery results to calibrate estimates.
- Build agency-specific estimation memory.

---

## 5. Proposal Chat, Negotiation, and Section Mutation

Primary backend route: `POST /api/proposal/:id/chat`

The proposal chat supports two modes:

- Question mode: answer user questions using the current proposal context.
- Mutation mode: modify a targeted proposal section, validate the updated section, merge it into the proposal JSON, and persist a new version.

Important implementation pieces:

- `backend/src/routes/proposalChat.js`
- `backend/src/services/proposal/proposalChatService.js`
- `backend/src/services/proposal/intentClassifier.js`
- `backend/src/services/proposal/sectionMutator.js`
- `backend/src/schemas/sectionSchemas.js`
- `src/hooks/useProposalChat.js`
- `src/hooks/useIntentClassifier.js`
- `src/components/proposalChat/*`

Key capabilities:

- SSE chat response streaming.
- Intent classification for question vs. mutation.
- Target section detection.
- Role checks for mutation permissions.
- JSON-mode generation for section updates.
- Section schema validation.
- Automatic merge into current proposal JSON.
- Version bump after successful mutation.

Startup-level value:

This is where FixFlowAI becomes more than a generator. It becomes an AI-assisted negotiation and revision workspace.

---

## 6. Proposal Versioning, Export, and Diff

Backend route group: `/api/proposals`

Important implementation pieces:

- `backend/src/routes/proposals.js`
- `backend/src/services/proposal/proposalAccess.js`
- `backend/src/services/storage/s3.js`
- `backend/src/services/export/pdfExport.js`
- `backend/src/services/export/formatters.js`

Key capabilities:

- Proposal versions are stored as JSON snapshots.
- Latest version is tracked in MongoDB metadata.
- S3 path pattern is used for versioned output blobs.
- Users can list versions.
- Users can compare versions through jsondiffpatch.
- Users can export PDF, Markdown, or JSON.
- Deleting a proposal removes stored versions.

Startup-level value:

Versioning turns AI generation into a professional document workflow. Agencies need auditability, change tracking, and reliable handoff artifacts.

---

## 7. Client Portal

Public route: `/p/:token`  
Backend routes:

- `POST /api/proposals/:id/portal`
- `GET /api/proposals/:id/portal`
- `GET /api/portal/:token`
- `POST /api/portal/:token/verify`
- `POST /api/portal/:token/event`
- `POST /api/portal/:token/feedback`

Important implementation pieces:

- `src/pages/ProposalPortal.jsx`
- `src/components/portal/*`
- `backend/src/routes/portals.js`
- `backend/src/routes/publicPortal.js`
- `backend/src/services/portal/portalService.js`

Key capabilities:

- Tokenized public proposal links.
- Optional PIN protection.
- Expiry controls.
- Public metadata fetch.
- Portal access verification.
- Client interaction event tracking.
- Client feedback submission.
- Bundle portals for TriProposal.

Startup-level value:

The portal turns proposals from static files into measurable sales assets. This enables client engagement tracking, follow-up signals, and better sales operations.

---

## 8. TriProposal Multi-Strategy Generation

Primary route: `/tri/:tripId`  
Backend route group: `/api/trips`

TriProposal creates and compares multiple proposal strategies, usually lean, standard, and premium. Each strategy is stored as a normal proposal but grouped under a trip.

Important implementation pieces:

- `src/pages/TriProposal.jsx`
- `src/hooks/useTriGeneration.js`
- `src/components/triproposal/*`
- `backend/src/routes/trips.js`
- `backend/src/services/trips/tripService.js`
- Strategy support inside `backend/src/routes/generate.js`

Key capabilities:

- Parallel strategy generation orchestration.
- Strategy labels and comparison UI.
- Proposal status tracking per strategy.
- Bundle portal sharing for selected strategy proposals.
- Capability gating by plan/workspace.

Startup-level value:

This can become a strong sales feature. Agencies often need multiple scope options for the same client. FixFlowAI can turn one brief into pricing and delivery tiers.

---

## 9. Agency Brain

Primary route: `/agency-brain`  
Backend route group: `/api/agency-brain`

Agency Brain extracts reusable intelligence from proposal history and outcomes. It is meant to help teams improve estimation, pricing, feature recommendations, and risk handling over time.

Important implementation pieces:

- `src/pages/AgencyBrain.jsx`
- `src/stores/agencyBrainStore.js`
- `src/components/agencyBrain/*`
- `backend/src/routes/agencyBrain.js`
- `backend/src/services/agencyBrain/agencyBrainService.js`
- `backend/src/services/agencyBrain/briefSignalService.js`
- `backend/src/utils/patternExtractors/*`

Pattern extractors include:

- Confidence threshold analysis.
- Feature count correlation.
- Industry classification.
- Effort calibration delta.
- Tech stack win-rate analysis.

Startup-level value:

Agency Brain is the path toward compounding product defensibility. Generic proposal tools can write documents. FixFlowAI can learn what wins for a specific agency.

---

## 10. Analytics and Win/Loss Learning

Primary route: `/analytics`  
Backend route group: `/api/analytics`

The analytics surface summarizes proposal outcomes and compares generated signals against business results.

Important implementation pieces:

- `src/pages/Analytics.jsx`
- `src/components/analytics/*`
- `src/components/winloss/*`
- `backend/src/routes/analytics.js`
- `backend/src/services/analytics/analyticsService.js`
- `backend/src/services/proposal/outcomeService.js`
- `backend/src/prompts/wonOutcomePrompt.js`
- `backend/src/prompts/lostOutcomePrompt.js`

Key capabilities:

- Win-rate visualization.
- Feature leaderboard.
- Confidence comparisons.
- Won/lost status tracking.
- AI-generated won/lost outcome packs.
- Outcome email sending where SMTP is configured.

Startup-level opportunity:

The analytics layer should eventually connect proposal content to revenue outcomes, close rates, margin, and delivery risk.

---

## 11. Workspace Collaboration

Primary routes:

- `/workspace`
- `/workspace/settings`
- `/join/:token`

Backend route group: `/api/workspaces`

Important implementation pieces:

- `src/pages/Workspace.jsx`
- `src/pages/WorkspaceSettings.jsx`
- `src/pages/JoinWorkspace.jsx`
- `src/components/workspace/*`
- `src/hooks/useWorkspace.js`
- `src/hooks/usePresence.js`
- `backend/src/routes/workspaces.js`
- `backend/src/services/workspace/workspaceService.js`
- `backend/src/routes/proposalComments.js`
- `backend/src/routes/proposalPresence.js`

Key capabilities:

- Workspace creation and current workspace retrieval.
- Workspace invite creation and redemption.
- Member list.
- Role definitions and permissions.
- Member role assignment.
- Member removal.
- Workspace proposal listing.
- Proposal assignment.
- Comments and approvals.
- Presence heartbeat/polling.
- Workspace notifications.
- Slack integration card and backend Slack route support.

Startup-level value:

Workspaces move FixFlowAI from a solo utility to a team product. This is necessary for agency subscriptions and multi-seat revenue.

---

## 12. Notification Center

Backend route group: `/api/notifications`

Important implementation pieces:

- `src/components/notifications/NotificationCenter.jsx`
- `src/hooks/useNotifications.js`
- `src/lib/notificationPreferences.js`
- `backend/src/routes/notifications.js`
- `backend/src/services/notifications/*`
- `backend/src/models/Notification.js`

Key capabilities:

- Personal and workspace-scoped notifications.
- Notification preference normalization.
- Mark read / mark all read flows.
- Lifecycle notifications from proposal, workspace, freelancer, and escrow actions.

Startup-level value:

Notifications are important for turning workflows into a daily-use product. The next step is making them reliable across email, Slack, and in-app channels.

---

## 13. Slack Integration

Backend route group: `/api/integrations/slack`

Important implementation pieces:

- `src/components/workspace/SlackIntegrationCard.jsx`
- `backend/src/routes/slackIntegration.js`
- `backend/src/services/integrations/slackService.js`
- `backend/src/services/integrations/secretCrypto.js`

Key capabilities:

- Slack integration route support.
- Encrypted webhook storage patterns.
- Workspace lifecycle/event posting support.

Startup-level opportunity:

Slack can become a major distribution and retention path for agency teams if proposal events, review requests, and client engagement alerts are pushed into existing work channels.

---

## 14. Freelancer OS

Primary route group: `/freelancer/*`  
Backend route group: `/api/freelancer`

The Freelancer OS is a second major product surface. It helps an individual freelancer move from identity and niche discovery to leads, outreach, escrow, invoices, and reputation.

Important implementation pieces:

- `src/pages/freelancer/*`
- `src/hooks/useFreelancer.js`
- `src/components/freelancer/FreelancerPrimitives.jsx`
- `backend/src/routes/freelancer.js`
- `backend/src/services/freelancer/freelancerService.js`
- `backend/src/services/freelancer/opportunityDiscoveryService.js`
- `backend/src/services/freelancer/profileMatchService.js`
- `backend/src/models/FreelancerProfile.js`
- `backend/src/models/Niche.js`
- `backend/src/models/Lead.js`
- `backend/src/models/Escrow.js`
- `backend/src/models/Invoice.js`
- `backend/src/models/Credential.js`

Key capabilities:

- FlowBoard dashboard with niche, lead, escrow, reputation, and agent metrics.
- GitHub scan snapshot.
- Niche analysis.
- Niche acceptance.
- Profile generation and editing.
- Lead list and Kanban-style pipeline.
- Opportunity discovery through configurable search providers.
- Client project matching against profile/niche evidence.
- Outreach draft generation.
- 150-word outreach validation.
- Personalization token extraction.
- Lead send blocking when score is below threshold.
- Escrow milestone release/dispute actions.
- Invoice listing.
- Credential minting.
- Agent configuration toggles.

Important status note:

Some Freelancer OS data is seeded/demo-backed by `buildDemoSeed`. This is useful for product demonstration, but the LLM reviewing this codebase should separate demo-ready UI from production-grade automation.

Startup-level value:

This product surface expands FixFlowAI from "proposal generator" to "freelancer business OS." It should be evaluated carefully for focus: it is powerful, but it may be too broad unless positioned as a separate module or product tier.

---

## 15. Escrow and Credential Layer

Frontend routes:

- `/freelancer/escrows`
- `/freelancer/identity`

Backend routes:

- `/api/freelancer/escrows`
- `/api/freelancer/credentials`
- `/api/escrows`

Contract:

- `contracts/src/FixFlowEscrow.sol`

Current capabilities:

- Escrow records in MongoDB.
- Milestone statuses.
- Release and dispute actions in backend.
- Invoice records.
- DID-style profile identifiers.
- Credential records with proof strings.
- Basic Solidity contract skeleton with access control, pausing, states, and events.

Startup-level caution:

The escrow and credential system should not be described as production-ready Web3 infrastructure yet. It needs a complete contract implementation, tests, deployment scripts, wallet flows, chain event ingestion, security review, and legal/payment compliance review before real-money use.

---

## Data Model Summary

The major backend models include:

- User.
- Proposal.
- Portal.
- Workspace.
- Trip.
- AgencyPattern.
- ProposalPresence.
- Notification.
- FreelancerProfile.
- Niche.
- Lead.
- Escrow.
- Invoice.
- Credential.

Data is split between:

- MongoDB for metadata, user/workspace state, workflow state, portal tracking, and dashboard queries.
- S3 for uploaded brief files and versioned proposal JSON snapshots.

---

## Core Backend API Surface

### Auth

- `/api/auth/*`
- Email/password auth.
- JWT access/refresh flow.
- GitHub OAuth.
- Password reset/OTP support where email is configured.

### Proposal Intelligence

- `/api/brief/*`
- `/api/generate`
- `/api/proposals/*`
- `/api/proposal/:id/chat`
- `/api/eta/*`

### Sharing and Lifecycle

- `/api/proposals/:id/portal`
- `/api/portal/:token/*`
- `/api/proposals/:id/deal-status`
- `/api/proposals/:id/outcome`
- `/api/trips/*`

### Collaboration

- `/api/workspaces/*`
- `/api/proposals/:id/comments`
- `/api/proposals/:id/presence`
- `/api/notifications/*`
- `/api/integrations/slack/*`

### Freelancer OS

- `/api/freelancer/flowboard`
- `/api/freelancer/github/scan`
- `/api/freelancer/niches`
- `/api/freelancer/niches/analyze`
- `/api/freelancer/profiles`
- `/api/freelancer/leads`
- `/api/freelancer/leads/discover`
- `/api/freelancer/projects/match`
- `/api/freelancer/outreach`
- `/api/freelancer/escrows`
- `/api/freelancer/invoices`
- `/api/freelancer/credentials`
- `/api/freelancer/settings/agents`

---

## What Makes FixFlowAI Novel

### 1. Schema-First AI Instead of Text-First AI

The model output is treated as structured product data, not just prose. This makes validation, rendering, editing, diffing, analytics, and export possible.

### 2. Confidence-Aware Proposal Review

The UI exposes confidence, complexity, risk, effort, and delivery plan signals so humans can focus review effort where uncertainty is highest.

### 3. Post-Generation Workflow

The product does not stop after generation. It supports chat refinement, section mutation, versioning, export, sharing, comments, approvals, and deal outcomes.

### 4. Client Portal Telemetry

Proposal sharing is measurable. Client views, feedback, and portal access behavior can become sales follow-up signals.

### 5. Agency Memory

Agency Brain creates the foundation for learning from historical proposals and outcomes.

### 6. Multi-Strategy Selling

TriProposal supports lean, standard, and premium strategy comparison from the same brief.

### 7. Freelancer Business OS Extension

The freelancer module connects niche positioning, lead discovery, outreach, escrow, invoices, and credentials into one workflow.

---

## Current Maturity Assessment

### Strongest / Most Product-Ready Areas

- Proposal generation pipeline.
- BriefScore preflight.
- Proposal workspace.
- Proposal versioning.
- Export to PDF/Markdown/JSON.
- Client portal with PIN/expiry/event tracking.
- Proposal chat and section mutation.
- Workspace roles, invites, and collaboration.
- TriProposal flow.
- Agency Brain foundations.

### Functional but Needs Hardening

- Email-dependent workflows.
- Slack integration UX and operational reliability.
- Notification preferences and multi-channel delivery.
- ETA estimation calibration.
- Agency Brain pattern quality and explainability.
- Profile/settings persistence.
- Provider fallback observability.

### Prototype / Emerging Areas

- Freelancer OS automation.
- Live opportunity discovery quality.
- Escrow payment lifecycle.
- Credential minting and proof verification.
- Solidity escrow contract completeness.
- DID/reputation system.

---

## Key Startup-Level Gaps an LLM Should Investigate

Ask the reviewing LLM to inspect the codebase and propose practical changes in these areas.

### 1. Product Focus and Packaging

The platform currently includes agency proposal workflows and freelancer OS workflows. An LLM should evaluate whether these should be:

- One unified product.
- Two modules under the same platform.
- Two separately positioned products.
- One core MVP with future modules hidden behind flags.

### 2. Production Readiness

Review:

- Error handling consistency.
- Loading/empty/error UI states.
- Retry and recovery behavior.
- API response envelope consistency.
- Environment variable validation.
- Fake/demo data boundaries.
- Logging quality.
- Observability and alerting.

### 3. AI Reliability

Review:

- Prompt structure.
- JSON repair limits.
- Schema drift risk.
- Token limits and truncation.
- Provider fallback behavior.
- Rate limit handling.
- User-visible error messages.
- Evaluation tests for generated proposal quality.

### 4. Security and Permissions

Review:

- Workspace permission enforcement.
- Public portal access control.
- PIN storage and validation.
- Invite token security.
- Uploaded file safety.
- S3 object access boundaries.
- XSS risks in exported or rendered generated content.
- Rate limiting coverage.
- Secrets handling.

### 5. Data and Analytics Quality

Review:

- Whether analytics are based on reliable persisted events.
- Whether portal tracking is enough for sales insights.
- Whether win/loss data feeds Agency Brain correctly.
- Whether proposal confidence scores are calibrated against outcomes.
- Whether data models support future billing and teams.

### 6. Billing and Plans

Review missing startup essentials:

- Stripe subscription flow.
- Plan limits.
- Usage metering.
- Trial state.
- Upgrade prompts.
- Billing portal.
- Team seat billing.
- Model token cost tracking.

### 7. Onboarding and Activation

Review:

- New-user path after signup.
- Individual vs. team entry mode.
- First proposal creation flow.
- Demo data vs. real data transition.
- Freelancer onboarding clarity.
- Whether the product reaches value in under five minutes.

### 8. Enterprise / Agency Readiness

Review:

- Custom branding.
- White-label exports.
- Proposal templates.
- Workspace audit logs.
- Role customization completeness.
- Comment resolution workflow.
- Approval gates.
- SSO/SAML roadmap.

### 9. Freelancer OS Viability

Review:

- Whether opportunity discovery is real enough.
- Whether lead scoring has evidence.
- Whether outreach sending should integrate email/LinkedIn/Upwork APIs.
- Whether the bid threshold is understandable to users.
- Whether escrow and credentials should be hidden until production-ready.

### 10. Deployment and Operations

Review:

- Docker/ECS deployment files.
- Health checks.
- Build scripts.
- CI coverage.
- Backend test coverage.
- E2E coverage.
- Environment docs.
- Rollback strategy.

---

## Suggested Prompt for Another LLM

Use this prompt when asking another LLM to review the codebase:

```text
You are reviewing the FixFlowAI repository. First read reference/features.md, then inspect the codebase.

Your task is to identify what changes are needed to make FixFlowAI a startup-level product.

Focus on:
1. Product positioning and MVP scope.
2. Production-readiness gaps.
3. AI workflow reliability.
4. Security and permissions.
5. UX gaps across onboarding, proposal generation, portal sharing, workspace collaboration, and Freelancer OS.
6. Billing, usage limits, and plan enforcement.
7. Data model and analytics improvements.
8. Deployment, testing, and observability.

Separate your output into:
- What already works well.
- Critical blockers before launch.
- High-impact product improvements.
- Technical debt.
- Security risks.
- Suggested implementation order.
- Specific files/modules to change.

Do not give generic startup advice. Ground every recommendation in the actual codebase.
```

---

## Most Important Files for LLM Codebase Review

### Frontend Entry and Routing

- `src/App.jsx`
- `src/main.jsx`
- `src/config/api.js`
- `src/components/layout/DashboardLayout.jsx`
- `src/components/layout/Sidebar.jsx`

### Proposal Core

- `src/pages/NewProposal.jsx`
- `src/pages/ProposalResult.jsx`
- `src/hooks/useStreamingProposal.js`
- `src/hooks/useProposalChat.js`
- `src/lib/proposals.js`
- `src/components/proposal/*`
- `src/components/proposalChat/*`

### Portal and Sharing

- `src/pages/ProposalPortal.jsx`
- `src/components/portal/*`
- `backend/src/routes/portals.js`
- `backend/src/routes/publicPortal.js`
- `backend/src/services/portal/portalService.js`

### Backend Generation and AI

- `backend/src/routes/generate.js`
- `backend/src/routes/proposalChat.js`
- `backend/src/services/llm/*`
- `backend/src/prompts/*`
- `backend/src/schemas/*`

### Data and Persistence

- `backend/src/models/*`
- `backend/src/services/storage/s3.js`
- `backend/src/services/proposal/proposalAccess.js`

### Workspace and Collaboration

- `src/pages/Workspace.jsx`
- `src/pages/WorkspaceSettings.jsx`
- `backend/src/routes/workspaces.js`
- `backend/src/services/workspace/workspaceService.js`
- `backend/src/routes/proposalComments.js`
- `backend/src/routes/proposalPresence.js`

### Agency Brain and Analytics

- `src/pages/AgencyBrain.jsx`
- `src/pages/Analytics.jsx`
- `backend/src/routes/agencyBrain.js`
- `backend/src/routes/analytics.js`
- `backend/src/services/agencyBrain/*`
- `backend/src/services/analytics/*`

### Freelancer OS

- `src/pages/freelancer/*`
- `src/hooks/useFreelancer.js`
- `backend/src/routes/freelancer.js`
- `backend/src/services/freelancer/*`
- `backend/src/models/FreelancerProfile.js`
- `backend/src/models/Niche.js`
- `backend/src/models/Lead.js`
- `backend/src/models/Escrow.js`
- `backend/src/models/Invoice.js`
- `backend/src/models/Credential.js`

### Escrow Contract

- `contracts/src/FixFlowEscrow.sol`
- `contracts/test/FixFlowEscrow.spec.md`

---

## Final Product Summary

FixFlowAI is best understood as a workflow product, not a document generator.

Its core loop is:

```text
Client brief
  -> BriefScore
  -> schema-first AI proposal generation
  -> confidence-aware proposal workspace
  -> chat refinement and versioning
  -> export or client portal
  -> client feedback and deal status
  -> analytics and Agency Brain learning
```

Its expanded freelancer loop is:

```text
GitHub/profile evidence
  -> niche analysis
  -> lead discovery and match scoring
  -> outreach drafting
  -> lead pipeline
  -> escrow/invoice tracking
  -> credential/reputation record
```

The best next-stage product direction is to harden the agency proposal lifecycle first, then decide whether Freelancer OS remains a module, a separate product line, or a future expansion.
