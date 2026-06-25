---
name: fixflow-gemini-orchestrator
description: >
  Expert-level Google Gemini LLM integration skill for FixFlowAI. Triggers when
  the user asks about AI features, LLM calls, prompt engineering, structured
  output, multi-agent orchestration, self-correction loops, confidence scoring,
  or any interaction with the @google/genai SDK. Contains the exact API patterns,
  prompt engineering techniques, and fallback strategies used in this project.
---

# FixFlowAI Gemini Orchestrator Skill

You are the **Lead AI/ML Engineer** for FixFlowAI, with mastery over Google Gemini integration, multi-agent orchestration, prompt engineering, and LLM output reliability.

---

## SDK Reference (`@google/genai`)

FixFlowAI uses the `@google/genai` package (NOT the legacy `@google-ai/generativelanguage`). Here is the exact API surface used:

### Initialization
```typescript
import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
```

### Content Generation (Core Method)
```typescript
const response = await ai.models.generateContent({
  model: 'gemini-2.5-pro',       // Default model for FixFlowAI
  contents: userPromptString,     // The user/context content
  config: {
    temperature: 0.1,             // 0.0-2.0, low = deterministic
    systemInstruction: systemPromptString,
    responseMimeType: 'application/json',  // Forces JSON output
    responseSchema: {             // Native JSON Schema constraint
      type: 'OBJECT',
      properties: { /* ... */ },
      required: [ /* ... */ ]
    }
  }
});

// Access the response
const text: string = response.text || '';
const parsed = JSON.parse(text);
```

### Critical API Notes
- `response.text` may be `undefined` or empty — ALWAYS check with `|| ''`
- `responseMimeType: 'application/json'` + `responseSchema` together force structured JSON
- The `responseSchema` uses a subset of JSON Schema (not full OpenAPI spec)
- Supported schema types: `STRING`, `INTEGER`, `NUMBER`, `BOOLEAN`, `ARRAY`, `OBJECT`
- `systemInstruction` is a single string, not a message array

---

## Persona Agent Design (Multi-Agent Pattern)

FixFlowAI uses **parallel persona agents** where multiple Gemini calls run simultaneously, each with a different system prompt "persona." Results are aggregated by consensus.

### Current Personas in Production

#### 1. Auditor Agent (confidenceGrid.ts)
```
Role: Lead Auditor Agent
Purpose: Budget alignment + deliverable coverage analysis
Temperature: 0.1 (highly deterministic)
Scores: budget_alignment_score (0-100), deliverable_coverage_score (0-100)
```

#### 2. Feasibility Agent (confidenceGrid.ts)
```
Role: Technical Feasibility Agent
Purpose: Technical feasibility + timeline realism analysis
Temperature: 0.1
Scores: technical_feasibility_score (0-100), timeline_realism_score (0-100)
```

#### 3. Optimizer Agent (confidenceGrid.ts — self-correction)
```
Role: Proposal Optimizer Agent
Purpose: Fix issues flagged by Auditor + Feasibility agents
Temperature: 0.2 (slightly more creative for fixes)
Input: Original brief + proposal + list of specific issues
Output: Corrected proposal JSON
```

#### 4. Brief Parser Agent (briefParser.ts)
```
Role: Project Analyst / Proposal Architect
Purpose: Parse unstructured briefs into structured JSON proposals
Temperature: 0.1
Output: Complex nested JSON (features, risks, timeline, delivery plan)
```

#### 5. Interview Architect Agent (interviewGenerator.ts)
```
Role: Lead Technical Interview Architect
Purpose: Generate 3-5 targeted screening questions
Temperature: 0.2
Input: Brief + GitHub scan + missing skills list
```

### Designing New Personas

When creating a new LLM persona, follow this template:

```typescript
const systemPrompt = `You are the {Role Title} Agent for FixFlow AI.
Your task is to {specific task with measurable outcomes}.

You will be provided with:
1. {Input 1 description}
2. {Input 2 description}
3. {Input 3 description}

{Specific constraints and output format rules}

Output strictly in JSON conforming to the requested schema.
Do not output markdown decorators or extra prose.`;
```

**Rules for system prompts:**
- Always identify the agent by role name
- State the task with measurable outcomes (scores, classifications, structured data)
- List exactly what inputs will be provided
- End with the JSON constraint instruction
- Keep under 500 words — longer prompts reduce output quality

---

## Multi-Agent Orchestration Pattern

