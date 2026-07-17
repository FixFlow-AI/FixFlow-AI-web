# BUG-11 — Non-FSM Direct `save()` After a Transition Clobbers Version & Skips the Audit Chain

> **Role**: Backend Engineer / FSM Expert · **Priority**: 🟡 Medium · **Effort**: ~1 day
> **Status**: 🔴 Not started. Identified in [index.ts — `/fund` and `/verify-payment` handlers](../../backend/src/index.ts).

---

## Story Identity

| Field | Value |
|:---|:---|
| **Story ID** | `BUG-11` |
| **Owner** | Backend Engineer / FSM Expert |
| **Files** | `backend/src/index.ts`, `backend/src/services/milestoneRepository.ts`, `backend/src/services/escrowService.ts` |
| **Depends on** | Complements BUG-01 (transactional `saveWithAuditBlock`, already implemented) |

---

## 1. Current Problem

After routing a state change through the FSM (`applyTransition`, which correctly bumps `version` and appends an audit block via `saveWithAuditBlock`), the `/fund` and `/verify-payment` handlers **mutate the returned milestone and write it again with a bare `repo.save()`**:

```typescript
// backend/src/index.ts — /fund
const transitionResult = await applyTransition(milestone.id, { toState: 'Pending_Deposit', /* ... */ });
milestone = transitionResult.milestone;
milestone.razorpayOrderId = order.id;      // ← direct field mutation
await getMilestoneRepository().save(milestone);   // ← second write, no version bump, no audit block
```

```typescript
// backend/src/index.ts — /verify-payment
const updated = { ...transitionResult.milestone, razorpayOrderId, razorpayPaymentId, razorpaySignature };
await getMilestoneRepository().save(updated);     // ← same pattern
```

This second write bypasses the FSM's optimistic-concurrency and audit guarantees:

- It persists at the **same `version`** the transition just wrote, so a concurrent transition that ran in between is silently overwritten (lost update).
- The payment identifiers (`razorpayOrderId`, `razorpayPaymentId`, `razorpaySignature`) are **not** reflected in the SHA-256 audit chain, so the ledger no longer fully describes the milestone's mutations.

```mermaid
sequenceDiagram
    participant H as /fund handler
    participant Svc as escrowService
    participant DB as milestoneRepository
    H->>Svc: applyTransition(...) 
    Svc->>DB: saveWithAuditBlock(v+1, block)   %% correct
    Svc-->>H: milestone @ v+1
    H->>H: milestone.razorpayOrderId = order.id
    H->>DB: save(milestone @ v+1)              %% raw write, no bump, no audit
    Note over DB: concurrent transition @ v+1 lost;<br/>payment id absent from audit chain
```

---

## 2. Why It Matters

- **Lost updates**: the raw re-save defeats the version-based concurrency control that BUG-01 established for the transactional path.
- **Incomplete audit trail**: payment identifiers — the very evidence that funds moved — live outside the tamper-evident chain.
- **Two sources of truth**: mixing FSM writes with ad-hoc `save()` invites drift and race conditions.

---

## 3. Step-Wise Solution

### Step 3.1 — Carry payment metadata *through* the transition
Extend `TransitionInput` (and the audit block metadata) to accept structured payment fields, so `razorpayOrderId`/`paymentId`/`signature` are written **inside** `saveWithAuditBlock` with the version bump and audit entry, in one atomic step.

### Step 3.2 — Remove the post-transition `save()` calls
Delete the `milestone.x = ...; await repo.save(milestone)` blocks in `/fund` and `/verify-payment`; rely on the transition to persist everything.

### Step 3.3 — If a field genuinely must change without a state change
Add a dedicated repository method that performs a **conditional update** (optimistic version check) rather than a blind `Put`, and record a non-state audit note.

### Step 3.4 — Make `save()` safe by default
Have `MilestoneRepository.save` perform a version-conditional write (DynamoDB `ConditionExpression: version = :expected`) so any blind overwrite fails loudly instead of clobbering.

---

## 4. Done When

- [ ] Payment identifiers are persisted via the FSM transition (atomic with version bump + audit block).
- [ ] The ad-hoc `repo.save()` calls in `/fund` and `/verify-payment` are removed.
- [ ] `save()` (or a new conditional method) enforces an optimistic version check.
- [ ] A test proves a concurrent transition is not silently lost during funding.
- [ ] `npm run build` compiles cleanly.

---

## 5. Cross-References

| Document | Relevance |
|:---|:---|
| [index.ts](../../backend/src/index.ts) | `/fund` and `/verify-payment` handlers |
| [escrowService.ts](../../backend/src/services/escrowService.ts) | `applyTransition` + `saveWithAuditBlock` |
| [milestoneRepository.ts](../../backend/src/services/milestoneRepository.ts) | `save` / `saveWithAuditBlock` implementations |
| [BUG-01 (implemented)](../specifications/ai_features/stories/BUG-01-escrow-race-condition.md) | The transactional path this story protects |
