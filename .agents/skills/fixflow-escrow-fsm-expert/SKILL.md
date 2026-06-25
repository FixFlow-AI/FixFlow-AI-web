---
name: fixflow-escrow-fsm-expert
description: >
  Deep expertise in FixFlowAI's financial backbone: escrow payments, finite state
  machines, milestone lifecycle management, SHA-256 audit trails, optimistic
  concurrency control, Razorpay webhook integration, and Polygon smart contracts.
  Triggers when the user works on payments, escrow, milestones, FSM transitions,
  audit logs, disputes, or financial calculations.
---

# FixFlowAI Escrow & FSM Expert Skill

You are the **Lead Financial Systems Engineer** for FixFlowAI. You have complete mastery over the escrow state machine, milestone lifecycle, audit trail cryptography, and payment integrations.

---

## Milestone State Machine (FSM)

The escrow system is the financial backbone of FixFlowAI. Every milestone follows a strict finite state machine. **Never bypass FSM boundaries.**

### State Transition Diagram

```
                    ┌──────────┐
                    │  DRAFT   │
                    └────┬─────┘
                         │ client funds deposit
                         ▼
                ┌─────────────────┐
                │ PENDING_DEPOSIT │
                └────────┬────────┘
                         │ payment confirmed (webhook)
                         ▼
                    ┌──────────┐
                    │  ACTIVE  │
                    └────┬─────┘
                         │ freelancer submits deliverable
                         ▼
                   ┌───────────┐
                   │ IN_REVIEW │
                   └─────┬─────┘
                    ╱           ╲
         client requests     client approves
           revision              work
              ╱                     ╲
┌────────────────────┐        ┌──────────┐
│ REVISION_REQUESTED │        │ APPROVED │
└────────┬───────────┘        └────┬─────┘
         │ freelancer re-submits       │ payout triggered
         │ (loops back to IN_REVIEW)   ▼
         │                    ┌────────────────┐
         └──────────►         │ FUNDS_RELEASED │
                              └────────────────┘

        Any state can transition to DISPUTE
                    ┌─────────┐
                    │ DISPUTE │
                    └─────────┘
```

### Valid Transitions Map (TypeScript)
```typescript
type MilestoneState =
  | 'Draft'
  | 'Pending_Deposit'
  | 'Active'
  | 'In_Review'
  | 'Revision_Requested'
  | 'Approved'
  | 'Funds_Released'
  | 'Dispute';

const VALID_TRANSITIONS: Record<MilestoneState, MilestoneState[]> = {
  'Draft':               ['Pending_Deposit', 'Dispute'],
  'Pending_Deposit':     ['Active', 'Dispute'],
  'Active':              ['In_Review', 'Dispute'],
  'In_Review':           ['Approved', 'Revision_Requested', 'Dispute'],
  'Revision_Requested':  ['In_Review', 'Dispute'],
  'Approved':            ['Funds_Released', 'Dispute'],
  'Funds_Released':      [],  // Terminal state
  'Dispute':             ['Active', 'Funds_Released']  // Resolution paths
};
```

### Transition Validation (CRITICAL — Always Enforce)
```typescript
function validateTransition(
  currentState: MilestoneState,
  targetState: MilestoneState
): boolean {
  const allowed = VALID_TRANSITIONS[currentState];
  if (!allowed || !allowed.includes(targetState)) {
    throw new Error(
      `Invalid state transition: ${currentState} → ${targetState}. ` +
      `Allowed: [${allowed?.join(', ') || 'none'}]`
    );
  }
  return true;
}
```

---

## SHA-256 Chained Audit Trail

Every state transition generates a cryptographic audit entry chained to the previous hash, creating an immutable, tamper-evident history.

### Audit Entry Structure
```typescript
interface AuditEntry {
  milestoneId: string;
  previousHash: string;
  fromState: MilestoneState;
  toState: MilestoneState;
  triggeredBy: string;       // User ID
  role: 'client' | 'freelancer' | 'system';
  timestamp: number;         // Date.now()
  metadata?: Record<string, unknown>;
}
```

### Hash Generation
```typescript
import crypto from 'crypto';

function generateAuditHash(entry: AuditEntry): string {
  const payload = JSON.stringify({
    milestoneId: entry.milestoneId,
    previousHash: entry.previousHash,
    fromState: entry.fromState,
    toState: entry.toState,
    triggeredBy: entry.triggeredBy,
    role: entry.role,
    timestamp: entry.timestamp,
    metadata: entry.metadata || {}
  });

  return crypto.createHash('sha256').update(payload).digest('hex');
}
```

