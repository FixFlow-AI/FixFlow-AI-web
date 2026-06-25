---
name: fixflow-fullstack-engineer
description: >
  The core AGI-level full-stack engineering skill for FixFlowAI. Triggers when
  the user asks to implement features end-to-end, write backend routes, create
  React components, add new skill modules, connect frontend to backend, or
  build any production-quality code. Contains implementation templates, patterns
  from existing codebase, and the complete feature development workflow.
---

# FixFlowAI Full-Stack Engineer Skill

You are a **world-class full-stack software engineer** working on FixFlowAI. You write production-grade code that follows every pattern established in this codebase. You think end-to-end: from database schema to API to UI to tests.

---

## Feature Implementation Workflow (ALWAYS Follow)

When building ANY new feature, execute these steps in order:

### Step 1: Schema Definition (Zod First)
```typescript
// ALWAYS start here. Define the data contract before anything else.
import { z } from 'zod';

export const NewFeatureOutputSchema = z.object({
  id: z.string().min(1, 'ID is required'),
  title: z.string().min(1, 'Title must not be empty'),
  status: z.enum(['draft', 'active', 'completed']),
  score: z.number().min(0).max(100),
  metadata: z.record(z.string(), z.unknown()).optional()
});

export type NewFeatureOutput = z.infer<typeof NewFeatureOutputSchema>;
```

### Step 2: Backend Skill Module
```typescript
// File: backend/src/skills/{featureName}.ts
import { z } from 'zod';
import { GoogleGenAI } from '@google/genai';

// 1. Schema definitions (export for reuse)
export const OutputSchema = z.object({ /* ... */ });
export type OutputType = z.infer<typeof OutputSchema>;

// 2. Core function (async, explicit params, typed return)
export async function processFeature(
  input: string,
  apiKey: string,
  modelName: string = 'gemini-2.5-pro'
): Promise<OutputType> {
  // Input validation
  if (!apiKey?.trim()) {
    throw new Error('Feature: API key is required.');
  }

  const ai = new GoogleGenAI({ apiKey });

  const systemPrompt = `You are the {Role} Agent for FixFlow AI.
Your task is to {specific task description}.
Output strictly in JSON conforming to the requested schema.
Do not output markdown decorators or extra prose.`;

  try {
    const response = await ai.models.generateContent({
      model: modelName,
      contents: input,
      config: {
        temperature: 0.1,
        systemInstruction: systemPrompt,
        responseMimeType: 'application/json',
        responseSchema: {
          type: 'OBJECT',
          properties: { /* match Zod schema */ },
          required: [ /* required fields */ ]
        }
      }
    });

    const text = response.text || '';
    if (!text.trim()) {
      throw new Error('LLM response returned empty text.');
    }

    return OutputSchema.parse(JSON.parse(text));
  } catch (error) {
    console.error('Feature exception, applying fallback:', error);
    return generateFallback(input);
  }
}

// 3. Fallback function (ALWAYS implement)
function generateFallback(input: string): OutputType {
  return {
    // Safe defaults that won't crash the app
  };
}
```

### Step 3: Express API Route
```typescript
// File: backend/src/routes/{featureName}Routes.ts
import express from 'express';
import { processFeature, OutputSchema } from '../skills/{featureName}.js';

const router = express.Router();

router.post('/api/v1/{feature}', async (req, res) => {
  try {
    // 1. Validate input with Zod
    const input = InputSchema.parse(req.body);

    // 2. Call skill module
    const result = await processFeature(
      input.data,
      process.env.GEMINI_API_KEY!
    );

    // 3. Return validated output
    res.json({ success: true, data: result });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ success: false, errors: error.errors });
    } else {
      console.error('Route error:', error);
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }
});

export default router;
```

### Step 4: Frontend Zustand Store
```javascript
// File: frontend/src/store/{featureName}Store.js
import { create } from 'zustand';

const useFeatureStore = create((set, get) => ({
  // State
  data: null,
  loading: false,
  error: null,

  // Actions
  fetchData: async (input) => {
    set({ loading: true, error: null });
    try {
      const res = await fetch('/api/v1/{feature}', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input)
      });
      const json = await res.json();
      if (json.success) {
        set({ data: json.data, loading: false });
      } else {
        set({ error: json.message || 'Request failed', loading: false });
      }
    } catch (err) {
      set({ error: err.message, loading: false });
    }
  },

  // Optimistic update pattern
  optimisticUpdate: (updatedData) => {
    const previous = get().data;
    set({ data: updatedData }); // Optimistic
    // Sync with server, rollback on failure
    fetch('/api/v1/{feature}', { /* ... */ })
      .catch(() => set({ data: previous })); // Rollback
  },

  reset: () => set({ data: null, loading: false, error: null })
}));

export default useFeatureStore;
```

### Step 5: React Component
```jsx
// File: frontend/src/components/{FeatureName}Card.jsx
import { useEffect } from 'react';
import useFeatureStore from '../store/{featureName}Store';

export default function FeatureNameCard({ input }) {
  const { data, loading, error, fetchData } = useFeatureStore();

  useEffect(() => {
    if (input) fetchData(input);
  }, [input]);

  if (loading) return <LoadingSkeleton />;
  if (error) return <ErrorBanner message={error} />;
  if (!data) return null;

  return (
    <div className="glass-card rounded-2xl p-6 backdrop-blur-xl
                    bg-white/5 border border-white/10 shadow-2xl">
      {/* Component content using glassmorphism design tokens */}
    </div>
  );
}
```

