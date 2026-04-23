# Proplytics — Full Requirements & Implementation Plan

> **AI Client Brief → Proposal Builder**
> Takes a raw client brief (pasted text or uploaded PDF/DOCX) and generates a structured, scored project proposal with confidence grid, risk matrix, timeline, and effort breakdown — powered by LLM streaming.

---

## Table of Contents

1. [Current State Analysis](#1-current-state-analysis)
2. [Target Architecture Overview](#2-target-architecture-overview)
3. [Phase 0 — Foundation Setup (3 days)](#3-phase-0--foundation-setup)
4. [Phase 1 — Authentication + AWS Infrastructure (Wk 1–2)](#4-phase-1--authentication--aws-infrastructure)
5. [Phase 2 — AI Pipeline + Streaming (Wk 3–6) — CRITICAL PATH](#5-phase-2--ai-pipeline--streaming)
6. [Phase 3 — Frontend Integration + Confidence Grid (Wk 7–9)](#6-phase-3--frontend-integration--confidence-grid)
7. [Phase 4 — Export + Revision History (Wk 10–11)](#7-phase-4--export--revision-history)
8. [Phase 5 — Polish + QA (Wk 12)](#8-phase-5--polish--qa)
9. [Database Schema Design](#9-database-schema-design)
10. [API Endpoint Specification](#10-api-endpoint-specification)
11. [LLM Prompt Schema & Output Contract](#11-llm-prompt-schema--output-contract)
12. [Technical Risks & Mitigations](#12-technical-risks--mitigations)
13. [Effort Breakdown](#13-effort-breakdown)

---

## 1. Current State Analysis

### What Exists (Frontend Only — React SPA)

| Layer | Details |
|---|---|
| **Framework** | React 18 + Vite 5 + TailwindCSS 3.4 |
| **Routing** | React Router DOM v6 — 4 routes: `/`, `/dashboard`, `/new`, `/proposal/:id` |
| **Pages** | `Landing.jsx`, `Dashboard.jsx`, `NewProposal.jsx`, `ProposalResult.jsx` |
| **Components** | BriefInput, FileUpload, ConfidenceCard, InsightCard, TimelineStep, EffortCard, RiskCard, DetailDrawer, SectionSkeleton, full UI kit (Button, Card, Input, Badge, Sheet, etc.) |
| **Animations** | Framer Motion + Three.js (landing 3D hero) |
| **Data** | **100% mock data** in `src/lib/mock-data.js` — no real API calls |
| **Auth** | None |
| **State Mgmt** | Local `useState` only — no Zustand/Context |
| **Backend** | None |
| **Database** | None |
| **Cloud Infra** | None |

### What Does NOT Exist Yet

- No backend server (Node.js)
- No authentication (JWT, login/signup)
- No database (MongoDB)
- No cloud storage (S3)
- No AI/LLM integration
- No streaming pipeline (SSE)
- No file parsing (PDF/DOCX)
- No real proposal generation
- No PDF export
- No revision history
- No CI/CD pipeline
- No deployment infrastructure

---

## 2. Target Architecture Overview

> **Cost-Optimized Architecture** — Eliminates API Gateway & Lambda overhead.
> ECS Fargate runs the full Express server (all routes + SSE streaming).
> No Lambda 29s timeout issue. No API Gateway per-request billing.

```
┌────────────────────────────────────────────────────────────────┐
│  CLIENT LAYER — React SPA                                      │
│  AWS Amplify Hosting + CloudFront CDN                          │
│                                                                │
│  • Brief input (paste text / upload PDF/DOCX)                  │
│  • Streaming output renderer (200ms partial JSON parse)        │
│  • Confidence Grid UI (signature feature)                      │
│  • Revision history panel                                      │
│  • Export / download (PDF)                                     │
│  • Auth screens (JWT login/signup)                             │
└────────────────────────┬───────────────────────────────────────┘
                         │ HTTPS + Bearer JWT
                         ▼
┌────────────────────────────────────────────────────────────────┐
│  COMPUTE LAYER — ECS Fargate (single Express service)          │
│  ALB (Application Load Balancer) → Fargate Task                │
│                                                                │
│  Express.js handles ALL routes:                                │
│  • JWT auth middleware (verify access/refresh tokens)          │
│  • Rate limiting (express-rate-limit)                          │
│  • CORS + Helmet security headers                              │
│  • /api/auth/*     — Registration, login, refresh, logout      │
│  • /api/proposals/* — CRUD operations                          │
│  • /api/generate    — SSE streaming (no timeout constraint)    │
│  • /api/proposals/:id/export — PDF export (Puppeteer)          │
│                                                                │
│  Services:                                                     │
│  • File parser (pdf-parse / mammoth → clean text)              │
│  • Prompt template engine                                      │
│  • LLM API client (streaming)                                  │
│  • Partial JSON validator (Zod)                                │
│  • S3 upload handler (pre-signed URLs)                         │
└─────────┬──────────────┬───────────────────┬───────────────────┘
          │              │                   │
          ▼              ▼                   ▼
┌──────────────┐ ┌──────────────┐ ┌─────────────────┐
│  MongoDB     │ │  AWS S3      │ │  LLM API        │
│  Atlas M0    │ │  (1 bucket)  │ │  (Google Gemini) │
│  FREE TIER   │ │              │ │                  │
│              │ │  proplytics- │ │                  │
│  • Users     │ │  assets-{env}│ │  • Streaming     │
│  • Auth/JWT  │ │  ├─ briefs/  │ │    JSON output   │
│  • Proposal  │ │  ├─ output/  │ │  • Temp 0.2–0.4  │
│    index     │ │  └─ exports/ │ │  • Schema-       │
│  • Usage     │ │  (versioned) │ │    enforced      │
│    counter   │ │              │ │                  │
└──────────────┘ └──────────────┘ └─────────────────┘

     Secrets: SSM Parameter Store (SecureString) — FREE TIER
     Monitoring: CloudWatch Logs + Basic Metrics — FREE TIER
     CI/CD: GitHub Actions → Amplify (frontend) + ECR/ECS (backend)
```

### AWS Services & Cost Breakdown

| Service | Usage | Free Tier | Est. Monthly Cost |
|---|---|---|---|
| **ECS Fargate** | 0.25 vCPU / 0.5 GB task, 1 desired count | N/A | ~$9/mo (can scale to 0 with scheduled scaling) |
| **ALB** | Routes HTTPS to Fargate | N/A | ~$16/mo (or skip ALB and use Fargate public IP + Nginx for dev) |
| **ECR** | Docker image storage | 500 MB/mo free | $0 |
| **Amplify Hosting** | Frontend SPA + CloudFront | 1000 build-min, 15 GB served/mo | $0 (free tier) |
| **S3** | 1 bucket, briefs + proposals + exports | 5 GB, 20K GET, 2K PUT/mo | $0–0.50/mo |
| **SSM Parameter Store** | API keys, MongoDB URI, JWT secret | 10,000 standard params free | $0 |
| **CloudWatch Logs** | Application logs from Fargate | 5 GB ingest, 5 GB storage/mo | $0 |
| **MongoDB Atlas M0** | Users, proposals index | 512 MB free forever | $0 |
| **LLM API** | Google Gemini API | Free tier available | $0 for low-volume dev; paid as usage grows |

**Total (development/low traffic): ~$9–25/month**

> 💡 **Cost tip:** During development, skip the ALB entirely — run Fargate with a public IP
> and use Nginx inside the container for SSL termination. This saves ~$16/mo.
> Add ALB only when you need auto-scaling or health-check routing.

### IAM Policy Requirements

You need **one IAM user** (for CI/CD) and **one ECS Task Execution Role** (for Fargate):

**1. IAM User: `proplytics-ci-cd`** (for GitHub Actions deployments)
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "ECRPushPull",
      "Effect": "Allow",
      "Action": [
        "ecr:GetAuthorizationToken",
        "ecr:BatchCheckLayerAvailability",
        "ecr:GetDownloadUrlForLayer",
        "ecr:BatchGetImage",
        "ecr:PutImage",
        "ecr:InitiateLayerUpload",
        "ecr:UploadLayerPart",
        "ecr:CompleteLayerUpload"
      ],
      "Resource": "arn:aws:ecr:*:*:repository/proplytics-backend"
    },
    {
      "Sid": "ECSUpdateService",
      "Effect": "Allow",
      "Action": [
        "ecs:UpdateService",
        "ecs:DescribeServices",
        "ecs:DescribeTaskDefinition",
        "ecs:RegisterTaskDefinition"
      ],
      "Resource": "*"
    },
    {
      "Sid": "PassRole",
      "Effect": "Allow",
      "Action": "iam:PassRole",
      "Resource": "arn:aws:iam::*:role/proplytics-ecs-*"
    }
  ]
}
```

**2. ECS Task Role: `proplytics-ecs-task-role`** (attached to Fargate task)
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "S3Access",
      "Effect": "Allow",
      "Action": [
        "s3:GetObject",
        "s3:PutObject",
        "s3:DeleteObject",
        "s3:ListBucket"
      ],
      "Resource": [
        "arn:aws:s3:::proplytics-assets-*",
        "arn:aws:s3:::proplytics-assets-*/*"
      ]
    },
    {
      "Sid": "SSMParameterRead",
      "Effect": "Allow",
      "Action": [
        "ssm:GetParameter",
        "ssm:GetParameters",
        "ssm:GetParametersByPath"
      ],
      "Resource": "arn:aws:ssm:*:*:parameter/proplytics/*"
    },
    {
      "Sid": "CloudWatchLogs",
      "Effect": "Allow",
      "Action": [
        "logs:CreateLogStream",
        "logs:PutLogEvents"
      ],
      "Resource": "arn:aws:logs:*:*:log-group:/ecs/proplytics-*"
    }
  ]
}
```

**3. ECS Task Execution Role: `proplytics-ecs-execution-role`** (pulls image + sends logs)
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "ecr:GetAuthorizationToken",
        "ecr:BatchCheckLayerAvailability",
        "ecr:GetDownloadUrlForLayer",
        "ecr:BatchGetImage",
        "logs:CreateLogGroup",
        "logs:CreateLogStream",
        "logs:PutLogEvents"
      ],
      "Resource": "*"
    },
    {
      "Sid": "SSMForEnvInjection",
      "Effect": "Allow",
      "Action": [
        "ssm:GetParameters"
      ],
      "Resource": "arn:aws:ssm:*:*:parameter/proplytics/*"
    }
  ]
}
```

### SSM Parameter Store — Secrets Layout

| Parameter Path | Type | Value |
|---|---|---|
| `/proplytics/prod/MONGODB_URI` | SecureString | `mongodb+srv://...` |
| `/proplytics/prod/JWT_SECRET` | SecureString | `<hex string>` |
| `/proplytics/prod/JWT_REFRESH_SECRET` | SecureString | `<hex string>` |
| `/proplytics/prod/GEMINI_API_KEY` | SecureString | `AIza...` |
| `/proplytics/prod/FRONTEND_URL` | String | `https://main.d1234.amplifyapp.com` |
| `/proplytics/dev/...` | ... | (same structure for dev) |

### Tech Stack Summary

| Layer | Technology | Purpose |
|---|---|---|
| Frontend | React 18, Vite 5, TailwindCSS, Framer Motion, Three.js | SPA + animations |
| State Mgmt | Zustand + React Query (TanStack Query) | Global state + server state caching |
| Backend | Node.js (Express) on ECS Fargate | API server + SSE streaming (single service) |
| Streaming | SSE (Server-Sent Events) over Express | LLM streaming to client (no timeout limit) |
| Auth | JWT (access + refresh tokens) | Stateless auth (Express middleware) |
| Database | MongoDB Atlas (M0 free tier) | Users, auth, proposal index |
| File Storage | AWS S3 (1 bucket, prefix-based) | Briefs, proposal JSON, PDF exports |
| AI/LLM | Google Gemini 2.5 Flash | Proposal generation |
| File Parsing | pdf-parse, mammoth | PDF/DOCX → clean text |
| Validation | Zod | JSON schema validation + repair |
| PDF Export | Puppeteer (primary), react-pdf (fallback) | Business-grade PDF output |
| CI/CD | GitHub Actions → ECR + ECS / Amplify | Automated tests + deploy |
| Monitoring | AWS CloudWatch (free tier) | Container logs + basic metrics |
| Secrets | AWS SSM Parameter Store (SecureString) | API keys, MongoDB URI — FREE |
| Hosting | AWS Amplify + CloudFront | Frontend SPA hosting + CDN |
| Compute | ECS Fargate (0.25 vCPU / 0.5 GB) | Backend container runtime |

> **Removed services:** Lambda (unnecessary — Express handles all routes), API Gateway (Express handles routing/auth/CORS/rate-limiting), Secrets Manager (replaced by free SSM Parameter Store)

---

## 3. Phase 0 — Foundation Setup

**Duration:** 3 days | **Gate:** Dev environment running, CI green, DB connected

### Step 0.1 — Backend Project Scaffolding

```
backend/
├── package.json
├── .env.example
├── .env                        # Never committed
├── src/
│   ├── index.js                # Express/Fastify app entry
│   ├── config/
│   │   └── env.js              # Validated env vars (Zod)
│   ├── middleware/
│   │   ├── auth.js             # JWT verification middleware
│   │   ├── cors.js             # CORS configuration
│   │   ├── rateLimit.js        # Rate limiting
│   │   └── errorHandler.js     # Global error handler
│   ├── routes/
│   │   ├── auth.js             # /api/auth/*
│   │   ├── proposals.js        # /api/proposals/*
│   │   └── generate.js         # /api/generate (SSE streaming)
│   ├── services/
│   │   ├── llm/
│   │   │   ├── client.js       # LLM API streaming client
│   │   │   ├── promptBuilder.js # Prompt template engine
│   │   │   └── jsonValidator.js # Zod validation + repair
│   │   ├── fileParser/
│   │   │   ├── pdf.js          # pdf-parse wrapper
│   │   │   ├── docx.js         # mammoth wrapper
│   │   │   └── index.js        # Unified parser interface
│   │   ├── storage/
│   │   │   └── s3.js           # S3 operations (upload, presign, get)
│   │   └── export/
│   │       └── pdfExport.js    # Puppeteer PDF generation
│   ├── models/
│   │   ├── User.js             # Mongoose user schema
│   │   ├── Proposal.js         # Mongoose proposal index schema
│   │   └── schemas.js          # Zod schemas for API validation
│   ├── db/
│   │   └── mongoose.js         # MongoDB connection + pooling
│   └── utils/
│       ├── jwt.js              # JWT sign/verify helpers
│       └── errors.js           # Custom error classes
├── scripts/
│   └── parse_file.py           # Python fallback for complex PDF/DOCX extraction
│                                # (PyMuPDF + python-docx for better table/layout handling)
└── tests/
    ├── auth.test.js
    ├── generate.test.js
    └── proposal.test.js
```

**Tasks:**

1. **Initialize Node.js project**
   ```bash
   mkdir backend && cd backend
   npm init -y
   npm i express cors helmet dotenv mongoose zod jsonwebtoken bcryptjs
   npm i -D nodemon
   ```

2. **Set up Python environment** (for advanced file parsing fallback):
   ```bash
   cd scripts
   python -m venv venv
   venv\Scripts\activate        # Windows
   # source venv/bin/activate   # macOS/Linux
   pip install PyMuPDF python-docx
   pip freeze > requirements.txt
   ```

3. **Create Express app** (`src/index.js`)
   - Body parser (JSON + multipart)
   - CORS middleware (whitelist frontend origin)
   - Helmet for security headers
   - Rate limiting middleware
   - Global error handler
   - Health check endpoint: `GET /api/health`

4. **Add development scripts** to `package.json`:
   ```json
   {
     "scripts": {
       "dev": "nodemon src/index.js",
       "start": "node src/index.js",
       "test": "jest"
     }
   }
   ```

### Step 0.2 — MongoDB Atlas Setup

1. **Create free M0 cluster** on MongoDB Atlas
2. **Create database user** with read/write permissions
3. **Whitelist IP** (or use 0.0.0.0/0 for dev)
4. **Get connection string**: `mongodb+srv://user:pass@cluster.mongodb.net/proplytics`
5. **Create Mongoose connection** (`src/db/mongoose.js`):
   - Connection pooling (min: 2, max: 10)
   - Retry logic on disconnect
   - Log connection events
6. **Test connectivity** from backend health endpoint

### Step 0.3 — AWS Account + Services Setup

> **All IAM policies are defined in Section 2 (Architecture Overview).**
> Refer to the IAM Policy Requirements section for exact JSON policies.

1. **Create AWS account** (or use existing)

2. **Set up IAM roles & user** (see Section 2 for full JSON policies):
   - **`proplytics-ci-cd` IAM user** — programmatic access for GitHub Actions (ECR push + ECS deploy)
   - **`proplytics-ecs-task-role`** — attached to Fargate task (S3, SSM, CloudWatch Logs)
   - **`proplytics-ecs-execution-role`** — ECS pulls images from ECR + reads SSM + writes logs

3. **Create S3 bucket** (single bucket, prefix-based):
   - `proplytics-assets-{env}` (e.g., `proplytics-assets-dev`, `proplytics-assets-prod`)
   - Prefixes: `briefs/`, `output/`, `exports/`
   - Enable versioning (for proposal revision history)
   - Private by default — pre-signed URL access only
   - Lifecycle rule: archive `exports/` to Glacier after 90 days

4. **Store secrets** in SSM Parameter Store (SecureString — **FREE**):
   ```bash
   # Create parameters (run once per environment)
   aws ssm put-parameter --name "/proplytics/dev/MONGODB_URI" --type SecureString --value "mongodb+srv://..."
   aws ssm put-parameter --name "/proplytics/dev/JWT_SECRET" --type SecureString --value "<hex>"
   aws ssm put-parameter --name "/proplytics/dev/JWT_REFRESH_SECRET" --type SecureString --value "<hex>"
   aws ssm put-parameter --name "/proplytics/dev/GEMINI_API_KEY" --type SecureString --value "AIza..."
   aws ssm put-parameter --name "/proplytics/dev/FRONTEND_URL" --type String --value "http://localhost:5173"
   ```

5. **Create ECR repository:**
   ```bash
   aws ecr create-repository --repository-name proplytics-backend --region us-east-1
   ```

6. **Create ECS cluster:**
   ```bash
   aws ecs create-cluster --cluster-name proplytics-cluster --region us-east-1
   ```

7. **Create CloudWatch log group:**
   ```bash
   aws logs create-log-group --log-group-name /ecs/proplytics-backend
   ```

### Step 0.4 — GitHub CI/CD Pipeline

1. **Create `.github/workflows/ci.yml`:**
   ```yaml
   - Backend: lint + unit tests
   - Frontend: lint + build verification
   - Security: npm audit
   ```
2. **Create `.github/workflows/deploy.yml`:**
   - Deploy frontend to Amplify on `main` push
   - Build Docker image → push to ECR → update ECS Fargate service on `main` push
3. **Branch protection:** require CI green before merge

### Step 0.5 — Frontend Environment Prep

1. **Install new dependencies:**
   ```bash
   npm i zustand @tanstack/react-query axios
   ```
2. **Create `src/config/api.js`** — centralized API URL config
3. **Create `src/stores/authStore.js`** — Zustand auth store skeleton
4. **Create `src/stores/proposalStore.js`** — Zustand proposal store skeleton
5. **Set up Axios instance** with interceptors for JWT

---

## 4. Phase 1 — Authentication + AWS Infrastructure

**Duration:** 1–2 weeks | **Gate:** Auth flow end-to-end working, S3 read/write confirmed

### Step 1.1 — User Registration + Login (Backend)

**MongoDB User Schema:**

```javascript
// models/User.js
{
  email:        { type: String, required: true, unique: true, lowercase: true },
  passwordHash: { type: String, required: true },
  name:         { type: String, required: true },
  plan:         { type: String, enum: ['free', 'pro', 'enterprise'], default: 'free' },
  usageCount:   { type: Number, default: 0 },          // proposals generated this month
  usageLimit:   { type: Number, default: 10 },          // monthly limit per plan
  createdAt:    { type: Date, default: Date.now },
  updatedAt:    { type: Date, default: Date.now },
}
```

**Auth Endpoints:**

| Method | Endpoint | Body | Response |
|---|---|---|---|
| `POST` | `/api/auth/register` | `{ email, password, name }` | `{ user, accessToken, refreshToken }` |
| `POST` | `/api/auth/login` | `{ email, password }` | `{ user, accessToken, refreshToken }` |
| `POST` | `/api/auth/refresh` | `{ refreshToken }` | `{ accessToken }` |
| `GET` | `/api/auth/me` | — (Bearer token) | `{ user }` |
| `POST` | `/api/auth/logout` | — (Bearer token) | `{ success: true }` |

**Implementation Steps:**

1. **Password hashing** with bcryptjs (12 rounds)
2. **JWT tokens:**
   - Access token: 15 minute expiry, contains `{ userId, email }`
   - Refresh token: 7 day expiry, stored in MongoDB
   - Signed with HS256 (via SSM Parameter Store key)
3. **Auth middleware** (`src/middleware/auth.js`):
   - Extract `Authorization: Bearer <token>` header
   - Verify JWT signature + expiry
   - Attach `req.user = { userId, email }` to request
   - Return 401 on invalid/expired token
4. **Input validation** with Zod:
   - Email format validation
   - Password minimum 8 chars, 1 uppercase, 1 number
   - Name 2-50 chars
5. **Rate limiting** on auth endpoints: 5 requests per minute per IP

### Step 1.2 — Frontend Auth Flow

1. **Create pages:**
   - `src/pages/Login.jsx` — email/password form
   - `src/pages/Register.jsx` — registration form
2. **Zustand auth store** (`src/stores/authStore.js`):
   ```javascript
   {
     user: null,
     accessToken: null,
     isAuthenticated: false,
     login: (email, password) => { /* ... */ },
     register: (email, password, name) => { /* ... */ },
     logout: () => { /* ... */ },
     refreshToken: () => { /* ... */ },
   }
   ```
3. **Protected routes** — redirect to `/login` if not authenticated
4. **Axios interceptor:**
   - Attach `Authorization: Bearer <token>` to all API calls
   - On 401 response, attempt token refresh
   - On refresh failure, redirect to login
5. **Persist auth state** — store tokens in `localStorage` (access) and `httpOnly cookie` (refresh, if possible)

### Step 1.3 — Route Updates

```jsx
// App.jsx — updated routes
<Routes>
  <Route path="/" element={<Landing />} />
  <Route path="/login" element={<Login />} />
  <Route path="/register" element={<Register />} />
  <Route path="/dashboard" element={<ProtectedRoute><DashboardLayout><Dashboard /></DashboardLayout></ProtectedRoute>} />
  <Route path="/new" element={<ProtectedRoute><DashboardLayout><NewProposal /></DashboardLayout></ProtectedRoute>} />
  <Route path="/proposal/:id" element={<ProtectedRoute><DashboardLayout><ProposalResult /></DashboardLayout></ProtectedRoute>} />
  <Route path="/proposal/:id/history" element={<ProtectedRoute><DashboardLayout><RevisionHistory /></DashboardLayout></ProtectedRoute>} />
</Routes>
```

### Step 1.4 — S3 Integration (Backend)

1. **Install AWS SDK:**
   ```bash
   npm i @aws-sdk/client-s3 @aws-sdk/s3-request-presigner
   ```

2. **S3 service** (`src/services/storage/s3.js`):
   ```javascript
   // Key functions:
   generateUploadUrl(userId, fileType)     // Pre-signed PUT URL (5 min expiry)
   generateDownloadUrl(s3Key)              // Pre-signed GET URL (1 hour expiry)
   uploadProposalJSON(userId, proposalId, version, data)
   getProposalJSON(s3Key)
   listProposalVersions(userId, proposalId)
   ```

3. **File upload flow:**
   - Frontend requests pre-signed URL from backend
   - Frontend uploads directly to S3 using pre-signed URL
   - Frontend notifies backend of upload completion
   - Backend validates file exists in S3

4. **S3 key structure** (single bucket: `proplytics-assets-{env}`):
   ```
   briefs/{userId}/{proposalId}/brief.{pdf|docx|txt}
   output/{userId}/{proposalId}/v{n}.json
   exports/{userId}/{proposalId}/proposal-v{n}.pdf
   ```

### Step 1.5 — ECS Fargate Task Definition

> **No API Gateway needed.** Express handles all routing, auth, CORS, and rate limiting internally.
> The Fargate task runs the Express server directly, accessible via ALB or public IP.

1. **Create Dockerfile** (`backend/Dockerfile`):
   ```dockerfile
   FROM node:20-alpine
   WORKDIR /app
   COPY package*.json ./
   RUN npm ci --production
   COPY src/ ./src/
   EXPOSE 3001
   CMD ["node", "src/index.js"]
   ```

2. **Create ECS Task Definition:**
   - Family: `proplytics-backend`
   - CPU: 256 (0.25 vCPU) — sufficient for auth/CRUD + streaming
   - Memory: 512 MB
   - Container: `proplytics-backend` from ECR
   - Port mapping: 3001
   - Task Role: `proplytics-ecs-task-role` (S3 + SSM + CloudWatch)
   - Execution Role: `proplytics-ecs-execution-role` (ECR + logs + SSM)
   - Environment: inject secrets from SSM Parameter Store (using `valueFrom`)
   - Log driver: `awslogs` → `/ecs/proplytics-backend`

3. **Create ECS Service:**
   - Cluster: `proplytics-cluster`
   - Service: `proplytics-backend-service`
   - Desired count: 1 (scale later)
   - Launch type: FARGATE
   - Networking: public subnet + security group (inbound 3001)
   - Health check: `GET /api/health`

4. **Optional: ALB setup** (recommended for production):
   - Application Load Balancer → Target Group → Fargate tasks
   - HTTPS listener (443) with ACM certificate
   - Health check path: `/api/health`
   - Skip for development — use Fargate public IP + port 3001 directly

---

## 5. Phase 2 — AI Pipeline + Streaming

**Duration:** 3–4 weeks | **Gate:** Paste brief → get valid streamed JSON proposal with sections revealing progressively

> ⚠️ **CRITICAL PATH** — This is the most complex and highest-risk phase. Plan carefully.

### Step 2.1 — File Parser Service

**Install dependencies:**
```bash
npm i pdf-parse mammoth
```

**Implementation** (`src/services/fileParser/`):

1. **PDF parser** (`pdf.js`):
   - Use `pdf-parse` to extract text from PDF buffers
   - Handle multi-page documents
   - Strip headers/footers/page numbers
   - Return clean text string

2. **DOCX parser** (`docx.js`):
   - Use `mammoth` to convert DOCX to plain text
   - Extract text only (ignore formatting)
   - Handle tables (convert to text representation)

3. **Unified interface** (`index.js`):
   ```javascript
   async function parseFile(buffer, mimeType) {
     if (mimeType === 'application/pdf') return parsePDF(buffer);
     if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') return parseDOCX(buffer);
     if (mimeType === 'text/plain') return buffer.toString('utf-8');
     throw new UnsupportedFileTypeError(mimeType);
   }
   ```

   > **Python fallback:** For complex PDFs with tables/images, the Node.js parser can shell out to
   > `scripts/parse_file.py` via `child_process.execFile()`. The Python script uses PyMuPDF for
   > superior table extraction and python-docx for complex DOCX layouts.

4. **Text sanitization:**
   - Remove excessive whitespace/newlines
   - Truncate to the model context limit (current implementation keeps briefs under 150K chars)
   - Strip any potentially harmful content
   - Return character count for token estimation

### Step 2.2 — Prompt Template Engine

**Implementation** (`src/services/llm/promptBuilder.js`):

1. **System prompt** — Elite consultant persona:
   ```
   You are an elite technical consultant who analyzes client briefs and produces
   structured project proposals. You output ONLY valid JSON matching the exact
   schema provided. You assess each feature's feasibility with confidence scores.
   You identify risks with severity ratings. You provide realistic timelines.
   ```

2. **Output schema definition** (enforced in system prompt):
   ```json
   {
     "project_summary": "string (2-4 sentences)",
     "features": [{
       "title": "string",
       "description": "string",
       "technical_approach": "string",
       "complexity": "High | Medium | Low",
       "confidence": "High | Medium | Low",
       "confidence_pct": "number (0-100)",
       "area": "string (e.g., Frontend, Backend, AI/ML)"
     }],
     "risks": [{
       "label": "string",
       "severity": "number (0-100)",
       "mitigation": "string",
       "category": "string"
     }],
     "timeline": [{
       "phase": "string",
       "duration": "string",
       "tasks": ["string"],
       "dependencies": ["string"]
     }],
     "effort": [{
       "label": "string",
       "percentage": "number",
       "timeframe": "string",
       "description": "string"
     }],
     "market": [{
       "title": "string",
       "description": "string",
       "trend": "up | down | stable",
       "relevance": "number (0-100)"
     }],
     "impact": [{
       "title": "string",
       "description": "string",
       "impact_score": "number (0-100)",
       "category": "string"
     }]
   }
   ```

3. **Prompt construction:**
   ```javascript
   function buildPrompt(briefText) {
     return {
       system: SYSTEM_PROMPT + '\n\nOutput ONLY this JSON schema:\n' + JSON.stringify(OUTPUT_SCHEMA),
       user: `Analyze the following client brief and generate a structured proposal:\n\n${briefText}`
     };
   }
   ```

4. **Temperature:** 0.2–0.4 (low for structured fidelity)
5. **Token counter guard:** estimate input tokens, warn if approaching context limit

### Step 2.3 — LLM Streaming Client

**Install dependencies:**
```bash
npm i @google/genai
```

**Implementation** (`src/services/llm/client.js`):

1. **Streaming call:**
   ```javascript
   async function* streamProposal(system, userMessage) {
     const stream = await gemini.models.generateContentStream({
       model: 'gemini-2.5-flash',
       contents: userMessage,
       config: {
         temperature: 0.3,
         maxOutputTokens: 8000,
         systemInstruction: system,
       },
     });

     for await (const chunk of stream) {
       if (chunk.text) {
         yield chunk.text;
       }
     }
   }
   ```

2. **Error handling:**
   - Retry on 429 (rate limit) with exponential backoff
   - Retry on 500 (server error) up to 3 times
   - Timeout after 120 seconds
   - Return partial result on timeout if buffer has valid JSON sections

### Step 2.4 — SSE Streaming Endpoint (Express on Fargate)

> **No Lambda timeout concerns.** The Express server runs on ECS Fargate with no connection
> time limits. SSE streaming connections can run as long as needed (60-120s for LLM generation).

**Implementation** (`src/routes/generate.js`):

```javascript
// POST /api/generate
router.post('/generate', authMiddleware, async (req, res) => {
  const { briefText, fileKey } = req.body;

  // Set SSE headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no',  // Disable nginx buffering
  });

  // Keep-alive ping every 20 seconds
  const keepAlive = setInterval(() => {
    res.write(': keepalive\n\n');
  }, 20000);

  try {
    // 1. Parse file if fileKey provided
    let text = briefText;
    if (fileKey) {
      const fileBuffer = await s3Service.getFile(fileKey);
      text = await fileParser.parseFile(fileBuffer, getMimeType(fileKey));
    }

    // 2. Build prompt
    const { system, user } = promptBuilder.buildPrompt(text);

    // 3. Stream LLM response
    let fullBuffer = '';
    for await (const chunk of llmClient.streamProposal(system, user)) {
      fullBuffer += chunk;
      res.write(`data: ${JSON.stringify({ type: 'chunk', content: chunk })}\n\n`);
    }

    // 4. Validate complete JSON
    const validated = await jsonValidator.validateAndRepair(fullBuffer);

    // 5. Save to S3
    const s3Key = await s3Service.uploadProposalJSON(
      req.user.userId, proposalId, 1, validated
    );

    // 6. Save index to MongoDB
    await Proposal.create({
      userId: req.user.userId,
      s3Key,
      title: validated.project_summary.substring(0, 100),
      status: 'complete',
      versionCount: 1,
    });

    // 7. Send completion event
    res.write(`data: ${JSON.stringify({ type: 'complete', proposalId, s3Key })}\n\n`);
  } catch (error) {
    res.write(`data: ${JSON.stringify({ type: 'error', message: error.message })}\n\n`);
  } finally {
    clearInterval(keepAlive);
    res.end();
  }
});
```

### Step 2.5 — JSON Validation + Repair

**Implementation** (`src/services/llm/jsonValidator.js`):

1. **Primary validation** with Zod:
   ```javascript
   const ProposalSchema = z.object({
     project_summary: z.string().min(20),
     features: z.array(FeatureSchema).min(1).max(20),
     risks: z.array(RiskSchema).min(1).max(10),
     timeline: z.array(TimelineSchema).min(1),
     effort: z.array(EffortSchema).min(1),
     market: z.array(MarketSchema).optional(),
     impact: z.array(ImpactSchema).optional(),
   });
   ```

2. **Repair strategies** (in priority order):
   - **Strategy 1:** Direct `JSON.parse()` — if LLM returned clean JSON
   - **Strategy 2:** Strip markdown code fences (` ```json ... ``` `)
   - **Strategy 3:** Find first `{` and last `}`, extract substring
   - **Strategy 4:** Re-prompt LLM with only the broken section for repair

3. **Field-level confidence scoring:**
   - If a field is missing or defaulted, lower its confidence score
   - Track which fields came from LLM vs. repair/default

### Step 2.6 — Partial JSON Streaming Parser (Frontend)

**Implementation** (`src/hooks/useStreamingProposal.js`):

```javascript
function useStreamingProposal() {
  const [buffer, setBuffer] = useState('');
  const [parsedSections, setParsedSections] = useState({});
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState(null);

  const generate = async (briefText, fileKey) => {
    setIsGenerating(true);
    setBuffer('');
    setParsedSections({});

    const eventSource = new EventSource(`/api/generate?...`);
    // OR use fetch() with ReadableStream for POST requests

    let rawBuffer = '';

    // Every 200ms, attempt to parse what we have
    const parseInterval = setInterval(() => {
      try {
        const partial = JSON.parse(rawBuffer + '"}]}'); // Try closing
        // Check which top-level keys are complete
        for (const key of Object.keys(partial)) {
          if (!parsedSections[key]) {
            setParsedSections(prev => ({ ...prev, [key]: partial[key] }));
          }
        }
      } catch (e) {
        // Not yet parseable — continue accumulating
      }
    }, 200);

    // On each SSE chunk
    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'chunk') {
        rawBuffer += data.content;
        setBuffer(rawBuffer);
      }
      if (data.type === 'complete') {
        clearInterval(parseInterval);
        setIsGenerating(false);
        // Final parse of complete JSON
      }
      if (data.type === 'error') {
        clearInterval(parseInterval);
        setIsGenerating(false);
        setError(data.message);
      }
    };
  };

  return { generate, parsedSections, isGenerating, error, buffer };
}
```

**Key pattern:** As each top-level key (`project_summary`, `features`, `risks`, etc.) becomes parseable, render its card immediately. Show `SectionSkeleton` for pending sections.

---

## 6. Phase 3 — Frontend Integration + Confidence Grid

**Duration:** 2–3 weeks | **Gate:** Full UI working, animated confidence bars, real proposals from S3

### Step 3.1 — State Management Setup

1. **Install Zustand + React Query:**
   ```bash
   npm i zustand @tanstack/react-query axios
   ```

2. **Auth store** (`src/stores/authStore.js`):
   ```javascript
   // AuthStore shape:
   // {
   //   user: null,
   //   accessToken: null,
   //   isAuthenticated: false,
   //   login: (email, password) => Promise<void>,
   //   register: (email, password, name) => Promise<void>,
   //   logout: () => void,
   //   refreshToken: () => Promise<void>,
   // }
   ```

3. **Proposal store** (`src/stores/proposalStore.js`):
   ```javascript
   // ProposalStore shape:
   // {
   //   proposals: [],
   //   currentProposal: null,
   //   streamBuffer: '',
   //   parsedSections: {},
   //   isGenerating: false,
   //   fetchProposals: () => Promise<void>,
   //   fetchProposal: (id) => Promise<void>,
   //   generateProposal: (briefText, fileKey) => Promise<void>,
   // }
   ```

4. **React Query provider** in `main.jsx`:
   ```jsx
   const queryClient = new QueryClient();
   <QueryClientProvider client={queryClient}>
     <App />
   </QueryClientProvider>
   ```

### Step 3.2 — API Client Setup

**Create `src/lib/api.js`:**

```javascript
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3001/api',
  timeout: 30000,
});

// Request interceptor — attach JWT
api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Response interceptor — handle 401 refresh
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      await useAuthStore.getState().refreshToken();
      return api.request(error.config);  // Retry original request
    }
    return Promise.reject(error);
  }
);
```

### Step 3.3 — Replace Mock Data with Real API Calls

**Dashboard.jsx:**
- Replace `mockProposals` with React Query `useQuery('proposals', api.getProposals)`
- Add loading state, error state
- Real-time proposal status updates

**NewProposal.jsx:**
- Replace `setTimeout` simulation with real `/api/generate` SSE call
- Use `useStreamingProposal()` hook
- Show streaming progress indicator
- Navigate to `/proposal/:id` on completion

**ProposalResult.jsx:**
- Replace `mockProposal` with React Query `useQuery(['proposal', id], () => api.getProposal(id))`
- Replace simulated section loading with real streaming sections from `parsedSections`
- Real Export PDF button → calls `/api/proposals/:id/export`

### Step 3.4 — Confidence Grid (Signature Feature)

This is the feature that makes Proplytics stand out. Each feature/risk card shows:

1. **Color-coded left accent strip** — 3px wide, color based on confidence:
   - High (≥75%): `#10B981` (green)
   - Medium (40–74%): `#F59E0B` (amber)
   - Low (<40%): `#EF4444` (red)

2. **Confidence score bar** — animated fill:
   - Width maps to confidence percentage
   - CSS `transition: width 0.8s ease` for the "filling up" animation
   - Triggered on mount (component enters viewport)

3. **Complexity badge** — top-right corner:
   - High / Medium / Low with matching background tint

4. **Hover expansion** — on hover, card expands to show:
   - `technical_approach` text for features
   - `mitigation` text for risks

**Existing `ConfidenceCard.jsx` needs updates:**
- Ensure animated bar width on mount
- Add hover expansion with approach/mitigation text
- Ensure color mapping follows the schema above

### Step 3.5 — Streaming Display Component

**Create/update `src/components/proposal/StreamingDisplay.jsx`:**

```jsx
function StreamingDisplay({ parsedSections, isGenerating }) {
  const sectionOrder = ['project_summary', 'features', 'risks', 'timeline', 'effort', 'market', 'impact'];

  return (
    <div className="space-y-6">
      {sectionOrder.map(section => (
        parsedSections[section] ? (
          <motion.div key={section} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <SectionRenderer section={section} data={parsedSections[section]} />
          </motion.div>
        ) : isGenerating ? (
          <SectionSkeleton key={section} label={section} />
        ) : null
      ))}
    </div>
  );
}
```

### Step 3.6 — Login + Register Pages

1. **`src/pages/Login.jsx`:**
   - Email + password form
   - "Don't have an account? Register" link
   - Error display for invalid credentials
   - Loading state during API call
   - Redirect to `/dashboard` on success

2. **`src/pages/Register.jsx`:**
   - Name + email + password + confirm password form
   - "Already have an account? Login" link
   - Client-side validation matching backend rules
   - Redirect to `/dashboard` on success

3. **`src/components/layout/ProtectedRoute.jsx`:**
   ```jsx
   function ProtectedRoute({ children }) {
     const isAuthenticated = useAuthStore(state => state.isAuthenticated);
     if (!isAuthenticated) return <Navigate to="/login" />;
     return children;
   }
   ```

---

## 7. Phase 4 — Export + Revision History

**Duration:** 1–2 weeks | **Gate:** Downloadable business-grade PDF, version history diff working

### Step 4.1 — PDF Export (Backend)

**Option A (Recommended): Puppeteer**

```bash
npm i puppeteer
```

1. **Create HTML template** for proposal PDF:
   - Company header/logo
   - Project summary section
   - Features table with confidence indicators
   - Risk matrix
   - Timeline visualization
   - Effort breakdown chart
   - Footer with generation metadata

2. **PDF generation endpoint:**
   ```
   POST /api/proposals/:id/export
   → Fetch proposal JSON from S3
   → Inject into HTML template
   → Render with Puppeteer headless Chrome
   → Return PDF as download
   ```

3. **Puppeteer config for ECS Fargate:**
   - Use full `puppeteer` (Chromium included) — Fargate has enough memory
   - Task memory: bump to 1024 MB if PDF generation is heavy
   - Timeout: 30 seconds

**Option B (Fallback): react-pdf**
- Use `@react-pdf/renderer` for programmatic PDF without browser
- Less pixel-accurate but lighter weight

### Step 4.2 — S3 Versioned Storage

1. **Enable versioning** on `proplytics-assets-{env}` bucket
2. **Version key structure:** `output/{userId}/{proposalId}/v{n}.json`
3. **On regeneration:**
   - Increment `versionCount` in MongoDB proposal document
   - Upload new JSON as `v{n+1}.json`
   - Keep all previous versions in S3
4. **List versions** API: `GET /api/proposals/:id/versions`

### Step 4.3 — Revision History UI

**Create `src/pages/RevisionHistory.jsx`:**

1. **Version list sidebar:**
   - Show all versions with timestamps
   - Click to view any version
   - Highlight current/latest version

2. **Diff view:**
   - Side-by-side comparison of two versions
   - Highlight added/removed/changed sections
   - Use a JSON diff library (e.g., `deep-diff` or `jsondiffpatch`)

3. **Revision drawer** (`RevisionDrawer`):
   - Slide-in panel from the right
   - Shows version history for current proposal
   - Quick switch between versions

### Step 4.4 — Export Modal

**Create `src/components/proposal/ExportModal.jsx`:**

- Choose export format: PDF, JSON, Markdown
- Select sections to include
- Add custom branding (logo upload, company name)
- Download button with progress indicator
- Optional: email to client (SES integration)

### Step 4.5 — Email Delivery (Optional — SES)

1. **Verify sender domain** in AWS SES
2. **Create email template** for proposal delivery
3. **Endpoint:** `POST /api/proposals/:id/email`
   - Body: `{ recipientEmail, subject, message }`
   - Attach PDF as email attachment
   - Rate limit: 1 email per proposal per hour

---

## 8. Phase 5 — Polish + QA

**Duration:** 1 week | **Gate:** Production-ready, all tests passing, monitoring live

### Step 5.1 — Error Boundaries

1. **Create `src/components/ErrorBoundary.jsx`:**
   - Catch rendering errors
   - Show friendly error UI with retry button
   - Log errors to console (and optionally to backend)

2. **Wrap key sections:**
   - Each proposal section in its own error boundary
   - Dashboard content
   - Streaming display

### Step 5.2 — Mobile Responsive Audit

1. **Test all pages** at 320px, 375px, 768px, 1024px, 1440px widths
2. **Fix issues:**
   - Confidence Grid: stack to 1 column on mobile
   - Sidebar: collapsible drawer on mobile
   - Export modal: full-screen on mobile
   - Landing page: responsive hero section

### Step 5.3 — CloudWatch Monitoring (Free Tier)

> **Cost-optimized:** Use only free-tier CloudWatch features initially.
> Add custom metrics/alarms later when you have actual traffic to monitor.

1. **Free tier logging** (via ECS Fargate `awslogs` driver):
   - Application logs automatically sent to `/ecs/proplytics-backend`
   - Use structured JSON logging (`console.log(JSON.stringify({...}))`)
   - Log: LLM call latency, errors, streaming duration, file parse results

2. **Free tier metrics** (automatic with ECS):
   - CPU/memory utilization (ECS provides these free)
   - Container health checks

3. **CloudWatch Log Insights queries** (free for first 5 GB scanned/mo):
   ```
   # Find LLM errors
   fields @timestamp, @message
   | filter @message like /LLM_ERROR/
   | sort @timestamp desc
   | limit 20

   # Average generation time
   fields @timestamp, @message
   | filter @message like /GENERATION_COMPLETE/
   | stats avg(duration) as avg_duration by bin(1h)
   ```

4. **Future (when needed):** Add custom CloudWatch metrics + alarms for:
   - LLM error rate > 5% → SNS alert
   - P99 latency > 30s → SNS alert
   - Streaming drop rate > 10% → SNS alert

### Step 5.4 — End-to-End Tests (Playwright)

```bash
npm i -D @playwright/test
```

**Test cases:**

1. **Auth flow:** Register → Login → See dashboard → Logout
2. **Proposal generation:** Login → New proposal → Paste brief → Generate → See streaming sections → View complete result
3. **File upload:** Upload PDF → Generate → Verify parsed correctly
4. **Export:** Generate → Export PDF → Verify download
5. **Revision history:** Generate → Regenerate → View history → Compare versions
6. **Error handling:** Invalid brief (too short) → See error message
7. **Rate limiting:** Exceed usage limit → See upgrade prompt

### Step 5.5 — Performance Optimization

1. **Code splitting** — lazy load pages with `React.lazy()` + `Suspense`
2. **Image optimization** — compress all static assets
3. **Bundle analysis** — run `vite-plugin-visualizer` to check bundle size
4. **API response caching** — React Query stale time for proposals list
5. **S3 pre-signed URL caching** — cache download URLs for 1 hour

---

## 9. Database Schema Design

### MongoDB Collections

**Collection: `users`**
```json
{
  "_id": "ObjectId",
  "email": "string (unique, indexed)",
  "passwordHash": "string (bcrypt)",
  "name": "string",
  "plan": "free | pro | enterprise",
  "usageCount": "number (reset monthly)",
  "usageLimit": "number (10/50/unlimited)",
  "refreshToken": "string | null",
  "createdAt": "Date",
  "updatedAt": "Date"
}
```

**Collection: `proposals`** (index only — actual JSON in S3)
```json
{
  "_id": "ObjectId",
  "userId": "ObjectId (ref: users, indexed)",
  "s3Key": "string (proposals/userId/proposalId/v1.json)",
  "title": "string (first 100 chars of project_summary)",
  "status": "generating | complete | failed",
  "versionCount": "number",
  "inputType": "text | pdf | docx",
  "inputHash": "string (SHA-256 of input for dedup)",
  "modelUsed": "string (e.g., gemini-2.5-flash)",
  "generationTimeMs": "number",
  "createdAt": "Date",
  "updatedAt": "Date"
}
```

### S3 Object Structure

```
proplytics-assets-{env}/
  ├── briefs/
  │   └── {userId}/
  │       └── {proposalId}/
  │           └── brief.pdf          # Uploaded brief file
  ├── output/
  │   └── {userId}/
  │       └── {proposalId}/
  │           ├── v1.json            # First generation
  │           ├── v2.json            # Regeneration
  │           └── v3.json            # Latest version
  └── exports/
      └── {userId}/
          └── {proposalId}/
              └── proposal.pdf       # Generated PDF export
```

---

## 10. API Endpoint Specification

### Authentication

| Method | Endpoint | Auth | Body | Response |
|---|---|---|---|---|
| `POST` | `/api/auth/register` | ❌ | `{ email, password, name }` | `{ user, accessToken, refreshToken }` |
| `POST` | `/api/auth/login` | ❌ | `{ email, password }` | `{ user, accessToken, refreshToken }` |
| `POST` | `/api/auth/refresh` | ❌ | `{ refreshToken }` | `{ accessToken }` |
| `GET` | `/api/auth/me` | ✅ | — | `{ user }` |
| `POST` | `/api/auth/logout` | ✅ | — | `{ success: true }` |

### Proposals

| Method | Endpoint | Auth | Body/Params | Response |
|---|---|---|---|---|
| `GET` | `/api/proposals` | ✅ | `?page=1&limit=20` | `{ proposals[], total, page }` |
| `GET` | `/api/proposals/:id` | ✅ | — | `{ proposal (full JSON from S3) }` |
| `DELETE` | `/api/proposals/:id` | ✅ | — | `{ success: true }` |
| `GET` | `/api/proposals/:id/versions` | ✅ | — | `{ versions[] }` |
| `GET` | `/api/proposals/:id/version/:v` | ✅ | — | `{ proposal (specific version from S3) }` |

### Generation (SSE Streaming)

| Method | Endpoint | Auth | Body | Response |
|---|---|---|---|---|
| `POST` | `/api/generate` | ✅ | `{ briefText?, fileKey? }` | SSE stream: `chunk` → `complete` events |
| `POST` | `/api/generate/upload-url` | ✅ | `{ fileName, fileType }` | `{ uploadUrl, fileKey }` |

### Export

| Method | Endpoint | Auth | Body | Response |
|---|---|---|---|---|
| `POST` | `/api/proposals/:id/export` | ✅ | `{ format: 'pdf'|'json'|'md', sections? }` | Binary PDF or JSON/MD file |
| `POST` | `/api/proposals/:id/email` | ✅ | `{ recipientEmail, subject?, message? }` | `{ success: true, messageId }` |

### Health

| Method | Endpoint | Auth | Response |
|---|---|---|---|
| `GET` | `/api/health` | ❌ | `{ status: 'ok', db: 'connected', uptime }` |

---

## 11. LLM Prompt Schema & Output Contract

### System Prompt

```
You are an elite senior technical consultant and solution architect. You analyze
client project briefs and produce comprehensive, structured project proposals.

RULES:
1. Output ONLY valid JSON — no markdown, no explanations, no code fences.
2. Follow the exact schema provided below — every field is required.
3. Assess each feature honestly — do not inflate confidence scores.
4. Identify real risks — do not omit uncomfortable truths.
5. Provide realistic timelines — do not compress unreasonably.
6. If the brief is too vague for a section, still provide your best assessment
   but lower the confidence score accordingly.

OUTPUT SCHEMA:
{schema}
```

### Expected JSON Output

```json
{
  "project_summary": "A 2-4 sentence summary of the project scope, goals, and recommended approach.",
  "features": [
    {
      "title": "Feature Name",
      "description": "What this feature does for the user",
      "technical_approach": "Specific technologies, patterns, and implementation strategy",
      "complexity": "High",
      "confidence": "High",
      "confidence_pct": 87,
      "area": "Backend Infrastructure"
    }
  ],
  "risks": [
    {
      "label": "Risk Title",
      "severity": 75,
      "mitigation": "Specific steps to reduce this risk",
      "category": "Technical"
    }
  ],
  "timeline": [
    {
      "phase": "Phase Name",
      "duration": "3 weeks",
      "tasks": ["Task 1", "Task 2"],
      "dependencies": ["Previous Phase"]
    }
  ],
  "effort": [
    {
      "label": "Layer/Area Name",
      "percentage": 30,
      "timeframe": "5-6 weeks",
      "description": "What work happens here"
    }
  ],
  "market": [
    {
      "title": "Market Trend",
      "description": "Relevant market data or trend",
      "trend": "up",
      "relevance": 88
    }
  ],
  "impact": [
    {
      "title": "Business Impact",
      "description": "Expected business outcome",
      "impact_score": 85,
      "category": "Revenue"
    }
  ]
}
```

---

## 12. Technical Risks & Mitigations

| # | Risk | Severity | Mitigation |
|---|---|---|---|
| 1 | **LLM hallucinating JSON keys** | 🟡 Medium (70%) | Enforce schema with Zod. Re-prompt on validation failure. 4-strategy JSON repair pipeline. |
| 2 | **Streaming mid-cut JSON** | 🟡 Medium (65%) | Accumulate full buffer. Validate only on stream completion. Repair broken trailing JSON. |
| 3 | **LLM API rate limits** | 🟡 Medium (55%) | Per-user generation queue. Exponential retry backoff. Usage counter in MongoDB. |
| 4 | **PDF export fidelity** | 🟡 Medium (50%) | Puppeteer for pixel-accurate output. react-pdf as fallback. Budget a full week. |
| 5 | **MongoDB cold start latency** | 🟢 Low (35%) | Connection pooling via Mongoose. Keep Fargate task running. Use `serverSelectionTimeoutMS: 5000`. |
| 6 | **200ms partial JSON parse pattern** | 🔴 High (complexity) | `setInterval(200ms)` with try/catch `JSON.parse`. Render completed top-level keys. `SectionSkeleton` for pending. |
| 7 | **S3 cost at scale** | 🟢 Low (20%) | Lifecycle rule: archive to Glacier after 90 days. Delete orphaned objects weekly. |
| 8 | **ECS Fargate cost during idle** | 🟢 Low (25%) | Use scheduled scaling to 0 during non-business hours (saves ~50%). Scale to 1 on first request via ALB. |

---

## 13. Effort Breakdown

| Layer | Effort % | Duration | Key Deliverables |
|---|---|---|---|
| **AI Pipeline + Streaming** | 35% | 3–4 weeks | File parser, prompt engine, LLM streaming client, SSE endpoint, JSON validation, partial JSON parser |
| **Frontend Integration** | 25% | 2–3 weeks | Zustand stores, React Query hooks, streaming display, confidence grid animations, replace all mock data |
| **Auth + AWS Infrastructure** | 20% | 1–2 weeks | JWT auth, MongoDB schemas, S3 bucket, ECS Fargate task, SSM params, Amplify hosting |
| **Export + Revision History** | 15% | 1–2 weeks | Puppeteer PDF, S3 versioning, revision diff UI, export modal |
| **Polish + QA** | 5% | 1 week | Error boundaries, mobile audit, CloudWatch logs, Playwright tests |

### Total Estimated Timeline: 8–12 weeks

```
Week  0:   Foundation setup (dev env, CI/CD, MongoDB, AWS accounts)
Week  1-2: Auth + AWS infra
Week  3-6: AI pipeline + streaming (CRITICAL PATH)
Week  7-9: Frontend integration + confidence grid
Week 10-11: Export + revision history
Week  12:  Polish + QA
```

---

## Quick Reference: Commands

```bash
# Frontend (existing)
cd proplytics
npm install
npm run dev                     # http://localhost:5173

# Backend (to be created)
cd backend
npm install
cp .env.example .env            # Fill in values
npm run dev                     # http://localhost:3001

# Python scripts (for advanced file parsing)
cd backend/scripts
python -m venv venv
venv\Scripts\activate           # Windows (or: source venv/bin/activate on macOS/Linux)
pip install -r requirements.txt

# Run tests
cd backend && npm test
cd frontend && npx playwright test

# Build for production
cd frontend && npm run build
```

---

## Environment Variables

### Backend `.env` (local development only — production uses SSM Parameter Store)

```bash
# Server
PORT=3001
NODE_ENV=development

# MongoDB
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/proplytics

# JWT
JWT_SECRET=<generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))">
JWT_ACCESS_EXPIRY=15m
JWT_REFRESH_EXPIRY=7d

# AWS (local dev uses IAM credentials; Fargate uses Task Role — no keys needed)
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=<from IAM — local dev only>
AWS_SECRET_ACCESS_KEY=<from IAM — local dev only>
S3_BUCKET=proplytics-assets-dev

# LLM
GEMINI_API_KEY=<from aistudio.google.com/apikey>
# Best free-tier quality/performance tradeoff for text generation.
GEMINI_MODEL=gemini-2.5-flash
GEMINI_FALLBACK_MODEL=gemini-2.5-flash-lite
GEMINI_KEY_GUARD_MS=900000
STREAM_TIMEOUT_MS=120000

# Frontend URL (for CORS)
FRONTEND_URL=http://localhost:5173
```

> **Production:** All secrets are stored in SSM Parameter Store under `/proplytics/prod/*`.
> The ECS Task Definition injects them as environment variables using `valueFrom`.
> No `.env` file or AWS credential keys are needed in production.

### Frontend `.env`

```bash
VITE_API_URL=http://localhost:3001/api
```
