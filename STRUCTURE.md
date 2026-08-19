# FixFlowAI — Master Structure & Context Brief

> **What this document is.** A single, self-contained briefing on FixFlowAI: the business, the market thesis, the product, the architecture, what is actually built, and what is not. It is organised to answer, in order, every question in the investor/judge presentation timeline (`Presentation timeline infornt investors.txt`), and it preserves the founder's own framing notes for each section.
>
> **How to use it with an LLM.** Paste this whole file as context. It is written so that a model with zero prior knowledge of the repo can (a) pitch the product accurately, (b) run market research without inventing facts, and (c) tell the difference between shipped capability and roadmap. Every claim is either marked as **implemented**, **partial**, or **planned**. Do not upgrade a "planned" item to a "shipped" one when generating pitch copy.
>
> **Team:** Team Optimus · **Product:** FixFlow AI · **Stage:** Early access, built during BuildX · **Primary market:** India-first, global-capable
>
> **Ground truth note.** The `README.md`, `.kiro/steering/tech.md`, and `.kiro/steering/structure.md` files in this repo contain some stale claims (Prisma/PostgreSQL as the live DB, four TypeScript LLM "skills" that were since ported to Python, `gemini-2.5-pro` as the model, Next.js as the frontend). **This document supersedes them.** Corrections are listed in Appendix E.

---

## 0. The 60-Second Fact Sheet

| Field | Answer |
|---|---|
| **Team name** | Team Optimus |
| **Product name** | FixFlow AI |
| **One-liner** | A trust-first, outcome-based freelance workspace: it verifies real skills from code, turns a raw client brief into a structured plan, and guarantees payment through finite-state escrow. |
| **Category** | AI-native talent + project execution platform (not a bidding marketplace) |
| **Who pays** | Clients (checkout premium + subscription), freelancers (commission on payout + subscription) |
| **Core wedge** | Evidence-based verification (GitHub scan) + protected-by-default milestone escrow with a cryptographic audit trail |
| **Deployed as** | 3 services: React/Vite SPA, Node/Express API, Python/FastAPI AI service |
| **Live domain** | `fixflowai.xyz` (frontend), `fixflowai-backend.onrender.com`, `fixflowai-ai-service.onrender.com` |
| **AI** | Google Gemini via `google-genai`, hybrid design: deterministic scoring + bounded LLM modifiers |
| **Payments** | Razorpay (Orders, Route transfers, refunds, webhooks) |
| **Datastore** | DynamoDB (`ap-south-1`) with JSON-file and in-memory providers selectable at runtime |
| **Not yet built** | Freelancer job-browse/apply UI, proctored interview room UI, live Polygon SBT minting, opportunity scraping ingestion pipeline |

**The mantra:** *"We do not just connect clients to freelancers. We remove hiring uncertainty, reduce proposal noise, and manage the whole delivery flow."*

---

## 1. Introduction (~20 sec)

### Founder's reflection (verbatim intent)
> *"We are team optimus and our project name is FixFlow AI, then founder and CEO introduction and their background."*

### What to cover
1. **Team name** — Team Optimus.
2. **Project name** — FixFlow AI.
3. **Founder/CEO intro** — name, role, and the one credential that makes the team credible for *this* problem (engineering depth: the team shipped a three-service system with a cryptographically audited payment state machine, a multi-agent AI service, and a live GitHub evidence scanner during BuildX).

### Speaker framing
Keep it to two sentences of team, one sentence of "why us." The credibility signal is that this is not a mockup — it is a deployed, three-service system with real payments, real OAuth, and real code analysis. Land that early so the rest of the pitch is heard as engineering, not concept.

### Fill-in placeholders (must be completed before presenting)
- Founder & CEO: `<name>` — background: `<background>`
- Co-founders / core members and their lanes: `<names + roles>`

---

## 2. Problem Statement (~30–40 sec)

### Founder's reflection (verbatim intent)
> *"Storytelling problem statement. Here we will discuss first about client's pain point and then freelancer's, and also include freelancer's proper skill-based hiring with minimal manual intervention."*
> *"Why is this problem important? Importance of the freelancing market, and also tell about time and money saving."*

### 2.1 Narrative order (as the founder wants it)
**Client first → freelancer second → then the shared root cause: hiring runs on claims, not evidence, and it needs constant manual babysitting.**

### 2.2 The client's pain (tell this as a story)
A client posts a project. Within hours there are 200 proposals, most of them copy-pasted or AI-generated. They cannot tell competence from polish. They interview for two weeks, pick someone on gut feel, and then run the project across Slack, email, Drive, GitHub, and invoices. Scope drifts, nobody agrees on what "done" means, and money is either paid too early (and at risk) or too late (and the freelancer disengages).

| # | Client pain | Why it persists on existing platforms |
|---|---|---|
| 1 | "I don't know whom to trust" | Profiles are self-reported; portfolios are unverifiable |
| 2 | "I'm drowning in bad proposals" | Open bidding rewards volume, not fit |
| 3 | "Hiring takes too long" | Vetting is fully manual: post → collect → screen → interview |
| 4 | "Communication is messy and scattered" | The platform ends at matchmaking; delivery happens elsewhere |
| 5 | "Pricing feels unfair / unclear" | Fees and markups surface at checkout |
| 6 | "I need outcomes, not profiles" | A résumé does not prove someone can build *this* thing |

### 2.3 The freelancer's pain
On the other side, a genuinely skilled developer burns paid connects competing against bots for jobs that may not be real. When they win, 15–20% disappears in fees, ranking is governed by an opaque algorithm, and payment safety depends on the client's goodwill. One bad review or one vanishing client resets their income.

| # | Freelancer pain | Consequence |
|---|---|---|
| 1 | Too much competition, too little real opportunity | Wasted proposal credits, bot/spam bids |
| 2 | Fees eat earnings | Net payout unknown until after acceptance |
| 3 | Opaque visibility algorithms | Income collapses without explanation |
| 4 | Payment safety risk | Unpaid work, delayed approvals, disputes |
| 5 | Low-quality clients | Scope creep with no compensation |
| 6 | Constant hustle, no predictability | No compounding reputation asset |

