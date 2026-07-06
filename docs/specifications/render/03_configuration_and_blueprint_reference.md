# 03 — Configuration & Blueprint Reference

> The exact **`render.yaml`**, the **environment-variable matrix** per service, the **service topology**, and the **branch/deploy model** for running FixFlowAI on Render's `testing` branch alongside your AWS production line.

---

## 1. Service topology

```mermaid
flowchart TB
    subgraph RENDER["Render (branch: testing)"]
        BE["fixflowai-backend<br/>Web Service (Node)<br/>REST /api + WSS /sync"]
        AI["fixflowai-ai-service<br/>Web Service (Python)<br/>/ai/* + /health"]
        WF["fixflowai-workflows<br/>(Workflow runtime — track)"]
    end
    G["Gemini API"]

    BE -->|AI_SERVICE_URL (private)| AI
    WF --> AI
    BE -.-> WF
    AI --> G

    classDef svc fill:#dcfce7,stroke:#16a34a;
    class BE,AI,WF svc;
```

- **Two services are mandatory** (backend + ai-service).
- **Third service (workflows)** is added only for the competition track; how it's hosted (background worker vs part of backend) depends on the current Render Workflows deploy model — **verify in Render docs**.
- **No database service needed** for the demo (seed + in-memory). Add **Render Postgres/Key Value** later only if you wire real persistence.

---

## 2. Full `render.yaml`

Place this at the **repository root** on the `testing` branch, then use **Render → New → Blueprint**.

```yaml
# render.yaml — FixFlowAI (testing branch)
# Deploys the backend (Node) and the AI service (Python).
# Secrets marked sync:false must be entered in the Render dashboard.

services:
  # ---------------------------------------------------------------
  # Python AI service (FastAPI + Gemini) — deploy this first
  # ---------------------------------------------------------------
  - type: web
    name: fixflowai-ai-service
    runtime: python
    branch: testing
    rootDir: ai-service
    buildCommand: pip install -r requirements.txt
    startCommand: uvicorn app.main:app --host 0.0.0.0 --port $PORT
    plan: free                      # use 'starter' for a stable judged demo
    healthCheckPath: /health
    envVars:
      - key: GEMINI_API_KEY
        sync: false                 # secret — enter in dashboard
      - key: GEMINI_MODEL
        value: gemini-3.5-flash
      - key: CONFIDENCE_THRESHOLD
        value: "75"
      - key: MAX_CORRECTION_CYCLES
        value: "1"
      - key: AI_SERVICE_TOKEN
        generateValue: true         # Render generates a shared secret

  # ---------------------------------------------------------------
  # TypeScript backend (Express + WebSocket sync)
  # ---------------------------------------------------------------
  - type: web
    name: fixflowai-backend
    runtime: node
    branch: testing
    rootDir: backend
    buildCommand: npm install && npm run build
    startCommand: npm start
    plan: free                      # 'starter' keeps WebSockets alive (no sleep)
    healthCheckPath: /api/health
    envVars:
      - key: AI_SERVICE_URL
        fromService:
          type: web
          name: fixflowai-ai-service
          property: hostport        # private internal address (host:port)
      - key: AI_SERVICE_TOKEN
        fromService:
          type: web
          name: fixflowai-ai-service
          envVarKey: AI_SERVICE_TOKEN   # reuse the generated shared secret
      - key: JWT_SECRET
        generateValue: true
      - key: GOOGLE_OAUTH_CLIENT_ID
        sync: false                 # secret — enter in dashboard
      - key: FREELANCER_PROVIDER
        value: seed
      - key: USER_PROVIDER
        value: seed
```

> **Notes**
> - `fromService … property: hostport` wires the backend to the AI service over Render's **private network** (no public round-trip). If your SDK version doesn't support it, fall back to the public `https://fixflowai-ai-service.onrender.com` URL as a plain `value`.
> - `generateValue: true` lets Render create `JWT_SECRET` / `AI_SERVICE_TOKEN` so they never live in git.
> - If `AI_SERVICE_URL` uses `hostport`, prefix with `http://` in code if your client needs a scheme — verify the emitted value and adjust the start logic or set a full URL instead.
> - **Adding the workflow service**: append a `type: worker` (or the runtime Render specifies for Workflows) with the same repo/branch and its own start command; verify against current Render Workflows docs.

---

## 3. Environment-variable matrix

### AI service (`ai-service`)
| Key | Required | Value / example | Purpose |
|---|:--:|---|---|
| `GEMINI_API_KEY` | ✅ | *secret* | Enables all AI features |
| `GEMINI_MODEL` | – | `gemini-3.5-flash` | Model (fallback `gemini-3.1-flash-lite`) |
| `AI_SERVICE_TOKEN` | – | *generated* | Shared secret with backend |
| `CONFIDENCE_THRESHOLD` | – | `75` | AI-002 threshold |
| `MAX_CORRECTION_CYCLES` | – | `1` | AI-002 self-correction cycles |
| `PORT` | auto | *(Render sets)* | uvicorn binds `--port $PORT` |