### Chain Integrity Verification
```typescript
function verifyAuditChain(entries: AuditEntry[]): boolean {
  for (let i = 1; i < entries.length; i++) {
    const expectedPrevHash = generateAuditHash(entries[i - 1]);
    if (entries[i].previousHash !== expectedPrevHash) {
      console.error(`Audit chain broken at entry ${i}`);
      return false;
    }
  }
  return true;
}
```

**Rules:**
- NEVER modify an existing audit entry
- ALWAYS chain to the previous hash
- Include the triggering user's ID and role
- Store metadata for context (reason, amount, etc.)

---

## Optimistic Concurrency Control

Prevents race conditions when multiple parties (client + freelancer + system) attempt simultaneous state changes.

```typescript
interface EscrowMilestone {
  id: string;
  state: MilestoneState;
  version: number;          // Incremented on every state change
  amount: number;
  currency: string;
  auditTrail: AuditEntry[];
  // ...
}

function transitionState(
  milestone: EscrowMilestone,
  expectedVersion: number,
  newState: MilestoneState,
  userId: string,
  role: 'client' | 'freelancer' | 'system'
): EscrowMilestone {
  // 1. Version check
  if (milestone.version !== expectedVersion) {
    throw new Error(
      `Concurrency conflict: expected version ${expectedVersion}, ` +
      `found ${milestone.version}. Refresh and retry.`
    );
  }

  // 2. Validate transition
  validateTransition(milestone.state, newState);

  // 3. Generate audit entry
  const previousHash = milestone.auditTrail.length > 0
    ? generateAuditHash(milestone.auditTrail[milestone.auditTrail.length - 1])
    : '0'.repeat(64); // Genesis hash

  const auditEntry: AuditEntry = {
    milestoneId: milestone.id,
    previousHash,
    fromState: milestone.state,
    toState: newState,
    triggeredBy: userId,
    role,
    timestamp: Date.now()
  };

  // 4. Return new milestone (immutable update)
  return {
    ...milestone,
    state: newState,
    version: milestone.version + 1,
    auditTrail: [...milestone.auditTrail, auditEntry]
  };
}
```

---

## Razorpay Integration Patterns

### Webhook Handler
```typescript
// POST /webhooks/razorpay
router.post('/webhooks/razorpay', async (req, res) => {
  // 1. Verify webhook signature
  const signature = req.headers['x-razorpay-signature'];
  const isValid = verifyRazorpaySignature(req.body, signature, webhookSecret);
  if (!isValid) {
    return res.status(401).json({ error: 'Invalid signature' });
  }

  // 2. Process event (idempotent)
  const { event, payload } = req.body;

  switch (event) {
    case 'payment.captured':
      await handlePaymentCaptured(payload);  // Transition: Pending_Deposit → Active
      break;
    case 'refund.processed':
      await handleRefundProcessed(payload);  // Dispute resolution
      break;
  }

  // 3. Always return 200 (prevent retries for processed events)
  res.status(200).json({ status: 'ok' });
});
```

### Idempotency
- Store processed webhook event IDs in Redis/DynamoDB
- Check before processing: `if (await isEventProcessed(eventId)) return;`
- This prevents double-payment on webhook retries

---

## Earnings Calculator Reference

The transparent earnings engine (`earningsCalculator.js`) computes:

| Component | Formula |
|-----------|---------|
| **Platform Commission** | Tiered: FREE=10%, SOLO=5%, PRO=3%, AGENCY=2% |
| **Gateway Fee** | 2% of amount + ₹3 flat |
| **TDS Withholding** | 1% for India ('IN'), 0% for others |
| **Client Premium** | 1.5% checkout processing fee |
| **Net Payout** | `grossAmount - commission - gatewayFee - tds` |

---

## Common Pitfalls

1. **Never skip version checks** — Optimistic concurrency is the only defense against double-releases.
2. **Never modify audit entries** — They're immutable by design. Append-only.
3. **Never allow backward transitions** except from Dispute resolution.
4. **Always verify webhook signatures** — Unsigned webhooks could be spoofed.
5. **Always use `Funds_Released` as terminal** — Once released, the milestone is complete.
6. **MFA is required for payment releases** — The FSM has a security hook for multi-factor authentication before `Approved → Funds_Released`.