### 2.4 The shared root cause — and the founder's key point
Both sides suffer from the same defect: **hiring is based on claims and requires heavy manual intervention.** Nobody checks whether the code behind a claimed skill exists. Nobody structures the brief before matching. So a human has to do all the filtering, all the scoping, and all the trust-building, every single time.

**FixFlowAI's thesis:** if you make skills *machine-verifiable* and briefs *machine-structured*, then skill-based hiring can run with minimal manual intervention — and the trust problem stops being a human judgement call.

### 2.5 Why this problem matters (the "importance" beat)
- **Market scale.** Freelancing/independent work is one of the fastest-growing labour segments globally, and India is among the largest supply markets for technical freelance talent. *(Sizing figures must be sourced live — see §10 research prompts. Do not state a market number that has not been verified.)*
- **Time saved.** Today: weeks from brief to hire. FixFlowAI's target: **brief to structured requirements in under 60 seconds**, and a shortlist of **3–5 explainable matches** instead of 200 proposals.
- **Money saved.** Clients stop paying for mis-hires and rework. Freelancers see exact net earnings *before* accepting, and never work on unfunded milestones. Every rupee is funded before work starts and released against agreed acceptance criteria.
- **Risk removed.** Every state change in the money flow is recorded in a SHA-256 chained audit trail that either party can verify.

---

## 3. Solution (~40–50 sec)

### Founder's reflection (verbatim intent)
> *"Storytelling: freelancer's skill verification, and then client's portion — FixFlow AI creates a collaborative team workspace for the client's workspace, and all key features one after another, complete client things."*

### 3.1 Narrative order (as the founder wants it)
**Start with freelancer skill verification (that is the trust foundation) → then walk the client's collaborative workspace end to end, feature by feature.**

### 3.2 Act I — Freelancer skill verification (the trust foundation) ✅ implemented
A freelancer signs in **with GitHub**, not with a résumé. FixFlowAI then scans their actual repositories:

1. **GitHub OAuth sign-in** — the freelancer's identity is their code identity.
2. **Repository scan** — a batched GraphQL pass plus bounded REST passes over manifests and contributor stats (`ai-service/app/features/github_scan/client.py`).
3. **Deterministic aggregation** — language percentages and framework detection computed by math, not by an LLM (`aggregate.py`, with a synonym table so `react` / `reactjs` / `React.js` collapse correctly).
4. **Four parallel agents** (`agents.py`) — skills, projects, experience signals, profile confidence. Only *skills* and *projects* call the LLM (one cheap batched call each); *experience* and *confidence* are pure arithmetic, so they cannot be hallucinated.
5. **A verified skills profile** — each skill carries `source: 'github_scan'` and `editable: false`. **The freelancer cannot edit their own verified skills.** That single design decision is what makes the profile trustworthy.
6. **Confidence band** — `emerging` / `developing` / `match_ready`.
7. **Streamed live** — the scan streams to the UI over SSE, so the freelancer watches Skills → Projects → Experience appear segment by segment.

> **The line that lands:** *"On other platforms you write your skills. Here, your code writes them."*

### 3.3 Act II — The client's collaborative workspace (feature by feature) ✅ implemented
A single dashboard carries the project from raw idea to released funds. Walk it in this order:

| Step | Feature | What it does | Status |
|---|---|---|---|
| 1 | **AI Builder** (`ProposalGenerator.jsx`) | 5-step guided intake: describe idea → structured scope → intelligence analysis → timeline & roles → review & finalize | ✅ |
| 2 | **Discovery Wizard** (`DiscoveryWizard.jsx`) | Adaptive, one-question-at-a-time interview that fills the gaps in a vague brief before anything is parsed | ✅ |
| 3 | **Semantic Brief Parsing (AI-001)** | Unstructured intent → structured proposal: features, risks, timeline phases, deliverables, competitors, architecture, milestones, roles | ✅ |
| 4 | **Project Plan (AI-008)** | A deep execution plan: scope modules, architecture graph, week-by-week tasks, team capacity, checkpoints, requirement coverage — with revision history, approve/reopen, and JSON-Patch editing guarded by optimistic concurrency | ✅ |
| 5 | **Timeline validation** | A pure validator that catches dangling references, dependency cycles, week discontinuity, capacity overload, unmitigated risks, orphan tasks, and uncovered requirements | ✅ |
| 6 | **AI Evaluation / Confidence Grid (AI-002)** | Auditor + Feasibility agents run in parallel over four grounded factors (deliverable coverage 30%, timeline realism 25%, technical feasibility 25%, budget alignment 20%). Scores are **deterministic**; the LLM may only apply a *bounded modifier*. Below the threshold, a self-correction loop rewrites the proposal — and reverts the rewrite if it scores worse | ✅ |
| 7 | **Talent Matches** (`MatchResults.jsx`) | Top 3–5 explainable candidates, scored on skill overlap, GitHub signal, domain history, budget fit, reputation, availability, and SBT. Plus a hiring funnel: Suggested → Shortlisted → Invited → Interviewing → Selected, each transition version-guarded | ✅ |
| 8 | **Interview question generation (AI-003)** | Generates project-specific questions with rationale, expected keywords, and an ideal-answer summary — derived from the brief *and* the candidate's actual scan | ✅ generation / ⚠️ no interview room UI |
| 9 | **Agreement Composer** | Draft → sent → approved, with an activity trail; on approval it seeds escrow milestones directly from the plan's timeline phases | ✅ |
| 10 | **Escrow Funds** (`MilestoneFunds.jsx`) | The core guarantee. Fund a milestone via Razorpay → verify signature → FSM moves it to `Active`. Release requires **TOTP MFA**. Disputes carry reasons and evidence URLs. A drawer shows the SHA-256 audit chain | ✅ |
| 11 | **Delivery Control** | Freelancer submits deliverable evidence → milestone transitions to `In_Review`; AI suggests contract extensions (AI-004) from completed work and conversation context | ✅ |
| 12 | **Payments** | Full deposit / escrow / payout ledger | ✅ |
| 13 | **Automations** | Connect GitHub / Slack / Gmail through the Corsair integration layer; FixBot agent action log | ✅ |
| 14 | **Outcomes** | Verified outcome record — the reputation proof that feeds the next hire | ✅ |

### 3.4 Why this is better than the alternatives

