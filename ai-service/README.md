# FixFlowAI — Python AI Service

Stateless FastAPI service that owns the four LLM-powered features. The TypeScript
backend (auth, escrow FSM, payments, sync, persistence) proxies to it; the
frontend never calls this service directly.

| Feature | Endpoint |
|---|---|
| AI-001 Semantic Brief Parsing | `POST /ai/brief/parse` |
| AI-002 Confidence Grid + Self-Correction | `POST /ai/confidence/evaluate` |
| AI-003 Interview Generation | `POST /ai/interview/generate` |
| AI-004 Contract Extensions | `POST /ai/extensions/generate` |
| Health | `GET /health` |

## Setup

```bash
python -m venv .venv
.venv\Scripts\activate        # Windows (use: source .venv/bin/activate on macOS/Linux)
pip install -r requirements.txt
copy .env.example .env         # then set GEMINI_API_KEY
```

## Run

```bash
uvicorn app.main:app --reload --port 8000
```

Interactive docs are served at `http://localhost:8000/docs`.

## Contract with the TS backend

- Set `AI_SERVICE_URL=http://localhost:8000` in `backend/.env`.
- If you set `AI_SERVICE_TOKEN` here, set the same value in `backend/.env`; the TS
  backend sends it as the `x-ai-service-token` header.
- The Pydantic models in `app/schemas/` mirror the TS `Proposal` shape. Keep them
  in sync when either side changes.
```
