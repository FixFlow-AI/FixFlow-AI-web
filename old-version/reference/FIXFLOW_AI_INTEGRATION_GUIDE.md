# Fix Flow AI — Complete Feature & Integration Guide

> **Purpose of this document**
> This file is a complete reference of every page, component, AI workflow, animation system and design token built in the **Lovable "Fix Flow AI" (Decentralised Freelancer OS)** project, plus a step-by-step plan to **merge it into your existing Proplytics / FixFlowAI** root project (React 18 + Vite + Express 5 + MongoDB + S3 + Gemini).
>
> Read top-to-bottom for understanding, or jump to **Part 3 — Merge Playbook** if you just want to integrate.

---

## Table of Contents

1. [Product Overview](#1-product-overview)
2. [Tech Stack (this Lovable project)](#2-tech-stack)
3. [Design System](#3-design-system)
4. [Routes & Page Map](#4-routes--page-map)
5. [Page-by-Page Feature Inventory](#5-page-by-page-feature-inventory)
6. [Reusable Components](#6-reusable-components)
7. [AI Workflows & Agent Behaviours](#7-ai-workflows--agent-behaviours)
8. [Animation & Motion System](#8-animation--motion-system)
9. [Data Model (mocked → ready for backend)](#9-data-model)
10. [Merge Playbook — Integrating into your existing root project](#10-merge-playbook)
11. [API Contracts to implement on Express side](#11-api-contracts)
12. [Migration checklist](#12-migration-checklist)
13. [FAQ / Gotchas](#13-faq--gotchas)

---

## 1. Product Overview

**Fix Flow AI** is a *Decentralised Freelancer OS*. It takes a developer's GitHub identity and turns it into:

- A **niche analysis** engine (what you're actually good at, with rate ceilings).
- A **lead pipeline** (AI-discovered prospects from Reddit / HN / Upwork / direct).
- An **outreach engine** (personalised messages with word-count + personalisation validation).
- A **smart-escrow** layer (milestone-based payments, $FIXFLOW / USDC / MATIC).
- A **ZK-credential vault** (Soulbound Reputation NFT + verifiable skills / DID).
- A **FlowBoard** (single-pane dashboard of revenue, leads, tasks, invoices).

It is conceptually a **superset** of your existing Proplytics flow:

| Proplytics today | Fix Flow AI adds |
|---|---|
| Brief → proposal (one user, one doc) | Lead → proposal → escrow → payout (full lifecycle) |
| Confidence Grid per feature | Niche depth score + rate ceiling per niche |
| Share portal w/ PIN | On-chain reputation + ZK skill proofs |
| MongoDB metadata + S3 versions | Same, plus lead/escrow/credential collections |

**Both products share the same idea**: schema-first AI output → progressive UI → versioned persistence. The Lovable project is the **front-end shell** that can plug straight into your existing Express + Gemini backend.

---

## 2. Tech Stack

| Layer | Library | Notes |
|---|---|---|
| Framework | React 18 + Vite 5 + TypeScript | SPA, route-split |
| Routing | `react-router-dom` v6 | Nested under `/dashboard` |
| Styling | Tailwind CSS v3 + CSS variables | All colours are HSL semantic tokens |
| UI primitives | `shadcn/ui` (Radix) | button, dialog, toast, drawer, sheet, sidebar, etc. |
| Motion | `framer-motion` | Spring physics on interactions, eased on routes |
| 3D | `@react-three/fiber` + `three` | Particle field on hero (disabled <768px) |
| Icons | `lucide-react` | |
| State | `@tanstack/react-query` (provider only — no live queries yet) | Mock data in components today |
| Toasts | `sonner` + shadcn toaster | Two toasters mounted; standardise on one in merge |

**No backend in this project yet.** All data is mocked inside the page files. This is intentional — it makes the merge into your existing Express backend trivial.

---

## 3. Design System

Theme name: **Cosmic Dark-Glass**.

### 3.1 Colour tokens (`src/index.css`)

All defined as **HSL** channels so Tailwind utilities can wrap them with opacity:

```
--cosmic-void:  230 84% 4%      // app background
--deep-space:   232 60% 8%
--nebula:       232 60% 13%     // card surface
--stellar:      232 40% 18%

--violet:       263 70% 50%     // primary brand
--violet-glow:  263 70% 60%
--cyan:         187 94% 43%     // AI / accent
--cyan-glow:    187 94% 55%
--emerald:      160 84% 39%     // success / paid
--amber:         38 92% 50%     // warnings
--rose:         350 89% 60%     // error / overdue / problem stats

--glass-1..4:   layered translucency for GlassCard
```

**Rule**: never write `text-white`, `bg-black`, hex codes, or raw rgba in components. Use semantic tokens (`bg-cosmic-void`, `text-violet`, `border-rose/40`, etc.) defined in `tailwind.config.ts`.

### 3.2 Typography

- **Space Grotesk** — display / headings
- **Inter** — body
- **JetBrains Mono** — addresses, DIDs, hashes, on-chain data
Loaded via Google Fonts in `index.css`.

### 3.3 Glass system

`GlassCard` exposes 4 levels of blur+opacity, plus `glow="violet|cyan|emerald|none"` and `hover` (spring scale+lift). Built-in:
- top-edge gradient highlight (`.glass-edge-light`)
- SVG noise overlay (`.noise-overlay`)
- semantic border glow on hover

### 3.4 Glow utilities

```
.glow-violet  → violet-tinted box-shadow (CTAs, primary)
.glow-cyan    → cyan-tinted box-shadow (AI surfaces)
.glow-emerald → green (success/paid)
```

### 3.5 Custom keyframes

`fade-in`, `float`, `pulse-glow`, `gradient-shift` (used by holographic Soulbound NFT and animated CTA).

---

## 4. Routes & Page Map

```
/                              →  Marketing homepage (public)
/onboarding                    →  GitHub-scan animation (6 stages)
/onboarding/profiles           →  AI-generated bio editor (Upwork / LinkedIn / etc.)

/dashboard                     →  DashboardLayout (sidebar + bottom-tab on mobile)
  /dashboard                   →  FlowBoard (overview)
  /dashboard/leads             →  Lead Pipeline (Kanban + detail panel)
  /dashboard/niches            →  Niche Analysis (3 niche cards w/ evidence)
  /dashboard/outreach          →  Outreach Queue (split view + message editor)
  /dashboard/escrows           →  Escrows + Invoice History + Payouts
  /dashboard/identity          →  Identity Vault (Soulbound NFT + ZK creds)
  /dashboard/settings          →  Profile / Wallet / Agent toggles

*                              →  NotFound
```

Route changes are wrapped in `AnimatePresence` via `<AnimatedOutlet />` for eased fade/slide transitions.

---

## 5. Page-by-Page Feature Inventory

### 5.1 `/` — Marketing Homepage  (`src/pages/Index.tsx`)

| Section | Component | What it does |
|---|---|---|
| Hero | `HeroSection` (existing) + `ParticleField` | Headline w/ violet→cyan gradient, animated tagline, glowing "Connect GitHub" CTA, 3D star canvas (disabled <768px) |
| Problem | `landing/ProblemSection` | 3 rose-tinted glass stat cards (87% / 14hrs / 0%) |
| Insight | `landing/InsightSection` | Octocat → FixFlow hex morph (opacity crossfade) |
| How It Works | `landing/HowItWorksSection` | Sticky scroll: terminal typewriter → SVG radar chart → spring-animated lead cards |
| Features | `landing/FeaturesSection` | 6-card grid w/ `HexIcon` (violet→cyan gradient fills) |
| Proof | `landing/ProofSection` | `AnimatedCounter` stats + infinite testimonial marquee |
| Web3 | `landing/Web3Section` | Holographic ZK Credential card + Soulbound NFT card |
| Final CTA + Footer | `landing/FinalCTASection` | Full-bleed gradient (`#6D28D9` → `#06B6D4`), gradient CTA, ghost demo button, footer w/ link groups + social |

### 5.2 `/onboarding` — GitHub Scan Animation

`src/pages/Onboarding.tsx` — 6 sequential stages (Connecting → Cloning repos → Analysing commits → Detecting stack → Scoring niches → Building profile). Terminal block w/ typewriter, progress bar, then auto-redirects to `/dashboard/niches`.

### 5.3 `/onboarding/profiles` — Bio Editor

`src/pages/ProfileEditor.tsx` — tabs for Upwork / LinkedIn / Personal-site bios, AI-generated, editable, **auto-save indicator** (pulses on dirty, settles on saved).

### 5.4 `/dashboard` — FlowBoard  (`src/pages/FlowBoard.tsx`)

**Row 1 — 4 metric cards** (`MetricCard`): 30-day earnings, reputation score, active agents, escrow balance. Each = animated counter + SVG sparkline.

**Row 2 — Action Queue (60%) + Tasks Due (40%)**
- Action Queue: 5 lead rows. Each = avatar (initials, violet gradient) + company + role + **score ring** (SVG arc; ≥80 emerald, 60–79 violet, <60 amber) + action button.
- Tasks Due: checkbox list with strikethrough on complete.

**Row 3 — Mini-Gantt** horizontal timeline of active projects.

**Row 4 — Overdue Invoices** with pulsing rose alert.

### 5.5 `/dashboard/leads` — Lead Pipeline  (`src/pages/LeadPipeline.tsx`)

- **5-column Kanban**: New → Qualified → Contacted → Replied → Won/Lost (won column has emerald accent, lost has rose).
- **Drag-and-drop** between columns (native HTML5 DnD + framer-motion `layout`).
- Click card → **480px slide-in `LeadDetailPanel`** (full-screen drawer on mobile):
  - Collapsible "Research" section (company, stack, signals).
  - **AI Reasoning chips** (why this lead scored high).
  - Inline message editor with **word counter** validating `<= 150 words`.
  - Personalisation regex highlights tokens like `{{firstName}}`, `{{repo}}`.

### 5.6 `/dashboard/niches` — Niche Analysis  (`src/pages/NicheAnalysis.tsx`)

3 niche cards, each with:
- **Depth score** rendered as SVG circular arc.
- **Rate ceiling** (e.g. `$140/hr`).
- **Evidence chips** pulled from GitHub (repo name + commit count).
- **Accept / Reject** buttons (state stored locally; once all 3 are accepted, "Generate My Profiles" CTA enables → routes to `/onboarding/profiles`).
- `AIProcessingOverlay` shown during regenerate.

### 5.7 `/dashboard/outreach` — Outreach Queue  (`src/pages/OutreachQueue.tsx`)

Two-panel split:
- **Left (lead list)**: scrollable, selectable rows.
- **Right (detail + editor)**: company info, **message textarea** w/
  - live **word count** (red >150).
  - **personalisation highlights** (regex matches `{{...}}` and underlines them in cyan).
  - Send / Save Draft / Regenerate buttons.

### 5.8 `/dashboard/escrows` — Escrows  (`src/pages/Escrows.tsx`)

- `EscrowPipeline` component — animated flow: Client avatar → Smart-Contract lock → Freelancer avatar, with milestone progress bars and a "Dispute" button.
- **Invoice History** table (collapses to stacked cards <768px).
- **Payout Summary** — wallet balances ($FIXFLOW, USDC, MATIC) + withdraw control.

### 5.9 `/dashboard/identity` — Identity Vault  (`src/pages/IdentityVault.tsx`)

- **Left**: Soulbound Reputation NFT — holographic card using `animate-gradient-shift`.
- **Right**: ZK Credential grid (`HexCredentialCard`) with 3D mouse-tracked tilt; "Verify New Skill" CTA glows cyan; "Share Profile" + "Copy DID" actions emit toasts.

### 5.10 `/dashboard/settings` — Settings  (`src/pages/Settings.tsx`)

3 sections: Profile (name, email, timezone), Wallet (connected addresses + balances, JetBrains Mono), Agent Configuration (toggle switches for Lead Hunter, Outreach Writer, Escrow Watcher, etc.).

---

## 6. Reusable Components

| Component | Path | Purpose |
|---|---|---|
| `GlassCard` | `src/components/GlassCard.tsx` | 4-level glass surface, glow variants |
| `MetricCard` | `src/components/MetricCard.tsx` | Animated counter + sparkline |
| `EscrowPipeline` | `src/components/EscrowPipeline.tsx` | Parameterised fund-flow viz |
| `HexCredentialCard` | `src/components/HexCredentialCard.tsx` | Hexagonal holographic card w/ 3D tilt |
| `ParticleField` | `src/components/ParticleField.tsx` | R3F star canvas (mobile-disabled) |
| `AnimatedOutlet` | `src/components/AnimatedOutlet.tsx` | `AnimatePresence` wrapper for route transitions |
| `AIProcessingOverlay` | `src/components/AIProcessingOverlay.tsx` | Cyan scanning line + corner pulses while AI works |
| `Navbar` | `src/components/Navbar.tsx` | Public site nav |
| `NavLink` | `src/components/NavLink.tsx` | Sidebar link w/ active glow |
| `landing/*` | `src/components/landing/` | 7 homepage sections |
| `ui/*` | `src/components/ui/` | Full shadcn/ui set |

---

## 7. AI Workflows & Agent Behaviours

> Every workflow below is **schema-first**: model returns JSON validated against a Zod schema, then UI renders progressively. This is the same pattern as your existing Proplytics `/api/generate` SSE pipeline.

### 7.1 GitHub Scan → Niche Detection  (Stage 1)

**Input**: GitHub OAuth token.
**Pipeline** (mirrors your Express SSE pattern):

1. `POST /api/github/scan` — clones repo metadata, extracts `package.json` deps, commit cadence, top languages, contribution graph.
2. `POST /api/niches/analyze` (SSE, Gemini) — returns:
   ```json
   {
     "niches": [
       {
         "name": "AI / RAG backend engineering",
         "depth": 87,                // 0..100
         "rateCeiling": 140,         // USD/hr
         "evidence": [
           { "repo": "user/llm-pipe", "commits": 312, "stars": 41 },
           { "repo": "user/vec-store", "commits": 88,  "stars": 12 }
         ],
         "reasoning": "..."
       }
     ]
   }
   ```
3. Response progressively populates the 3 niche cards. `AIProcessingOverlay` mounted during stream.

### 7.2 Profile Generation  (Stage 1.5)

After all 3 niches accepted → `POST /api/profiles/generate` (Gemini, structured JSON):
```json
{
  "upwork":   { "headline": "...", "summary": "...", "rate": 140 },
  "linkedin": { "headline": "...", "about": "..." },
  "personal": { "tagline": "...", "bio": "..." }
}
```
ProfileEditor binds each tab to one key; auto-save debounced 800 ms.

### 7.3 Lead Hunter Agent

Background worker that polls Reddit, HN, Upwork RSS, direct inbound. Each candidate → Gemini scoring:
```json
{
  "leadId": "...",
  "score": 0-100,
  "source": "reddit|hn|upwork|direct",
  "reasoning": ["matches niche AI/RAG", "company funded $8M", "..."],
  "company": { "name": "Stripe", "stack": ["Node","Postgres"], "size": "1000+" },
  "role": "Senior AI Engineer",
  "rateRange": [120, 180]
}
```
Score drives ring colour; reasoning array → chips in detail panel.

### 7.4 Outreach Writer Agent

`POST /api/outreach/draft` returns:
```json
{
  "subject": "...",
  "body": "Hi {{firstName}}, I noticed {{repo}}...",
  "wordCount": 132,
  "personalisationTokens": ["firstName","repo","companyMission"],
  "tone": "warm-direct"
}
```
- Frontend regex `\{\{([a-z]+)\}\}/gi` highlights each token in cyan.
- Word count validated client-side; >150 turns counter rose and disables Send.

### 7.5 Escrow Watcher Agent

Listens for milestone state changes on-chain → emits SSE events to FlowBoard so milestone progress bars animate live. Triggers toast on payout received.

### 7.6 Reputation / ZK Credential Engine

When a project closes "Won" + escrow released → mint Soulbound NFT credential containing:
```json
{
  "skill": "RAG architecture",
  "proof": "<zk-snark>",
  "issuer": "did:fixflow:0xabc...",
  "subject": "did:fixflow:0xdef...",
  "evidence": { "escrowTx": "0x...", "githubCommit": "0x..." }
}
```

### 7.7 Agent toggles

`Settings → Agent Configuration` switches map 1:1 to background-worker `enabled` flags persisted in Mongo (`users.agentConfig`).

---

## 8. Animation & Motion System

| Surface | Motion |
|---|---|
| Buttons / cards | `framer-motion` spring `{ stiffness: 400, damping: 25 }` |
| Route changes | `AnimatePresence mode="wait"` + fade/slide eased 0.25s |
| Lists (Action Queue, leads) | `staggerChildren: 0.05` + per-item spring rise |
| Onboarding stages | sequential delays, terminal typewriter |
| AI processing | Cyan vertical scan line (`animate-y` infinite) + corner-dot pulse |
| Holographic NFT | `animate-gradient-shift` 8s infinite |
| Particle field | R3F frame loop, **disabled below 768px** |
| Counters | tween ease-out, 1.2s |
| Drag-and-drop | `motion.div layout` for re-order spring |

`will-change: transform` on every animated element.

---

## 9. Data Model

These are the shapes the UI consumes today (mocked in components). Use them as your Mongo collection schemas directly.

```ts
// users
{
  _id, email, githubId, did, walletAddresses: { fixflow, usdc, matic },
  agentConfig: { leadHunter: bool, outreachWriter: bool, escrowWatcher: bool },
  niches: [Niche],
  profiles: { upwork, linkedin, personal }
}

// leads
{
  _id, userId, status: "new|qualified|contacted|replied|won|lost",
  score, source, reasoning: [string],
  company: { name, stack:[string], size, logo },
  role, rateRange:[low,high],
  draftMessage: { subject, body, wordCount, tokens:[string] },
  createdAt, updatedAt
}

// escrows
{
  _id, userId, leadId, clientDid, freelancerDid,
  totalAmount, currency: "USDC|FIXFLOW|MATIC",
  milestones: [{ name, amount, status, releasedAt }],
  contractAddress, chain, createdAt
}

// invoices
{ _id, userId, leadId, amount, status: "paid|pending|overdue", dueDate }

// credentials
{
  _id, userId, skill, proof, issuerDid, subjectDid,
  evidence: { escrowTx, githubCommit }, mintedAt, soulbound: true
}

// niches
{ _id, userId, name, depth, rateCeiling, evidence:[{repo,commits,stars}], reasoning, accepted }
```

---

## 10. Merge Playbook

> Goal: keep your **existing Proplytics Express + MongoDB + S3 + Gemini backend untouched** and graft this Lovable UI on as the new front-end shell. Your `/api/generate`, `/api/brief/score`, BriefScore + Confidence Grid stay; we add new routes for leads / niches / escrows / credentials.

### 10.1 Repo layout target

If your existing repo looks like this:
```
your-root/
├── client/            # React 18 + Vite + JS
├── server/            # Express 5
├── package.json
└── ...
```

You will:
1. Replace (or progressively migrate) `client/` with the Lovable codebase.
2. Add new Express routers under `server/routes/` for niches, leads, outreach, escrows, identity.
3. Reuse your existing `auth`, `briefs`, `proposals`, `analytics`, `portal` routers untouched.

### 10.2 Step-by-step

**Step 1 — Pick a strategy**

| Strategy | When to use |
|---|---|
| **A. Replace `client/` entirely** | You're rebranding Proplytics → Fix Flow AI |
| **B. Mount Lovable UI at `/freelancer/*` and keep Proplytics UI at `/`** | You want both products under one app |
| **C. Cherry-pick components only** | You only want the design system + Lead Pipeline / Escrow visuals |

**Step 2 — Bring code across**

```bash
# from your-root/
rm -rf client_old && mv client client_old        # safety
cp -R /path/to/lovable-fixflow client
cd client && bun install                         # or npm/pnpm
```

If your existing client is JavaScript and this one is TypeScript: TS files compile fine alongside JS in Vite — no rewrite needed. Keep `tsconfig.json` from Lovable.

**Step 3 — Reconcile Vite config**

Your existing `vite.config` likely already proxies `/api` → `http://localhost:5000` (Express). Add that to `client/vite.config.ts`:

```ts
server: {
  host: "::",
  port: 8080,
  proxy: {
    "/api": { target: "http://localhost:5000", changeOrigin: true },
  },
},
```

**Step 4 — Auth bridge**

Replace the placeholder "Connect GitHub" button (`src/components/Navbar.tsx` and Hero CTA) with a call to your existing `/api/auth/github` flow. After OAuth callback, redirect to `/onboarding` instead of `/dashboard` for new users (decide via `user.onboardedAt` flag).

**Step 5 — Wire React Query to your APIs**

`QueryClientProvider` is already mounted in `App.tsx`. Replace mocked arrays in each page with hooks:

```ts
// src/hooks/useLeads.ts
export const useLeads = () =>
  useQuery({ queryKey: ["leads"], queryFn: () => fetch("/api/leads").then(r => r.json()) });
```

Repeat for: `useNiches`, `useOutreachQueue`, `useEscrows`, `useInvoices`, `useCredentials`, `useFlowBoard`.

**Step 6 — Connect the Niche / Profile streams to Gemini**

Reuse your existing SSE plumbing from `/api/generate`. Add:

```
POST /api/niches/analyze       // SSE, Gemini, schema-validated JSON
POST /api/profiles/generate    // one-shot Gemini, schema-validated
POST /api/outreach/draft       // one-shot, schema-validated
POST /api/leads/score          // background worker hook
```

Use the **same Zod-repair pipeline** you already have for proposals — it works unchanged for these new schemas.

**Step 7 — Persistence**

Add Mongo collections from §9. S3 buckets you already have:
- `briefs/{userId}/...` — keep as-is
- `output/{userId}/{proposalId}/vN.json` — keep as-is
- *(new)* `niches/{userId}/vN.json`
- *(new)* `outreach/{userId}/{leadId}/vN.json`

**Step 8 — Toaster cleanup**

`App.tsx` mounts both `sonner` and shadcn `Toaster`. Remove one (recommend keeping `sonner`). In your existing app, do the same.

**Step 9 — Tailwind merge**

If your existing `tailwind.config` has tokens, merge — **don't replace**. The Lovable config defines `cosmic`, `violet`, `cyan`, `emerald`, `amber`, `rose` plus glow utilities. Add them under `theme.extend.colors`. Same for `keyframes` and `animation`.

If your existing site uses the Proplytics light theme, namespace the Fix Flow theme under a CSS class:

```css
.theme-fixflow {
  --background: 230 84% 4%;
  --primary: 263 70% 50%;
  /* ... */
}
```
and wrap the dashboard layout: `<div className="theme-fixflow">…</div>`.

**Step 10 — Routing merge**

In your existing router add:
```tsx
<Route path="/freelancer" element={<DashboardLayout />}>
  <Route index element={<FlowBoard />} />
  <Route path="leads" element={<LeadPipeline />} />
  <Route path="niches" element={<NicheAnalysis />} />
  <Route path="outreach" element={<OutreachQueue />} />
  <Route path="escrows" element={<Escrows />} />
  <Route path="identity" element={<IdentityVault />} />
  <Route path="settings" element={<Settings />} />
</Route>
<Route path="/freelancer/onboarding" element={<Onboarding />} />
<Route path="/freelancer/onboarding/profiles" element={<ProfileEditor />} />
```

Keep your `/proposal/:id`, `/dashboard`, `/p/:token` routes from Proplytics intact.

**Step 11 — Web3 layer (optional, can ship empty)**

The escrow / DID / Soulbound NFT views are **fully render-able with mocked data**. If you don't have a chain integration yet, leave the data static — they still demo well. When you're ready, add an `ethers` (or `viem`) provider and a `useWallet()` hook; bind the wallet panel in Settings to it.

---

## 11. API Contracts

Reference shapes for every backend endpoint the UI expects.

```
GET    /api/me                            → User
POST   /api/auth/github/callback          → { token, user }

POST   /api/github/scan                   → { repos, commits, languages }
POST   /api/niches/analyze       (SSE)    → stream<Niche>
POST   /api/niches/:id/accept             → { ok }
POST   /api/profiles/generate             → { upwork, linkedin, personal }
PATCH  /api/profiles                      → { upwork?, linkedin?, personal? }

GET    /api/leads?status=...              → Lead[]
PATCH  /api/leads/:id                     → Lead             // status drag-drop
POST   /api/leads/:id/draft-message       → { subject, body, wordCount, tokens }
POST   /api/leads/:id/send                → { ok, sentAt }

GET    /api/flowboard                     → { metrics, actionQueue, tasks, gantt, overdue }

GET    /api/escrows                       → Escrow[]
POST   /api/escrows/:id/release/:msIdx    → { txHash }
POST   /api/escrows/:id/dispute           → { ok }

GET    /api/invoices                      → Invoice[]
POST   /api/invoices/:id/remind           → { ok }

GET    /api/credentials                   → Credential[]
POST   /api/credentials/mint              → Credential
GET    /api/identity/share                → { url, did }

PATCH  /api/settings                      → User
PATCH  /api/settings/agents               → { leadHunter, outreachWriter, escrowWatcher }
```

All responses use the same envelope your existing API uses (you mentioned `{ ok, data, error }` in your Express layer — keep it).

---

## 12. Migration Checklist

- [ ] Decide replace-vs-mount-vs-cherrypick (§10.1)
- [ ] Copy Lovable client into `your-root/client`
- [ ] Add `/api` proxy in `vite.config.ts`
- [ ] Merge Tailwind config (don't overwrite)
- [ ] Merge `index.css` tokens (namespace under `.theme-fixflow` if mixed-theme)
- [ ] Wire `/api/auth/github` to existing OAuth
- [ ] Add 7 new Express routers (niches, leads, outreach, escrows, invoices, credentials, flowboard)
- [ ] Add Mongo collections from §9
- [ ] Reuse existing Gemini + Zod-repair pipeline for new schemas
- [ ] Replace mocked arrays in each page with React Query hooks
- [ ] Decide if you keep one toaster or both
- [ ] QA: drag-and-drop on Lead Pipeline still works after API wiring
- [ ] QA: SSE niche stream renders progressively
- [ ] QA: mobile bottom-tab + stacked cards on <768px
- [ ] QA: route transitions still smooth
- [ ] Remove `/onboarding` from public routes if you require auth-first

---

## 13. FAQ / Gotchas

**Q: My existing client is JavaScript. Do I have to convert all my code to TS?**
No. Vite happily mixes `.jsx` and `.tsx`. Keep your old files as-is.

**Q: Two `Toaster` components — issue?**
Cosmetic only (you may see double toasts). Remove the shadcn one and standardise on `sonner`.

**Q: Particle field eats CPU on mobile.**
It's already gated by `useIsMobile()` and `prefers-reduced-motion`. Verify the gate runs in your build.

**Q: Can I keep Proplytics' Confidence Grid alongside Niche Analysis?**
Yes — they're orthogonal. Confidence Grid lives on the proposal page; Niche Analysis lives on `/freelancer/niches`.

**Q: How do I theme-switch between Proplytics light and Fix Flow dark?**
Use the `.theme-fixflow` wrapper approach in §10 Step 9. Toggle via a top-level layout based on route.

**Q: Where are the AI prompts?**
Not in this repo — they belong in your Express server. Use schema-first prompting (return JSON only; validate with Zod; repair on parse-fail) — same pattern as your existing `/api/generate`.

**Q: Drag-and-drop library?**
Native HTML5 DnD + framer-motion `layout`. No `react-dnd`/`dnd-kit` dependency. Re-evaluate if you need touch DnD on mobile.

**Q: 3D / R3F bundle size?**
~150 KB gzipped. If you don't want it, delete `ParticleField` and the import in `HeroSection`; the page falls back gracefully.

---

## Appendix — File map (quick reference)

```
src/
├── App.tsx                          # Routes + providers
├── index.css                        # Design tokens, glass, glow, fonts
├── layouts/
│   └── DashboardLayout.tsx          # Sidebar + bottom-tab + outlet
├── pages/
│   ├── Index.tsx                    # Marketing homepage
│   ├── Onboarding.tsx               # GitHub scan animation
│   ├── ProfileEditor.tsx            # Bio editor (post-niche-accept)
│   ├── FlowBoard.tsx                # Dashboard overview
│   ├── LeadPipeline.tsx             # Kanban + detail panel
│   ├── NicheAnalysis.tsx            # 3 niche cards w/ evidence
│   ├── OutreachQueue.tsx            # Two-panel + word count + highlights
│   ├── Escrows.tsx                  # Pipeline + invoices + payouts
│   ├── IdentityVault.tsx            # Soulbound NFT + ZK creds
│   ├── Settings.tsx                 # Profile / wallet / agents
│   └── NotFound.tsx
├── components/
│   ├── GlassCard.tsx
│   ├── MetricCard.tsx
│   ├── EscrowPipeline.tsx
│   ├── HexCredentialCard.tsx
│   ├── ParticleField.tsx
│   ├── AnimatedOutlet.tsx
│   ├── AIProcessingOverlay.tsx
│   ├── Navbar.tsx
│   ├── NavLink.tsx
│   ├── landing/
│   │   ├── ProblemSection.tsx
│   │   ├── InsightSection.tsx
│   │   ├── HowItWorksSection.tsx
│   │   ├── FeaturesSection.tsx
│   │   ├── ProofSection.tsx
│   │   ├── Web3Section.tsx
│   │   └── FinalCTASection.tsx
│   └── ui/                          # shadcn primitives
└── lib/utils.ts                     # cn() helper
```

---

*Generated for merge planning. All AI workflows above assume your existing schema-first Gemini + Zod pipeline; no new infrastructure is required to ship the Fix Flow AI front-end on top of Proplytics.*