| Dimension | Upwork / Fiverr / Freelancer.com | FixFlowAI |
|---|---|---|
| Skill signal | Self-reported profile + stars | **Scanned from real repositories; non-editable** |
| Matching | Open bidding, 200 proposals | **Top 3–5, each match explained factor by factor** |
| Brief handling | Free text, human interpretation | **Parsed into scope, plan, milestones, acceptance criteria** |
| Scoring integrity | Opaque algorithm | **Deterministic math; LLM can only nudge within bounds** |
| Payment safety | Escrow as an option, manual releases | **Protected by default: a finite state machine, MFA-gated release, no funding = no work** |
| Auditability | Support tickets | **SHA-256 chained, independently verifiable audit trail** |
| Delivery | Happens off-platform | **One workspace: brief → plan → agreement → escrow → delivery → outcome** |
| Reputation | Star rating, gameable | **Multi-dimensional, evidence-derived, portable (Soulbound DID planned)** |

### 3.5 The two structural claims to repeat
1. **"Scores are grounded, not generated."** The confidence index and factor scores are computed deterministically; the LLM contributes qualitative issues and a *capped* modifier. There is a test named for exactly this.
2. **"The money cannot move sideways."** Every payment state change goes through one state machine, with optimistic-concurrency version checks, an MFA gate on approval and release, and a hash-chained audit block. A tampered chain is detectable.

---

## 4. Live Demonstration (1–2 min)

### Founder's reflection (verbatim intent)
> *"Laptop navigation of our website from Client."* — Demonstrate the working product. Avoid slides. Judges want the actual implementation.

### 4.1 Recommended demo path (client's perspective, ~90 sec)
Run against the live deployment (`fixflowai.xyz`) or local. Navigate by hash routes.

| # | Route | Action | The line to say |
|---|---|---|---|
| 1 | `#/login` | Sign in (Google, or GitHub for the freelancer side) | "Real OAuth, real session, real refresh." |
| 2 | `#/dashboard/overview` | Show KPIs + proposal history | "Every project the client has ever scoped, in one place." |
| 3 | `#/dashboard/proposal-generator` | Paste a rough brief → run Discovery Wizard | "It asks the questions a good consultant would ask." |
| 4 | *(same)* | Watch the brief become structured scope | "Under a minute from paragraph to plan." |
| 5 | `#/dashboard/project-plan` | Show the week-by-week plan, capacity, checkpoints | "This is a delivery plan, not a proposal template." |
| 6 | `#/dashboard/evidence-confidence` | Run AI Evaluation → show factor bars | "Notice: deterministic base plus a bounded AI modifier. The score is defensible." |
| 7 | `#/dashboard/matching` | Run matches → 3–5 candidates with factor bars → open a candidate's code analytics | "This is why they matched — not a black box." |
| 8 | `#/dashboard/agreement-composer` | Approve the agreement → it seeds milestones | "Signing creates the escrow schedule automatically." |
| 9 | `#/dashboard/milestone-funds` | Fund a milestone via Razorpay → verify → `Active` | "No funding, no work. That's the default." |
| 10 | *(same)* | Release → MFA modal → open the audit trail drawer | "Release needs a second factor, and every step is hash-chained." |

### 4.2 Freelancer-side cut (if there is time — 20 sec)
`#/dashboard/analytics` → trigger a rescan and let the SSE stream reveal Skills → Projects → Experience live. This is the most visually convincing 10 seconds in the product.

### 4.3 Demo risk checklist (read this before presenting)
- **Cold start.** All three services run on Render's free plan and sleep. There is a keep-alive pinger plus a GitHub Actions cron, but **warm all three URLs manually 5 minutes before the demo**: `/api/health`, `/health`, and the frontend root.
- **Payments.** `ALLOW_PAYMENT_SIMULATION=true` by default, so funding works without live Razorpay keys. Know which mode you are in before you demo.
- **AI key.** Without `GEMINI_API_KEY`, AI panels fall back to sample data and the UI badges it as "Sample". Verify the key is set, or the demo silently shows mock output.
- **Do not demo** the freelancer job-apply flow or a proctored interview room. Neither exists yet (see §8.4).
- **WebSocket sync** is implemented server-side at `/sync` but is not connected in the client. Do not claim live co-editing during the demo.

---

## 5. Technology Stack (~20–30 sec)

### 5.1 Architecture at a glance

```
Browser (React 18 + Vite 5 SPA, hash routing)
        │  HTTPS  /api/*   ·  Bearer JWT   ·  SSE for scan streams
        ▼
Node 22 / Express API  ─────────────────────────────► Razorpay (Orders, Route, Refunds, Webhooks)
  · Auth (Google + GitHub OAuth, JWT + refresh)  ──►  AWS SES v2 (transactional email)
  · Escrow FSM + SHA-256 audit chain             ──►  DynamoDB ap-south-1 (fixflow_*)
  · Matching engine, plan service, interview svc  ──►  Corsair (GitHub / Slack / Gmail agents)
  · WebSocket /sync (vector clocks, LWW)
        │  x-ai-service-token
        ▼
Python 3 / FastAPI AI service  ─────────────────────► Google Gemini (google-genai)
  · AI-001..008 features                         ──►  GitHub GraphQL + REST (repo scanning)
  · Deterministic scoring + bounded LLM modifiers ──►  Redis (optional LLM response cache)
  · Circuit breaker, retry/backoff, model fallback
```

### 5.2 Stack table

