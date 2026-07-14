# FixFlowAI — Codebase Hardening Backlog

> **Engineering stories for security auditing, robustness, and fault tolerance.** Each story is a self-contained `.md` containing the current problem, why it matters, a step-wise solution, Mermaid visuals, and "done when" acceptance criteria.

---

## ⚠️ Backlog Scope

This backlog focuses entirely on **bugs, fault tolerance, and security safeguards** discovered during the latest codebase audit. It replaces the previous AI feature backlog (which has been completed or deprecated). These stories are scoped to the existing codebases (TypeScript Backend and Python AI Service).

---

## Role Definitions

| Role | Responsibility | Code Surface |
|:---|:---|:---|
| **Backend Engineer** | Core API security, performance, FSM transitions, database transaction integrity, token caching | `backend/src/services/*`, `backend/src/skills/*`, `backend/src/routes/*` |
| **AI Engineer** | AI pipeline logic, LLM parameter optimization, multi-agent validation loops | `ai-service/app/features/*`, `ai-service/app/schemas/*` |
| **AI Automation Engineer** | Async retries, timeout guard rails, API retry logic with exponential backoff | `ai-service/app/llm/*`, `ai-service/app/config.py` |
| **Security Auditor** | Payment signature verification, OAuth safety, MFA validation mechanics | All layers |

---

## Story Registry

| ID | Story | Priority | Effort | Touches |
|:---|:---|:---:|:---:|:---|
| `BUG-01` | [Escrow Race Condition](./BUG-01-escrow-race-condition.md) | 🔴 Critical | ~1 day | `escrowService.ts`, `milestoneRepository.ts` |
| `BUG-02` | [Gemini Unbounded Request Hang](./BUG-02-gemini-unbounded-hang.md) | 🔴 Critical | ~2 days | `gemini.py`, `config.py` |
| `BUG-03` | [WebSocket Sync Missing Auth](./BUG-03-websocket-sync-auth.md) | 🟡 High | ~2 days | `syncServer.ts`, `index.ts` |
| `BUG-04` | [Razorpay Webhook Bypass](./BUG-04-razorpay-webhook-bypass.md) | 🔴 Critical | ~1 day | `paymentService.ts`, `index.ts` |
| `BUG-05` | [Confidence Grid Double-Evaluation](./BUG-05-confidence-grid-double-eval.md) | 🟡 Medium | ~1 day | `confidence_grid.py` |
| `BUG-06` | [MFA Verifier Stub Bypass](./BUG-06-mfa-verifier-stub.md) | 🔴 Critical | ~1 day | `escrowService.ts` |
| `BUG-07` | [Refresh Token Unbounded Growth](./BUG-07-refresh-token-unbounded-grow.md) | 🟡 Medium | ~1 day | `userRepository.ts` |

---

## Dependency Map

```mermaid
flowchart TD
    classDef critical fill:#dc2626,stroke:#991b1b,color:#fff
    classDef high fill:#ea580c,stroke:#c2410c,color:#fff
    classDef medium fill:#eab308,stroke:#ca8a04,color:#000

    BUG01["BUG-01 Escrow atomicity"]:::critical
    BUG02["BUG-02 Gemini timeout"]:::critical
    BUG03["BUG-03 WebSocket auth"]:::high
    BUG04["BUG-04 Webhook bypass"]:::critical
    BUG05["BUG-05 Double eval"]:::medium
    BUG06["BUG-06 MFA stub"]:::critical
    BUG07["BUG-07 Token cap"]:::medium

    BUG04 --> BUG06
    BUG06 --> BUG01
```

---

## Suggested Execution Order

We recommend resolving stories in three phases:

1. **Phase 1: Financial Safety (Critical)**
   - **BUG-04** (Webhook signature validation bypass)
   - **BUG-06** (MFA verifier stub bypass)
   - **BUG-01** (Non-atomic escrow saves)
   *These three together form a critical path where attackers can trigger fake payments and release funds.*

2. **Phase 2: Platform Resilience**
   - **BUG-02** (Gemini request timeouts and exponential backoff)
   - **BUG-03** (WebSocket collaboration route auth checks)

3. **Phase 3: Cleanup & Optimization**
   - **BUG-05** (Confidence grid double-evaluation redundancy)
   - **BUG-07** (Refresh token array growth limit check)
