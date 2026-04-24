# 🚀 Proplytics — Three New MVP Feature Plans
## *7-Day Execution Roadmap · Zero New AWS Services · Full Lifecycle Coverage*

---

> **Total build time: 7 days across 3 features**
> **ProposalChat (Negotiation Engine) is already planned — these are completely additive**
> **All three features use existing infra: ECS, S3, Lambda, API Gateway, CloudFront, SES, MongoDB, Gemini**

---

## The Lifecycle Problem These Three MVPs Solve Together

Right now Proplytics handles one moment in the proposal lifecycle: generation.

But the real lifecycle has five stages, and Proplytics currently covers only one:

```
[1] INTAKE           [2] GENERATION        [3] DELIVERY         [4] TRACKING          [5] CLOSING
Brief arrives   →   Proposal created   →   Sent to client   →   Proposal status   →   Won or lost
    ↑                      ✅                    ❌                   ❌                    ❌
 COVERED              COVERED             NOT COVERED          NOT COVERED           NOT COVERED
 (BriefInput)     (AI Pipeline)         (MVP #2 below)       (MVP #3 below)         (MVP #3 below)
                                                                                   + follow-up emails

PLUS: There is a quality gate BEFORE generation that no one is solving:
    → Is this brief good enough to generate a proposal from?
    → MVP #1 below
```

The three MVPs together transform Proplytics from a **generation tool** into a **full proposal lifecycle platform**.

---

---

# MVP #1 — BriefScore

## **The AI Brief Quality Analyzer**
### *"Know if your brief is proposal-ready before you hit Generate"*

> **Build time: 2 days**
> **Position in lifecycle: Pre-generation quality gate**
> **New AWS services needed: None**

---

## The Problem

The quality of the generated proposal is entirely dependent on the quality of the input brief. A vague brief produces a vague proposal. A proposal with Low confidence scores across the board is almost always the result of a brief that lacked:
- A defined budget range
- Integration requirements
- Timeline constraints
- Clear success criteria
- Named stakeholders or decision-makers

Right now Proplytics accepts any brief and generates from it regardless of quality. The output might be mediocre and the user doesn't know why.

**BriefScore catches this before generation happens.**

The typical agency problem this solves is also client-side: junior account managers paste whatever the client emailed them. BriefScore becomes a coaching layer that trains the team to ask better discovery questions.

---

## What BriefScore Does

When a user pastes or uploads a brief, **before** clicking "Generate Proposal," the system automatically runs a real-time brief quality analysis. This takes 3–5 seconds and streams a structured quality report.

The report produces a **BriefScore** from 0 to 100, broken into six dimensions, each scored independently:

| Dimension | What It Checks | Why It Matters |
|:---|:---|:---|
| **Scope Clarity** | Are the features/deliverables explicitly described or are they vague? | Vague scope → Low confidence feature extraction |
| **Technical Depth** | Are integrations, APIs, platforms, or tech stack mentioned? | Missing tech context → generic architecture estimates |
| **Timeline Signal** | Is there any deadline, launch date, or urgency mentioned? | No timeline → AI cannot calibrate effort estimates |
| **Budget Signal** | Is there any budget range, constraint, or rate card mentioned? | No budget → effort estimates cannot be reality-checked |
| **Stakeholder Definition** | Are roles mentioned (CTO, product owner, end users)? | Missing stakeholders → risk matrix gaps |
| **Success Criteria** | Are measurable outcomes or KPIs defined? | No success criteria → no validation phase in timeline |

The UI shows:
- A large circular score dial (animated fill, color-coded: 0–40 red, 41–70 amber, 71–100 green)
- Six dimension bars, each with a score and a one-sentence diagnostic
- A "Missing Signals" list: specific pieces of information the AI could not find in the brief
- An "Improvement Suggestions" section: 2–4 concrete questions the agency should ask the client before generating

**Two CTA states based on score:**

If score ≥ 70: "Generate Proposal" button is fully active. A small tag shows "Brief Quality: Good"

If score < 70: "Generate Proposal" button shows as amber with a warning tooltip: "Your brief has gaps that may reduce proposal accuracy. Review suggestions or generate anyway." The user can always override.

The score and diagnostic persist in the proposal metadata in MongoDB, so the dashboard can later surface "Proposals generated from Low-quality briefs" as an analytics insight.

---

## System Architecture

```
User pastes/uploads brief in BriefInput component
        │
        │  [Triggers automatically on input debounce — 1.5s after last keystroke]
        │  [OR: user clicks "Analyze Brief" button]
        ▼
POST /api/brief/score
  {
    briefText: string,    ← cleaned, sanitized brief text
    userId: string        ← from JWT
  }
        │
        ▼
Backend: Node.js route (ECS Fargate — same container)
        │
        ├── Token count check — if brief < 50 words, return score: 0 with "Brief too short"
        │
        ├── Build BriefScore prompt:
        │     System: "You are a senior project discovery consultant.
        │              Analyze the following client brief across 6 dimensions.
        │              Return ONLY valid JSON matching the BriefScore schema."
        │     User:   [brief text]
        │
        ├── Call Gemini (temp: 0.1 — maximum determinism, this is scoring not generating)
        │
        ├── Validate response against BriefScoreZodSchema
        │
        └── Return BriefScore JSON to frontend via SSE stream
                │
                ▼
        Frontend renders BriefScorePanel component
        with animated score dial + dimension bars + suggestions
```

