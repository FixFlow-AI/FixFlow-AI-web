# 🔭 Proplytics — Futuristic MVP Roadmap
## *Three Features That Turn Proplytics from a Tool into a Platform*
### *Beyond the Roadmap · Category-Defining · 7-Day Execution Window*

---

> **Total build window: 7 days**
> **Existing stack: React 18 · Express 5 · Gemini · Zod · S3 · MongoDB · Puppeteer · Zustand · Framer Motion**
> **These are NOT on the current roadmap. These are what comes AFTER the roadmap.**
> **Each feature is architected to work independently and compound in value together.**

---

## Why These Three — The Strategic Logic

The current Proplytics roadmap completes the **single-user proposal lifecycle** with near-total coverage. Every stage from intake scoring to win/loss email follow-up is built or nearly built.

The next evolution is not adding more stages. It is deepening the **intelligence layer** and expanding the **unit of operation** from a single user to an agency as an intelligent organism.

These three MVPs do exactly that:

```
CURRENT STATE                           AFTER THESE THREE MVPs
──────────────                          ──────────────────────

One user → one proposal                 Agency Brain: every proposal
                                        teaches the platform about
                                        YOUR agency's patterns

One proposal generated                  MultiVariant: three strategic
at a time, one version                  options generated in parallel —
of the scope                            Lean / Standard / Premium

One person works on                     Team Workspace: shared proposals,
the proposal alone                      role-based access, invite clients
                                        and colleagues in
```

Together they transform Proplytics from a **productivity tool** into an **agency intelligence platform** — the kind of product that agencies become structurally dependent on, not just habitually reliant on.

---
---

# MVP F1 — Agency Brain
## **Institutional Proposal Intelligence: The Platform That Learns Your Agency**
### *"The more you use it, the smarter it gets about you specifically."*

> **Build time: 3 days**
> **Depends on: existing proposal JSON in S3, existing win/loss status in MongoDB, existing Confidence Grid scores**
> **New infrastructure: zero**
> **This is the feature that creates a moat competitors cannot replicate — because it requires your data**

---

## The Core Insight

Every proposal Proplytics has ever generated for an agency is a data point. Currently those data points exist in S3 and MongoDB but are only surfaced on the Analytics page as aggregate win-rate charts.

The Agency Brain turns every past proposal into a **calibration input** for the next one.

Here is the problem it solves that nobody has named yet:

Every agency has systematic blind spots in their estimation patterns. They consistently underestimate API integration work. They over-engineer authentication. They scope mobile development too tightly. They always add a QA phase when the client mentions "healthcare" and omit it when the client says "startup." These patterns are invisible to the agency — they feel like individual judgment calls each time.

Over 20 proposals, these patterns become statistically observable. Over 50, they are predictive. The Agency Brain surfaces them, quantifies them, and injects them directly into the next proposal generation as calibration context.

The result: every new proposal Proplytics generates is not just based on the client brief. It is based on the brief filtered through the accumulated institutional knowledge of that specific agency's bidding history, win patterns, and estimation accuracy.

**No general-purpose AI tool can replicate this because it requires your specific data.**

---

## What Agency Brain Does

### Layer 1 — Pattern Extraction Engine (Background Job)

Runs after every new proposal is created or when a deal status changes to Won or Lost. Analyzes the growing proposal corpus in MongoDB/S3 and extracts these signal categories:

**Estimation Calibration Signals:**
Compares effort estimates across proposals that went to Won vs Lost status. Identifies: do proposals with higher Frontend effort estimates tend to win or lose? Do proposals that estimate > 8 weeks for a project tend to lose to scope objections? This becomes an "Estimation Bias Profile" for the agency.

**Tech Stack Win Patterns:**
Across all generated proposals, which technology combinations appear most in Won proposals vs Lost? This is extracted directly from the proposal JSON features array. If 80% of your Won proposals involve React + Node.js but only 40% involve Python, and your win rate on Python proposals is 22% vs 61% on JavaScript proposals — that is signal.

**Scope Complexity Correlation:**
Compares the number of features extracted from Won vs Lost briefs. Identifies optimal scope range: agencies often lose when proposals have fewer than 5 or more than 14 distinct features. The sweet spot becomes visible.

**Confidence Score Calibration:**
Compares the Confidence Grid scores of Won proposals vs Lost proposals. If your Won proposals have an average confidence of 74% and your Lost proposals average 51%, then proposals below a confidence threshold are statistically risky — and future generation can flag this automatically.

**Client Industry Patterns:**
Extracted from the brief text itself using keyword classification. If healthcare briefs tend to win at 70% but e-commerce briefs at 34%, the agency has a specialization signal they may not have consciously noticed.

### Layer 2 — Calibration Injection (Generation Time)

When a new proposal is generated, the Agency Brain injects a calibration block into the prompt that the agency never sees directly but that fundamentally shapes the output:

The calibration block tells Gemini:

- "This agency has historically underestimated authentication implementation by an average of 1.2 weeks across 8 projects. Adjust accordingly."
- "This agency's Won proposals average 7.4 features. The current brief suggests 12 features — flag complexity in the executive summary."
- "This agency has a 68% win rate on React projects and 29% on Vue projects. No tech stack preference is expressed in this brief — default to the agency's stronger stack."
- "The average Confidence Grid score of this agency's Won proposals is 74%. Current generation target: aim for composite score ≥ 70%."

This calibration context is explicitly marked as internal to the prompt and does not appear in the output — it shapes the reasoning without cluttering the proposal.

