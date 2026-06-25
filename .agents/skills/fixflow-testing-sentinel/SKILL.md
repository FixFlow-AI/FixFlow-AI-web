---
name: fixflow-testing-sentinel
description: >
  Quality assurance and testing skill for FixFlowAI. Triggers when the user
  asks about writing tests, test strategies, edge cases, schema validation
  testing, FSM transition testing, LLM mock strategies, integration tests,
  or error boundary verification. Ensures production-grade reliability for
  every module in the system.
---

# FixFlowAI Testing Sentinel Skill

You are the **Lead QA Engineer** for FixFlowAI. You ensure every module is battle-tested with comprehensive unit tests, integration tests, and edge case coverage. Your philosophy: **if it can break, it has a test.**

---

## Testing Stack

| Tool | Purpose | Location |
|------|---------|----------|
| **Vitest** | Unit & integration test runner | Backend & Frontend |
| **React Testing Library** | Component rendering & interaction | Frontend |
| **MSW (Mock Service Worker)** | API mocking for frontend tests | Frontend |
| **Zod** | Schema validation (doubles as test assertions) | Both |

### Test File Locations
```
backend/src/test/       → Backend skill module tests
frontend/src/test/      → Frontend component & store tests
```

### Naming Convention
```
{moduleName}.test.ts    → Unit tests for a specific module
{moduleName}.int.test.ts → Integration tests requiring external services
```

---

## Testing Strategies by Module Type

### 1. Zod Schema Tests (MOST CRITICAL)

Every Zod schema must have validation tests for valid data, invalid data, and boundary values.

```typescript
import { describe, it, expect } from 'vitest';
import { ProposalSchema, FeatureSchema, RiskSchema } from '../skills/briefParser.js';

describe('ProposalSchema Validation', () => {
  it('should accept a valid complete proposal', () => {
    const validProposal = {
      title: 'E-Commerce Platform Redesign',
      summary: 'Full redesign of checkout flow',
      techStack: ['React', 'Node.js', 'PostgreSQL'],
      features: [{
        title: 'Payment Gateway',
        description: 'Integrate Stripe payment processing',
        technical_approach: 'Server-side Stripe SDK with webhook handling',
        complexity: 'High',
        confidence: 'High',
        confidence_pct: 92,
        area: 'Backend'
      }],
      risks: [{
        label: 'Third-party API dependency',
        severity: 45,
        mitigation: 'Implement fallback payment processor',
        category: 'Integration'
      }],
      timeline: [{
        phase: 'Phase 1',
        duration: '2 weeks',
        tasks: ['Setup repo', 'Configure CI'],
        dependencies: []
      }]
    };

    expect(() => ProposalSchema.parse(validProposal)).not.toThrow();
  });

  it('should reject proposal with empty title', () => {
    const invalid = { title: '', summary: 'test' };
    expect(() => ProposalSchema.parse(invalid)).toThrow();
  });

  it('should reject feature with invalid complexity enum', () => {
    const invalidFeature = {
      title: 'Test',
      description: 'Test',
      technical_approach: 'Test',
      complexity: 'Super High',  // Invalid enum
      confidence: 'High',
      confidence_pct: 50,
      area: 'Backend'
    };
    expect(() => FeatureSchema.parse(invalidFeature)).toThrow();
  });

  it('should reject confidence_pct outside 0-100 range', () => {
    const invalid = {
      title: 'Test', description: 'Test',
      technical_approach: 'Test', complexity: 'High',
      confidence: 'High', confidence_pct: 150, area: 'Backend'
    };
    expect(() => FeatureSchema.parse(invalid)).toThrow();
  });

  it('should reject risk severity outside 0-100', () => {
    expect(() => RiskSchema.parse({
      label: 'Test', severity: -10,
      mitigation: 'Test', category: 'Test'
    })).toThrow();
  });
});
```

### 2. FSM Transition Tests

Test EVERY valid transition, EVERY invalid transition, and concurrent access scenarios.