### BriefScore JSON Schema (Zod-validated)

```
BriefScore {
  overallScore: number (0-100),
  grade: "Excellent" | "Good" | "Fair" | "Poor",
  readyToGenerate: boolean,
  dimensions: [
    {
      name: string,
      score: number (0-100),
      diagnostic: string,        ← one sentence explaining the score
      missing: string | null     ← what specific info is absent
    }
  ],
  missingSections: string[],     ← list of absent critical elements
  improvementSuggestions: [
    {
      question: string,          ← exact question to ask the client
      impact: "High" | "Medium"  ← impact on proposal quality if addressed
    }
  ],
  estimatedConfidenceBoost: number  ← "Adding these details would improve proposal confidence by ~X%"
}
```

---

## New Files to Create

### Backend

```
backend/
└── routes/
    └── briefScore.js              ← POST /api/brief/score route handler

backend/
└── services/
    └── briefScoreService.js       ← Gemini call, prompt builder, Zod validation

backend/
└── prompts/
    └── briefScorePrompt.js        ← The 6-dimension scoring system prompt

backend/
└── schemas/
    └── briefScoreSchema.js        ← Zod schema for BriefScore JSON
```

### Frontend

```
src/
└── components/
    └── briefScore/
        ├── BriefScorePanel.jsx        ← Main panel — score dial + dimensions + suggestions
        ├── ScoreDial.jsx              ← Animated circular score indicator (SVG + CSS)
        ├── DimensionBar.jsx           ← Individual dimension score bar with diagnostic text
        ├── MissingSignalsList.jsx     ← Chips showing what's absent from the brief
        └── ImprovementSuggestions.jsx ← Expandable list of coaching questions

src/
└── hooks/
    └── useBriefScore.js           ← Debounced trigger, SSE connection, state management

src/
└── pages/
    └── NewProposal.jsx            ← Add: BriefScorePanel below BriefInput, CTA state logic
```

---

## 2-Day Execution Plan

### Day 1 — Backend

**Morning:**
1. Create `briefScoreSchema.js` — define the full Zod schema for the 6-dimension scoring output
2. Write `briefScorePrompt.js` — craft the system prompt that reliably extracts 6 distinct dimension scores. This is the most important work of the day. The prompt must enforce: (a) numerical scores 0–100, (b) specific diagnostics not generic, (c) concrete improvement questions not vague advice
3. Create `briefScoreService.js` — Gemini call at temp 0.1, Zod validation, fallback to default "cannot score" response if validation fails

**Afternoon:**
4. Create `briefScore.js` route — auth middleware, input sanitization (strip HTML, normalize whitespace), minimum length check, service call
5. Register route in main app
6. Test with Postman: 5 different brief quality levels — check that scores correlate correctly with brief quality
7. Tune prompt if scores are inconsistent across identical briefs (temperature 0.1 should keep variance under ±5 points)

**End of Day 1 Gate:** API endpoint returns valid BriefScore JSON for any brief input. Scoring is consistent across repeated calls. Improvement suggestions are concrete and actionable, not generic.

### Day 2 — Frontend

**Morning:**
1. Build `ScoreDial.jsx` — SVG circle with animated stroke-dashoffset fill on mount. Color transitions: red → amber → green based on score. Show score number in center. This is the visual centrepiece.
2. Build `DimensionBar.jsx` — reuse the Confidence Grid visual language (animated progress bar, color-coded, left accent strip). Show dimension name + score + diagnostic text.
3. Build `BriefScorePanel.jsx` — compose ScoreDial + 6 DimensionBars + MissingSignalsList + ImprovementSuggestions in a responsive grid

**Afternoon:**
4. Build `useBriefScore.js` — debounced trigger (1.5s after user stops typing), SSE connection, loading/error states, clear state when brief is wiped
5. Wire BriefScorePanel into `NewProposal.jsx` — appears below BriefInput, fades in when score arrives
6. Wire CTA state: "Generate Proposal" button reads from brief score state to determine warning vs. active state
7. Store score metadata in proposal creation request so MongoDB index captures it

**End of Day 2 Gate:** Full flow works: paste brief → 1.5s → score dial fills with animation → 6 dimension bars appear → improvement suggestions expand. CTA states correctly reflect score quality.

---

## Success Checklist

- [ ] Score between 0–100 is returned for any brief longer than 50 words
- [ ] All 6 dimension bars render with correct colors matching score ranges
- [ ] Score is consistent (±5 points) across 3 repeated calls with the same brief
- [ ] Improvement suggestions are brief-specific, not generic boilerplate
- [ ] Generate button correctly shows warning state when score < 70
- [ ] User can override warning and generate anyway
- [ ] Score is stored in MongoDB proposal index document
- [ ] BriefScorePanel shows graceful skeleton loader while scoring is in progress
- [ ] BriefScorePanel is hidden until user has typed at least 50 words