### Layer 3 — Agency Intelligence Dashboard (New Page: /agency-brain)

A dedicated page showing the extracted intelligence about the agency's proposal patterns. Not analytics (that page already exists). This is **actionable intelligence** presented as a series of insight cards:

**Insight Card types:**
- "Your React proposals win 2.3× more often than your Python proposals. Your last 3 Python proposals were all marked Lost."
- "Your average effort estimate for API integration is 2.1 weeks. Your Won proposals average 2.8 weeks for the same scope. You may be under-scoping integrations."
- "Your win rate drops sharply above 10-feature proposals (18%) vs below 10 features (61%). Consider splitting large briefs into phases."
- "Your strongest performing brief category: healthcare + SaaS. Your weakest: e-commerce + mobile."
- "Proposals with Confidence Grid scores above 72% have a 64% win rate. Proposals below 72% win 28% of the time."

Each insight card shows:
- The pattern title
- The data behind it (sample size, percentages)
- A direct action recommendation
- A "Apply to Next Generation" toggle — when on, this insight is included in the calibration block at generation time

### Layer 4 — Pre-Generation Calibration Summary

On the NewProposal page, after BriefScore runs but before the user hits Generate, a new "Agency Calibration" panel appears (collapsible, below BriefScore):

It shows 3–5 of the most relevant active calibration insights for the current brief. Examples:

- "Based on similar briefs: your API integration estimates tend to run 25% low. We'll adjust."
- "This brief mentions 'mobile-first' — your mobile proposals have a 38% win rate. Consider a phased approach."
- "Your last 3 healthcare proposals all Won. This looks like healthcare territory — strong positioning."

The user can toggle individual calibrations off before generating if they disagree with the AI's pattern read.

---

## System Architecture

### Pattern Extraction — MongoDB Aggregation Pipeline

```
Trigger: Fired after every proposal status change (won/lost) or once weekly via a scheduled job

GET /api/agency-brain/analyze (authenticated)

Backend service: agencyBrainService.js
      │
      ├── Query MongoDB proposals collection (all proposals for userId)
      │     Filter: status in [won, lost], min 3 proposals required
      │
      ├── Fetch proposal JSONs from S3 in parallel (Promise.all)
      │     Extract from each: features[], effortEstimates, techStack, timeline, confidenceScores
      │
      ├── Run pattern extractors (pure JS, no LLM needed):
      │     • techStackWinRate()          → { react: 0.67, python: 0.29, vue: 0.31 }
      │     • effortCalibrationDelta()    → { apiIntegration: +1.2wks, auth: +0.4wks }
      │     • featureCountWinCorrelation() → { optimal: [5,10], dropoff: ">10" }
      │     • confidenceScoreThreshold()  → { wonAvg: 74, lostAvg: 51, threshold: 68 }
      │     • industryWinRate()           → { healthcare: 0.71, ecommerce: 0.34 }
      │
      ├── Write extracted patterns to MongoDB:
      │     agencyPatterns collection:
      │     { userId, extractedAt, patterns: { ...above }, sampleSize: N }
      │
      └── Return patterns object to frontend
```

### Calibration Injection — Generation Prompt Augmentation

```
User clicks "Generate" on NewProposal page
      │
      ▼
GET /api/agency-brain/calibration?briefText={...}  (called before /api/generate)
      │
      ▼
Backend:
  1. Load latest agencyPatterns from MongoDB for this userId
  2. Run brief classifier: extract tech keywords + industry signals from briefText
  3. Score relevance of each pattern against the current brief
  4. Select top 5 most relevant active patterns
  5. Format calibration block (structured text, not JSON):
     "AGENCY CALIBRATION CONTEXT (do not include in output):
      - This agency underestimates API integration by ~1.2 weeks historically
      - Won proposals average 7.4 features; this brief suggests ~{N} features
      - Win rate on {detected industry}: {X}%
      ..."
  6. Return calibration block text
      │
      ▼
Frontend injects calibration block into the generate request body:
  POST /api/generate { briefText, calibrationContext }
      │
      ▼
Backend promptBuilder.js — already exists, add new section:
  System prompt appends calibration block before the user brief
  Wrapped in clearly-marked tags so it cannot bleed into output
```

### Agency Brain Dashboard Data Flow

```
GET /api/agency-brain/insights (authenticated)
      │
      ▼
Backend returns: latest agencyPatterns + sample sizes + formatted insight strings
      │
      ▼
Frontend AgencyBrain.jsx page renders:
  • Pattern strength indicator (how many proposals the pattern is based on)
  • Insight cards with data-backed metrics
  • "Apply to Next Generation" toggles (stored in Zustand agencyBrainStore)
  • Minimum data requirement notice: "You need 5 completed proposals to see patterns"
```

---

## New Files

### Backend

```
backend/src/
└── routes/
    └── agencyBrain.js              ← GET /api/agency-brain/analyze
                                       GET /api/agency-brain/insights
                                       GET /api/agency-brain/calibration

└── services/
    └── agencyBrainService.js       ← Pattern extraction logic (pure JS aggregators)
    └── calibrationInjector.js      ← Relevance scoring + calibration block formatter

└── models/
    └── AgencyPattern.js            ← Mongoose schema for extracted patterns

└── utils/
    └── patternExtractors/
        ├── techStackWinRate.js
        ├── effortCalibrationDelta.js
        ├── featureCountCorrelation.js
        ├── confidenceThreshold.js
        └── industryClassifier.js
```

### Frontend

