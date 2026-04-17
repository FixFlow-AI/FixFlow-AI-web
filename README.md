<div align="center">

```
██████╗ ██████╗  ██ ███╗ ██████╗ ██╗  ██╗   ██╗████████╗██╗ ██████╗███████╗
██╔══██╗██╔══██╗██╔═══██╗██╔══██╗██║  ╚██╗ ██╔╝╚══██╔══╝██║██╔════╝██╔════╝
██████╔╝██████╔╝██║   ██║██████╔╝██║   ╚████╔╝    ██║   ██║██║     ███████╗
██╔═══╝ ██╔══██╗██║   ██║██╔═══╝ ██║    ╚██╔╝     ██║   ██║██║     ╚════██║
██║     ██║  ██║╚██████╔╝██║     ███████╗██║      ██║   ██║╚██████╗███████║
╚═╝     ╚═╝  ╚═╝ ╚═════╝ ╚═╝     ╚══════╝╚═╝      ╚═╝   ╚═╝ ╚═════╝╚══════╝
```

### *Paste a brief. Get a proposal. Close faster.*

<br/>

[![React](https://img.shields.io/badge/React-18-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.4-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://typescriptlang.org)
[![Vite](https://img.shields.io/badge/Vite-5-646CFF?style=for-the-badge&logo=vite&logoColor=white)](https://vite.dev)
[![Node.js](https://img.shields.io/badge/Node.js-Backend-339933?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org)
[![AWS](https://img.shields.io/badge/AWS-Full_Stack-FF9900?style=for-the-badge&logo=amazonaws&logoColor=white)](https://aws.amazon.com)
[![MongoDB](https://img.shields.io/badge/MongoDB-Atlas-47A248?style=for-the-badge&logo=mongodb&logoColor=white)](https://mongodb.com/atlas)
[![License](https://img.shields.io/badge/License-MIT-22c55e?style=for-the-badge)](LICENSE)
[![Status](https://img.shields.io/badge/Status-In_Development-4F6EF7?style=for-the-badge)]()

<br/>

> **AI-powered client brief → structured proposal generator · Streaming JSON · Confidence Grid · Built for agencies and freelancers**

</div>

---

## ❓ The Problem Nobody Talks About

<div align="center">

| Agencies Deal With | But Proposals Are Built With |
|:---:|:---:|
| **$50K–$500K project scopes** | **Copy-paste from old proposals** |
| **48-hour turnaround pressure** | **3–5 days of manual writing** |
| **Complex technical requirements** | **Guesswork on effort estimates** |
| **Multiple stakeholders needing clarity** | **Inconsistent, unstructured docs** |

</div>

<br/>

The gap between **receiving a client brief** and **delivering a polished proposal** costs agencies thousands of hours per year in manual effort.

The typical proposal workflow looks like this:
- Read a 5-page brief carefully (30 min)
- Identify features, risks, and unknowns (1–2 hours)
- Estimate effort per feature with the team (2–4 hours)
- Write the proposal document (4–8 hours)
- Review, revise, format, and export (2–3 hours)

**Total: 10–17 hours per proposal.** For an agency sending 4 proposals per week, that's **200+ hours/month** burned on document creation alone.

> **This is not a writing problem. It is a structured analysis problem.** An LLM that can parse intent, extract requirements, and output structured JSON can collapse 15 hours of work into 30 seconds — if the pipeline is built correctly.

---

## 🧠 Why We Built Proplytics

<div align="center">

```
The Real Problem We Solved
══════════════════════════════════════════════════════════════════

    Client Brief Arrives              What Currently Happens
    ──────────────────               ──────────────────────

    "We need an AI dashboard         → Read entire brief
     integrated with Salesforce       → Manually list features
     with real-time analytics..."     → Guess effort estimates
                                      → Write 8-page proposal
                                      → Review and revise
                                      → Format and export PDF

    Total time to proposal: 2 days   Cost per proposal: ~$1,200

    ══════════════════════════════════════════════════════════════

    With Proplytics:

    "We need an AI dashboard         → Paste the brief
     integrated with Salesforce       → Press Generate
     with real-time analytics..."     → Get structured proposal
                                      → Review confidence scores
                                      → Export PDF

    Total time to proposal: < 30s    Cost per proposal: < $0.05
```

</div>

<br/>

We built Proplytics because the intersection of **streaming LLMs** and **structured JSON output** finally makes it possible to transform raw client briefs into complete, confidence-scored technical proposals — not with a chatbot that guesses, but with a pipeline that extracts, structures, validates, and presents.

This is not a template filler. Proplytics is a **deterministic analysis pipeline** where the LLM acts as an elite consultant, extracting features, risks, and effort estimates from the client's own words. **The Confidence Grid shows exactly how sure the AI is about every recommendation.**

---

## 🎯 Our Approach & Solution

### The Core Insight

Most AI proposal tools fail because they generate generic text. We do the opposite: **the LLM extracts structured data, the frontend renders it as an interactive, reviewable proposal.**

<div align="center">

```
                    PROPLYTICS PIPELINE
    ╔═══════════════════════════════════════════════════╗
    ║                                                   ║
    ║  Client Brief (Paste or Upload)                   ║
    ║         │                                         ║
    ║         ▼                                         ║
    ║  ┌─────────────────┐                              ║
    ║  │  Input Ingestion │  ← PDF/DOCX → text via      ║
    ║  │  + Sanitization  │    pdf-parse / mammoth       ║
    ║  └────────┬─────────┘                             ║
    ║           │                                       ║
    ║           ▼                                       ║
    ║  ┌─────────────────┐                              ║
    ║  │  Prompt Builder  │  ← Elite consultant persona  ║
    ║  │  (Temp: 0.2-0.4) │    JSON-only output enforced ║
    ║  └────────┬─────────┘                             ║
    ║           │                                       ║
    ║           ▼                                       ║
    ║  ┌─────────────────┐                              ║
    ║  │  Streaming LLM   │  ← SSE pipe: Node → API GW  ║
    ║  │  (Anthropic/OAI) │    → React progressive render║
    ║  └────────┬─────────┘                             ║
    ║           │                                       ║
    ║           ▼                                       ║
    ║  ┌─────────────────┐                              ║
    ║  │  JSON Validation │  ← Zod schema validation     ║
    ║  │  + Repair Pass   │    fallback re-prompt        ║
    ║  └────────┬─────────┘                             ║
    ║           │                                       ║
    ║           ▼                                       ║
    ║  ┌─────────────────┐                              ║
    ║  │  Confidence Grid │  ← Per-feature scoring       ║
    ║  │  + PDF Export    │    animated UI reveal         ║
    ║  └─────────────────┘                              ║
    ║                                                   ║
    ╚═══════════════════════════════════════════════════╝
```

</div>

### The Confidence Grid — Signature Feature

<div align="center">

| | Feature | Confidence | Complexity | What It Means |
|:---:|:---|:---:|:---:|:---|
| 🟢 | Brief Ingestion | **High (88%)** | Low | Well-understood, standard parsing |
| 🟢 | LLM JSON Streaming | **High (82%)** | High | Complex but proven pattern |
| 🟢 | Confidence Grid UI | **High (85%)** | Medium | Clear requirements, strong design |
| 🟡 | Partial JSON Parsing | **Medium (58%)** | High | Edge cases in progressive rendering |
| 🟡 | PDF Export | **Medium (60%)** | Medium | Font embedding + layout accuracy |
| 🟡 | Revision History Diff | **Medium (55%)** | Medium | S3 versioning integration |
| 🔴 | Lambda Streaming Timeout | **Low (28%)** | High | 29s limit requires ECS Fargate |
| 🔴 | JSON Schema Repair | **Low (32%)** | High | LLM occasionally cuts off output |

</div>

Every feature card in the proposal has a **colour-coded left accent**, a **confidence score bar**, and a **complexity badge** — all derived directly from the LLM's structured JSON output. This is what makes Proplytics proposals feel *premium*.

### What Makes Us Different

<div align="center">

| Competitor Approach | Proplytics Approach |
|:---|:---|
| Template-based fill-in-the-blank | AI extracts features from the client's own brief |
| Generic effort estimates | Per-feature confidence scoring with complexity |
| Static document output | Streaming, animated proposal with progressive reveal |
| No visibility into AI reasoning | Confidence Grid shows exactly what the AI is sure about |
| PDF-only export | Interactive web view + PDF export |
| No revision tracking | S3-versioned proposals with diff history |
| One-size-fits-all output | Every proposal is uniquely structured from the brief |

</div>

---

## 🏗️ Architecture

<div align="center">

```
┌─────────────────────────────────────────────────────────────────────────┐
│                                                                         │
│                        USER BROWSER                                     │
│             React 18 + Vite  ·  Amplify Hosting + CloudFront            │
│                                                                         │
│   ┌──────────┐   ┌──────────────┐   ┌────────────┐   ┌──────────────┐  │
│   │ Landing  │   │  Dashboard   │   │   /new     │   │  /proposal   │  │
│   │  Page    │   │  All Briefs  │   │  AI Gen    │   │   /:id View  │  │
│   └──────────┘   └──────────────┘   └────────────┘   └──────────────┘  │
│                                                                         │
└───────────────────────────────┬─────────────────────────────────────────┘
                                │  HTTPS + Bearer JWT
                                │  POST /generate  GET /proposals  SSE
                                ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    AWS API GATEWAY  (REST + WebSocket)                   │
│          JWT authorizer  ·  Rate limiting  ·  CORS auto-managed         │
└───────────────────────────────┬─────────────────────────────────────────┘
                                │  Lambda Proxy / ECS Fargate
                                ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                  BACKEND  —  Node.js                                    │
│          Lambda (short ops) + ECS Fargate (LLM streaming)               │
│                                                                         │
│   ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────────────┐  │
│   │  /auth/*   │ │ File Parser│ │  Prompt    │ │  LLM Streaming     │  │
│   │ JWT Auth   │ │ PDF / DOCX │ │  Builder   │ │  Client (SSE)      │  │
│   └────────────┘ └────────────┘ └────────────┘ └────────────────────┘  │
│   ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────────────┐  │
│   │  JSON      │ │  Proposal  │ │  PDF Export│ │  S3 Upload         │  │
│   │  Validator │ │  CRUD      │ │  Engine    │ │  Handler           │  │
│   │  Zod       │ │            │ │  Puppeteer │ │                    │  │
│   └────────────┘ └────────────┘ └────────────┘ └────────────────────┘  │
│                                                                         │
└──────────┬────────────────────┬───────────────────────┬─────────────────┘
           │                    │                       │
           ▼                    ▼                       ▼
┌──────────────────┐ ┌──────────────────┐ ┌─────────────────────────────┐
│ MONGODB ATLAS    │ │ AWS S3           │ │ LLM API                     │
│ (Auth + Index)   │ │ (Versioned)      │ │ (Anthropic / OpenAI)        │
│                  │ │                  │ │                             │
│ • Users + JWT    │ │ • Brief uploads  │ │ • Streaming JSON            │
│ • Proposal index │ │ • Proposal JSON  │ │ • Temp 0.2–0.4             │
│ • Usage counter  │ │ • versioned:     │ │ • Schema-enforced           │
│ • Plan / tier    │ │   uid/pid/v1.json│ │ • Confidence scores         │
└──────────────────┘ └──────────────────┘ └─────────────────────────────┘
```

</div>

### Key Architecture Decisions

<div align="center">

| Decision | Why We Made It | What It Enables |
|:---|:---|:---|
| **React SPA + Zustand** | Lightweight state for streaming buffer + proposals | Progressive JSON reveal without re-renders |
| **SSE for streaming** | Server-Sent Events pipe LLM chunks to frontend | Cards appear as sections become parseable |
| **ECS Fargate for /generate** | Lambda's 29s timeout kills LLM streaming | Long-lived connections without timeout |
| **S3 for proposal storage** | JSON blobs don't belong in MongoDB | Keeps DB lean; storage costs near-zero |
| **MongoDB for auth only** | User docs + JWT store + proposal index pointers | Horizontal sharding, global replication |
| **Zod schema validation** | LLMs occasionally malform JSON output | Auto-repair pass or re-prompt on failure |
| **Partial JSON parser (200ms)** | Users shouldn't wait for full response | Sections render as they become parseable |
| **Puppeteer PDF export** | Pixel-accurate rendering of React views | Business-grade PDF from the actual UI |

</div>

---

## ⚙️ Technology Stack

<div align="center">

| Layer | Technology | Version | Purpose |
|:---:|:---:|:---:|:---|
| **Frontend Framework** | React | 18.3 | Component-based UI with hooks |
| **Language** | TypeScript | 5.4 | Type-safe frontend development |
| **Build Tool** | Vite | 5.3 | Sub-second HMR, optimized prod bundles |
| **Routing** | React Router DOM | 6.23 | Client-side SPA navigation |
| **Animation** | Framer Motion | 11.2 | Page transitions, card animations |
| **3D Rendering** | Three.js + R3F | 0.165 | Landing page 3D hero element |
| **State Management** | Zustand (planned) | — | Global: `authUser`, `proposalList` |
| **Icons** | Lucide React | 0.396 | Consistent, tree-shakable icon set |
| **Styling** | Tailwind CSS | 3.4 | Utility-first responsive design |
| **Frontend Hosting** | AWS Amplify | — | Git-based CI/CD + CloudFront CDN |
| | | | |
| **Backend Runtime** | Node.js | — | API handlers + LLM client |
| **File Parsing** | pdf-parse / mammoth | — | PDF/DOCX → clean text extraction |
| **LLM Provider** | Anthropic / OpenAI | — | Streaming JSON proposal generation |
| **Schema Validation** | Zod | — | Enforce LLM output structure |
| **PDF Engine** | Puppeteer | — | Headless Chrome → pixel-accurate PDF |
| | | | |
| **Cloud Compute** | AWS Lambda + ECS Fargate | — | Short ops + long-lived streaming |
| **API Layer** | AWS API Gateway | v2 | REST + WebSocket, JWT authorizer |
| **File Storage** | AWS S3 | — | Brief uploads + versioned proposal JSON |
| **Primary DB** | MongoDB Atlas | M0+ | Users, auth, proposal index |
| **Secrets** | AWS Secrets Manager | — | LLM API keys, MongoDB URI — never in env |
| **CDN** | AWS CloudFront | — | SPA static assets, cached reads |
| **Monitoring** | AWS CloudWatch | — | LLM latency, error rates, streaming drops |

</div>

---

## ✨ Features

<div align="center">

| | Feature | Description | Status |
|:---:|:---|:---|:---:|
| 📋 | **Brief Input (Paste / Upload)** | Paste raw text or drop PDF/DOCX — auto-extracts clean brief content | ✅ Frontend |
| 🤖 | **AI Proposal Generation** | One-click: brief → full structured proposal with features, risks, and timeline | 🚧 In Progress |
| ⚡ | **Streaming Output** | SSE streams LLM response; sections reveal progressively as JSON keys resolve | 🚧 In Progress |
| 📊 | **Confidence Grid** | Per-feature confidence bars with color-coded accents (High/Medium/Low) | ✅ Frontend |
| ⏱️ | **Effort Estimator** | AI-generated effort breakdown per layer with week estimates | ✅ Frontend |
| ⚠️ | **Risk Matrix** | Extracted risks with severity scoring and mitigation strategies | ✅ Frontend |
| 📅 | **Timeline View** | Phase-gated roadmap with deliverables and gate criteria | ✅ Frontend |
| 🗂️ | **Proposal Dashboard** | List all generated proposals with status, date, and quick access | ✅ Frontend |
| 📤 | **PDF Export** | Business-grade PDF rendered from the actual proposal view via Puppeteer | 📅 Planned |
| 🔄 | **Revision History** | S3-versioned proposals with diff comparison between versions | 📅 Planned |
| 🔐 | **JWT Authentication** | Secure auth flow with MongoDB-backed user store | 📅 Planned |
| 📧 | **Email Proposal (SES)** | Send generated proposal PDF directly to the client | 💡 Future |
| 💳 | **Usage Tiers** | Free / Pro / Enterprise with query limits and team features | 💡 Future |

</div>

---

## 📂 Project Structure

```
proplytics/
│
├── 📁 src/
│   ├── App.tsx                        ← React Router + AnimatePresence
│   ├── main.tsx                       ← App entry point
│   ├── index.css                      ← Global styles + Tailwind
│   │
│   ├── 📁 pages/                      ← Route-level views
│   │   ├── Landing.tsx                ← Hero + features + CTA
│   │   ├── Dashboard.tsx              ← All proposals list
│   │   ├── NewProposal.tsx            ← Brief input + AI generation
│   │   └── ProposalResult.tsx         ← Full proposal output view
│   │
│   ├── 📁 components/
│   │   ├── 📁 landing/                ← Landing page sections
│   │   │   ├── HeroSection.tsx        ← Main CTA + tagline
│   │   │   ├── Hero3DElement.tsx      ← Three.js 3D visual
│   │   │   ├── FeaturesSection.tsx    ← Feature cards grid
│   │   │   ├── HowItWorks.tsx         ← Step-by-step flow
│   │   │   ├── BenefitsGrid.tsx       ← Value proposition grid
│   │   │   └── Footer.tsx             ← Site footer
│   │   │
│   │   ├── 📁 proposal/              ← Proposal output components
│   │   │   ├── ConfidenceCard.tsx     ← Confidence Grid card
│   │   │   ├── ConfidenceBar.tsx      ← Animated confidence bar
│   │   │   ├── InsightCard.tsx        ← AI insight display
│   │   │   ├── RiskCard.tsx           ← Risk with severity + mitigation
│   │   │   ├── EffortCard.tsx         ← Effort estimate per layer
│   │   │   ├── TimelineStep.tsx       ← Phase timeline item
│   │   │   ├── BriefInput.tsx         ← Text paste input
│   │   │   ├── FileUpload.tsx         ← PDF/DOCX drag-and-drop
│   │   │   ├── DetailDrawer.tsx       ← Slide-out detail panel
│   │   │   └── SectionSkeleton.tsx    ← Loading skeleton for streaming
│   │   │
│   │   ├── 📁 dashboard/             ← Dashboard components
│   │   │   ├── DashboardHeader.tsx    ← Title + actions
│   │   │   ├── ProposalCard.tsx       ← Proposal list item
│   │   │   └── EmptyState.tsx         ← No proposals CTA
│   │   │
│   │   ├── 📁 layout/                ← App shell
│   │   │   ├── DashboardLayout.tsx    ← Sidebar + content wrapper
│   │   │   ├── Navbar.tsx             ← Top navigation bar
│   │   │   └── Sidebar.tsx            ← Left navigation panel
│   │   │
│   │   └── 📁 ui/                    ← Reusable primitives
│   │       ├── Button.tsx             ← Styled button variants
│   │       ├── Card.tsx               ← Card container
│   │       ├── Badge.tsx              ← Status badges
│   │       ├── Input.tsx              ← Form input
│   │       ├── Avatar.tsx             ← User avatar
│   │       ├── Sheet.tsx              ← Slide-over panel
│   │       └── Skeleton.tsx           ← Loading skeleton
│   │
│   └── 📁 lib/                       ← Utilities
│       ├── mock-data.ts              ← Development mock proposals
│       └── utils.ts                  ← Helpers (cn, formatDate, etc.)
│
├── 📁 reference/                      ← Design reference files
│   ├── proposal_builder_tech_architecture.html
│   ├── proposal_builder_master_form.html
│   └── README.md                     ← Style reference
│
├── index.html                        ← Vite entry HTML
├── package.json                      ← Dependencies + scripts
├── vite.config.ts                    ← Vite + React plugin
├── tsconfig.json                     ← TypeScript config
├── tailwind.config.js                ← Tailwind theme + extensions
├── postcss.config.js                 ← PostCSS + Tailwind plugin
└── .gitignore                        ← Excluded files
```

---

## 🚀 Quick Start

### Prerequisites

```bash
node --version         # Node 18+
npm --version          # npm 9+
```

### Local Development

```bash
# 1. Clone
git clone https://github.com/Suvam-paul145/Proplytics.git
cd Proplytics

# 2. Install dependencies
npm install

# 3. Start development server
npm run dev
# App: http://localhost:5173

# 4. Build for production
npm run build
npm run preview
```

---

## 🧩 AI Pipeline — How It Works

<div align="center">

| Step | Stage | What Happens | Technology |
|:---:|:---|:---|:---|
| **1** | Input Ingestion | Accept raw text paste OR file upload (PDF/DOCX). Extract clean text, sanitise, truncate to LLM context limit. | pdf-parse, mammoth, S3 pre-signed URL |
| **2** | Prompt Construction | System prompt (elite consultant persona) + client brief injected into template. JSON-only output enforced. Temperature 0.2–0.4. | Prompt template engine, token counter |
| **3** | Streaming LLM Call | SSE pipe: Node.js streams LLM delta chunks → API Gateway → React client. Frontend accumulates raw JSON string and progressively reveals sections. | EventSource, partial JSON parser |
| **4** | JSON Validation + Repair | Validate full JSON against Zod schema. If malformed, run repair pass or re-request broken section only. Assign confidence per field. | Zod, fallback re-prompt |
| **5** | Proposal Persistence | Validated JSON stored to S3 at `userId/proposalId/v1.json`. Metadata saved to MongoDB. Enables revision history diff. | S3 versioned bucket, MongoDB index |

</div>

---

## ⚠️ Technical Risks & Mitigations

<div align="center">

| Risk | Severity | Mitigation |
|:---|:---:|:---|
| Lambda 29s streaming timeout | 🔴 **90%** | Use ECS Fargate for /generate endpoint |
| LLM hallucinating JSON keys | 🟡 **70%** | Enforce schema with Zod, re-prompt on failure |
| PDF export fidelity | 🟡 **50%** | Puppeteer for pixel-accurate; react-pdf as fallback |
| LLM API rate limits | 🟡 **55%** | Per-user queue, exponential retry, usage counter |
| Streaming mid-cut JSON | 🟡 **65%** | Accumulate full buffer, validate on stream end |
| MongoDB cold start latency | 🟢 **35%** | Connection pooling + Lambda warm-up pings |
| S3 cost at scale | 🟢 **20%** | Archive old revisions to S3 Glacier after 90 days |

</div>

---

## 💼 Business Plan & Scalability

### The Market Opportunity

<div align="center">

| Metric | Value | Source |
|:---|:---:|:---|
| Global Professional Services Market | **$6.4T** | Statista |
| Agencies sending 4+ proposals/week | **68%** | HubSpot Agency Survey |
| Average time per proposal (manual) | **15 hours** | Proposify State of Proposals |
| Average cost per proposal | **~$1,200** | U.S. BLS (analyst hourly rate) |
| Win rate with fast turnaround (<24h) | **40% higher** | Proposify |
| Cost per Proplytics proposal | **< $0.05** | LLM API pricing |

</div>

### Revenue Model

<div align="center">

```
┌─────────────────────────────────────────────────────────────────┐
│                    PRICING TIERS                                │
├──────────────────┬──────────────────┬───────────────────────────┤
│   🆓 FREE        │  💼 PROFESSIONAL  │  🏢 AGENCY                │
│   $0/month       │  $39/month        │  $149/month               │
├──────────────────┼──────────────────┼───────────────────────────┤
│ • 5 proposals/mo │ • 50 proposals   │ • Unlimited proposals     │
│ • Paste-only     │ • PDF/DOCX upload│ • Custom brand templates  │
│ • Basic PDF      │ • Confidence Grid│ • Team workspaces         │
│ • 1 user         │ • Revision hist. │ • Client email delivery   │
│                  │ • Priority LLM   │ • API access              │
│                  │ • 3 users        │ • SSO / SAML auth         │
│                  │                  │ • Unlimited users         │
└──────────────────┴──────────────────┴───────────────────────────┘
```

</div>

### Scalability Path

<div align="center">

| Traffic Level | Infrastructure | Monthly Cost | Concurrent Users |
|:---|:---|:---:|:---:|
| **MVP / Demo** | Lambda free tier + MongoDB M0 | **$0** | ~100 |
| **Early Adopters (500 users)** | Lambda + Atlas M10 + ECS | **~$65** | ~300 |
| **Growth (5K users)** | ECS Fargate autoscale + Atlas M30 | **~$350** | ~3,000 |
| **Scale (50K users)** | Multi-region ECS + Atlas M80 + CloudFront | **~$2,500** | ~30,000 |

</div>

---

## 🔒 Security

<div align="center">

| Layer | Implementation |
|:---|:---|
| **Authentication** | JWT tokens with MongoDB-backed user store |
| **Authorization** | Per-user proposal scoping — users cannot access others' data |
| **File upload** | PDF/DOCX/TXT only validation, content-type check, UUID-renamed storage |
| **LLM output** | Zod schema validation on every response; malformed JSON rejected |
| **Secrets** | AWS Secrets Manager for all API keys — never in env files or code |
| **API protection** | Rate limiting + CORS via API Gateway |
| **Storage** | S3 bucket policies, pre-signed URLs with expiry |

</div>

---

## 🗺️ Roadmap

<div align="center">

| Timeline | Feature | Status |
|:---:|:---|:---:|
| ✅ Done | React SPA with Vite + TypeScript | Released |
| ✅ Done | Landing page with 3D hero element | Released |
| ✅ Done | Dashboard with proposal list view | Released |
| ✅ Done | Brief input (paste + file upload) | Released |
| ✅ Done | Confidence Grid with animated bars | Released |
| ✅ Done | Risk matrix + effort estimator UI | Released |
| ✅ Done | Timeline / roadmap phase view | Released |
| ✅ Done | Section skeleton loaders | Released |
| 🚧 Next | Node.js backend + LLM integration | In Progress |
| 🚧 Next | SSE streaming + partial JSON parser | In Progress |
| 🚧 Next | JWT authentication flow | In Progress |
| 📅 Planned | AWS deployment (Lambda + ECS + S3) | Q2 2026 |
| 📅 Planned | PDF export via Puppeteer | Q2 2026 |
| 📅 Planned | Revision history with S3 versioning | Q3 2026 |
| 📅 Planned | Client email delivery (SES) | Q3 2026 |
| 💡 Future | Team workspaces + shared proposals | Q4 2026 |
| 💡 Future | Custom brand template builder | Q4 2026 |
| 💡 Future | Proposal analytics dashboard | 2027 |

</div>

---

## 👨‍💻 Team

<div align="center">

| | Suvam Paul |
|:---:|:---|
| **Role** | Full-Stack AI Engineer · Product Architect |
| **Focus** | End-to-end: LLM pipeline, Node.js backend, React frontend, AWS deployment |
| **Stack** | TypeScript · React · Node.js · AWS · MongoDB · LLM APIs |
| **GitHub** | [@Suvam-paul145](https://github.com/Suvam-paul145) |

</div>

---

## 📜 License

This project is licensed under the **MIT License** — see the [LICENSE](LICENSE) file for details.

---

<div align="center">

```
Built with obsession · Designed for agencies · Powered by structured AI

        "The fastest proposal wins the deal."

  ─────────────────────────────────────────────────────────────
  Proplytics · github.com/Suvam-paul145/Proplytics · MIT
  ─────────────────────────────────────────────────────────────
```

[![Star this repo](https://img.shields.io/github/stars/Suvam-paul145/Proplytics?style=social)](https://github.com/Suvam-paul145/Proplytics)

</div>