```typescript
import { describe, it, expect } from 'vitest';
import { transitionState, createMilestone } from '../skills/escrowStateMachine.js';

describe('EscrowStateMachine', () => {
  // ── Valid Transitions ──
  it('should transition Draft → Pending_Deposit', () => {
    const ms = createMilestone({ amount: 1000, currency: 'INR' });
    const result = transitionState(ms, ms.version, 'Pending_Deposit', 'client-1', 'client');
    expect(result.state).toBe('Pending_Deposit');
    expect(result.version).toBe(ms.version + 1);
  });

  it('should generate audit hash on transition', () => {
    const ms = createMilestone({ amount: 1000 });
    const result = transitionState(ms, ms.version, 'Pending_Deposit', 'client-1', 'client');
    expect(result.auditTrail).toHaveLength(1);
    expect(result.auditTrail[0].fromState).toBe('Draft');
    expect(result.auditTrail[0].toState).toBe('Pending_Deposit');
  });

  // ── Invalid Transitions ──
  it('should reject Draft → Active (must go through Pending_Deposit)', () => {
    const ms = createMilestone({ amount: 1000 });
    expect(() => transitionState(ms, ms.version, 'Active', 'client-1', 'client'))
      .toThrow(/Invalid state transition/);
  });

  it('should reject Funds_Released → any state (terminal)', () => {
    const ms = { ...createMilestone({}), state: 'Funds_Released', version: 5 };
    expect(() => transitionState(ms, 5, 'Active', 'sys', 'system'))
      .toThrow(/Invalid state transition/);
  });

  // ── Concurrency Tests ──
  it('should reject stale version (optimistic concurrency)', () => {
    const ms = { ...createMilestone({}), version: 3 };
    expect(() => transitionState(ms, 2, 'Pending_Deposit', 'client-1', 'client'))
      .toThrow(/Concurrency conflict/);
  });

  // ── Dispute Access ──
  it('should allow any active state → Dispute', () => {
    const states = ['Draft', 'Pending_Deposit', 'Active', 'In_Review', 'Approved'];
    states.forEach(state => {
      const ms = { ...createMilestone({}), state, version: 1 };
      const result = transitionState(ms, 1, 'Dispute', 'client-1', 'client');
      expect(result.state).toBe('Dispute');
    });
  });

  // ── Audit Chain Integrity ──
  it('should maintain valid audit hash chain across multiple transitions', () => {
    let ms = createMilestone({ amount: 5000 });
    ms = transitionState(ms, ms.version, 'Pending_Deposit', 'c1', 'client');
    ms = transitionState(ms, ms.version, 'Active', 'sys', 'system');
    ms = transitionState(ms, ms.version, 'In_Review', 'f1', 'freelancer');

    expect(ms.auditTrail).toHaveLength(3);
    expect(verifyAuditChain(ms.auditTrail)).toBe(true);
  });
});
```

### 3. LLM/Gemini Mock Tests

Never call the real Gemini API in tests. Mock the SDK response.

```typescript
import { describe, it, expect, vi } from 'vitest';

// Mock the @google/genai module
vi.mock('@google/genai', () => ({
  GoogleGenAI: vi.fn().mockImplementation(() => ({
    models: {
      generateContent: vi.fn().mockResolvedValue({
        text: JSON.stringify({
          questions: [{
            question: 'How would you handle WebSocket scaling?',
            rationale: 'Tests real-time architecture knowledge',
            expectedKeywords: ['WebSocket', 'scaling', 'rooms'],
            idealAnswerSummary: 'Discusses horizontal scaling with Redis pub/sub'
          }]
        })
      })
    }
  }))
}));

import { generateInterviewQuestions } from '../skills/interviewGenerator.js';

describe('InterviewGenerator', () => {
  it('should return valid interview questions', async () => {
    const result = await generateInterviewQuestions(
      'Build a real-time chat app',
      { repos: ['chat-app'], languages: ['TypeScript'] },
      ['WebSocket', 'Redis'],
      'fake-api-key'
    );

    expect(result.questions).toHaveLength(1);
    expect(result.questions[0].question).toContain('WebSocket');
  });

  it('should handle API failures with fallback questions', async () => {
    // Override mock to simulate failure
    const { GoogleGenAI } = await import('@google/genai');
    (GoogleGenAI as any).mockImplementation(() => ({
      models: {
        generateContent: vi.fn().mockRejectedValue(new Error('API quota exceeded'))
      }
    }));

    const result = await generateInterviewQuestions(
      'Build a chat app', {}, ['WebSocket', 'Redis', 'Docker'],
      'fake-api-key'
    );

    // Should return fallback questions based on missing skills
    expect(result.questions.length).toBeGreaterThanOrEqual(3);
    expect(result.questions[0].question).toContain('WebSocket');
  });
});
```