```
src/
└── pages/
    └── AgencyBrain.jsx             ← New page: /agency-brain

└── components/
    └── agencyBrain/
        ├── InsightCard.jsx         ← Individual insight with toggle + data backing
        ├── PatternStrengthBar.jsx  ← Visual indicator: how many proposals back this
        ├── CalibrationPanel.jsx    ← Pre-generation panel in NewProposal.jsx
        ├── InsufficientDataState.jsx ← "Needs 5 proposals" empty state
        └── AgencyBrainHeader.jsx   ← Page header with last-analyzed timestamp

└── stores/
    └── agencyBrainStore.js         ← Active calibration toggles, patterns cache

└── components/layout/
    └── Sidebar.jsx                 ← Add "Agency Brain" nav item with ✨ badge
```

---

## 3-Day Execution Plan

### Day 1 — Pattern Extraction Engine + MongoDB

**Morning:**
1. Create `AgencyPattern.js` Mongoose schema — stores all extracted pattern types as a flexible document
2. Write all five `patternExtractors/` modules — pure JavaScript math functions that take an array of proposal objects and return pattern objects. No LLM. No API calls. These are deterministic aggregators.
3. Write `agencyBrainService.js` — orchestrates the extractors: fetch all proposals for userId, batch-fetch JSONs from S3 with Promise.all, run extractors, write AgencyPattern document to MongoDB

**Afternoon:**
4. Create `agencyBrain.js` route — GET /analyze (triggers extraction, returns patterns), GET /insights (returns formatted insight strings from stored patterns)
5. Write `calibrationInjector.js` — GET /calibration route: load stored patterns, classify the incoming brief text by tech keywords and industry signals, score and select top 5 relevant patterns, format as a calibration block string
6. Register routes, test with Postman using real proposal data

**End of Day 1 Gate:** Pattern extraction runs on a real set of proposals and produces statistically meaningful output. The /calibration endpoint returns a relevant, correctly scoped calibration block for a test brief.

### Day 2 — Calibration Injection into Generation + Calibration Panel UI

**Morning:**
1. Modify `backend/src/services/llmService.js` (or promptBuilder) to accept an optional `calibrationContext` parameter and prepend it to the system prompt inside clearly-marked tags
2. Modify `POST /api/generate` handler to accept `calibrationContext` in the request body and pass it through to the prompt builder
3. Test: generate a proposal with calibration context vs without, verify the calibration does not appear in the output but measurably affects estimates

**Afternoon:**
4. Build `CalibrationPanel.jsx` — compact component that appears between BriefScore and the Generate button in `NewProposal.jsx`. Fetches /calibration after BriefScore completes (has brief text by then). Shows 3–5 relevant insight chips with individual toggles.
5. Wire `agencyBrainStore.js` Zustand store — stores toggle state, feeds into the generate API call as calibrationContext
6. Build `PatternStrengthBar.jsx` — a small indicator showing sample size underneath each calibration chip ("based on 8 proposals")

**End of Day 2 Gate:** Full calibration loop works: generate 3 proposals → mark Won/Lost → see patterns extract → open NewProposal → CalibrationPanel shows relevant insights → generate with calibration context → observe measurable prompt influence.

### Day 3 — Agency Brain Dashboard Page

**Morning:**
1. Build `InsightCard.jsx` — the core display unit. Shows: insight title, the supporting data (percentages, sample sizes), a plain-English recommendation, an "Apply to Next Generation" toggle, and a color-coded strength indicator (Anecdotal / Emerging / Confirmed based on sample size thresholds: <5 / 5–15 / >15)
2. Build `AgencyBrain.jsx` page — header with last-analyzed timestamp, grid of InsightCards, insufficient data empty state, "Re-analyze" button
3. Add "Agency Brain" to Sidebar navigation with a subtle ✨ icon