### Backend (`backend`)
| Key | Required | Value / example | Purpose |
|---|:--:|---|---|
| `AI_SERVICE_URL` | ✅ | AI service URL | Where to proxy AI calls |
| `AI_SERVICE_TOKEN` | – | *same as AI service* | Must match |
| `JWT_SECRET` | ✅ | *32+ bytes* | Signs access JWTs |
| `GOOGLE_OAUTH_CLIENT_ID` | ✅* | *web client id* | Google sign-in (*required for real login) |
| `GOOGLE_OAUTH_ALLOWED_AUDIENCES` | – | csv | Extra client IDs |
| `JWT_ACCESS_TTL` / `JWT_REFRESH_TTL` | – | `30m` / `7d` | Token TTLs |
| `FREELANCER_PROVIDER` | – | `seed` | No DB for matching roster |
| `USER_PROVIDER` | – | `seed` | No DB for users |
| `PORT` | auto | *(Render sets)* | Express + `/sync` bind here |
| `PERSISTENCE_PROVIDER` | – | *(leave unset)* | Unset = in-memory proposals |
| `RAZORPAY_*`, `AWS_*`, `DDB_*`, `S3_*`, `DATABASE_URL` | – | *(blank)* | Only if you enable those flows |

> **Demo rule:** keep AWS/DynamoDB/Razorpay blank and providers on `seed` → the whole thing runs on Render with **zero external infra** beyond Gemini.

---

## 4. Persistence options on Render

```mermaid
flowchart TD
    Q{"Need data to survive restarts?"} -->|No (demo)| SEED["seed + in-memory<br/>(current default) — $0, simplest"]
    Q -->|Yes, Render-native| PG["Render Postgres<br/>(requires new repository impl — code targets DynamoDB today)"]
    Q -->|Yes, reuse AWS| DDB["Keep DynamoDB<br/>(set PERSISTENCE_PROVIDER=dynamodb + AWS creds)"]
```

- **For the competition:** use **seed + in-memory**. Nothing to provision.
- **Render Postgres:** your code currently has **DynamoDB + in-memory** repositories, not Postgres. Using Render Postgres would need a new `*Repository.ts` (Prisma/pg). Out of scope for the demo.
- **Reuse AWS DynamoDB:** possible from Render by setting `PERSISTENCE_PROVIDER=dynamodb` + `AWS_*` creds, but it couples the demo to AWS — avoid unless needed.

---

## 5. Branching & deploy model

One `main` for AWS, `testing` for Render, no diverging platform branches. Platform differences live in **config + a thin orchestration adapter**, not in forked code.

```mermaid
flowchart TB
    MAIN["main<br/>(AWS/production line)"]
    TEST["testing<br/>(Render watches this)"]
    FEAT["feat/* (short-lived)"]
    SUB["submission/buildx-render (snapshot tag)"]

    FEAT -->|merge| MAIN
    MAIN -->|merge/rebase| TEST
    TEST -->|tag at demo time| SUB

    MAIN -. deploys to .-> AWS["AWS serverless"]
    TEST -. deploys to .-> RENDER["Render"]
```

- **`render.yaml` uses `branch: testing`** → Render auto-deploys on push to `testing`.
- Keep AWS-specific config (`template.yaml`/CDK/`serverless.yml`) in the same repo; it's ignored by Render and vice-versa.
- Orchestration is selected by env: `ORCHESTRATOR=render` (Render Workflows) vs `aws` (Step Functions). Same product code, different edge. (See [doc 02 §2](./02_render_workflows_guide.md#2-architecture-where-the-workflow-sits).)
- Freeze what you submit with a **`submission/buildx-render` tag**, keep evolving `testing`.

---

## 6. Cost & instance sizing

| Service | Free tier | Recommended for judged demo |
|---|---|---|
| ai-service | Sleeps after idle; cold start | Starter (stays warm) |
| backend | Sleeps after idle; **drops WebSockets** | Starter (keeps `/sync` alive) |
| workflows | per Render Workflows pricing | check docs |

- The BuildX **$50 Render credits** comfortably cover Starter instances for the event window ([render.com/docs/credits](https://render.com/docs/credits)).
- Scale to Free between demos to conserve credits.

---

## 7. Pre-submission checklist

- [ ] `render.yaml` committed at repo root on `testing`.
- [ ] `GEMINI_API_KEY`, `JWT_SECRET`, `GOOGLE_OAUTH_CLIENT_ID` set (secrets, not in git).
- [ ] `AI_SERVICE_TOKEN` identical on both services.
- [ ] ai-service `/health` → `aiEnabled:true`; backend `/api/health` → ok.
- [ ] A real `parse → evaluate → match` round trip works.
- [ ] `wss://…/sync` connects (paid instance if judged live).
- [ ] Confidence Grid Render Workflow runs, shows parallel tasks + a retry + resume-after-restart.
- [ ] `submission/buildx-render` tag created at demo state.

---

## 8. Cross-references

| Document | Why |
|---|---|
| [01 — Deployment Guide](./01_render_deployment_guide.md) | Manual click-through + verification |
| [02 — Render Workflows Guide](./02_render_workflows_guide.md) | The workflow service in this blueprint |
| [BuildX Strategy](../product_strategy/buildx_prize_track_strategy.md) | Track rationale |
| [Serverless Migration Plan](../architecture/serverless_migration_plan.md) | The AWS side of the branch model |