```typescript
// 1. Fire agents in parallel with Promise.allSettled (NOT Promise.all)
const [auditorResult, feasibilityResult] = await Promise.allSettled([
  runAuditorAgent(briefText, proposal, apiKey, modelName),
  runFeasibilityAgent(briefText, proposal, apiKey, modelName)
]);

// 2. Extract results with safety checks
const auditor: AuditorEvaluation = auditorResult.status === 'fulfilled'
  ? auditorResult.value
  : { budget_alignment_score: 50, deliverable_coverage_score: 50, issues: ['Auditor failed'], findings: 'Fallback' };

const feasibility: FeasibilityEvaluation = feasibilityResult.status === 'fulfilled'
  ? feasibilityResult.value
  : { technical_feasibility_score: 50, timeline_realism_score: 50, issues: ['Feasibility failed'], findings: 'Fallback' };

// 3. Compute consensus (mathematical mean)
const confidenceIndex = (
  auditor.budget_alignment_score +
  auditor.deliverable_coverage_score +
  feasibility.technical_feasibility_score +
  feasibility.timeline_realism_score
) / 4;

// 4. Self-correction trigger
if (confidenceIndex < 75) {
  const allIssues = [...auditor.issues, ...feasibility.issues];
  const optimizedProposal = await optimizeProposal(briefText, proposal, allIssues, apiKey);
  return { ...result, optimized: true, finalProposal: optimizedProposal };
}
```

**Why `Promise.allSettled` over `Promise.all`?**
- If the Auditor agent fails, the Feasibility agent result is still usable.
- Fallback scores (50/100) are used for failed agents, not crashes.
- This is a critical reliability pattern — never change this.

---

## Self-Correction Loop (GAP Feedback)

When the Confidence Index falls below 75, the system automatically:

1. **Collects issues** from both agents' evaluations
2. **Constructs a GAP prompt** that includes:
   - Original client brief
   - Current proposal JSON
   - Specific issues list from the failed evaluation
3. **Sends to Optimizer Agent** with slightly higher temperature (0.2)
4. **Re-validates** the output with the same Zod schema

```typescript
async function optimizeProposal(
  briefText: string,
  proposal: Proposal,
  issues: string[],
  apiKey: string
): Promise<Proposal> {
  const systemPrompt = `You are the Proposal Optimizer Agent for FixFlow AI.
You have been given a proposal that scored below the quality threshold.
Your job is to fix the specific issues listed below while preserving
the overall structure and intent of the original proposal.

ISSUES TO FIX:
${issues.map((issue, i) => `${i + 1}. ${issue}`).join('\n')}

Output the corrected proposal in the same JSON schema as the original.`;

  // ... Gemini call with temperature 0.2
}
```

---

## Temperature Guidelines

| Use Case | Temperature | Rationale |
|----------|------------|-----------|
| Structured JSON output (schemas, proposals) | `0.1` | Maximum determinism for consistent structure |
| Technical interview questions | `0.2` | Slight creativity for question variety |
| Proposal optimization/fixes | `0.2` | Creative enough to find solutions |
| Natural language summaries | `0.4` | Readable prose with some personality |
| Brainstorming/ideation | `0.7-1.0` | Maximum creativity (rarely used in production) |

---

## Response Schema Design Rules

1. **Match Zod schemas**: Every `responseSchema` in a Gemini call must have a corresponding Zod schema for validation.
2. **Use simple types**: Stick to `STRING`, `INTEGER`, `NUMBER`, `BOOLEAN`, `ARRAY`, `OBJECT`. Avoid complex unions.
3. **Required fields first**: List all critical fields in the `required` array.
4. **Flat over nested**: Prefer flat objects over deeply nested structures (reduces LLM errors).
5. **Constrain arrays**: If you need exactly 3-5 items, say so in the system prompt, not the schema.

---

## Fallback Strategy Hierarchy

```
Level 1: Zod parse succeeds → Return parsed result ✅
Level 2: Zod parse fails → sanitizeAndPatch() with safe defaults ⚠️
Level 3: JSON.parse fails → Attempt regex extraction of JSON from text ⚠️
Level 4: API call throws → Return pre-built fallback response ⚠️
Level 5: API key missing → Throw with clear error message ❌
```

Every skill module MUST implement at least Levels 1, 2, and 4.

---

## Common Pitfalls (Avoid These)

1. **Don't use `Promise.all()`** for multi-agent calls. Use `Promise.allSettled()`.
2. **Don't trust `response.text`** — it can be undefined, empty, or contain markdown wrappers.
3. **Don't skip Zod validation** on LLM output — structured output mode reduces but doesn't eliminate malformed JSON.
4. **Don't use high temperature** (>0.3) for structured data generation.
5. **Don't put schema constraints in the system prompt alone** — always use `responseSchema` for enforcement.
6. **Don't ignore the confidence index** — if it's below 75, trigger self-correction.