| Layer | Technology | Notes |
|---|---|---|
| **Frontend** | React 18.3 + **Vite 5.4**, Zustand 5, Tailwind 3.4, Framer Motion 11, GSAP, Lenis, react-three-fiber | Hand-rolled hash router — no react-router. Charts are hand-built divs, no chart library. *(Correction: this is Vite, not Next.js.)* |
| **API** | Node 22 + Express 4, TypeScript 5.4 strict, ES Modules | `zod` for schema validation, `express-rate-limit`, `ws` for WebSocket |
| **AI service** | Python + FastAPI ≥0.115, Pydantic 2, `google-genai` | Separate service; the backend is the only caller |
| **LLM** | Google Gemini | Default `gemini-3.1-flash-lite`; proposals on `gemini-3.5-flash`; allowlisted models with automatic fallback |
| **Datastore** | **Amazon DynamoDB** (`ap-south-1`, tables `fixflow_*`) | Provider is swappable at runtime: `dynamodb` / `memory` / `file`. *(Correction: Prisma + PostgreSQL is design-only, not implemented.)* |
| **Payments** | **Razorpay** — Orders, Route transfers, refunds, signature + webhook HMAC verification | Simulation mode for demos |
| **Auth** | Google OAuth (ID token), GitHub OAuth (code exchange), HS256 JWT access + opaque hashed refresh token | Hand-rolled TOTP (base32 + HMAC-SHA1, ±30s) for payment MFA |
| **Email** | AWS SES v2 | 550-line template set |
| **Real-time** | SSE (live, used for scans) · WebSocket `/sync` with vector clocks + LWW (server implemented, client not wired) | |
| **Web3** | Polygon Soulbound DID / SBT | **Planned.** Reputation and SBT metadata are computed; minting is not wired |
| **Cache** | Redis, optional, for LLM responses (SHA-256 keyed, 1-day TTL) | Degrades to in-process dict if absent |
| **Hosting** | **Render** (3 services via `render.yaml`, `buildx` branch) · **AWS Amplify** build spec also present for the SPA | Free plan + keep-alive strategy |
| **CI/CD** | GitHub Actions: backend CI, ai-service CI, frontend CI, CodeQL, security CI, quality gate, deploy, keep-alive cron | |

### 5.3 AI features implemented

| ID | Feature | Endpoint (AI service) | Design note |
|---|---|---|---|
| AI-001 | Semantic brief parsing | `POST /ai/brief/parse` | Deterministic confidence/severity/impact + sanitising fallback so it never hard-fails |
| AI-002 | Multi-agent confidence grid + self-correction | `POST /ai/confidence/evaluate` | Parallel Auditor + Feasibility agents; bounded LLM modifier; regression-guarded optimiser |
| AI-003 | Interview question generation | `POST /ai/interview/generate` | Derives missing skills server-side from the GitHub scan |
| AI-004 | Contextual contract extensions | `POST /ai/extensions/generate` | Maintenance-milestone fallback |
| AI-005 | Opportunity intelligence scoring | `POST /ai/opportunity/score` | Scoring is **implemented and fully deterministic**; the scraping/ingestion pipeline is **planned** |
| AI-006 | Skill matching / lead scoring | `POST /ai/github/scan` (+ `/stream`) → backend matching engine | Scan works with **no** Gemini key; weights configurable via env |
| AI-007 | Freelancer growth plan | `POST /ai/growth/plan` | LLM + deterministic fallback |
| AI-008 | Deep proposal timeline & implementation plan | `POST /ai/plan/generate`, `POST /ai/plan/validate` | Deterministic primary path; LLM enrichment accepted **only** if it still validates with zero errors |
| — | Adaptive discovery | `POST /ai/discovery/next` | Stateless question loop with generic fallback |

### 5.4 Reliability engineering (this is a differentiator — say it out loud)
- **Bounded LLM timeouts** (default 15s) with retry + exponential backoff **and jitter**, retrying only genuinely transient failures (429/5xx/timeouts) and failing fast on everything else.
- **Automatic model fallback** on the first transient failure, unless the caller pinned a model.
- **Circuit breaker** (5 failures → open, 30s recovery, half-open probe) that routes straight to the fallback model while open.
- **Schema-violation recovery** — if the structured response fails validation, the raw payload is attached for repair rather than thrown away.
- **Every LLM feature has a deterministic fallback path.** The application is designed never to crash from a bad model response.
- **Payment webhook idempotency** keyed on `x-razorpay-event-id`, marked processed only *after* successful handling so transient failures are safely retried.
- **Atomic escrow writes** — milestone + audit block commit in a single DynamoDB `TransactWrite`.

### 5.5 Sponsor / partner technologies used
| Sponsor | How it is used | Status |
|---|---|---|
| **Render** | Primary hosting for all three services via `render.yaml` blueprint (`buildx` branch), with internal service discovery, generated shared secrets, health checks, and a keep-alive strategy | ✅ live |
| **Corsair** | Agent integration layer mounted at `/api/corsair/*` — GitHub (managed OAuth), Slack, Gmail plugins; signature-verified webhooks; powers the Automations panel and the FixBot agent | ✅ integrated |
| **AWS** | DynamoDB (persistence), SES v2 (email), Amplify (SPA build spec), S3 bucket provisioned | ✅ DynamoDB + SES live |
| **Google Gemini** | All LLM features | ✅ live |
| **Razorpay** | Fiat escrow, Route payouts, refunds | ✅ live (simulation-capable) |
| **Bindu / Stellar** | Referenced in BuildX prize-track docs (`docs/specifications/buildx-prize-tracks/`) | ⚠️ verify integration status before claiming |

> ⚠️ **Honesty gate:** only name a sponsor technology on stage if you can point at the code path. Render, Corsair, AWS, Gemini, and Razorpay are all defensible today.

---

## 6. Target Users (~10 sec)

### Founder's reflection (verbatim intent)
> *"Who is your customer? Who will actually use this product?"*

### 6.1 The two-sided answer

**Paying customer (primary): the client who is hiring.**
- Early-stage startups and founders who need to ship a specific technical outcome and cannot afford a mis-hire.
- Small and mid-size businesses with no in-house engineering leadership to vet developers.
- Agencies subcontracting specialised work who need governance and audit trails.
- Product/ops leads who need a defensible paper trail for spend.

**Supply side (the trust engine): the freelance developer or agency.**
- Genuinely skilled developers with real GitHub history who currently lose to better-marketed profiles.
- Developers in high-supply markets (India first) who are tired of paying connects to compete with bots.
- Small dev agencies that want a verifiable team-level proof of capability.

### 6.2 Roles the product actually implements
Four roles exist in code, with a permission matrix enforced in both the nav and the API: **client**, **freelancer**, **developer**, **agency**. Client-only surfaces are AI Builder, Project Plan, Brief Intelligence, AI Evaluation, and Talent Matches. Freelancer-only is Code Analytics. Agreement, Delivery Control, Escrow, Payments, Automations, and Outcomes are shared.

### 6.3 Ideal first customer (the wedge)
**A funded early-stage startup in India hiring 1–3 contract developers for a defined technical build, with a budget between ₹1L and ₹10L per project.** They feel all six client pains at once, they are technical enough to value evidence-based verification, and the escrow amounts are large enough that payment protection is a purchase driver rather than a nice-to-have.