### Step 6: Tests
```typescript
// File: backend/src/test/{featureName}.test.ts
import { describe, it, expect } from 'vitest';
import { OutputSchema } from '../skills/{featureName}.js';

describe('{FeatureName} Skill', () => {
  it('should validate correct output schema', () => {
    const validData = { /* valid test data */ };
    expect(() => OutputSchema.parse(validData)).not.toThrow();
  });

  it('should reject invalid data', () => {
    const invalidData = { /* missing required fields */ };
    expect(() => OutputSchema.parse(invalidData)).toThrow();
  });

  it('should handle edge cases gracefully', () => {
    // Test empty strings, nulls, boundary values
  });
});
```

---

## Existing Skill Module Reference

These are the 9 existing backend skills — study their patterns when adding new ones:

| Module | Lines | Key Pattern |
|--------|-------|------------|
| `briefParser.ts` | 554 | Complex Zod schemas, Gemini JSON output, `sanitizeAndPatchBrief()` fallback |
| `confidenceGrid.ts` | 445 | Parallel multi-agent (Auditor + Feasibility), consensus scoring, self-correction loop |
| `escrowStateMachine.ts` | ~200 | FSM transitions, SHA-256 audit chain, optimistic concurrency |
| `syncServer.ts` | ~300 | WebSocket rooms, vector clocks, LWW conflict resolution |
| `interviewGenerator.ts` | 147 | Clean single-purpose LLM call, fallback question generation |
| `contextExtensions.ts` | ~150 | Project log analysis, contract extension suggestions |
| `earningsCalculator.js` | ~80 | Pure math (tiered commissions, gateway fees, TDS) |
| `reputationCalculator.js` | ~150 | Metric aggregation, SBT ERC-721 schema builder |
| `clientScoring.js` | ~120 | Risk classification, score thresholds, badge assignment |

---

## Critical Code Patterns

### Pattern 1: Gemini API Call (from `@google/genai`)
```typescript
const ai = new GoogleGenAI({ apiKey });
const response = await ai.models.generateContent({
  model: 'gemini-2.5-pro',
  contents: userPrompt,
  config: {
    temperature: 0.1,
    systemInstruction: systemPrompt,
    responseMimeType: 'application/json',
    responseSchema: { type: 'OBJECT', properties: {...}, required: [...] }
  }
});
const text = response.text || '';
```

### Pattern 2: Parallel Multi-Agent (from confidenceGrid.ts)
```typescript
const [auditorResult, feasibilityResult] = await Promise.allSettled([
  runAuditorAgent(briefText, proposal, apiKey),
  runFeasibilityAgent(briefText, proposal, apiKey)
]);
// Extract results, compute consensus
const confidenceIndex = (a.budget + a.deliverable + f.technical + f.timeline) / 4;
```

### Pattern 3: FSM State Transition (from escrowStateMachine.ts)
```typescript
const VALID_TRANSITIONS: Record<MilestoneState, MilestoneState[]> = {
  'Draft': ['Pending_Deposit'],
  'Pending_Deposit': ['Active'],
  'Active': ['In_Review'],
  // ...
};

function transition(milestone: Milestone, newState: MilestoneState, userId: string) {
  if (!VALID_TRANSITIONS[milestone.state]?.includes(newState)) {
    throw new Error(`Invalid transition: ${milestone.state} → ${newState}`);
  }
  // Generate audit hash, increment version, update state
}
```

### Pattern 4: SHA-256 Audit Hash (from escrowStateMachine.ts)
```typescript
import crypto from 'crypto';

function generateAuditHash(previousHash: string, data: AuditEntry): string {
  const payload = JSON.stringify({ previousHash, ...data, timestamp: Date.now() });
  return crypto.createHash('sha256').update(payload).digest('hex');
}
```

### Pattern 5: Zod Fallback Sanitization (from briefParser.ts)
```typescript
function sanitizeAndPatch(rawData: unknown): OutputType {
  const defaults: OutputType = {
    title: '[Untitled — Auto-recovered]',
    features: [],
    risks: [],
    // ... safe defaults for every field
  };

  if (typeof rawData === 'object' && rawData !== null) {
    // Merge valid fields, patch missing ones
    return { ...defaults, ...safeFieldsFrom(rawData) };
  }
  return defaults;
}
```

---

## Performance Guidelines

1. **Gemini calls**: Use `temperature: 0.1` for structured output, `0.2` for creative content, `0.7+` only for brainstorming.
2. **Parallel execution**: Always use `Promise.allSettled()` (not `Promise.all()`) for multi-agent calls — one failure shouldn't crash all.
3. **Bundle size**: Lazy-load heavy components. Split Zustand stores by feature domain.
4. **WebSocket efficiency**: Debounce rapid updates (300ms). Batch small changes before broadcast.
5. **Schema validation**: Validate at the boundary (API entry/exit), not inside business logic loops.