---

## Why This Feature Wins

BriefScore is the only pre-generation quality gate in any proposal tool on the market. It solves a problem that no competitor has even identified — that the quality bottleneck is not the proposal writer, it's the brief. By surfacing this and coaching the user to fix it, Proplytics directly improves the outcome quality of every proposal it generates, creating a measurable competitive advantage: proposals generated via Proplytics with scores above 80 should have significantly higher confidence scores on the Confidence Grid than those generated from low-score briefs. That correlation becomes a story, and that story becomes a case study.

---
---

# MVP #2 — ClientPortal

## **The Shareable, Trackable Client-Facing Proposal View**
### *"Send a link. Not a PDF attachment. Never again."*

> **Build time: 3 days**
> **Position in lifecycle: Post-generation delivery**
> **New AWS services needed: None (uses existing S3, CloudFront, Lambda, SES)**

---

## The Problem

After Proplytics generates a proposal, the agency has to export a PDF, attach it to an email, and send it — entering a black hole. They have no idea if the client opened it, which section they spent time on, whether they forwarded it to the CTO, or if it's sitting unread in a spam folder.

More importantly: PDF proposals are dead on arrival. They can't be navigated. They can't be filtered. The Confidence Grid — Proplytics' signature feature — renders as a flat image. All the interactivity disappears.

**ClientPortal solves this by keeping the proposal alive, interactive, and tracked.**

---

## What ClientPortal Does

With one click from the ProposalResult page, the agency generates a unique shareable URL for the proposal. This URL:

- Requires no login to access
- Renders the full interactive proposal view (Confidence Grid, timeline, risks, effort estimator — everything) in read-only mode
- Is optionally password-protected (4-digit PIN, stored as bcrypt hash in MongoDB)
- Has a configurable expiry (7 days / 30 days / Never)
- Tracks: first opened timestamp, total view count, last viewed timestamp, approximate time-on-page per section (via scroll depth events)
- Shows a "Request Changes" form — the client types their feedback and hits Submit; the agency receives an SES email with the feedback and a link back to the proposal in their Proplytics dashboard

The agency sees a "Portal Analytics" panel on their ProposalResult page showing: view count, last viewed, which sections the client scrolled past. This is proposal intelligence that no competitor offers.

---

## System Architecture

### Share Link Generation

```
Agency clicks "Share with Client" on ProposalResult page
        │
        ▼
POST /api/proposal/:id/portal
  {
    expiryDays: 7 | 30 | 0,   ← 0 = never expires
    pinProtected: boolean,
    pin: string | null         ← raw 4-digit PIN if pinProtected
  }
        │
        ▼
Backend: Lambda function (short operation, no SSE needed)
        │
        ├── Generate shareToken: crypto.randomUUID() ← 36-char UUID, URL-safe
        │
        ├── Hash PIN with bcrypt if pinProtected (cost factor 10)
        │
        ├── Store portal record in MongoDB:
        │     {
        │       proposalId, userId, shareToken,
        │       expiryAt: Date | null,
        │       pinHash: string | null,
        │       viewCount: 0,
        │       firstViewedAt: null,
        │       lastViewedAt: null,
        │       createdAt: Date
        │     }
        │
        └── Return { shareUrl: "https://main.d22glq95zibf1w.amplifyapp.com/p/{shareToken}" }
```

### Public Portal View (No Auth Required)

```
Client opens: /p/{shareToken}
        │
        ▼
GET /api/portal/{shareToken}  ← No JWT required on this route
        │
        ├── Look up shareToken in MongoDB portals collection
        ├── Check expiry (if expiryAt < now → return 410 Gone)
        ├── If pinProtected → return { requiresPin: true }
        │
        ├── If pin check passes OR not pin-protected:
        │     → Fetch proposal JSON from S3 (using proposalId from portal record)
        │     → Return proposal JSON (read-only, no userId exposed)
        │     → Increment viewCount, set firstViewedAt if null, update lastViewedAt
        │
        └── Frontend renders ProposalPortalView (read-only version of ProposalResult)
```

### View Tracking (Scroll Depth Events)

```
Client scrolls through proposal in browser
        │
        │  [Intersection Observer on each section]
        ▼
POST /api/portal/{shareToken}/event  ← fire-and-forget, non-blocking
  { section: "features" | "timeline" | "risks" | "effort", event: "visible" }
        │
        ▼
Backend: Lambda (fast, no streaming) → append section visibility to MongoDB portal record
```

### Client Feedback (Request Changes)

```
Client types feedback in "Request Changes" form on portal page
        │
        ▼
POST /api/portal/{shareToken}/feedback
  { message: string }
        │
        ├── Store feedback in MongoDB portal record: { feedback: string, submittedAt: Date }
        │
        └── Send SES email to agency user:
              Subject: "Client feedback on: [Proposal Title]"
              Body:    "[Client] left feedback on your proposal:
                        '[feedback text]'
                        View proposal: [link to ProposalResult in Proplytics dashboard]"
```