---

## 7. Business & Scalability (~1–1.25 min)

### Founder's reflection (verbatim intent)
> *"Business model, revenue opportunities, scalability, future roadmap."*

### 7.1 Revenue model — four streams

**Stream 1 — Transaction commission on payout (primary).** Implemented in `backend/src/skills/earningsCalculator.js` and surfaced in the UI *before* the freelancer accepts:

| Plan | Platform commission on payout |
|---|---|
| FREE | 10% |
| SOLO | 5% |
| PRO | 3% |
| AGENCY | 2% |

The calculator also transparently itemises the Razorpay gateway fee (2% + ₹3) and Indian TDS withholding (1%), then shows exact `netFreelancerEarnings`. **The transparency is the product; the commission is the revenue.**

**Stream 2 — Client checkout premium.** A **1.5%** premium on top of the milestone value at client checkout (`totalClientCheckout`). Implemented.

**Stream 3 — Subscriptions.** Three tiers on the live pricing page. ⚠️ **These figures are placeholders in code and must be finalised before you quote them to investors.**

| Tier | Monthly | Annual (per mo) | Positioning |
|---|---|---|---|
| Starter | $0 | $0 | 1 active project, standard escrow fees |
| Professional | $24 | $19 | Unlimited projects, confidence-grid shortlisting, reduced escrow fees, reputation trail |
| Scale | $79 | $63 | Agencies: team proof, role governance, priority dispute resolution, audit-ready exports |

Note the deliberate design: **higher tiers buy a lower commission rate.** Subscription and transaction revenue reinforce each other instead of competing.

**Stream 4 — Future / expansion.** Verified-talent API licensing (sell the evidence layer to other platforms and ATSs), enterprise governance and compliance exports, dispute arbitration as a paid service, and portable Soulbound reputation credentials.

### 7.2 Unit economics illustration
On a ₹1,00,000 project with a FREE-tier freelancer: platform commission ₹10,000 + client premium ₹1,500 = **₹11,500 gross platform revenue per ₹1L of GMV (~11.5%)**, against roughly ₹2,003 of Razorpay cost. Revenue scales with GMV, not with headcount — which is the whole point of the architecture below.

### 7.3 Why it scales — architecture as a business argument
- **Cost structure is pay-per-use.** DynamoDB on-demand, Lambda-compatible stateless API, S3, SES, Amplify CDN. The internal cost analysis (`docs/specifications/architecture/cost_analysis_1000_users.md`) targets roughly **~$1.35/month at 1,000 MAU**, dominated by Secrets Manager and Route 53 — not compute.
- **LLM cost is deliberately suppressed.** The expensive part of every AI feature is deterministic Python, not tokens. The GitHub scanner uses batched GraphQL and only two cheap LLM calls. Responses are SHA-256-cached in Redis for a day. Model fallback drops to a cheaper model under pressure. **Marginal AI cost per project is small and bounded.**
- **The trust asset compounds.** Every completed project deepens the verified-evidence graph, which makes matching better, which makes the next hire faster. That is a defensible data moat that a bidding board cannot copy by adding a feature.
- **Supply acquisition is nearly free.** A freelancer signs in with GitHub and gets an instant verified profile plus a growth plan (AI-007) that shows exactly which skills to close. That is a reason to join before there is any demand-side liquidity.

### 7.4 Known scaling constraints (state these honestly — investors trust operators who know their limits)
| Constraint | Impact | Fix |
|---|---|---|
| WebSocket rooms are in-process (`Map`) | Real-time sync breaks across horizontally scaled replicas | Move room state to Redis pub/sub |
| In-memory LLM cache has no TTL or eviction | Unbounded growth in a long-lived process | Enforce Redis-only or add LRU + TTL |
| Circuit breaker mutates shared state without a lock | Race under concurrency | Add a lock |
| Free-tier hosting sleeps | Cold-start latency | Paid plan before any real traffic |
| Rate limiting covers only `/api/escrow` | Auth and AI routes are unthrottled | Extend limiter |
| Payments run in simulation by default | Not production-safe as configured | Flip `ALLOW_PAYMENT_SIMULATION=false` + live keys |

### 7.5 Future roadmap

**Near term (next 4–8 weeks) — close the loop**
1. Freelancer job-browse + apply + invitation inbox *(the biggest product gap)*
2. Proctored interview room UI on top of the already-built interview backend
3. Security hardening: remove/guard `dev-login`, authenticate the calculator and sync-room endpoints, extend rate limiting, fix the payment-signature fallback
4. Live Razorpay: disable simulation, verify Route payouts end to end
5. Wire the WebSocket client so the workspace is genuinely collaborative in real time

**Mid term (3–6 months) — deepen the moat**
6. Opportunity intelligence ingestion (AI-005 scoring exists; add the scrapers)
7. Polygon Soulbound DID minting — portable, verifiable reputation
8. Arbitrator role + real dispute resolution workflow
9. Client quality scoring surfaced to freelancers as risk labels on incoming work
10. Serverless migration (plan already written) + Redis-backed sync

**Long term — platform**
11. Verified-talent API licensed to other platforms and ATSs
12. Agency/team accounts with shared governance and audit-ready exports
13. Beyond software: apply the same evidence-verification model to design, data, and content work
14. Geographic expansion past the India-first wedge

---

## 8. Progress During BuildX (~40–50 sec)

### Founder's reflection (verbatim intent)
> *"What you built during BuildX. Challenges faced. Key milestones. Future improvements."*

