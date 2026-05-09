# FixFlowAI — Implementation Roadmap
> Grounded in actual codebase structure. Every task references real files, routes, and services.  
> Generated from the 10X Master Plan strategic analysis.

---

## How to Use This Document

- Tasks are **ordered by dependency** — complete them top-to-bottom within each phase.
- Every task includes the **exact files to create or modify**.
- `[BLOCKER]` = must be done before anything else in that phase.
- `[HIGH]` = major leverage or moat-building.
- `[MED]` = meaningful but not critical path.
- `[LOW]` = polish / nice-to-have.

---

## Table of Contents

1. [Phase 1 — Revenue Gate (Weeks 1–12)](#phase-1--revenue-gate-weeks-112)
2. [Phase 2 — Moat Building (Months 3–9)](#phase-2--moat-building-months-39)
3. [Phase 3 — Category Creation (Months 9–18)](#phase-3--category-creation-months-918)
4. [Ongoing / Cross-Cutting](#ongoing--cross-cutting)
5. [Tech Debt to Clear Before Phase 2](#tech-debt-to-clear-before-phase-2)

---

## Phase 1 — Revenue Gate (Weeks 1–12)

> **Goal:** Turn the product into a business. Ship billing, fix production gaps, close the first feedback loops.

---

### 1.1 Stripe Billing & Subscription Lifecycle `[BLOCKER]`

**Why first:** Plan-gated routing already exists. The feature wall is built. Revenue is the only missing piece.

#### Backend

**New files:**
- `backend/src/routes/billing.js` — Stripe webhook handler + subscription management routes
- `backend/src/services/billing/stripeService.js` — checkout session creation, portal session, subscription status sync
- `backend/src/services/billing/planEnforcer.js` — reads `user.subscription` and enforces proposal count, seat count, feature flags
- `backend/src/models/Subscription.js` — Mongoose schema: `userId`, `stripeCustomerId`, `stripePriceId`, `plan` (free/pro/agency), `status`, `currentPeriodEnd`, `seats`, `usageThisMonth`

**Modify:**
- `backend/src/models/User.js` — add `stripeCustomerId`, `plan`, `subscriptionStatus`, `proposalsThisMonth`, `resetDate` fields
- `backend/src/config/env.js` — add `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRO_PRICE_ID`, `STRIPE_AGENCY_PRICE_ID` to validation
- `backend/src/index.js` — register `/api/billing` routes; add raw body parser for Stripe webhook route before JSON middleware

**Webhook events to handle in `stripeService.js`:**
- `checkout.session.completed` → activate subscription, set `user.plan`
- `customer.subscription.updated` → sync plan changes and seat count
- `customer.subscription.deleted` → downgrade to free, enforce limits
- `invoice.payment_failed` → flag account, send warning email via Nodemailer
- `invoice.payment_succeeded` → reset `proposalsThisMonth`, log billing event

#### Frontend

**New files:**
- `src/pages/Billing.jsx` — subscription management page
- `src/components/billing/PlanCard.jsx` — current plan display with usage meters
- `src/components/billing/UpgradeModal.jsx` — plan comparison + Stripe checkout redirect
- `src/components/billing/UsageMeter.jsx` — proposals used / limit bar
- `src/lib/billing.js` — API helper functions for billing routes

**Modify:**
- `src/App.jsx` — add `/billing` protected route
- `src/components/layout/Sidebar.jsx` — add Billing link + usage indicator pill in sidebar footer
- `src/stores/authStore.js` (or equivalent) — store `plan`, `proposalsThisMonth`, `proposalLimit` in auth state
- `src/components/dashboard/` — surface upgrade prompts when user is near proposal limit
- Every gated feature component — replace hardcoded plan-check logic with `planEnforcer` response from the backend, not client-side guessing

#### Environment variables to add:
```
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_PRO_PRICE_ID=
STRIPE_AGENCY_PRICE_ID=
STRIPE_SOLO_PRICE_ID=
FRONTEND_URL=https://your-amplify-url
```

#### Success criteria:
- [ ] User can upgrade from free → pro via Stripe Checkout
- [ ] Webhook correctly updates `user.plan` in MongoDB
- [ ] Free users are blocked at 5 proposals with a visible upgrade prompt
- [ ] Billing page shows current plan, usage, and manage subscription button (Stripe Portal)
- [ ] `npm --prefix backend test` passes with billing service unit tests

---

### 1.2 SMTP Hardening & Email Reliability `[BLOCKER]`

**Why:** Outcome emails, OTP reset, and invitation flows are partially broken in non-SMTP environments. These are retention and trust signals.

#### Backend

**Modify:**
- `backend/src/services/email/` (create if it doesn't exist as a directory) — centralize all Nodemailer logic into a single `emailService.js` with:
  - `sendOtpEmail(to, otp)` 
  - `sendOutcomeEmail(to, proposalTitle, outcome, summaryHtml)`
  - `sendInviteEmail(to, workspaceName, inviteUrl)`
  - `sendFollowUpAlert(to, proposalTitle, daysSinceLastView)`
  - `sendWeeklyIntelligenceDigest(to, digestData)` ← hook for Phase 2
- Each function must check `process.env.SMTP_HOST` existence before attempting to send and log a warning (not throw) if unconfigured
- `backend/src/config/env.js` — make SMTP vars optional but validate format if present; add `EMAIL_FROM_ADDRESS`, `EMAIL_FROM_NAME`
- `backend/src/routes/auth.js` — OTP reset should return a clear error message when SMTP is unavailable, not a 500
- `backend/src/services/proposal/outcomeService.js` — wrap email send in try/catch; outcome pack should save to DB even if email fails
- `backend/src/routes/workspaces.js` — invite email send should be non-blocking; return invite URL in response even when email is down

#### Frontend

**Modify:**
- `src/pages/` (auth pages) — surface helpful error message "Email not configured — contact your workspace admin" instead of generic error when SMTP is down
- `src/components/workspace/` — show generated invite URL in a copy-to-clipboard input as fallback when email delivery is unavailable

#### Test:
- Add a unit test: `backend/test/emailService.test.js` — stub Nodemailer transport, assert correct template data passed

#### Success criteria:
- [ ] OTP flow works when SMTP is configured
- [ ] OTP flow returns a clear error (not 500) when SMTP is not configured
- [ ] Outcome emails send on deal won/lost with correct HTML
- [ ] Invite emails send; invite URL also returned in API response as fallback
- [ ] No uncaught SMTP exceptions crash the backend

---

### 1.3 Profile & Settings Persistence `[HIGH]`

**Why:** `user.plan`, theme preference, notification preferences, and profile data currently live in local store only. This causes data loss on logout and breaks billing enforcement.

#### Backend

**New files:**
- `backend/src/routes/users.js` — `GET /api/users/me`, `PATCH /api/users/me`
- `backend/src/services/users/userService.js` — fetch and update user profile fields

**Modify:**
- `backend/src/models/User.js` — add `displayName`, `avatarUrl`, `timezone`, `notificationPreferences` (object), `theme` fields
- `backend/src/index.js` — register `/api/users` routes

#### Frontend

**Modify:**
- `src/pages/Settings.jsx` (or create if separate) — wire form submit to `PATCH /api/users/me` instead of local store only
- `src/stores/authStore.js` — on login and app init, call `GET /api/users/me` and hydrate store from server response
- `src/config/api.js` — add `getMe()` and `updateMe(data)` helper functions
- `src/lib/notificationPreferences.js` — fetch preferences from server on load, not just from localStorage

#### Success criteria:
- [ ] User profile survives logout/login cycle
- [ ] Theme preference persists across devices
- [ ] Notification preferences saved to DB and respected by email/Slack services

---

### 1.4 Proposal Evaluation Harness (Start accumulating calibration data) `[HIGH]`

**Why:** Without logged eval data, you cannot prove Agency Brain is improving. This is the seed of your prediction engine. Start it now — even a basic rubric is valuable.

#### Backend

**New files:**
- `backend/src/services/eval/proposalEvalService.js` — after every successful generation, score the proposal against a rubric:
  - `completenessScore` — all required sections present and non-empty?
  - `confidenceDistribution` — mean/std of confidence scores across features
  - `riskCoverage` — number of risk items identified
  - `effortSpecificity` — effort estimates present with unit types
  - `deliveryPlanQuality` — phases > 1, milestones present?
  - `briefToProposalAlignment` — simple keyword overlap score between brief and generated features
- `backend/src/models/ProposalEval.js` — Mongoose schema: `proposalId`, `userId`, `workspaceId`, `generatedAt`, `modelUsed`, `briefScoreAtGeneration`, `evalScores` (object), `totalEvalScore`, `briefLength`, `generationTimeMs`

**Modify:**
- `backend/src/routes/generate.js` — after successful persist, call `proposalEvalService.evaluate(proposal)` asynchronously (do not await in the request path — use `setImmediate` or a background queue pattern)
- `backend/src/routes/analytics.js` — add `GET /api/analytics/eval-trends` endpoint returning average eval scores over time per workspace

#### Frontend

**Modify:**
- `src/pages/Analytics.jsx` — add an "AI Quality Trends" section showing proposal eval score averages over time (simple line chart, no additional library needed since you likely already have charting)

#### Success criteria:
- [ ] Every generated proposal produces a `ProposalEval` document in MongoDB
- [ ] Eval scoring does not block or slow the generation response
- [ ] Analytics page shows eval trend line for the workspace
- [ ] At least 20 eval records exist before Phase 2 begins (you need data to calibrate)

---

### 1.5 Deal Room v0 — Client-Side Interaction in Portal `[HIGH]`

**Why:** Transforming the portal from read-only to interactive is your bilateral growth engine. v0 is minimal — no e-sign yet, just annotations and tier selection.

#### Backend

**New files:**
- `backend/src/routes/dealRoom.js` — new route group `/api/portal/:token/deal-room`:
  - `POST /annotations` — client submits a section annotation (section name, comment text, type: `question | concern | approval`)
  - `GET /annotations` — agency sees all client annotations
  - `POST /tier-select` — client selects a TriProposal strategy tier (lean/standard/premium)
  - `GET /tier-selection` — current tier selection state
- `backend/src/models/DealRoomAnnotation.js` — `portalToken`, `proposalId`, `sectionName`, `comment`, `type`, `clientEmail` (optional), `createdAt`
- `backend/src/services/portal/dealRoomService.js` — annotation CRUD, tier selection persistence, trigger notification to workspace on new annotation

**Modify:**
- `backend/src/services/notifications/` — add `notifyWorkspaceOfClientAnnotation(workspaceId, proposalId, annotation)` 
- `backend/src/routes/publicPortal.js` — add deal room routes (they are public, authenticated by portal token, not JWT)

#### Frontend

**New files:**
- `src/components/portal/DealRoomPanel.jsx` — floating sidebar in the public portal with:
  - Section comment buttons (inline, appear on hover next to section headers)
  - Comment submission form with type selector
  - Tier selection card (shows for bundle/TriProposal portals)
  - "Your questions have been sent" confirmation state
- `src/components/portal/DealRoomAnnotationBadge.jsx` — shows annotation count per section in the agency's proposal workspace view

**Modify:**
- `src/pages/ProposalPortal.jsx` — render `<DealRoomPanel />` if portal is not expired and is deal-room-enabled
- `src/components/proposal/` (workspace view) — add annotation viewer so agency can see client questions per section
- `src/hooks/usePortalTracking.js` — add `postAnnotation()` and `postTierSelection()` mutations

#### Success criteria:
- [ ] Client can leave a comment on any section without logging in
- [ ] Agency receives in-app notification when client annotates
- [ ] Tier selection persists and is visible to the agency in the proposal workspace
- [ ] Existing portal PIN/expiry logic is unaffected

---

### 1.6 Slack App Directory Submission `[MED]`

**Why:** You have the integration built. Not submitting is leaving free distribution on the table.

#### Backend — already built, minor fixes needed:

**Modify:**
- `backend/src/services/integrations/slackService.js` — audit all event types being posted; ensure messages use Block Kit format (not plain text) for professional appearance in workspace channels
- `backend/src/routes/slackIntegration.js` — add `GET /api/integrations/slack/health` endpoint that Slack requires for OAuth app verification

#### Non-code work:
- Create a Slack developer account app entry at `api.slack.com/apps`
- Write app listing copy: name, description, category (Productivity → Proposal Management)
- Create required app icon assets: 512×512 PNG, 108×108 PNG
- Configure OAuth scopes: `incoming-webhook`, `channels:read`
- Submit for Slack directory review (review takes 1–3 weeks)

#### Success criteria:
- [ ] Slack OAuth install works end-to-end from workspace settings UI
- [ ] At least 3 event types post to the connected Slack channel (proposal created, deal won, client viewed portal)
- [ ] App submitted to Slack directory

---

### 1.7 Production Demo Seed Isolation `[MED]`

**Why:** `buildDemoSeed` in Freelancer OS is being called in production code paths. This is a data integrity risk and confuses real users with fake data.

#### Modify:
- `backend/src/services/freelancer/freelancerService.js` (or wherever `buildDemoSeed` is called) — wrap every demo seed call with:
  ```javascript
  if (process.env.NODE_ENV !== 'development' && !process.env.ALLOW_DEMO_SEED) {
    throw new Error('Demo seed is not available in production');
  }
  ```
- `backend/src/config/env.js` — add `ALLOW_DEMO_SEED=false` as an explicit env var
- `backend/.env.example` — document `ALLOW_DEMO_SEED=false` with a comment
- Create `backend/src/scripts/seedDemoData.js` — move all demo seed logic here as an explicit CLI script: `node scripts/seedDemoData.js --userId=xxx`

#### Success criteria:
- [ ] Production API returns a proper "not available" response (not demo data) for uninitialized Freelancer OS flows
- [ ] Demo data is only accessible in development via explicit env flag

---

## Phase 2 — Moat Building (Months 3–9)

> **Goal:** Close the intelligence loops. Make the product smarter with every proposal. Launch API tier. Begin enterprise conversations.

---

### 2.1 WinScore — Pre-Generation Deal Probability `[HIGH]`

**Why:** Transforms BriefScore from a quality gate into a revenue coaching tool. The most visible intelligence feature in the platform.

#### Backend

**New files:**
- `backend/src/services/intelligence/winScoreService.js` — orchestrates the score:
  1. Pull current BriefScore dimensions for the brief
  2. Query `AgencyPattern` collection for similar briefs (by industry tag, tech stack tags from the brief, effort range)
  3. Pull `ProposalEval` records for same workspace (Phase 1.4 data) 
  4. Compute:
     - `baseWinRate` — win rate from matched historical proposals in the workspace
     - `briefQualityMultiplier` — adjustment from BriefScore dimensions (missing timeline = -8%, missing budget = -12%, etc.)
     - `marketBenchmark` — anonymized cross-workspace rate (Phase 3 data; default to null until Phase 3)
     - `pulldownSignals` — array of specific things dragging the score down with suggested fixes
     - `final WinScore` = 0–100
  5. Return structured JSON: `{ winScore, baseWinRate, pulldownSignals, recommendation }`
- `backend/src/routes/intelligence.js` — `POST /api/intelligence/win-score` (accepts brief text + current briefScore result)
- `backend/src/prompts/winScorePrompt.js` — prompt template for AI-assisted signal extraction when pattern data is sparse (< 10 historical proposals)

**Modify:**
- `backend/src/index.js` — register `/api/intelligence` routes
- `backend/src/routes/briefScore.js` — optionally chain WinScore computation after BriefScore for plan-gated users

#### Frontend

**New files:**
- `src/components/briefScore/WinScoreCard.jsx` — rendered after BriefScore in the `/new` intake flow:
  - Large circular score dial (0–100)
  - Color-coded: red (0–40), amber (41–65), green (66–100)
  - Pull-down signal list with specific fix suggestions
  - "Improve Brief" quick-action buttons that auto-append suggestions to the brief text area

**Modify:**
- `src/pages/NewProposal.jsx` — call `POST /api/intelligence/win-score` after BriefScore resolves; render `<WinScoreCard />` in the pre-generation panel
- `src/hooks/useBriefScore.js` — extend to also fetch and return WinScore for gated plans

#### Success criteria:
- [ ] WinScore renders before generation for Pro/Agency users
- [ ] Pull-down signals are specific and actionable (not generic)
- [ ] Score changes meaningfully when brief is improved
- [ ] Free users see a blurred WinScore with upgrade prompt

---

### 2.2 Confidence Calibration Loop `[HIGH]`

**Why:** This is the core of the prediction engine moat. Without it, confidence scores are just numbers. With it, they are the world's only validated proposal accuracy model.

#### Backend

**New files:**
- `backend/src/services/intelligence/calibrationService.js`:
  - `recordOutcome(proposalId, outcome)` — called when deal status changes to `won` or `lost`; reads proposal's confidence scores and feature list from S3, writes a `CalibrationRecord`
  - `computeCalibrationDrift(workspaceId)` — for each confidence bucket (0–25, 26–50, 51–75, 76–100), compute actual win rate vs. predicted win rate
  - `getCalibrationInsights(workspaceId)` — returns human-readable findings: "Your 80%+ confidence proposals win only 45% of the time — overconfidence in frontend estimates"
- `backend/src/models/CalibrationRecord.js` — `proposalId`, `workspaceId`, `outcome` (won/lost), `avgConfidenceScore`, `featureConfidences` (array), `industryTag`, `effortDays`, `pricingTier`, `recordedAt`

**Modify:**
- `backend/src/services/proposal/outcomeService.js` — after recording won/lost outcome, call `calibrationService.recordOutcome(proposalId, outcome)` asynchronously
- `backend/src/routes/analytics.js` — add `GET /api/analytics/calibration` returning `calibrationDrift`, `calibrationInsights`, `totalOutcomesLogged`
- `backend/src/routes/agencyBrain.js` — inject calibration drift into Agency Brain context so future generations can be calibrated

#### Frontend

**New files:**
- `src/components/analytics/CalibrationPanel.jsx` — in the Analytics page:
  - "Confidence Accuracy" section showing a 2×2 table: confidence bucket vs. actual win rate
  - Visual drift indicator: "Your AI is 23% overconfident in high-complexity estimates"
  - Call-to-action: "Log more outcomes to improve calibration accuracy (need N more)"

**Modify:**
- `src/pages/Analytics.jsx` — render `<CalibrationPanel />` below existing analytics sections
- `src/components/proposal/ConfidenceCard.jsx` — add a tooltip: "Based on your history, 80% confidence estimates win X% of the time" (pulled from calibration data)
- `src/components/winloss/` — add a subtle prompt after marking won/lost: "This outcome has been logged for calibration. Thank you."

#### Success criteria:
- [ ] Every won/lost outcome generates a `CalibrationRecord`
- [ ] Analytics page shows calibration drift after 10+ outcomes
- [ ] Confidence cards show historical accuracy context
- [ ] `calibrationService.computeCalibrationDrift()` has a unit test

---

### 2.3 Scope Creep Radar `[HIGH]`

**Why:** Directly addresses why agencies lose margin. Makes the Confidence Grid 10x more actionable.

#### Backend

**New files:**
- `backend/src/services/intelligence/scopeCreepService.js`:
  - `analyzeFeatureRisk(featureList, workspaceId)` — for each feature in the generated proposal:
    - Match against `AgencyPattern` records that have `effortCalibrationDelta` > 20% (features that took longer than estimated)
    - Assign `scopeCreepProbability` (0–100) and `reason` string
  - `getFeatureRiskProfile(featureName, industryTag)` — lookup against `AgencyPattern.patternData`
- `backend/src/prompts/scopeCreepPrompt.js` — AI prompt for generating natural-language scope risk explanations when pattern data is sparse

**Modify:**
- `backend/src/routes/proposals.js` — add `GET /api/proposals/:id/scope-risk` that runs `scopeCreepService.analyzeFeatureRisk()` on the current proposal version and returns per-feature risk data
- `backend/src/services/agencyBrain/patternExtractors/effortCalibrationDelta.js` — ensure this extractor is writing usable data to `AgencyPattern`

#### Frontend

**New files:**
- `src/components/proposal/ScopeCreepBadge.jsx` — small pill overlaid on feature cards: 🔴 HIGH RISK, 🟡 WATCH, 🟢 STABLE with hover tooltip explaining why
- `src/hooks/useScopeRisk.js` — fetches scope risk data for the current proposal on workspace load

**Modify:**
- `src/pages/ProposalResult.jsx` — call `useScopeRisk()` and pass data down to feature rendering components
- `src/components/proposal/ConfidenceCard.jsx` — render `<ScopeCreepBadge />` when `scopeCreepProbability > 50`

#### Success criteria:
- [ ] Scope Creep Radar is visible on the proposal workspace for Pro/Agency plans
- [ ] At least 3 risk levels are meaningfully differentiated
- [ ] Tooltip explains why a feature is flagged (not just a number)
- [ ] Radar improves as more `AgencyPattern` records accumulate

---

### 2.4 Proposal Intelligence Feed (Weekly Digest) `[HIGH]`

**Why:** Turns passive analytics data into a weekly retention event. Users open FixFlowAI not just when writing proposals but every Monday.

#### Backend

**New files:**
- `backend/src/services/intelligence/digestService.js`:
  - `generateDigest(workspaceId)` — queries analytics, calibration, and Agency Brain to produce:
    - `topInsight` — single most impactful finding this week
    - `winRateChange` — delta vs. last 30 days
    - `riskAlert` — feature category with highest scope creep this month
    - `proposalsPending` — count of proposals without a deal status after 7+ days
    - `suggestedActions` — 2–3 specific actions (e.g., "Follow up on 3 proposals viewed by clients but not responded to")
  - `scheduleDigests()` — cron job (use `node-cron`) to run every Monday at 8am user's timezone
- `backend/src/routes/intelligence.js` — add `GET /api/intelligence/digest` (on-demand fetch of latest digest) and `POST /api/intelligence/digest/send` (manual trigger for testing)

**Modify:**
- `backend/src/index.js` — start the digest cron job on server init
- `backend/src/services/email/emailService.js` — add `sendWeeklyDigest(to, digestData)` with an HTML email template showing the 3–5 digest items cleanly
- `backend/src/services/integrations/slackService.js` — add `postDigestToSlack(webhookUrl, digestData)` — post the same digest as a Slack Block Kit message

#### Frontend

**New files:**
- `src/components/dashboard/IntelligenceFeed.jsx` — a sticky card at the top of the dashboard (not the full Analytics page) showing the current week's top 3 insights inline. Collapsible.

**Modify:**
- `src/pages/Analytics.jsx` — add "Latest Digest" section showing the last generated digest with a "Send to Slack / Email" button
- `src/pages/Dashboard.jsx` (or equivalent) — render `<IntelligenceFeed />` above the proposal list

#### Success criteria:
- [ ] Digest generates without error for workspaces with 5+ proposals
- [ ] Email template renders correctly with data
- [ ] Slack message posts correctly to connected workspace
- [ ] Frontend dashboard shows digest card
- [ ] Cron job runs and logs output

---

### 2.5 Public Proposal API Launch `[HIGH]`

**Why:** Turns FixFlowAI into infrastructure. Enables HubSpot, Monday.com, and CRM integrations. Opens an API revenue line.

#### Backend

**New files:**
- `backend/src/middleware/apiKeyAuth.js` — API key authentication middleware (separate from JWT):
  - Accept `X-FixFlow-API-Key` header
  - Validate against `ApiKey` model
  - Attach workspace context to `req.apiWorkspace`
  - Rate limit by API key (100 calls/hour for Pro, 1000/hour for Agency)
- `backend/src/models/ApiKey.js` — `workspaceId`, `userId`, `keyHash` (bcrypt hashed), `name`, `plan`, `callsThisHour`, `totalCalls`, `createdAt`, `lastUsedAt`, `active`
- `backend/src/routes/api-public.js` — public API routes under `/api/v1/`:
  - `POST /api/v1/proposals/generate` — accepts `{ brief, strategy?, agencyBrainEnabled? }`, returns structured proposal JSON (same as internal `/api/generate` but synchronous, not SSE)
  - `GET /api/v1/proposals` — list proposals for the workspace (paginated)
  - `GET /api/v1/proposals/:id` — get a specific proposal
  - `GET /api/v1/proposals/:id/versions` — list versions
  - `POST /api/v1/brief/score` — score a brief (for CRM pre-qualification)
- `backend/src/routes/apiKeys.js` — key management: `POST /api/api-keys`, `GET /api/api-keys`, `DELETE /api/api-keys/:id`

**New documentation file:**
- `docs/API.md` — public API documentation with curl examples, response schemas, error codes, rate limit headers

#### Frontend

**New files:**
- `src/pages/ApiKeys.jsx` — API key management page: generate key (show once), list keys, revoke keys, usage stats
- `src/components/apikeys/ApiKeyRow.jsx`
- `src/components/apikeys/NewKeyModal.jsx` — shows key once with copy-to-clipboard

**Modify:**
- `src/App.jsx` — add `/settings/api-keys` protected route (Agency plan only)
- `src/components/layout/Sidebar.jsx` — add API Keys link under Settings section for Agency plan users
- `backend/src/config/env.js` — add `API_RATE_LIMIT_PER_HOUR_PRO`, `API_RATE_LIMIT_PER_HOUR_AGENCY`

#### Success criteria:
- [ ] Agency plan user can generate an API key
- [ ] `POST /api/v1/proposals/generate` returns valid proposal JSON via API key auth
- [ ] Rate limiting works per key
- [ ] Key usage is logged (`totalCalls`, `lastUsedAt` updated)
- [ ] `docs/API.md` is complete with at least 5 working examples

---

### 2.6 Full White-Label Portal & Export `[MED]`

**Why:** Required for enterprise deals. Agencies pay a premium to present FixFlowAI as their own product.

#### Backend

**New files:**
- `backend/src/models/BrandProfile.js` — `workspaceId`, `logoUrl`, `primaryColor`, `accentColor`, `fontFamily`, `companyName`, `customDomain` (optional), `showPoweredBy` (boolean, default true)
- `backend/src/routes/branding.js` — `GET/PUT /api/workspaces/:id/branding`
- `backend/src/services/branding/brandingService.js` — fetch brand profile, apply to export templates

**Modify:**
- `backend/src/services/export/pdfExport.js` — accept `brandProfile` parameter; inject logo, colors, and company name into Puppeteer HTML template instead of FixFlowAI defaults
- `backend/src/services/portal/portalService.js` — include `brandProfile` in portal metadata returned to public routes
- `backend/src/routes/publicPortal.js` — return `brandProfile` in `GET /api/portal/:token` response

#### Frontend

**New files:**
- `src/pages/BrandSettings.jsx` — workspace branding page: logo upload, color pickers, font selector, preview panel
- `src/components/branding/BrandPreview.jsx` — live preview of how the portal and PDF will look with custom brand
- `src/components/branding/LogoUploader.jsx` — S3 signed URL upload for logo file

**Modify:**
- `src/pages/ProposalPortal.jsx` — read `brandProfile` from portal metadata and apply CSS variables dynamically (no hardcoded FixFlowAI colors in the public view)
- `src/pages/WorkspaceSettings.jsx` — add "Branding" tab linking to `<BrandSettings />`

#### S3 changes:
- `backend/src/services/storage/s3.js` — add `uploadBrandAsset(workspaceId, file)` and `getBrandAssetUrl(workspaceId)` functions

#### Success criteria:
- [ ] Agency plan user can upload a logo and set brand colors
- [ ] PDF export uses agency logo and colors
- [ ] Public portal renders agency brand colors and logo
- [ ] "Powered by FixFlowAI" is hidden for Agency plan (togglable)
- [ ] Free/Pro plans see a "Upgrade to Agency for white-label" prompt

---

### 2.7 FixFlow Solo — Freelancer Tier Separation `[MED]`

**Why:** Freelancer OS UX is too complex to maintain alongside the agency product. Isolate it under a Solo tier with feature flags.

#### Backend

**Modify:**
- `backend/src/middleware/` — create `requireSoloPlan.js` middleware (check `user.plan === 'solo' || user.plan === 'agency'`)
- `backend/src/routes/freelancer.js` — apply `requireSoloPlan` middleware to all routes; return `{ error: 'Solo plan required', upgradeUrl: '/billing' }` for free/pro users
- `backend/src/services/freelancer/freelancerService.js` — ensure `buildDemoSeed` is fully removed from production paths (see Phase 1.7)
- `backend/src/services/freelancer/opportunityDiscoveryService.js` — add a real web search path using `TAVILY_API_KEY` or `BRAVE_API_KEY` (whichever is configured) as the primary; keep existing providers as fallback

#### Frontend

**Modify:**
- `src/App.jsx` — wrap all `/freelancer/*` routes with a `<SoloPlanGate />` component that shows an upgrade screen for non-Solo users
- `src/components/layout/Sidebar.jsx` — show Freelancer OS section only for Solo/Agency plan; show a "Get Solo" upsell chip for others
- `src/pages/freelancer/FreelancerDashboard.jsx` — remove any remaining `buildDemoSeed` references; show empty state with setup CTA when no GitHub scan has been done

#### New file:
- `src/components/billing/SoloPlanGate.jsx` — a full-screen gate component showing Solo plan features and an upgrade CTA; renders as a child of protected routes

#### Success criteria:
- [ ] Free/Pro users see a plan gate on all Freelancer OS routes
- [ ] Solo plan users can access all Freelancer OS routes
- [ ] Opportunity discovery uses a real search provider (Tavily/Brave) for at least lead title and URL
- [ ] No demo seed data shown to Solo plan users who haven't scanned GitHub yet

---

## Phase 3 — Category Creation (Months 9–18)

> **Goal:** Build the data network. Launch autonomous workflows. Begin enterprise sales. Publish the intelligence report.

---

### 3.1 Cross-Agency Intelligence Network (Opt-In) `[HIGH]`

**Why:** The moat that becomes unassailable. Collectively, agencies on FixFlowAI produce the world's only structured proposal outcome dataset.

#### Architecture decisions to make first:
- Data is opt-in per workspace (default off, explicit consent required)
- All data is anonymized: no client names, company names, or identifying brief content
- Only extracted signals are shared: feature category tags, confidence scores, effort estimates, outcome, industry tag, pricing bucket, timeline
- Store cross-agency data in a separate MongoDB collection (or separate Atlas project) to enforce data boundaries

#### Backend

**New files:**
- `backend/src/models/AggregatedOutcome.js` — fully anonymized: `industryTag`, `techStackTags[]`, `effortBucket` (S/M/L/XL), `pricingBucket`, `avgConfidence`, `featureCategories[]`, `outcome` (won/lost), `scopeCreepOccurred` (bool), `source: 'anonymized'`
- `backend/src/services/intelligence/aggregationService.js`:
  - `contributeOutcome(workspaceId, proposalId, outcome)` — only called for opted-in workspaces; strips all PII, maps to `AggregatedOutcome` schema, writes to shared collection
  - `queryBenchmarks(industryTag, pricingBucket)` — returns win rate, avg confidence, common scope creep features from cross-agency data
  - `getMarketWinRate(filters)` — the core query for WinScore's `marketBenchmark` field (from Phase 2.1, currently returns null)
- `backend/src/routes/intelligence.js` — add `GET /api/intelligence/market-benchmarks?industry=X&pricing=Y`

**Modify:**
- `backend/src/services/intelligence/calibrationService.js` — after recording a `CalibrationRecord`, check workspace opt-in flag and call `aggregationService.contributeOutcome()` if opted in
- `backend/src/services/intelligence/winScoreService.js` — update `marketBenchmark` field computation using `aggregationService.queryBenchmarks()`
- `backend/src/models/Workspace.js` — add `intelligenceNetworkOptIn: Boolean` (default false) and `optInAcknowledgedAt: Date`

#### Frontend

**New files:**
- `src/components/workspace/IntelligenceNetworkOptIn.jsx` — explicit consent card in Workspace Settings:
  - What data is shared (anonymized list)
  - What you get in return (market benchmarks, cross-industry win rates)
  - Toggle + "I understand and agree" checkbox
  - Links to data handling policy

**Modify:**
- `src/pages/WorkspaceSettings.jsx` — add "Intelligence Network" section
- `src/components/briefScore/WinScoreCard.jsx` — when opt-in is active, show `marketBenchmark` alongside workspace-specific rate: "Your rate: 58% | Market: 62%"
- `src/pages/Analytics.jsx` — add "Market Benchmarks" panel for opted-in workspaces

#### Legal requirements (non-code):
- Write a data handling policy page (`/privacy/intelligence-network`) explaining exactly what is collected, how it's anonymized, and how to opt out
- Add a "Data Contribution Agreement" checkbox flow during opt-in

#### Success criteria:
- [ ] Opt-in toggle works and stores consent with timestamp
- [ ] Opted-in outcomes contribute anonymized `AggregatedOutcome` records
- [ ] WinScore shows market benchmark for opted-in workspaces with 50+ records in the shared pool
- [ ] Analytics shows market comparison panel
- [ ] Opting out stops future contributions and flags existing records for deletion

---

### 3.2 Proposal Autopilot / Agent Mode `[HIGH]`

**Why:** Category-defining feature. No competitor offers truly autonomous proposal generation with approval gates. This is the "wow" moment in every enterprise sales demo.

#### Architecture:
Use a job queue pattern (implement with `bull` npm package + Redis, or a simpler `setInterval`-based in-memory queue for v0).

```
Trigger (email webhook / API call / manual)
  → Create AutopilotJob (MongoDB)
  → Step 1: BriefScore check
  → Step 2: If score < threshold, send clarification email to client (via Nodemailer)
  → Step 3: Wait for clarification (poll or webhook)
  → Step 4: Generate proposal (call internal generate service)
  → Step 5: Post to workspace for approval (notification + Slack message)
  → Step 6: On approval, create and send portal to client
```

#### Backend

**New files:**
- `backend/src/models/AutopilotJob.js` — `workspaceId`, `userId`, `briefText`, `clientEmail`, `status` (pending | clarifying | generating | awaiting_approval | approved | sent | failed), `steps[]` (log of each step with timestamp), `proposalId` (once generated), `createdAt`
- `backend/src/services/autopilot/autopilotOrchestrator.js` — the main orchestration loop: reads job status, executes next step, updates job state
- `backend/src/services/autopilot/clarificationService.js` — sends templated clarification email, parses reply webhook (or polling a dedicated email inbox)
- `backend/src/routes/autopilot.js`:
  - `POST /api/autopilot/jobs` — create a new Autopilot job with a brief
  - `GET /api/autopilot/jobs` — list all jobs for the workspace
  - `GET /api/autopilot/jobs/:id` — get job status and step log
  - `POST /api/autopilot/jobs/:id/approve` — workspace member approves generated proposal for sending
  - `POST /api/autopilot/jobs/:id/reject` — reject with notes; job goes back to generating with revision context

**Modify:**
- `backend/src/index.js` — start autopilot job processor on server init; register routes
- `backend/src/services/integrations/slackService.js` — add `postApprovalRequest(webhookUrl, jobId, proposalPreviewUrl)` — posts "New autopilot proposal ready for approval" with Approve/Reject buttons (Slack interactive actions require additional setup — document this as a future enhancement; v0 uses notification only)
- `backend/src/services/notifications/` — add `notifyAutopilotApprovalRequired(workspaceId, jobId)`

#### Frontend

**New files:**
- `src/pages/Autopilot.jsx` — Autopilot dashboard: list of jobs with status timeline, approve/reject buttons, step log accordion
- `src/components/autopilot/JobStatusTimeline.jsx` — visual step-by-step progress: Received → Scored → Clarified → Generating → Ready → Sent
- `src/components/autopilot/NewAutopilotJobModal.jsx` — paste brief + client email + optional settings (tone, strategy, approval required toggle)
- `src/hooks/useAutopilotJobs.js` — polling hook for job status (every 5 seconds when a job is active)

**Modify:**
- `src/App.jsx` — add `/autopilot` route (Agency plan only)
- `src/components/layout/Sidebar.jsx` — add Autopilot link with a "NEW" badge for Agency plan users

#### Success criteria:
- [ ] Autopilot job can be created from the UI
- [ ] Job proceeds through at least: BriefScore → Generate → Notify for approval
- [ ] Workspace member can approve and job sends portal to client email
- [ ] Job status updates in real time on the Autopilot page
- [ ] Failed jobs show a clear error with retry option

---

### 3.3 Deal Room e-Sign + Escrow Link `[HIGH]`

**Why:** Closes the full revenue cycle. Brief → Proposal → Signed → Paid. The escrow contract already exists as infrastructure.

#### Prerequisites:
- Solidity contract (`contracts/src/FixFlowEscrow.sol`) must be audited and deployed to a testnet (Polygon Mumbai or Sepolia) before this feature ships to real users
- Legal review of e-signature validity in target markets (India, US, UK minimum)
- Integration with a lightweight e-sign provider as fallback (DocuSign API or HelloSign) for users who don't want Web3

#### Backend

**New files:**
- `backend/src/services/esign/esignService.js`:
  - `createSignatureRequest(proposalId, clientEmail, signerName)` — generates a signing session: either Web3 (wallet signature on proposal hash) or Web2 (DocuSign/PDF signing link)
  - `recordSignature(proposalId, signatureData, method)` — stores signature record
  - `verifySignature(proposalId)` — returns signature validity status
- `backend/src/models/Signature.js` — `proposalId`, `signerEmail`, `signerName`, `method` (web3 | docusign | pdf), `signatureHash`, `proposalContentHash`, `signedAt`, `valid`
- `backend/src/routes/esign.js` — `POST /api/proposals/:id/esign/request`, `POST /api/proposals/:id/esign/confirm`, `GET /api/proposals/:id/esign/status`
- `backend/src/services/blockchain/escrowService.js` — wrapper around `FixFlowEscrow.sol`:
  - `deployEscrow(proposalId, clientAddress, agencyAddress, milestones[])` — deploys or initializes escrow for a signed proposal
  - `releaseEscrow(escrowId, milestoneIndex)` — release a milestone
  - This service should work against testnet only until fully audited

**Modify:**
- `backend/src/routes/dealRoom.js` — add `POST /portal/:token/sign` endpoint that initiates e-sign flow from client side (no JWT required, authenticated by portal token)
- `backend/src/services/portal/portalService.js` — after signature confirmed, trigger proposal deal status update to `won` and kick off Autopilot outcome flow

#### Frontend

**New files:**
- `src/components/portal/SignaturePanel.jsx` — final panel in the Deal Room:
  - "Accept & Sign Proposal" button
  - Signature method selector: "Sign with wallet" (Web3) or "Sign digitally" (Web2 PDF)
  - Signature confirmation animation
  - "Your signature has been recorded" state with downloadable signed PDF
- `src/components/proposal/SignatureStatusBadge.jsx` — shows in proposal workspace: "Awaiting signature", "Signed by [client name] on [date]"

**Modify:**
- `src/pages/ProposalPortal.jsx` — render `<SignaturePanel />` as the final step in the Deal Room flow
- `src/pages/ProposalResult.jsx` — show `<SignatureStatusBadge />` in proposal header

#### Success criteria:
- [ ] Client can sign a proposal from the public portal (Web2 method minimum)
- [ ] Signature is recorded with proposal content hash
- [ ] Agency sees "Signed" status in the proposal workspace
- [ ] Signed PDF is generated and stored in S3
- [ ] Web3 escrow initialization works on testnet when wallet is connected (separate from main flow)

---

### 3.4 Revenue Forecasting Layer `[MED]`

**Why:** Turns FixFlowAI from a proposal tool into a revenue operations platform. This is the feature that makes CFOs and agency owners love the product.

#### Backend

**New files:**
- `backend/src/services/intelligence/forecastService.js`:
  - `getRevenueForecast(workspaceId)` — aggregates all proposals with deal status `pending` or `negotiating`:
    - For each: apply `WinScore` as close probability
    - Multiply by proposal value (if budget is in the brief, extract it; else use tier pricing estimates)
    - Sum to get `expectedRevenue`, `optimisticRevenue` (all won), `pessimisticRevenue` (apply 30% haircut)
    - Return 30/60/90-day forecast buckets by expected close date (from delivery plan start dates)
  - `getPipelineHealth(workspaceId)` — returns: total pipeline value, at-risk proposals (viewed but no response in 7+ days), overdue follow-ups, average days to close
- `backend/src/routes/analytics.js` — add `GET /api/analytics/forecast` and `GET /api/analytics/pipeline-health`

#### Frontend

**New files:**
- `src/components/analytics/RevenueForecastChart.jsx` — stacked bar chart: 30/60/90-day expected revenue with confidence bands
- `src/components/analytics/PipelineHealthCard.jsx` — metric cards: pipeline value, at-risk proposals, avg days to close

**Modify:**
- `src/pages/Analytics.jsx` — add "Revenue Forecast" section at the top (highest priority view for agency owners)
- `src/components/dashboard/IntelligenceFeed.jsx` — include pipeline health in the weekly digest card

#### Success criteria:
- [ ] Revenue forecast renders for workspaces with 5+ proposals
- [ ] 30/60/90-day breakdown is visible
- [ ] At-risk proposals are surfaced with direct links
- [ ] Forecast values update when deal statuses change

---

### 3.5 Enterprise SSO + Audit Logs `[MED]`

**Why:** Required for any deal over $500/month. Enterprise buyers will not sign without SSO and audit trails.

#### Backend

**New files:**
- `backend/src/services/auth/samlService.js` — SAML 2.0 SSO using `passport-saml` npm package:
  - `initiateSamlLogin(workspaceId)` — redirect to IdP
  - `handleSamlCallback(samlResponse)` — validate assertion, find or create user
- `backend/src/models/SsoConfig.js` — `workspaceId`, `provider` (okta | azure | google), `entryPoint`, `issuer`, `cert`, `active`
- `backend/src/routes/sso.js` — `GET /api/sso/:workspaceId/login`, `POST /api/sso/:workspaceId/callback`, `GET/PUT /api/sso/:workspaceId/config`
- `backend/src/models/AuditLog.js` — `workspaceId`, `userId`, `action` (proposal.created | proposal.deleted | member.invited | portal.shared | deal.closed | settings.changed | api_key.created etc.), `resourceId`, `resourceType`, `metadata` (object), `ip`, `userAgent`, `timestamp`
- `backend/src/services/audit/auditService.js` — `log(workspaceId, userId, action, resource, metadata, req)` — called throughout the backend on state-changing operations
- `backend/src/routes/audit.js` — `GET /api/workspaces/:id/audit-log` (paginated, filterable by action/user/date range) — Agency/Scale plan only

#### Frontend

**New files:**
- `src/pages/AuditLog.jsx` — paginated table of audit events with filters: user, action type, date range, resource type
- `src/pages/SsoSettings.jsx` — SSO configuration page for workspace admins: provider selector, certificate upload, test connection button

**Modify:**
- `src/pages/WorkspaceSettings.jsx` — add SSO and Audit Log tabs (Scale plan only)
- `backend/src/middleware/auth.js` — after validating JWT, log the route access if it's a mutating operation

#### Success criteria:
- [ ] SSO login works with at least one IdP (Okta recommended for testing)
- [ ] Every state-changing API call writes an `AuditLog` entry
- [ ] Audit log is viewable and filterable in the UI
- [ ] SSO-authenticated users have correct workspace roles applied

---

### 3.6 "Agency Proposal Intelligence Report" — Annual Research Publication `[MED]`

**Why:** Creates category authority. Becomes a PR event, a backlink source, and a top-of-funnel acquisition engine.

#### Non-code tasks:
- Aggregate anonymized platform data: win rates by industry, proposal timeline vs. win rate correlation, confidence score accuracy, average proposal-to-close time
- Write a 1,500-word report with 5–8 data-backed findings
- Design a report landing page at `fixflowai.com/report` (static page, separate from the app)
- Promote via: LinkedIn (agency communities), agency subreddits, Hacker News Show HN, ProductHunt
- Gate the full report behind email signup (lead gen)

#### Code tasks:
- `backend/src/routes/analytics.js` — add internal `GET /api/internal/report-data` route (IP-restricted or admin-only) that aggregates all anonymized data needed for the report
- `backend/src/services/intelligence/aggregationService.js` — add `generateReportSnapshot()` that produces a JSON export of cross-agency statistics
- Create a static `/report` landing page using the existing React app or a separate Astro/Next.js micro-site

---

## Ongoing / Cross-Cutting

These tasks are not tied to a single phase but should be maintained continuously.

---

### O.1 Proposal Token Cost Tracking

**Why:** You cannot add usage-based pricing without knowing your LLM costs per proposal.

**Modify:**
- `backend/src/services/llm/client.js` — capture token count from Gemini response metadata (`usageMetadata.totalTokenCount`)
- `backend/src/models/ProposalEval.js` (Phase 1.4) — add `inputTokens`, `outputTokens`, `estimatedCostUsd` fields
- `backend/src/routes/analytics.js` — add `GET /api/analytics/cost-summary` returning total tokens used, estimated cost this month, cost per proposal average

---

### O.2 E2E Test Coverage Expansion

**Why:** Your CI runs `npm --prefix backend test` (unit) and references Playwright config. The Playwright tests are minimal. Expand them.

**Add Playwright scenarios in `tests/e2e/`:**
- `proposal-generation.spec.js` — paste brief, hit generate, verify proposal renders with confidence cards
- `portal-share.spec.js` — generate portal link, access it unauthenticated, verify content loads and PIN gate works
- `workspace-invite.spec.js` — invite a member, accept invite, verify they appear in member list
- `deal-room.spec.js` — open portal, leave annotation, verify agency sees notification
- `billing-upgrade.spec.js` — mock Stripe; verify plan upgrade changes feature access

---

### O.3 Observability & Alerting

**Why:** You have no visibility into production failures beyond CloudWatch logs.

**Add:**
- `backend/src/middleware/requestLogger.js` — structured JSON logging for every request: method, route, status, duration, userId, workspaceId
- Integrate with AWS CloudWatch structured logs (already available via ECS) or add Pino/Winston with a CloudWatch transport
- Add CloudWatch Alarms for: 5xx error rate > 2%, generation route p95 latency > 15s, ECS CPU > 80%
- `backend/src/routes/generate.js` — log `{ event: 'generation.complete', proposalId, durationMs, tokenCount, briefScoreAtGeneration }` as a structured event after every successful generation

---

### O.4 API Response Envelope Standardization

**Why:** Inconsistent `{ data }` vs `{ proposal }` vs `{ result }` envelopes make frontend code fragile.

**Standard envelope to enforce everywhere:**
```json
{
  "success": true,
  "data": { ... },
  "meta": { "page": 1, "total": 40 }
}
```
**Error envelope:**
```json
{
  "success": false,
  "error": { "code": "PROPOSAL_NOT_FOUND", "message": "..." }
}
```
- Create `backend/src/utils/responseHelper.js` with `success(res, data, meta)` and `error(res, code, message, statusCode)` helpers
- Systematically update every route file to use these helpers
- Update `src/config/api.js` Axios interceptors to read from the standardized envelope

---

## Tech Debt to Clear Before Phase 2

These are specific issues in the current codebase that will block Phase 2 work if left unaddressed.

| # | Issue | File(s) | Fix |
|---|---|---|---|
| 1 | Git merge conflict markers in README.md | `README.md` lines 203–207 | Remove `<<<<<<< HEAD`, `=======`, `>>>>>>> a9a1c73...` markers |
| 2 | Demo seed in production paths | `freelancerService.js` | See Phase 1.7 |
| 3 | SMTP errors crashing routes | Multiple route files | See Phase 1.2 |
| 4 | Profile data loss on logout | `authStore.js` | See Phase 1.3 |
| 5 | `proplytics-cluster` / `proplytics-backend-service` in CI/CD | `.github/workflows/cicd.yml` env vars | Rename to `fixflowai-cluster` / `fixflowai-backend-service` to match the product name |
| 6 | No cost tracking on LLM calls | `llm/client.js` | See O.1 — required before usage billing |
| 7 | BriefScore improvement suggestions not wired to brief editor | `NewProposal.jsx` | Add "Apply suggestion" button that appends BriefScore recommendations to the brief text area |
| 8 | SSE keepalive not tested under load | `routes/generate.js` | Add a keepalive `:` comment event every 15s; test with a 2-minute generation on large brief |
| 9 | `jsondiffpatch` diff not rendered in UI | Revision history component | Surface a side-by-side diff viewer in the revision history panel (not just raw JSON) |
| 10 | No empty state on Analytics page for new workspaces | `Analytics.jsx` | Add a helpful empty state: "Generate and close 3+ proposals to unlock analytics" |

---

## Quick Reference — Priority Order

```
WEEK 1–2:   1.1 Stripe billing (backend models + webhook)
WEEK 2–3:   1.1 Stripe billing (frontend + upgrade flow)
WEEK 3:     1.2 SMTP hardening
WEEK 3–4:   1.3 Profile persistence
WEEK 4:     1.4 Eval harness (background task, low-risk)
WEEK 4–5:   1.5 Deal Room v0 (client annotations)
WEEK 5:     1.6 Slack App Directory submission
WEEK 5–6:   1.7 Demo seed isolation + tech debt items 1,5

MONTH 3–4:  2.1 WinScore
MONTH 4–5:  2.2 Calibration loop
MONTH 4–5:  2.3 Scope Creep Radar
MONTH 5–6:  2.4 Intelligence Feed / weekly digest
MONTH 6–7:  2.5 Public API
MONTH 7–8:  2.6 White-label
MONTH 8–9:  2.7 Solo tier separation

MONTH 9–11: 3.1 Cross-agency intelligence network
MONTH 10–12: 3.2 Autopilot agent
MONTH 12–14: 3.3 e-Sign + escrow link
MONTH 14–16: 3.4 Revenue forecasting
MONTH 15–18: 3.5 Enterprise SSO + audit
MONTH 16–18: 3.6 Intelligence Report publication
```

---

## Environment Variables — Complete Reference

All variables needed across all three phases. Add to `backend/.env.example`:

```bash
# ── Core ──────────────────────────────────────────────────────
MONGODB_URI=
JWT_SECRET=
JWT_REFRESH_SECRET=
AWS_REGION=
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
S3_BUCKET_NAME=
FRONTEND_URL=

# ── LLM ───────────────────────────────────────────────────────
GEMINI_API_KEY=
GEMINI_MODEL=gemini-1.5-pro
GEMINI_FALLBACK_MODEL=gemini-1.5-flash
LLM_PROVIDER_ORDER=gemini,openrouter
OPENROUTER_API_KEY=              # optional fallback
XAI_API_KEY=                     # optional
OLLAMA_API_KEY=                  # optional

# ── Email ─────────────────────────────────────────────────────
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
EMAIL_FROM_ADDRESS=hello@fixflowai.com
EMAIL_FROM_NAME=FixFlowAI

# ── Stripe (Phase 1.1) ────────────────────────────────────────
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_FREE_PRICE_ID=
STRIPE_PRO_PRICE_ID=
STRIPE_AGENCY_PRICE_ID=
STRIPE_SOLO_PRICE_ID=

# ── Slack (Phase 1.6) ─────────────────────────────────────────
SLACK_CLIENT_ID=
SLACK_CLIENT_SECRET=
SLACK_SIGNING_SECRET=

# ── GitHub OAuth ──────────────────────────────────────────────
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=
GITHUB_CALLBACK_URL=

# ── Freelancer Discovery (Phase 2.7) ──────────────────────────
OPPORTUNITY_SEARCH_PROVIDER_ORDER=tavily,brave
TAVILY_API_KEY=
BRAVE_API_KEY=
BID_MATCH_THRESHOLD=70
ALLOW_DEMO_SEED=false

# ── API Tier Rate Limits (Phase 2.5) ──────────────────────────
API_RATE_LIMIT_PER_HOUR_PRO=100
API_RATE_LIMIT_PER_HOUR_AGENCY=1000

# ── Blockchain / Escrow (Phase 3.3) ───────────────────────────
ESCROW_CONTRACT_ADDRESS=         # testnet only until audited
POLYGON_RPC_URL=
ESCROW_ADMIN_PRIVATE_KEY=        # server-side only, never expose

# ── Feature Flags ─────────────────────────────────────────────
ENABLE_CROSS_AGENCY_INTELLIGENCE=false   # flip on in Phase 3.1
ENABLE_AUTOPILOT=false                   # flip on in Phase 3.2
ENABLE_ESIGN=false                       # flip on in Phase 3.3

# ── Observability (Ongoing) ───────────────────────────────────
LOG_LEVEL=info
ENABLE_STRUCTURED_LOGGING=true
STREAM_TIMEOUT_MS=120000
```

---

*Document version: 1.0 — based on FixFlowAI master plan strategic analysis.*  
*All file paths relative to the repository root at `github.com/Suvam-paul145/FixFlowAI`.*