---

## New Files to Create

### Backend

```
backend/
└── routes/
    ├── portal.js             ← POST /api/proposal/:id/portal (create share link)
    ├── portalView.js         ← GET /api/portal/:token (fetch proposal for client view)
    ├── portalEvent.js        ← POST /api/portal/:token/event (track scroll section)
    └── portalFeedback.js     ← POST /api/portal/:token/feedback (client submits feedback)

backend/
└── services/
    ├── portalService.js      ← Share token generation, MongoDB CRUD, expiry logic
    ├── pinService.js         ← bcrypt hash + compare for PIN protection
    └── sesService.js         ← SES email sender for feedback notifications
```

### Frontend

```
src/
└── pages/
    ├── ProposalPortal.jsx        ← New route: /p/:token — public portal view (no auth)
    └── ProposalResult.jsx        ← Add: "Share with Client" button + ShareModal

src/
└── components/
    └── portal/
        ├── ShareModal.jsx         ← Modal: expiry picker + PIN toggle + generated link + copy button
        ├── PortalAnalyticsPanel.jsx ← Shows view count, last viewed, section heatmap (on ProposalResult)
        ├── PinGate.jsx            ← PIN entry screen for password-protected portals
        ├── ClientFeedbackForm.jsx ← "Request Changes" form on the portal view
        └── PortalBanner.jsx       ← Top banner on portal view: "Shared by [Agency Name] · Expires in X days"

src/
└── hooks/
    └── usePortalTracking.js      ← IntersectionObserver for section scroll events, fire-and-forget POST

src/
└── App.jsx
    └── Add route: /p/:token → ProposalPortal (no auth guard on this route)
```

### MongoDB — New Collection

```
Collection: portals
Schema:
  {
    shareToken: string (unique index),
    proposalId: string,
    userId: string,
    expiryAt: Date | null,
    pinHash: string | null,
    viewCount: number,
    firstViewedAt: Date | null,
    lastViewedAt: Date | null,
    sectionViews: {
      features: number,
      timeline: number,
      risks: number,
      effort: number,
      summary: number
    },
    feedback: string | null,
    feedbackSubmittedAt: Date | null,
    createdAt: Date
  }
```

---

## 3-Day Execution Plan

### Day 1 — Share Link Backend + MongoDB

**Morning:**
1. Create `portals` collection in MongoDB with correct indexes (shareToken unique, proposalId + userId compound)
2. Write `portalService.js` — share token generation, expiry calculation, MongoDB insert
3. Write `pinService.js` — bcrypt hash (cost 10) and compare functions
4. Create `portal.js` route (POST /api/proposal/:id/portal) — auth required, creates the portal record, returns shareUrl

**Afternoon:**
5. Create `portalView.js` route (GET /api/portal/:token) — no auth, expiry check, PIN check, S3 fetch, viewCount increment, return proposal JSON
6. Create `portalEvent.js` route (POST /api/portal/:token/event) — no auth, append section view to MongoDB
7. Create `sesService.js` — SES sendEmail wrapper using existing AWS SDK credentials
8. Create `portalFeedback.js` route — store feedback, trigger SES

**End of Day 1 Gate:** API test with curl. Creating a portal returns a shareToken. Fetching /api/portal/{token} returns the proposal JSON. ViewCount increments. SES email fires on feedback (check SES sandbox or verified email).

### Day 2 — Public Portal Frontend

**Morning:**
1. Add `/p/:token` route to `App.jsx` — no auth guard, loads `ProposalPortal.jsx`
2. Build `PinGate.jsx` — 4-digit PIN input with bcrypt check call, error state, retry limit
3. Build `ProposalPortal.jsx` — fetches proposal via portal API, renders read-only proposal view. Reuses all existing proposal components (ConfidenceCard, RiskCard, EffortCard, TimelineStep) but strips edit controls
4. Build `PortalBanner.jsx` — top sticky banner showing agency branding, expiry, proposal title

**Afternoon:**
5. Build `ClientFeedbackForm.jsx` — slide-up panel triggered by a "Request Changes" floating button, textarea + submit, success state
6. Build `usePortalTracking.js` — IntersectionObserver on each section wrapper, fires POST to /api/portal/:token/event when section enters viewport, debounced to avoid spam
7. Polish: 404/410 error states for expired or invalid tokens, loading skeleton during fetch

**End of Day 2 Gate:** Client-facing portal view renders the full interactive proposal at /p/{token}. PIN gate works. Feedback form submits. Scroll events fire and increment section counters in MongoDB.

### Day 3 — Agency Analytics Panel + Share Modal