### 8.1 What was built
A working three-service platform, deployed and reachable, not a prototype:
- **Frontend:** 16 dashboard panels + a full marketing site, with role-gated navigation and an authenticated SPA.
- **Backend:** ~60 REST endpoints, Google + GitHub OAuth with JWT refresh rotation, the escrow finite state machine with a SHA-256 audit chain, Razorpay integration (orders, signature verification, webhooks, Route payouts, refunds), a weighted matching engine, a revisioned plan service with JSON-Patch editing, an interview service, DynamoDB persistence with swappable providers, AWS SES email, a WebSocket sync server, and the Corsair agent integration layer.
- **AI service:** 12 FastAPI endpoints covering AI-001 through AI-008 plus adaptive discovery, a multi-agent GitHub scanner with SSE streaming, and a hardened Gemini layer (timeouts, jittered retry, model fallback, circuit breaker, caching).
- **Engineering rigour:** ~80+ Python tests including a golden-fixture evaluation harness with baseline-vs-latest score tracking, plus a 630-line backend integration suite covering FSM transitions, concurrency locks, audit-chain tamper detection, webhook idempotency, and the full escrow pipeline. Seven GitHub Actions workflows including CodeQL.
- **Self-audit discipline:** the team wrote its own bug and security stories — `SEC-01` dev-login bypass, `SEC-02` escrow object-level authorization, `SEC-03` CORS/rate limiting, `SEC-04` unauthenticated calculators, `BUG-08` webhook raw-body signature, `BUG-09` payment-signature mock bypass, `BUG-11` non-FSM milestone clobber. **Finding your own vulnerabilities and documenting them is a maturity signal — say so.**

### 8.2 Challenges faced (pick two or three, tell them as engineering stories)
1. **LLM scores were not trustworthy.** The first confidence grid let the model produce the numbers, and the numbers moved between runs on identical input. **Root cause:** we had outsourced judgement to a stochastic system. **Fix:** invert it — compute every factor deterministically in Python and let the LLM contribute only qualitative issues plus a *bounded* modifier. Two stories (`AIE-09`, `AIE-10`) exist for exactly this, and there is now a test asserting scores are grounded rather than generated.
2. **Self-correction sometimes made proposals worse.** An optimiser that rewrites a proposal can regress it. **Fix:** a regression guard — if the rewrite scores lower, revert it. Verified by test.
3. **Payment correctness is unforgiving.** Double-release, replayed webhooks, and concurrent transitions are all real failure modes. **Fix:** optimistic-concurrency version checks, TOTP MFA on approval and release, webhook idempotency keyed on the event ID, and an atomic transactional write of milestone + audit block.
4. **A TypeScript-to-Python migration mid-build.** Four LLM skills started as TypeScript modules and were ported to the Python AI service for better structured-output and async ergonomics. That created two services to keep in sync, hand-mirrored types, and stale artefacts to clean up.
5. **Free-tier cold starts nearly broke the demo.** Three sleeping services meant a 30-second first request. **Fix:** an in-process keep-alive pinger plus a GitHub Actions cron to wake sleeping services, plus retry-on-502/503/504 in the backend's AI client.

### 8.3 Key milestones
`M1` three services deployed on Render with internal service discovery → `M2` Google + GitHub OAuth with refresh rotation → `M3` brief parsing live end to end → `M4` escrow FSM with a verifiable audit chain → `M5` Razorpay funding, MFA release, and webhooks → `M6` GitHub evidence scanner streaming over SSE → `M7` deterministic confidence grid with self-correction → `M8` deep execution plan (AI-008) with revisions and approvals → `M9` matching workflow with a version-guarded hiring funnel → `M10` Corsair automations integration.

### 8.4 What is honestly not done yet
- **Freelancer job-browse / apply / invitation inbox** — the pipeline is client-initiated only today.
- **Proctored interview room UI** — question generation and the session backend exist; the room does not.
- **Polygon SBT minting** — metadata is computed, minting is not wired.
- **Opportunity ingestion scrapers** — scoring works; the pipeline that feeds it does not exist.
- **Client-side WebSocket wiring** — the sync coordinator is written but unused (dead code).
- **The security stories listed in 8.1** — documented, not all closed. `dev-login` in particular is an authentication bypass if deployed as-is.

### 8.5 Future improvements
See §7.5. If asked for one thing: **close the freelancer loop** (browse → apply → interview → get hired). The client side is deep; the freelancer side is currently passive.

---

## 9. Closing

### Founder's reflection (verbatim intent)
> *"We are not competing with other platforms — we reimagined freelancing and a transparent hiring process, which makes FixFlow AI strong. And judges, we will be happy to answer your questions."*

### Suggested closing script
> "We are not trying to be a better bidding board. Bidding is the problem. FixFlow AI reimagines freelance hiring around two ideas: **skills should be proven by code, not claimed in a profile**, and **money should be protected by default, not by trust.** Everything you just saw — the evidence scanner, the deterministic confidence grid, the finite-state escrow with a cryptographic audit trail — exists to make hiring a verifiable process instead of a gamble. That is what makes FixFlow AI strong. We would be happy to take your questions."

### Anticipated Q&A

| Question | Answer |
|---|---|
| "How do you get supply before demand?" | GitHub sign-in gives a freelancer an instant verified profile plus an AI growth plan showing exactly which skills to close. Value on day one, before any client exists. |
| "What stops Upwork from copying this?" | The verification layer is not a feature, it is an architecture: deterministic scoring, an evidence graph, and an audited money state machine. Retrofitting that onto a bidding business means cannibalising the connects revenue that funds it. |
| "What if the AI is wrong?" | It structurally cannot be the deciding factor. Every score has a deterministic base; the LLM applies only a bounded modifier. Every feature has a deterministic fallback. There are tests asserting exactly this. |
| "Is it really secure?" | We audited ourselves and wrote the findings down — seven security and bug stories are in `docs/stories/`. Payments use optimistic concurrency, MFA on release, webhook idempotency, and a tamper-detectable hash chain. Known open items are listed and prioritised. |
| "How do you handle disputes?" | The FSM has a `Dispute` state with reasons and evidence URLs. A dedicated Arbitrator role and full resolution workflow is on the near-term roadmap; today resolution is authenticated but not role-restricted. |
| "What's your moat?" | Accumulated verified evidence. Every completed project makes matching better. That compounds and cannot be shipped as a feature. |
| "Only GitHub? What about designers?" | GitHub is the wedge because code is the most machine-verifiable evidence that exists. The same architecture extends to design, data, and content — that is the long-term platform play. |

---

## Appendix A — Repository Map