**Afternoon:**
4. Polish: animate InsightCards in with Framer Motion stagger on page load. Add a loading skeleton for the analysis fetch. Respect the existing design token system (same color palette as Confidence Grid cards).
5. Wire "Apply to Next Generation" toggles to Zustand store so they persist within session
6. Handle edge cases: <3 proposals (don't run analysis, show encouraging empty state), proposals with missing fields (skip gracefully in extractors)

**End of Day 3 Gate:** /agency-brain page fully renders with insight cards, toggles work, the page is reachable from sidebar, and the minimum data state is handled gracefully.

---

## Success Checklist

- [ ] Pattern extraction runs without error on a corpus of 5+ proposals
- [ ] All five pattern extractor modules produce numerically correct output
- [ ] Calibration block is correctly injected into the system prompt without appearing in output
- [ ] Calibration panel appears in NewProposal between BriefScore and Generate button
- [ ] Individual calibration toggles correctly include/exclude patterns from the generation context
- [ ] AgencyBrain dashboard renders all insight types
- [ ] Sample size strength bar correctly shows Anecdotal/Emerging/Confirmed thresholds
- [ ] "Re-analyze" button triggers fresh pattern extraction
- [ ] < 3 proposals shows the "not enough data" empty state gracefully
- [ ] Sidebar nav item routes to /agency-brain

---

## Why This Feature Has No Competitor

No proposal tool on the market learns from your proposal history and feeds that learning back into your next generation. Proposify, PandaDoc, Qwilr, and every AI writing tool treat each proposal as a fresh start. Agency Brain is the first feature in the category that creates **compounding value** — the platform becomes more accurate and more useful the more you use it. After 50 proposals, your Proplytics is meaningfully better than a competitor's Proplytics. After 200 proposals, it is practically a different product. That is a structural competitive moat that cannot be copied without the data.

---
---

# MVP F2 — TriProposal
## **Three-Strategy Parallel Proposal Generation**
### *"Lean, Standard, or Premium — let the client choose their ambition level."*

> **Build time: 2 days**
> **Depends on: existing /api/generate pipeline, existing S3 versioning, existing ProposalResult page components**
> **New infrastructure: zero**
> **This is the feature that repositions Proplytics from 'proposal generator' to 'strategic advisor'**

---

## The Core Insight

Every client brief contains a negotiable core. The features the client asked for are not the minimum they will accept or the maximum they would love. There is a band — a Lean version that delivers the outcome without the extras, a Standard version that matches the brief exactly, and a Premium version that exceeds expectations and positions the agency as strategic rather than just executional.

Right now Proplytics generates one proposal per brief. The agency gets the Standard interpretation by default. They never know if the Lean version would have won on price, or if the Premium version would have unlocked a bigger scope conversation.

**TriProposal generates all three in parallel, in one click.**

The three strategies are defined by explicit generation directives that modify how Gemini interprets the same brief:

| Strategy | Directive Logic | Key Differences |
|:---|:---|:---|
| **Lean** | Minimum viable scope. Core outcomes only. No nice-to-haves. Fastest timeline. Lowest effort estimate. High confidence because scope is tight. | Fewer features, shorter timeline, lower budget, conservative risk |
| **Standard** | Faithful interpretation of the brief as written. The same output the current system produces. | The existing generation behavior |
| **Premium** | Strategic enhancements the client didn't ask for but would benefit from. Additional phases, deeper architecture, proactive risk mitigation, scalability considerations. Positions agency as a thought partner. | More features, longer timeline, higher budget, explicit value justification per addition |

---

## What TriProposal Does

### Generation Flow

User checks a "Generate 3 Strategies" toggle in the NewProposal page before clicking Generate. The existing Generate button label changes to "Generate 3 Proposals."

Three SSE streams open in parallel. The frontend renders three side-by-side loading skeletons. As each stream completes, the corresponding proposal card fills in progressively — the same animation behavior as the existing single proposal, but three columns simultaneously.

Each of the three generated proposals is:
- Stored in S3 as a separate proposal document with its own proposalId
- Indexed in MongoDB with a `tripId` linking all three to the same generation session
- Tagged with strategy: "lean" | "standard" | "premium"
- Fully functional: can be exported, shared via portal, negotiated via chat, and tracked for win/loss

### TriProposal Comparison View

After generation completes, a dedicated comparison view (new route: `/tri/:tripId`) renders all three proposals in a three-column comparison layout. The user can:

- Scan the Confidence Grid scores across all three — the Lean version will show higher confidence (tighter scope = more certainty) while Premium will show more Medium scores (expanded scope = more uncertainty)
- Compare timeline bars side by side
- Compare effort estimates by layer
- Compare feature counts and feature categories
- See a "Price Delta" indicator between strategies (derived from effort estimates)
- Select which proposal(s) to send to the client via the Share Portal

### Client-Facing Multi-Proposal Portal

When sending via ClientPortal, the agency can optionally share all three proposals in a single portal view. The client sees three clearly labelled cards with a brief description of each strategy and a "Request this approach" button. Clicking any card triggers the client feedback form pre-filled with the strategy name. This is the most sophisticated proposal delivery experience in the market.

### Strategy-Aware Prompt Engineering

The three generation calls share the same brief and base system prompt. The only difference is an injected Strategy Directive at the top of each call:

**Lean Directive:**
"Generate a minimum viable scope proposal. Preserve only the core outcome the client needs. Eliminate all nice-to-have features. Minimize timeline. Use the simplest appropriate tech stack. Confidence scores should reflect the tight, well-defined scope."

**Standard Directive:**
"Generate a faithful interpretation of the brief as written. Do not add or remove scope. Estimate accurately."

**Premium Directive:**
"Generate an enhanced strategic proposal that fulfills the brief and proactively extends it. Add phases or features the client would benefit from but did not explicitly request. Include rationale for each addition. Position the agency as a strategic thought partner, not just an executor. Confidence scores should reflect the expanded scope uncertainty honestly."

---

## System Architecture

### Parallel Generation

```
User clicks "Generate 3 Proposals"
      │
      ▼
Frontend opens THREE concurrent SSE connections:
  EventSource('/api/generate', { body: { ...briefData, strategy: 'lean' } })
  EventSource('/api/generate', { body: { ...briefData, strategy: 'standard' } })
  EventSource('/api/generate', { body: { ...briefData, strategy: 'premium' } })
      │
      ▼
Backend: /api/generate route already exists
  New: reads optional `strategy` field from request body
  New: promptBuilder injects strategy directive before user brief
  Otherwise: identical pipeline (Zod validation, S3 save, MongoDB index)
      │
      ▼
Each proposal saved with:
  { ..., strategy: "lean"|"standard"|"premium", tripId: uuid }
      │
      ▼
MongoDB proposals — new fields:
  strategy: string
  tripId: string (shared across all three proposals in a session)
      │
      ▼
After all three complete:
  POST /api/trips { tripId, proposalIds: [id1, id2, id3] }
  → Saved as a TriProposal session for /tri/:tripId route
```

### Comparison View Data Flow

```
GET /api/trips/:tripId
      │
      ├── Fetch trip document from MongoDB (three proposalIds)
      ├── Fetch all three proposal JSONs from S3 in parallel
      └── Return { lean: proposalJSON, standard: proposalJSON, premium: proposalJSON }
      │
      ▼
Frontend /tri/:tripId page
  Renders three-column layout using existing proposal components in compact form
  ComparisonRow components align the same data fields across all three columns
```

---

## New Files

### Backend

```
backend/src/
└── routes/
    └── trips.js                    ← POST /api/trips (save session), GET /api/trips/:tripId

└── models/
    └── Trip.js                     ← { tripId, userId, proposalIds[3], strategy tags, createdAt }

└── services/
    └── promptBuilder.js            ← MODIFY: add injectStrategyDirective(briefPrompt, strategy)
    └── generate.js (route)         ← MODIFY: read strategy from request body, pass to promptBuilder
```

### Frontend

```
src/
└── pages/
    └── TriProposal.jsx             ← Route: /tri/:tripId — 3-column comparison view

└── components/
    └── triproposal/
        ├── StrategyToggle.jsx          ← Toggle in NewProposal: single vs 3-strategy mode
        ├── TriLoadingColumns.jsx       ← 3 side-by-side skeleton columns during generation
        ├── ComparisonColumn.jsx        ← Single strategy column: compact proposal view
        ├── ComparisonRow.jsx           ← Aligns a specific field across all 3 columns (e.g. timeline)
        ├── PriceDeltaBadge.jsx         ← "Standard is ~30% more than Lean"
        ├── StrategyBadge.jsx           ← Lean / Standard / Premium label chip
        └── MultiPortalShareModal.jsx   ← Send 1, 2, or all 3 via ClientPortal

└── hooks/
    └── useTriGeneration.js             ← Manages 3 concurrent SSE connections + state
```

---

## 2-Day Execution Plan

### Day 1 — Backend Modification + Trip Storage

**Morning:**
1. Modify `promptBuilder.js` — add `injectStrategyDirective(strategy)` function that prepends the correct strategy directive text before the brief. Only three lines of routing logic — Lean/Standard/Premium → directive string. Standard returns the directive as empty string (existing behavior unchanged).
2. Modify `/api/generate` route to read `strategy` from request body (optional, defaults to "standard") and pass to promptBuilder.
3. Create `Trip.js` Mongoose model — minimal: tripId, userId, array of three proposalIds with their strategy tags, createdAt.
4. Create `trips.js` route: POST to save a trip after generation, GET to fetch all three proposals for a tripId.

**Afternoon:**
5. Test all three strategy generation calls with Postman. Compare outputs: verify Lean has fewer features, shorter timeline, Premium has extra phases and rationale. The prompt directive must produce meaningfully different output — if not, tune the directive wording.
6. Test parallel generation: fire three concurrent curl requests, verify all three complete and save to S3 with correct strategy tags and shared tripId.

**End of Day 1 Gate:** Three strategy-differentiated proposals generate from the same brief. Trip linking works. All three are addressable by tripId.

### Day 2 — Frontend: TriGeneration Mode + Comparison View

**Morning:**
1. Build `StrategyToggle.jsx` — a simple switch below the Generate button on NewProposal. When on, changes button label. Compact with a brief explanation of the three strategies.
2. Build `useTriGeneration.js` hook — opens three concurrent EventSource connections, maintains separate streaming buffers and completion state for each, fires POST /api/trips when all three complete.
3. Build `TriLoadingColumns.jsx` — three side-by-side skeleton columns. Each skeleton fills progressively as the corresponding stream delivers sections. Animate each column independently using the existing SectionSkeleton component.

**Afternoon:**
4. Build `TriProposal.jsx` comparison page — fetches trip data, renders three `ComparisonColumn` components. Add `ComparisonRow` for the key comparable data points: feature count, total timeline weeks, top 3 risks, composite confidence score, effort total.
5. Build `PriceDeltaBadge.jsx` — computes effort estimate totals across all three strategies and shows percentage deltas ("Premium is 2.4× Lean").
6. Build `MultiPortalShareModal.jsx` — checkboxes for which strategies to share, creates portal links for each selected one, shows a combined shareable message the agency can paste into email.

**End of Day 2 Gate:** Toggle works on NewProposal. Three skeleton columns load in parallel. Comparison view at /tri/:tripId renders all three proposals side by side. Price delta badges show. Multi-portal share creates links.

---

## Success Checklist

- [ ] Strategy toggle appears on NewProposal page without disrupting existing single-generate flow
- [ ] Lean proposal has measurably fewer features and shorter timeline than Standard
- [ ] Premium proposal has additional phases/features with explicit rationale for each addition
- [ ] All three proposals are saved to S3 with distinct proposalIds and shared tripId
- [ ] Three skeleton columns animate independently during parallel generation
- [ ] /tri/:tripId page renders all three proposals in columns
- [ ] ComparisonRows correctly align the same data field across all three columns
- [ ] PriceDeltaBadge correctly computes effort total deltas
- [ ] MultiPortalShareModal generates working portal links for selected strategies
- [ ] Existing single-proposal generation flow is 100% unchanged when toggle is off

---

## Why This Feature Wins

The strategic three-tier proposal is a well-established sales technique in professional services. McKinsey, Bain, Accenture — every top firm gives clients options rather than a single take-it-or-leave-it. Small agencies never do this because it takes three times as long to produce. TriProposal makes it free. The agency looks instantly more sophisticated. The client feels in control. And the data shows: giving clients options increases close rates because it converts a binary "yes/no" decision into a "which one" decision. A client who says no to the Premium might say yes to the Standard. A client who would have negotiated the Standard down might take the Lean immediately. TriProposal captures all of that value in one feature.

---
---

# MVP F3 — Team Workspace
## **Real-Time Proposal Collaboration with Role-Based Access**
### *"Your agency's proposals are a team sport. Proplytics becomes the pitch room."*

> **Build time: 2 days**
> **Addresses: the #1 "Planned" item on the official roadmap**
> **New infrastructure: zero (WebSocket via existing Express, MongoDB for membership)**
> **This is the feature that makes Proplytics a team-priced product, not a per-seat one**

---

## The Core Insight

The current Proplytics is a single-user system. One person generates a proposal, one person negotiates it via chat, one person shares it. In the real agency world, proposals involve at minimum three people: the business development person (writes the brief), the technical lead (validates the estimates), and the account manager (approves the pricing and strategy). Often a fourth — a copywriter or creative director — polishes the language before it goes to the client.

All four of these people are currently locked out. There is no way to share a proposal internally, leave a comment, request a review, or see what your colleague changed.

**Team Workspace gives Proplytics a workspace model.** Proposals become shared assets with access control, not private documents.

This is also the unlock for the Agency plan pricing tier: $149/month is justified by unlimited users, and unlimited users requires a workspace model.

---

## What Team Workspace Does

### Workspaces and Members

Every user account can create a **Workspace** — a named container for proposals, members, and shared settings. The user who creates it is the Owner.

The workspace has three roles:

| Role | What They Can Do |
|:---|:---|
| **Owner** | Full access: invite, remove, delete workspace, access billing, see all proposals |
| **Editor** | Generate proposals, negotiate via chat, export, share via portal, update deal status |
| **Viewer** | View all proposals and analytics in read-only mode; cannot generate or export |

Invitations are sent via email (Nodemailer, already in the stack). The invite link contains a signed JWT that pre-authenticates the join action — the new member clicks the link, sets a password if new to Proplytics, and lands directly in the workspace.

All proposals created by any workspace member are visible to all other members according to their role. The MongoDB proposal ownership model expands from `userId` to `workspaceId + userId`.

### Proposal Comments

Any workspace member can leave threaded comments on specific sections of a proposal. Comments appear as annotation markers on the relevant section in the ProposalResult view.

**Comment types:**
- **Review Request** — "Can you check the API integration estimate? I think it's too low."
- **Approval** — Member marks a section as approved (section gets a green checkmark)
- **Question** — Flagged for the proposal generator to answer
- **Edit Note** — Suggests a specific change

Comments are stored in MongoDB as a subdocument on the proposal metadata. The comment thread renders in a collapsible sidebar panel on the ProposalResult page — separate from the ProposalChat sidebar which is for AI negotiation.

### Real-Time Presence Indicators

When multiple workspace members have the same proposal open, each member sees the avatars of other currently-viewing members in the proposal header — the same pattern used by Figma, Notion, and Google Docs. No real-time co-editing of proposal content (that would require conflict resolution logic far beyond a 2-day build) — but presence awareness shows who is reviewing at the same time.

Implemented via lightweight polling (every 5 seconds: POST /api/proposals/:id/presence, returns list of active viewers). Not WebSocket. Polling is sufficient for presence and avoids infrastructure complexity.

### Workspace Dashboard

A new `/workspace` page replaces the personal `/dashboard` as the primary landing page for workspace members. It shows:
- All proposals created by any workspace member (not just the current user)
- Member activity feed: "Suvam generated 'TechCorp CRM Proposal' · 2 hours ago"
- Proposal assignment: the Owner or Editor can assign a proposal to a specific member for review
- Workspace-level analytics: aggregate win rate across all member proposals

---

## System Architecture

### Workspace and Member Data Model

```
MongoDB: workspaces collection
{
  _id, name, slug, ownerId, createdAt,
  members: [
    { userId, role: "owner"|"editor"|"viewer", joinedAt, invitedBy }
  ],
  invitePending: [
    { email, role, token, expiresAt }
  ]
}

MongoDB: proposals collection — add field:
  workspaceId: ObjectId | null   (null for personal proposals, set for workspace proposals)
```

### Invitation Flow

```
Owner clicks "Invite Member" in Workspace Settings
      │
      ▼
POST /api/workspace/invite
  { email, role: "editor"|"viewer" }
      │
      ▼
Backend:
  1. Generate invite token: crypto.randomUUID()
  2. Hash token, store in workspace.invitePending with 72hr expiry
  3. Send invite email via Nodemailer:
     Subject: "[Owner Name] invited you to Proplytics workspace"
     Body:    "Join link: /join/{rawToken}"
      │
      ▼
Invitee clicks link → GET /join/:token
      │
      ├── Verify token against hashed value in workspaces.invitePending
      ├── If user exists: add to workspace.members, remove from invitePending
      └── If new user: redirect to /register with workspaceJoinToken in query param
            → After registration, join logic runs automatically
```

### Proposal Comments

```
MongoDB: proposals collection — add field:
  comments: [
    {
      _id, authorId, authorName, section: string,
      type: "review"|"approval"|"question"|"edit_note",
      body: string, resolved: boolean,
      createdAt, resolvedAt, resolvedBy
    }
  ]

POST /api/proposals/:id/comments
  { section, type, body }
  → Authenticated, workspace membership check
  → Push to proposal.comments array
  → Return updated comments array

PATCH /api/proposals/:id/comments/:commentId
  { resolved: true }
  → Mark resolved

GET is embedded in the existing GET /api/proposals/:id response
```

### Presence Polling

```
Every 5s while proposal page is open:
  POST /api/proposals/:id/presence (fire-and-forget)
      │
      ▼
Backend: upsert presence record in MongoDB:
  { proposalId, userId, userName, avatarInitials, lastSeenAt }
  → Index with TTL of 15 seconds on lastSeenAt

GET /api/proposals/:id/presence
  → Return all presence documents where lastSeenAt > (now - 15s)
  → Frontend polls this every 5s, renders avatar stack in proposal header
```

---

## New Files

### Backend

```
backend/src/
└── models/
    └── Workspace.js                ← Mongoose schema for workspaces + members + invites

└── routes/
    ├── workspace.js                ← CRUD for workspaces, member management
    ├── workspaceInvite.js          ← POST /invite, GET /join/:token
    └── proposalComments.js         ← POST, PATCH comments on proposals
    └── proposalPresence.js         ← POST /presence, GET /presence

└── services/
    ├── workspaceService.js         ← Membership checks, invite token management
    └── inviteEmailService.js       ← Nodemailer invite email (reuse existing Nodemailer setup)

└── middleware/
    └── workspaceAuth.js            ← Middleware: verify userId is a member of the workspaceId
```

### Frontend

```
src/
└── pages/
    ├── Workspace.jsx               ← Route: /workspace — workspace-aware dashboard
    ├── WorkspaceSettings.jsx       ← Route: /workspace/settings — invite, roles, danger zone
    └── JoinWorkspace.jsx           ← Route: /join/:token — invitation acceptance page

└── components/
    └── workspace/
        ├── MemberList.jsx              ← Shows all workspace members + roles
        ├── InviteModal.jsx             ← Email input + role selector + send invite
        ├── PresenceStack.jsx           ← Hoverable avatar stack in proposal header
        ├── ActivityFeed.jsx            ← "Suvam generated X · 2hr ago" timeline
        └── WorkspaceProposalCard.jsx   ← Extended proposal card showing author

    └── comments/
        ├── CommentsSidebar.jsx         ← Slide-over panel on ProposalResult
        ├── CommentThread.jsx           ← Individual section comment + reply
        ├── CommentInput.jsx            ← Type + type selector + submit
        ├── CommentMarker.jsx           ← Visual annotation dot on section header
        └── ApprovalBadge.jsx           ← Green checkmark when section is approved

└── hooks/
    └── usePresence.js                  ← 5-second polling for presence, cleans up on unmount
    └── useWorkspace.js                 ← Workspace data, member list, role checks

└── stores/
    └── workspaceStore.js               ← Current workspace, member list, role of current user
```

---

## 2-Day Execution Plan

### Day 1 — Backend: Workspace Model + Invite Flow + Comments

**Morning:**
1. Create `Workspace.js` Mongoose schema
2. Write `workspaceService.js` — invite token generation, membership check function (used as middleware in all workspace-scoped routes)
3. Create `workspace.js` routes: POST create workspace, GET current workspace, PATCH update name
4. Create `workspaceInvite.js` routes: POST /invite (generate token, send email), GET /join/:token (validate + add member)
5. Write `inviteEmailService.js` — uses existing Nodemailer setup. Invite email is minimal: clear call-to-action with the join link.

**Afternoon:**
6. Add `workspaceId` field to Proposal model schema
7. Create `proposalComments.js` routes — POST add comment, PATCH resolve comment. Comments are embedded in the proposal document.
8. Create `proposalPresence.js` routes — POST upsert presence with 15s TTL, GET active viewers. Use MongoDB TTL index on `lastSeenAt` field.
9. Create `workspaceAuth.js` middleware — reads workspaceId from request, verifies current userId is a member, attaches role to req.workspace.

**End of Day 1 Gate:** Workspace can be created. Invite email sends correctly. Join link adds the user to workspace.members. Proposal comments POST and PATCH work. Presence upsert and GET work with TTL behavior.

### Day 2 — Frontend: Workspace Dashboard + Comments + Presence

**Morning:**
1. Build `workspaceStore.js` Zustand store — currentWorkspace, members, currentUserRole
2. Build `useWorkspace.js` hook — fetch workspace on auth, expose role-check helpers (canEdit, canViewOnly)
3. Build `Workspace.jsx` page — workspace-aware dashboard that queries proposals with workspaceId filter. Renders `WorkspaceProposalCard` (adds "by [author]" to existing proposal cards). Shows `ActivityFeed` alongside the proposal list.
4. Build `WorkspaceSettings.jsx` page — member list with role indicators, `InviteModal`, remove member button (Owner-only)

**Afternoon:**
5. Add `PresenceStack.jsx` to `ProposalResult.jsx` header — renders avatar initials for concurrent viewers
6. Build `CommentsSidebar.jsx` and wire into `ProposalResult.jsx` — separate from the ProposalChat sidebar (different button in the action bar: "Comments" vs "Negotiate")
7. Add `CommentMarker.jsx` dot to each proposal section header when unresolved comments exist for that section
8. Build `JoinWorkspace.jsx` page — shows workspace name, inviter name, role being granted, accept button
9. Wire `usePresence.js` hook into ProposalResult — starts polling when page mounts, stops on unmount

**End of Day 2 Gate:** Workspace dashboard shows all team proposals. Invite flow is end-to-end. Comments can be added, resolved, and appear as section markers. Presence avatars appear in the proposal header when multiple members view simultaneously.

---

## Success Checklist

- [ ] Workspace can be created with a name and slug
- [ ] Invite email sends to a new address
- [ ] Join link correctly adds the user to workspace.members with correct role
- [ ] Workspace dashboard shows proposals from all members
- [ ] Role-based access: Viewer cannot click Generate or Export
- [ ] Comment can be posted to a specific section
- [ ] Comment marker dot appears on section header when unresolved comments exist
- [ ] Comment can be marked resolved, marker disappears
- [ ] Presence stack shows correct avatars within 5 seconds of second member opening same proposal
- [ ] Presence avatars disappear within 20 seconds of member leaving the page
- [ ] WorkspaceSettings shows all members and their roles
- [ ] Owner can remove a member; that member loses access immediately

---

## Why This Feature Unlocks Revenue

Without Team Workspace, Proplytics is a personal productivity tool. The Agency pricing tier ($149/month) currently has no hard technical enforcement — a single user could subscribe and use all features. Team Workspace creates the structural requirement for the Agency plan: multiple users require a workspace, and workspace access requires the Agency tier. This converts the pricing model from "nice to have unlimited proposals" to "we structurally need the Agency tier to collaborate." That is the difference between a soft upsell and a hard adoption driver.

---
---

# The 7-Day Master Schedule

```
DAY 1  ─────────────────────────────────────────────────────────────────────
       Agency Brain — Pattern Extraction Engine + MongoDB
       ├── Morning: AgencyPattern model + 5 patternExtractor modules (pure JS)
       └── Afternoon: agencyBrainService.js + routes + Postman validation

DAY 2  ─────────────────────────────────────────────────────────────────────
       Agency Brain — Calibration Injection + CalibrationPanel Frontend
       ├── Morning: promptBuilder.js modification + /api/generate modification + test
       └── Afternoon: CalibrationPanel.jsx + agencyBrainStore.js + wire to NewProposal

DAY 3  ─────────────────────────────────────────────────────────────────────
       Agency Brain — Intelligence Dashboard Page
       ├── Morning: InsightCard.jsx + AgencyBrain.jsx page + PatternStrengthBar
       └── Afternoon: Polish + animations + Sidebar nav + edge case handling

DAY 4  ─────────────────────────────────────────────────────────────────────
       TriProposal — Backend Strategy Injection + Trip Storage
       ├── Morning: promptBuilder strategy directive + /generate modification + Trip model
       └── Afternoon: trips.js route + parallel generation test + output quality validation

DAY 5  ─────────────────────────────────────────────────────────────────────
       TriProposal — Frontend: TriGeneration Mode + Comparison View
       ├── Morning: StrategyToggle + useTriGeneration hook + TriLoadingColumns
       └── Afternoon: TriProposal comparison page + ComparisonRow + PriceDelta + MultiPortalShare

DAY 6  ─────────────────────────────────────────────────────────────────────
       Team Workspace — Backend: Workspace Model + Invite Flow + Comments + Presence
       ├── Morning: Workspace model + workspaceService + invite routes + email
       └── Afternoon: proposalComments routes + proposalPresence routes + workspaceAuth middleware

DAY 7  ─────────────────────────────────────────────────────────────────────
       Team Workspace — Frontend: Dashboard + Comments + Presence + Join Flow
       ├── Morning: workspaceStore + Workspace page + WorkspaceSettings + JoinWorkspace
       └── Afternoon: CommentsSidebar + PresenceStack + wire into ProposalResult + final QA
```

---

# What Proplytics Looks Like After All This

```
STAGE           CURRENT (already built)          AFTER THESE 3 MVPs
───────────────────────────────────────────────────────────────────────────────

INTAKE          BriefScore quality gate           + Agency Brain calibration panel
                                                  + "Based on 24 proposals, adjust..."

GENERATION      Single proposal, streamed         + TriProposal: Lean / Standard / Premium
                                                  + Calibrated by agency history

REVIEW          ProposalChat negotiation          + Team Comments + Section approvals
                                                  + Presence indicators
                Confidence Grid                   + Strategy comparison across 3 variants

DELIVERY        ClientPortal (live interactive)   + Multi-strategy portal
                                                  + Team-managed share links

TRACKING        Win/Loss + Analytics              + Agency Brain: pattern learning
                                                  + Workspace-level aggregate analytics

PLATFORM        Single user                       + Team Workspace
                Personal proposals                + Shared proposals
                Fixed pricing                     + Structural Agency tier enforcement
```

---

## The Compound Value Argument

These three features do not just add functionality in isolation. They create compounding platform value:

**Agency Brain × TriProposal:** The calibration context informs all three strategy variants simultaneously. The Lean variant is calibrated to the agency's fastest historical timelines. The Premium is calibrated to the agency's most ambitious Won proposals. The strategies are not just AI-imagined — they are grounded in the agency's actual track record.

**TriProposal × Team Workspace:** Team members can each advocate for different strategies via the Comments system. The technical lead approves the Standard's architecture. The business development lead champions the Premium. The account manager marks the Lean as approved for price-sensitive clients. The workspace becomes the internal negotiation layer before the proposal even reaches the client.

**Agency Brain × Team Workspace:** Pattern extraction now runs across the entire team's proposal corpus, not just one user's. A team of 5 generates 5× more proposals, so Agency Brain reaches statistical significance 5× faster. The patterns it surfaces reflect the agency's collective intelligence, not just one person's habits.

---

*Three features. Seven days. One platform that thinks like your best employee and works like your whole team.*

*"The fastest proposal wins the deal. The smartest platform wins the year."*