**Morning:**
1. Build `ShareModal.jsx` — expiry dropdown (7d / 30d / Never), PIN toggle + input, "Generate Link" button, generated URL display + copy-to-clipboard button, regenerate link option
2. Add "Share with Client" button to `ProposalResult.jsx` action bar (joins the row with "Export PDF" and "Negotiate & Refine")
3. Build `PortalAnalyticsPanel.jsx` — fetches portal record for current proposalId, shows: view count, first/last viewed timestamps, section heatmap bars (features/timeline/risks/effort sorted by view count)
4. Wire analytics panel into `ProposalResult.jsx` — renders below the action bar if a portal exists for this proposal

**Afternoon:**
5. Polish ShareModal: copy button animation, "Link active" vs "Link expired" status chip, "Deactivate link" button (sets expiryAt to now in MongoDB)
6. Mobile audit: portal view must render cleanly at 375px. All existing proposal components are already responsive — verify they adapt correctly in the portal context.
7. End-to-end test: generate proposal → share → open in incognito → verify analytics update → submit feedback → verify SES email arrives

**End of Day 3 Gate:** Complete client-facing sharing flow works. Agency sees analytics. SES feedback email arrives. Link deactivation works.

---

## Success Checklist

- [ ] Share link generated in < 500ms
- [ ] Portal view loads full proposal in < 2s (CloudFront cached S3 fetch)
- [ ] PIN gate blocks access correctly with wrong PIN
- [ ] Expired links return a clear error page, not a blank screen
- [ ] View count increments on each unique page load
- [ ] Section heatmap shows correct view counts for each section
- [ ] Client feedback form submits and triggers SES email to agency
- [ ] SES email contains correct proposal title and link back to dashboard
- [ ] "Deactivate link" immediately blocks further access
- [ ] Portal view shows no agency login UI — clean client-facing experience
- [ ] Confidence Grid animations play correctly in portal (read-only) mode
- [ ] Proposal branding ("Shared by [Agency]") appears in portal banner

---

## Why This Feature Wins

Every proposal tool exports PDFs. Nobody tracks what happens next. ClientPortal is the first feature in a proposal tool that turns the delivered document into a live intelligence asset. The agency knows when the client opens it, how long they spent on each section, whether they looked at the risk matrix (a sign of serious interest), and gets feedback without a single email thread. The section heatmap alone gives agencies insight they've never had: if clients consistently spend the most time on the Risk Matrix and not the Timeline, that's a signal to reposition how risks are framed in the brief. This becomes a product-level insight layer over time.

---
---

# MVP #3 — WinLoss Engine

## **The Proposal Outcome Tracker + AI Follow-Up Generator**
### *"Know your win rate. Never let a lost deal go silent."*

> **Build time: 2 days**
> **Position in lifecycle: Deal tracking + sales closure**
> **New AWS services needed: None (SES already planned, Lambda already exists)**

---

## The Problem

Right now, proposals leave Proplytics and disappear into email threads. There is no outcome data. The agency has no idea:
- What percentage of AI-generated proposals are winning deals
- Whether proposals with higher Confidence Grid scores win more often
- Which industries or project types have the highest win rates
- What to say to a prospect who went silent after receiving the proposal

Closing the feedback loop on proposal outcomes is both a user-retention feature (agencies keep coming back to update statuses) and a data-collection feature (outcome data enables the most powerful future feature: a win rate prediction model).

**WinLoss Engine closes this loop in 2 days.**

---

## What WinLoss Engine Does

### Part 1 — Status Tracking

Every proposal card on the dashboard gets a status selector with four states, shown as a color-coded badge:

| Status | Color | Meaning |
|:---|:---|:---|
| **Pending** | Blue | Proposal sent, awaiting client response |
| **In Negotiation** | Amber | Client is engaged, actively discussing scope |
| **Won** | Green | Deal closed, project starting |
| **Lost** | Red | Client went elsewhere or declined |