```
FixFlowAI/
├── frontend/                    React 18 + Vite 5 SPA
│   ├── src/sections/            Landing sections + Login/Signup/Dashboard shell
│   │   └── dashboard/           16 dashboard panels (Overview → Outcomes)
│   ├── src/components/          MFAModal, DisputeModal, AuditTrailViewer, PayoutOnboarding, …
│   ├── src/store/               useLandingStore.js — single Zustand store (~700 lines)
│   ├── src/lib/                 api.js (backend client), auth.js (JWT session)
│   ├── src/data/landing.js      All marketing copy, pricing tiers, FAQs
│   └── src/skills/              optimisticSync.js (written, currently unused)
├── backend/                     Node 22 + Express + TypeScript strict
│   ├── src/index.ts             ~60 endpoints, CORS, rate limit, error middleware
│   ├── src/routes/              auth.ts, freelancer.ts, interview.ts
│   ├── src/auth/                tokens, middleware, roles, googleOauth, githubOauth, otpVerifier
│   ├── src/skills/              escrowStateMachine.ts, syncServer.ts,
│   │                            earningsCalculator.js, reputationCalculator.js, clientScoring.js
│   ├── src/services/            25 files: aiClient, escrowService, paymentService,
│   │                            matchingEngine, clientMatchWorkflow, proposalPlanService,
│   │                            interviewService, githubScanService, emailService,
│   │                            corsairClient, agentRegistry, keepAliveService, repositories
│   ├── src/test/                testSkills.ts (630 lines), testPlan.ts
│   └── data/                    JSON seed + file-provider stores
├── ai-service/                  Python + FastAPI
│   ├── app/main.py              12 endpoints, token auth, request-id middleware
│   ├── app/features/            brief_parser, confidence_grid, scoring, plan_generator,
│   │                            timeline_validation, discovery, interview, extensions,
│   │                            opportunity, growth, skill_gap, github_scan/
│   ├── app/llm/                 gemini.py, cache.py, circuit_breaker.py
│   ├── app/schemas/             10 Pydantic schema modules
│   └── test_*.py, eval/         ~80+ tests + golden-fixture evaluation harness
├── docs/specifications/         ai_features/, architecture/, core_subsystems/,
│                                frontend/, product_strategy/, roles/, render/,
│                                buildx-prize-tracks/
├── docs/stories/                Self-authored SEC-01..04, BUG-08/09/11, AIE-09/10
├── .agents/ + .kiro/steering/   Agent operating manuals and project steering
├── .github/workflows/           8 CI/CD workflows
├── render.yaml                  3-service Render blueprint (buildx branch)
└── amplify.yml                  AWS Amplify build spec for the SPA
```

---

## Appendix B — Escrow State Machine (the core trust primitive)

```
Draft ──► Pending_Deposit ──► Active ──► In_Review ──► Approved ──► Funds_Released
  ▲            │                 │           │  │                        (terminal)
  └────────────┘                 │           │  └──► Revision_Requested ──┐
                                 │           │              │             │
                                 └───────────┴──────────────┴──► Dispute ─┘
                                                          (Dispute can return to
                                                     Approved / Funds_Released /
                                                       Draft / Pending_Deposit)
```

**Guarantees enforced in order on every transition:**
1. **Optimistic concurrency** — `version` mismatch throws `VersionMismatchError`. No double-release.
2. **Legality** — illegal transitions throw `InvalidTransitionError`.
3. **MFA gate** — `Approved` and `Funds_Released` require a verified TOTP.
4. **Version increment.**
5. **SHA-256 audit block** — chained via `previousHash` (genesis = 64 zeros), hashing index, timestamp, milestone, from-state, to-state, trigger user, role, metadata, and previous hash. `verifyAuditChain()` re-validates indices, recomputed hashes, and links; `scanAllAuditChains()` sweeps for tampering.
6. **Atomic persistence** — milestone + audit block commit in one DynamoDB transaction.

---

## Appendix C — Confidence Grid Weights & Fee Structure

**Confidence factors** (renormalised when the brief states no budget):
`deliverable_coverage 0.30` · `timeline_realism 0.25` · `technical_feasibility 0.25` · `budget_alignment 0.20`

**Matching factors** (all env-tunable): skill overlap, GitHub signal, domain match, budget fit, reputation, availability, SBT.

**Fee stack on a milestone:**
```
Client pays:      gross + 1.5% checkout premium
Freelancer nets:  gross − platform commission (10/5/3/2% by plan)
                        − Razorpay gateway fee (2% + ₹3)
                        − TDS withholding (1% for IN)
```
Shown to the freelancer **before** acceptance. That is the "transparent earnings engine."

---

## Appendix D — Deployment & Environment

**Three Render services from the `buildx` branch:** `fixflowai-ai-service` (FastAPI, health `/health`) → `fixflowai-backend` (Express, health `/api/health`, discovers the AI service internally and shares a generated `AI_SERVICE_TOKEN`) → `fixflowai-frontend` (Vite static, all `VITE_*` vars baked at build time). Custom domain `fixflowai.xyz`.

**Critical env vars.** Backend: `AI_SERVICE_URL`, `AI_SERVICE_TOKEN`, `JWT_SECRET` (rejected under 32 chars), `GOOGLE_OAUTH_CLIENT_ID`, `GITHUB_OAUTH_CLIENT_ID`/`_SECRET`, `RAZORPAY_KEY_ID`/`_KEY_SECRET`/`_WEBHOOK_SECRET`, `ALLOW_PAYMENT_SIMULATION`, `PERSISTENCE_PROVIDER`, `AWS_REGION`, `DDB_TABLE_PREFIX`, `SES_FROM_EMAIL`, `FRONTEND_ORIGINS`, `CORSAIR_*`. AI service: `GEMINI_API_KEY`, `GEMINI_MODEL`, `AI_SERVICE_TOKEN`, `GITHUB_TOKEN`, `REDIS_URL`, `CONFIDENCE_THRESHOLD`. Frontend: `VITE_API_BASE_URL`, `VITE_GOOGLE_CLIENT_ID`, `VITE_GITHUB_CLIENT_ID`, `VITE_GITHUB_REDIRECT_URI`, `VITE_RAZORPAY_KEY_ID`.

**Keep-alive.** In-process pingers in both services warm peers every ~10 minutes; a GitHub Actions cron wakes services that have fully slept.

> 🔒 **Security note for anyone using this file:** the repo contains a `secrets/` folder and a committed `frontend/.env`. The frontend values are public client IDs and a Razorpay test key, which is acceptable, but **do not paste anything from `secrets/` into an LLM, a slide, or a demo screen.** Rotate any credential that has been shared. Reference secrets by key name only.