### 4. Earnings Calculator Tests (Pure Functions)

```typescript
describe('EarningsCalculator', () => {
  it('should compute correct FREE tier payout', () => {
    const result = calculateEarnings({
      grossAmount: 10000,
      tier: 'FREE',
      country: 'IN',
      currency: 'INR'
    });

    expect(result.platformCommission).toBe(1000);  // 10%
    expect(result.gatewayFee).toBe(203);            // 2% + ₹3
    expect(result.tds).toBe(100);                   // 1% for IN
    expect(result.netPayout).toBe(8697);
  });

  it('should apply 0% TDS for non-Indian freelancers', () => {
    const result = calculateEarnings({
      grossAmount: 10000, tier: 'PRO', country: 'US', currency: 'INR'
    });
    expect(result.tds).toBe(0);
  });

  it('should handle zero amount gracefully', () => {
    const result = calculateEarnings({
      grossAmount: 0, tier: 'FREE', country: 'IN', currency: 'INR'
    });
    expect(result.netPayout).toBe(0);
  });
});
```

### 5. Frontend Component Tests

```jsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import ProposalCard from '../components/ProposalCard';

describe('ProposalCard', () => {
  const mockProposal = {
    id: 'prop-1',
    title: 'E-Commerce Platform',
    confidenceIndex: 85,
    status: 'active',
    features: [{ title: 'Checkout Flow', complexity: 'High' }]
  };

  it('should render proposal title', () => {
    render(<ProposalCard proposal={mockProposal} />);
    expect(screen.getByText('E-Commerce Platform')).toBeInTheDocument();
  });

  it('should show green score badge for confidence >= 80', () => {
    render(<ProposalCard proposal={mockProposal} />);
    const badge = screen.getByText('85%');
    expect(badge.className).toContain('emerald');
  });

  it('should show amber score badge for confidence 60-79', () => {
    render(<ProposalCard proposal={{ ...mockProposal, confidenceIndex: 72 }} />);
    const badge = screen.getByText('72%');
    expect(badge.className).toContain('amber');
  });
});
```

---

## Edge Case Checklist

When testing ANY module, verify these edge cases:

### Input Edge Cases
- [ ] Empty string inputs (`''`)
- [ ] Null/undefined values
- [ ] Extremely long strings (10,000+ characters)
- [ ] Special characters in text (`<script>`, SQL injection attempts, unicode)
- [ ] Negative numbers where positive expected
- [ ] Zero values
- [ ] Array with 0 items, 1 item, and 100+ items
- [ ] Deeply nested JSON (5+ levels)

### LLM-Specific Edge Cases
- [ ] Empty `response.text` (returns `undefined`)
- [ ] Response wrapped in markdown code fences (````json...```)
- [ ] Truncated JSON (API timeout mid-response)
- [ ] Valid JSON but wrong schema structure
- [ ] API key invalid/expired
- [ ] Rate limit exceeded (429 response)
- [ ] Network timeout

### FSM Edge Cases
- [ ] Double transition attempts (same state → same state)
- [ ] Concurrent transitions (version conflict)
- [ ] Backward transitions (should fail except from Dispute)
- [ ] Terminal state transitions (Funds_Released → anything)
- [ ] Missing user ID in transition trigger

### WebSocket Edge Cases
- [ ] Client disconnect mid-operation
- [ ] Reconnect with stale vector clock
- [ ] Broadcast to empty room
- [ ] Maximum concurrent connections
- [ ] Message larger than frame limit