The status can be changed from:
- The dashboard proposal card (quick-select dropdown)
- The ProposalResult page header
- An inline edit on the ProposalPortal analytics panel (once MVP #2 is built)

Status changes are a simple MongoDB PATCH — no LLM involved. The intelligence comes after the status is set.

### Part 2 — Won Flow: Kickoff Package Generator

When a proposal is marked **Won**, a slide-up modal triggers automatically:

The modal shows two AI-generated deliverables (generated via a single Gemini call, using the existing proposal JSON as context):

**Deliverable A — Project Kickoff Checklist:**
A structured list of the first 10 actions the agency needs to take to start the project well. Drawn from the timeline phases, risk mitigations, and tech stack in the proposal. Examples: "Set up staging environment matching the proposed AWS architecture," "Schedule discovery workshop with client stakeholders identified in brief," "Obtain API credentials for Salesforce integration (noted as Medium risk)."

**Deliverable B — Kickoff Email:**
A professional email draft to the client confirming the engagement, summarizing the first phase deliverables, and requesting a kickoff call. The email is generated from the proposal's executive summary and Phase 1 timeline. The agency can copy it directly or use it as a starting point.

Both deliverables are displayed in the modal and can be copied with one click. They are also saved to MongoDB in the proposal document so the agency can access them later.

### Part 3 — Lost Flow: Follow-Up Sequence Generator

When a proposal is marked **Lost**, a slide-up modal triggers automatically:

The modal asks one optional context question: "Do you know why you lost? (optional)" with a short textarea. Then it generates a 3-email follow-up sequence using the proposal JSON + any loss reason the user provided:

**Email 1 — Immediate (send same day):**
A gracious "thank you for considering us" email. Not desperate. Reiterates one differentiating value from the proposal's executive summary. Ends with: "We'd love to understand what made the difference in your decision — a 5-minute call would help us serve you better in the future."

**Email 2 — One-week follow-up:**
Addresses a specific risk or concern from the proposal's Risk Matrix that the AI judges as the most likely objection (e.g., if "timeline" had Low confidence, this email addresses timeline flexibility). Includes a soft alternative proposal: "We could structure this differently if budget or timeline was a constraint."

**Email 3 — One-month re-engagement:**
References any industry trend relevant to the project type. Opens a door: "We recently helped a similar company solve [related problem] in [timeframe] — happy to share what we learned if it's useful."

All three emails are displayed in the modal, can be copied individually or as a set, and are sent on-demand via SES. The agency chooses which to send — the system does not auto-send anything.

### Part 4 — WinLoss Analytics Dashboard

A new `/analytics` page (linked from the sidebar) shows aggregate outcome data across all proposals:

- **Win rate**: percentage of proposals marked Won vs total marked Won+Lost
- **Average confidence-to-win correlation**: do high Confidence Grid scores correlate with wins? (Displayed as a scatter plot or bar comparison)
- **Average brief score of Won vs Lost proposals**: (uses BriefScore data from MVP #1)
- **Status breakdown donut chart**: Pending / Negotiating / Won / Lost counts
- **Best-performing features**: which features appear most in Won proposals (from the features array in proposal JSON)
- **Time-to-close**: average days between proposal creation and Won/Lost status

This analytics page is entirely frontend-computed from the MongoDB proposal index documents — no new LLM call required.

---

## System Architecture

### Status Update (Simple CRUD)

```
Agency clicks status on dashboard card or proposal page
        │
        ▼
PATCH /api/proposal/:id/status
  { status: "pending" | "negotiating" | "won" | "lost", lossReason?: string }
        │
        ▼
Backend: Lambda (short operation)
  → Update status + statusUpdatedAt in MongoDB proposal index
  → If status = "won" or "lost": trigger outcome content generation
  → Return { success: true }
```

### Outcome Content Generation (Won or Lost)

```
Status update triggers POST /api/proposal/:id/outcome
  { status: "won" | "lost", lossReason: string | null }
        │
        ▼
Backend: ECS Fargate (LLM call — could take 10–15s, no SSE needed here, just await)
        │
        ├── Fetch proposal JSON from S3
        │
        ├── If "won":
        │     Build prompt: extract kickoff checklist (10 items) + kickoff email
        │     Gemini call (temp 0.2, JSON-only output)
        │     Validate against WonOutcomeZodSchema
        │     Save to MongoDB proposal document: { wonOutcome: { checklist: [...], email: string } }
        │     Return wonOutcome to frontend
        │
        └── If "lost":
              Build prompt: generate 3-email sequence using proposal context + lossReason
              Gemini call (temp 0.4, slightly more creative for email copy)
              Validate against LostOutcomeZodSchema
              Save to MongoDB: { lostOutcome: { email1: {...}, email2: {...}, email3: {...} } }
              Return lostOutcome to frontend
```

### Analytics Page (No LLM — Pure MongoDB Aggregation)

```
GET /api/analytics/proposals
        │
        ▼
Backend: Lambda
  → MongoDB aggregation pipeline:
    $group by status → count Won/Lost/Pending/Negotiating
    $avg of confidenceScore for Won vs Lost groups
    $avg of briefScore for Won vs Lost groups
    $avg of (statusUpdatedAt - createdAt) for Won proposals (time-to-close)
        │
        ▼
Return aggregated analytics object to frontend
Frontend computes visualizations from this data (no chart library needed — CSS bar charts match Proplytics design system)
```

---

## New Files to Create

### Backend

```
backend/
└── routes/
    ├── proposalStatus.js        ← PATCH /api/proposal/:id/status
    └── proposalOutcome.js       ← POST /api/proposal/:id/outcome (Won/Lost generator)
    └── analytics.js             ← GET /api/analytics/proposals

backend/
└── services/
    ├── outcomeService.js        ← Fetch from S3, build prompt, Gemini call, Zod validate, MongoDB write
    └── analyticsService.js      ← MongoDB aggregation pipeline builder

backend/
└── prompts/
    ├── wonOutcomePrompt.js      ← Kickoff checklist + kickoff email prompt
    └── lostOutcomePrompt.js     ← 3-email follow-up sequence prompt

backend/
└── schemas/
    ├── wonOutcomeSchema.js      ← Zod: { checklist: string[], kickoffEmail: { subject, body } }
    └── lostOutcomeSchema.js     ← Zod: { email1: { subject, body, sendTiming }, email2: {...}, email3: {...} }
```

### Frontend

```
src/
└── pages/
    ├── Analytics.jsx            ← New route: /analytics — WinLoss analytics dashboard
    └── Dashboard.jsx            ← Add: status badge + quick-select to ProposalCard

src/
└── components/
    └── winloss/
        ├── StatusSelector.jsx       ← Dropdown with 4 status options + color coding
        ├── WonOutcomeModal.jsx      ← Modal: Kickoff checklist + kickoff email (copy buttons)
        ├── LostOutcomeModal.jsx     ← Modal: 3-email sequence with send/copy per email
        ├── EmailCard.jsx            ← Individual email card with subject/body + copy button
        ├── ChecklistItem.jsx        ← Individual kickoff checklist item with checkbox
        └── OutcomeGeneratingLoader.jsx ← Loading state while Gemini generates the outcome content

src/
└── components/
    └── analytics/
        ├── WinRateDonut.jsx         ← SVG donut chart for status breakdown
        ├── ConfidenceWinBar.jsx     ← Bar comparison: avg confidence of Won vs Lost proposals
        ├── BriefScoreWinBar.jsx     ← Bar comparison: avg brief score of Won vs Lost
        └── TimeToCloseMetric.jsx    ← Single metric card: average days to close

src/
└── App.jsx
    └── Add route: /analytics → Analytics page

src/
└── components/layout/
    └── Sidebar.jsx              ← Add "Analytics" link to sidebar navigation
```

### MongoDB Schema Changes

```
Existing proposals collection — add fields:
  status: "pending" | "negotiating" | "won" | "lost"   (default: "pending")
  statusUpdatedAt: Date | null
  lossReason: string | null
  wonOutcome: { checklist: string[], kickoffEmail: { subject: string, body: string } } | null
  lostOutcome: { email1: {...}, email2: {...}, email3: {...} } | null
  briefScore: number | null                             ← populated by BriefScore (MVP #1)
  confidenceScore: number | null                        ← average confidence score across features

All existing proposals get status: "pending" on first query — handled by MongoDB $ifNull in aggregation.
```

---

## 2-Day Execution Plan

### Day 1 — Status Tracking + Outcome Generation Backend

**Morning:**
1. Add status fields to MongoDB proposal schema (schema-flexible, zero migration needed)
2. Create `proposalStatus.js` route — simple PATCH, auth check, MongoDB update, return success
3. Write `wonOutcomePrompt.js` — kickoff checklist prompt. Must produce exactly 10 items, each with a specific action verb and reference to the proposal's actual tech stack or timeline phase
4. Write `lostOutcomePrompt.js` — 3-email prompt. Must produce emails with different tones (gracious → problem-solving → re-engagement) and must reference specific content from the risk matrix and executive summary

**Afternoon:**
5. Create `wonOutcomeSchema.js` and `lostOutcomeSchema.js` Zod schemas
6. Create `outcomeService.js` — S3 fetch, prompt assembly, Gemini call (temp 0.2 for won, 0.4 for lost), Zod validation, MongoDB save
7. Create `proposalOutcome.js` route — auth check, call outcomeService, return outcome JSON

**End of Day 1 Gate:** PATCH /status correctly updates MongoDB. POST /outcome returns valid kickoff package for a "won" proposal and valid 3-email sequence for a "lost" proposal. Content is specific to the proposal — not generic boilerplate.

### Day 2 — Frontend + Analytics Page

**Morning:**
1. Build `StatusSelector.jsx` — dropdown with four options, each with a color-coded dot + label. Triggers PATCH /status on change. Shows a spinner on loading.
2. Add StatusSelector to `ProposalCard.jsx` on Dashboard — status badge visible on card
3. Build `WonOutcomeModal.jsx` — auto-opens when status changes to "won". Shows checklist (each item as a ChecklistItem with checkbox) and kickoff email (copy button). Fetches from /outcome endpoint while showing OutcomeGeneratingLoader.
4. Build `LostOutcomeModal.jsx` — auto-opens when status changes to "lost". Optional loss reason textarea. Three EmailCard components, each with subject + body + copy button + "Send via SES" button.

**Afternoon:**
5. Build `Analytics.jsx` page — fetch /api/analytics/proposals, render WinRateDonut + ConfidenceWinBar + BriefScoreWinBar + TimeToCloseMetric. All charts built with SVG + Tailwind, no new chart library.
6. Add "Analytics" to Sidebar navigation
7. End-to-end test: mark proposal Won → kickoff modal appears with correct content → mark different proposal Lost → email sequence appears with content referencing that proposal's risks → analytics page shows updated win rate

**End of Day 2 Gate:** Status badges render on dashboard. Won/Lost modals auto-trigger. Analytics page shows at least win rate donut and confidence comparison bar.

---

## Success Checklist

- [ ] Status dropdown renders on both dashboard card and proposal result page
- [ ] Status PATCH updates MongoDB in < 200ms
- [ ] Won modal auto-opens after marking Won with a correct loading state
- [ ] Kickoff checklist items reference the actual proposal tech stack (not generic)
- [ ] Kickoff email draft is copy-ready and proposal-specific
- [ ] Lost modal auto-opens after marking Lost
- [ ] Loss reason textarea is optional and correctly influences email tone when filled
- [ ] Email 2 references a specific risk from the proposal's risk matrix
- [ ] All 3 emails have distinct tones (gracious / problem-solving / re-engagement)
- [ ] Copy buttons work on all email cards and checklist
- [ ] Analytics page shows correct win rate based on current proposal statuses
- [ ] Analytics page shows confidence score comparison for Won vs Lost proposals
- [ ] Analytics page renders correctly with 0 proposals (empty state)
- [ ] "Analytics" link appears in sidebar and routes to /analytics

---

## Why This Feature Wins

The WinLoss Engine is the only feature in any proposal tool that actively helps close deals that appear lost. The 3-email follow-up sequence alone is worth the implementation time — sales research consistently shows that 80% of closed deals require 5 or more follow-ups, yet most agencies send one and give up. By generating a strategic, proposal-specific follow-up sequence in seconds, Proplytics becomes the tool that doesn't just help you win the proposal, it helps you recover deals that seemed gone.

The analytics layer creates a data flywheel: the more proposals agencies run through Proplytics, the richer their win-rate insights become. Over time, the correlation between BriefScore, Confidence Grid scores, and win rates becomes the most powerful selling point in Proplytics' pitch: "Proposals generated from briefs with scores above 80 win 40% more often. We can prove it."

---

---

# The Full 7-Day Execution Schedule

```
DAY 1  ───────────────────────────────────────────────────────────────────
       MVP #1 BriefScore
       ├── Morning: briefScoreSchema.js + briefScorePrompt.js (prompt tuning)
       └── Afternoon: briefScoreService.js + briefScore.js route + Postman test

DAY 2  ───────────────────────────────────────────────────────────────────
       MVP #1 BriefScore (Frontend)
       ├── Morning: ScoreDial.jsx + DimensionBar.jsx + BriefScorePanel.jsx
       └── Afternoon: useBriefScore.js + wire into NewProposal.jsx + CTA states

DAY 3  ───────────────────────────────────────────────────────────────────
       MVP #2 ClientPortal (Backend)
       ├── Morning: portals MongoDB collection + portalService.js + pinService.js
       └── Afternoon: portal.js + portalView.js + portalEvent.js + portalFeedback.js + sesService.js

DAY 4  ───────────────────────────────────────────────────────────────────
       MVP #2 ClientPortal (Public Portal Frontend)
       ├── Morning: /p/:token route + PinGate.jsx + ProposalPortal.jsx + PortalBanner.jsx
       └── Afternoon: ClientFeedbackForm.jsx + usePortalTracking.js + error states

DAY 5  ───────────────────────────────────────────────────────────────────
       MVP #2 ClientPortal (Agency-Side: Share Modal + Analytics Panel)
       ├── Morning: ShareModal.jsx + "Share with Client" button on ProposalResult
       └── Afternoon: PortalAnalyticsPanel.jsx + wire to ProposalResult + mobile audit

DAY 6  ───────────────────────────────────────────────────────────────────
       MVP #3 WinLoss Engine (Backend + Frontend core)
       ├── Morning: proposalStatus.js + outcomeService.js + wonOutcomePrompt.js + lostOutcomePrompt.js
       └── Afternoon: StatusSelector.jsx + WonOutcomeModal.jsx + LostOutcomeModal.jsx

DAY 7  ───────────────────────────────────────────────────────────────────
       MVP #3 WinLoss Engine (Analytics page + integration + QA)
       ├── Morning: Analytics.jsx + WinRateDonut + ConfidenceWinBar + sidebar link
       └── Afternoon: End-to-end integration test for all 3 MVPs + cross-feature QA
```

---

# Combined Feature Impact: The Full Proplytics Lifecycle

After implementing all three MVPs (plus the existing ProposalChat):

```
BEFORE BRIEF ARRIVES    AT GENERATION        AFTER DELIVERY       DEAL TRACKING
─────────────────────   ──────────────────   ──────────────────   ─────────────────────
                         ProposalChat         ClientPortal         WinLoss Engine
                         (already planned)    MVP #2               MVP #3
                                              ↓                    ↓
BriefScore               AI Proposal          Shareable link       Status tracking
MVP #1                   Generation           with tracking        Won/Lost marking
↓                        ↓                    ↓                    ↓
Quality gate             Confidence Grid      View analytics       Kickoff package
before generation        Risk Matrix          Feedback form        Follow-up emails
↓                        Timeline             SES notification     Win rate analytics
6-dimension score        Effort estimates
Improvement hints        Streaming output
```

No proposal tool on the market covers all five stages. Proplytics will be the first.

---

*Three MVPs. Seven days. Zero new AWS costs. Full proposal lifecycle covered.*
*"The fastest proposal wins the deal — but the smartest system closes the year."*