---

## Appendix E — Documentation Corrections (read before trusting other files)

| Stale claim | Where it appears | Reality |
|---|---|---|
| PostgreSQL + Prisma is the database | `README.md`, `.kiro/steering/tech.md`, `product.md` | **No Prisma anywhere.** DynamoDB + JSON-file + in-memory providers. `DATABASE_URL` is a commented placeholder. |
| Frontend is Next.js App Router | `.kiro/steering/product.md` | **React 18 + Vite 5** with a hand-rolled hash router. |
| `briefParser.ts`, `confidenceGrid.ts`, `interviewGenerator.ts`, `contextExtensions.ts` live in `backend/src/skills/` | `README.md`, `structure.md`, `.agents/AGENTS.md` | **Ported to Python** (`ai-service/app/features/`). Only stale compiled copies remain in `backend/dist/`. |
| Gemini model is `gemini-2.5-pro` | `README.md`, `tech.md`, `ai-service/.env.example` | Defaults are `gemini-3.1-flash-lite` (general) and `gemini-3.5-flash` (proposals). |
| S3 upload is implemented | `.env.example` | Env vars exist; **no upload code**. |
| Pricing figures are final | `frontend/src/data/landing.js` | Marked in-source as **placeholders** until commercial pricing is set. |
| Polygon SBT minting is live | `README.md` | Reputation and SBT metadata are computed; **minting is not wired**. |

---

## Appendix F — Market Research Prompt Pack

Give an LLM this file plus one of the prompts below. The rules: **cite sources, prefer the most recent data, never fabricate a number, and never present a "planned" feature as shipped.**

1. **Market sizing.** Size the global and Indian freelance/independent-work market, then narrow to technical/software freelancing. Report TAM/SAM/SOM for FixFlowAI's wedge (§6.3) with sources and dates. Flag any figure you could not verify.
2. **Competitive teardown.** Compare FixFlowAI against Upwork, Fiverr, Freelancer.com, Toptal, Gun.io, Braintrust, Contra, Lemon.io, and Andela on: verification method, matching mechanism, fee structure, payment protection, delivery workspace, and reputation portability. Identify where FixFlowAI is genuinely differentiated versus merely better-executed.
3. **Verification-layer competitors.** Who else derives skill signal from code or work artefacts (e.g. developer-assessment and code-analysis tools)? Are any of them positioned as a hiring layer? Where does FixFlowAI overlap and where is it distinct?
4. **Pricing validation.** Benchmark the §7.1 model (10/5/3/2% commission + 1.5% client premium + $0/$24/$79 subscriptions) against incumbents. Is the take rate competitive for India-first? Recommend final figures with reasoning.
5. **Escrow regulation.** What are the compliance requirements for holding and releasing client funds in India (RBI, payment aggregator norms, Razorpay Route constraints, TDS/GST on platform fees)? What must be in place before real money moves?
6. **GTM.** Design a supply-first launch for the §6.3 ideal customer. Where do verifiable Indian developers congregate? What is the lowest-cost path to first liquidity? Sequence the first 90 days.
7. **Investor objections.** Generate the ten hardest questions an investor would ask, given both the strengths in §3 and the honest gaps in §8.4. Draft answers grounded only in what this document says is implemented.
8. **Risk register.** Build a risk register across market, technical (§7.4), regulatory, and execution risk, with likelihood, impact, and mitigation.
9. **Moat durability.** Assess whether the evidence-graph moat (§7.3) is defensible against a well-funded incumbent. What would an incumbent have to give up to copy it?
10. **Expansion.** Evaluate extending evidence-based verification beyond code (design, data, writing). Which vertical has the strongest machine-verifiable artefact, and what would the scanner look like?

---

## Appendix G — Implemented vs Planned (single source of truth)

| Capability | Status |
|---|---|
| Google + GitHub OAuth, JWT access + rotating refresh | ✅ implemented |
| GitHub repository scan → verified, non-editable skills | ✅ implemented |
| SSE-streamed scan progress (Skills → Projects → Experience) | ✅ implemented |
| Adaptive discovery questioning | ✅ implemented |
| Semantic brief parsing (AI-001) | ✅ implemented |
| Deep execution plan with revisions, JSON-Patch, approve/reopen (AI-008) | ✅ implemented |
| Timeline validation (cycles, capacity, coverage) | ✅ implemented |
| Confidence grid: deterministic scoring + bounded LLM modifier + self-correction (AI-002) | ✅ implemented |
| Interview question generation (AI-003) | ✅ implemented |
| Contract extension suggestions (AI-004) | ✅ implemented |
| Opportunity scoring (AI-005) | ✅ scoring only — ⚠️ no ingestion pipeline |
| Matching engine + version-guarded hiring funnel (AI-006) | ✅ implemented |
| Freelancer growth plan (AI-007) | ✅ implemented |
| Agreement composer → seeds escrow milestones | ✅ implemented |
| Escrow FSM, optimistic concurrency, TOTP MFA, SHA-256 audit chain | ✅ implemented |
| Razorpay orders, signature verification, webhooks, Route payouts, refunds | ✅ implemented (simulation-capable) |
| Transparent earnings breakdown before acceptance | ✅ implemented |
| Dispute raise + resolve | ✅ implemented — ⚠️ no Arbitrator role |
| Payment history ledger, payout onboarding | ✅ implemented |
| Corsair automations (GitHub / Slack / Gmail) + FixBot | ✅ implemented |
| AWS SES transactional email | ✅ implemented |
| Reputation + SBT metadata computation | ✅ implemented |
| Client quality scoring calculator | ✅ implemented — ⚠️ not surfaced in UI |
| WebSocket sync server (vector clocks, LWW) | ⚠️ server implemented, **client not wired** |
| Freelancer job browse / apply / invitation inbox | ❌ not built |
| Proctored interview room UI | ❌ not built (backend + questions exist) |
| Polygon Soulbound DID minting | ❌ not built |
| S3 file uploads | ❌ not built |
| PostgreSQL / Prisma | ❌ design only |
| Landing early-access form submission | ❌ front-end only, not wired |

---

*Maintained by Team Optimus. When the product changes, update Appendix G first — every other section depends on it.*
