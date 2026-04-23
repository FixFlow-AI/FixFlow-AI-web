# 🧠 Proplytics — New Feature Plan
## **ProposalChat: The Contextual Negotiation & Section Mutation Engine**
### *The feature that turns a static proposal into a live negotiation partner*

---

> **Implementable in: 2 days**
> **Zero new AWS services required**
> **Reuses 100% of existing infra: ECS Fargate, S3, API Gateway, CloudFront, Gemini SSE**

---

## 📌 The Problem This Solves

Every proposal that lands in a client's inbox immediately generates questions.
*"Why does this take 3 months?" "Can we do this without the Salesforce connector?" "What if we halved the budget?"*

Right now, Proplytics generates the proposal and stops. The agency is back to manual work — rewriting sections, re-estimating effort, reformatting docs — just to answer scope questions.

**ProposalChat closes this loop entirely.**
After generation, the agency (or even the client, in a shareable view) can ask anything about the proposal, and get streaming, contextually aware responses — or trigger targeted regeneration of specific sections without touching the rest of the document.

This is what no competitor offers. Not Proposify, not PandaDoc, not Qwilr.

---

## 🎯 Feature Definition

### What ProposalChat Does

**Mode 1 — Contextual Q&A:**
The user asks any freeform question about the generated proposal. The AI answers with full awareness of every feature, risk, effort estimate, and timeline already in the document. Responses stream in real time using the existing SSE pipeline.

Example queries:
- "Why did you estimate 4 weeks for the authentication layer?"
- "What are the biggest risks if we skip the Zod validation step?"
- "Explain the Confidence Grid scores to me like I'm the client, not a developer"
- "What dependencies exist between Phase 2 and Phase 3?"

**Mode 2 — Scope Mutation:**
The user requests a targeted change to a specific section. The AI regenerates *only that section* of the proposal JSON, streams the new version, and the UI swaps the old card out for the new one with an animated transition — while the rest of the proposal remains untouched.

Example mutations:
- "Reduce the timeline by 2 weeks — what gets cut?"
- "Add a mobile-first phase between Phase 1 and Phase 2"
- "Rewrite the executive summary for a non-technical client audience"
- "Make the budget estimate more conservative — add 20% buffer everywhere"
- "What if we replaced MongoDB with DynamoDB? Rebuild the architecture section"

**Mode 3 — Proposal Interrogation (Intent Classification):**
The system automatically classifies whether a user's input is a *question* (Mode 1) or a *mutation request* (Mode 2) using a lightweight intent classifier built into the same Gemini call. The user never needs to switch modes manually.

---

## 🏗️ System Architecture

### Overview

```
ProposalResult Page
       │
       │  [Opens on button click]
       ▼
ProposalChatSidebar (slide-over panel, right side)
       │
       │  user types message
       ▼
Intent Classifier (client-side, lightweight regex + keyword heuristic)
       │
  ┌────┴──────────┐
  │               │
  ▼               ▼
Question       Mutation Request
  │               │
  └───────┬───────┘
          │
          ▼
POST /api/proposal/:id/chat
  {
    proposalId,
    message,
    intent: "question" | "mutate",
    targetSection: "features" | "timeline" | "risks" | "effort" | "summary" | null,
    history: [...]   ← conversation turns so far
  }
          │
          ▼
Backend: Node.js handler (ECS Fargate — same container, new route)
          │
          ├─── Fetch proposal JSON from S3 (userId/proposalId/vN.json)
          │
          ├─── Build context prompt:
          │      System: "You are a senior technical consultant reviewing this proposal..."
          │      Proposal JSON injected as structured context
          │      Conversation history injected
          │      User message appended
          │
          ├─── If intent = "question":
          │      → Call Gemini (temp 0.3) with narrative answer prompt
          │      → Stream plain text response via SSE
          │
          └─── If intent = "mutate":
                 → Call Gemini (temp 0.2) with JSON-only output prompt
                 → Enforce Zod sub-schema for the targeted section only
                 → Stream the new section JSON via SSE
                 → On stream complete: validate, store mutation as new proposal version in S3
                 → SSE sends { type: "section_update", section: "features", data: {...} }
                 → Frontend receives event → Framer Motion exit/enter animation swaps card
```

### Data Flow — Mutation Path (the harder and more impressive one)

```
User: "Reduce timeline by 2 weeks"
      │
      ▼
Client classifies intent → "mutate", targetSection → "timeline"
      │
      ▼
POST /api/proposal/:id/chat with intent="mutate"
      │
      ▼
Backend fetches full proposal JSON from S3
      │
      ▼
Constructs two-part prompt:
  Part A (System): Elite consultant persona + full proposal context
  Part B (User): "Given the above proposal, regenerate ONLY the timeline section
                  with a 2-week reduction. Identify what gets cut or compressed.
                  Return ONLY a JSON object matching the timeline Zod schema."
      │
      ▼
Gemini streams → backend accumulates → Zod validates timeline sub-schema
      │
      ▼
If valid:
  1. Merge new timeline into existing proposal JSON
  2. Increment version → save as vN+1.json to S3
  3. Update MongoDB version counter
  4. SSE sends: event: section_update, data: { section: "timeline", payload: {...} }
      │
      ▼
Frontend ProposalChatSidebar receives section_update event
  → Triggers Framer Motion exit animation on TimelineSection component
  → Injects new timeline data
  → Framer Motion entrance animation on updated cards
  → Chat thread shows: "Done — I removed Phase 2's QA sprint and compressed the
                        infrastructure setup from 2 weeks to 5 days. Review below."
```

---

## 📁 New Files to Create

### Backend (Node.js — new route, same ECS container)

```
backend/
└── routes/
    └── proposalChat.js           ← New route handler: POST /api/proposal/:id/chat
        
backend/
└── services/
    └── proposalChatService.js    ← Core logic: fetch from S3, build prompt, classify intent
    └── sectionMutator.js         ← Handles JSON merge + S3 versioning for mutations
    └── intentClassifier.js       ← Lightweight heuristic + Gemini fallback for classification
    
backend/
└── prompts/
    └── chatSystemPrompt.js       ← System prompt template for Q&A mode
    └── mutationPrompt.js         ← System prompt template for mutation mode (JSON-only)
    
backend/
└── schemas/
    └── sectionSchemas.js         ← Zod sub-schemas for each proposal section (timeline, features, risks, effort, summary)
```

### Frontend (React — new components on ProposalResult page)

```
src/
└── components/
    └── proposalChat/
        ├── ProposalChatSidebar.jsx    ← Main slide-over panel (reuses Sheet.jsx primitive)
        ├── ChatMessageThread.jsx      ← Scrollable message list with user/AI bubbles
        ├── ChatInputBar.jsx           ← Input + send button + intent indicator chip
        ├── MutationConfirmBanner.jsx  ← "Timeline updated — version 3 saved" notification
        └── SectionUpdateOverlay.jsx   ← Framer Motion wrapper for animated section swaps
        
src/
└── hooks/
    └── useProposalChat.js             ← All chat state: history, streaming, section updates, SSE connection
    └── useIntentClassifier.js         ← Client-side intent heuristic before API call
    
src/
└── pages/
    └── ProposalResult.jsx             ← Add: "Negotiate & Refine" button + ProposalChatSidebar integration
                                          Add: section-level state that can be updated by SSE events
```

---

## 🔄 API Contract

### New Endpoint

```
POST /api/proposal/:id/chat

Headers:
  Authorization: Bearer <jwt>
  Content-Type: application/json

Request Body:
  {
    message: string,               ← user's free-text input
    intent: "question" | "mutate", ← pre-classified on client side
    targetSection: string | null,  ← "features" | "timeline" | "risks" | "effort" | "summary"
    history: [                     ← conversation turns so far (for context continuity)
      { role: "user", content: string },
      { role: "assistant", content: string }
    ]
  }

SSE Event Stream Response:

  For "question" intent:
    event: token
    data: { text: "Based on the proposal, the 4-week estimate for authentication..." }
    
    event: done
    data: { fullResponse: "..." }

  For "mutate" intent:
    event: token           ← streaming the new section JSON as it arrives
    data: { chunk: "..." }
    
    event: section_update  ← fired once mutation is complete and validated
    data: {
      section: "timeline",
      payload: { ...new timeline JSON... },
      newVersion: 3,
      summary: "Removed Phase 2 QA sprint, compressed infra setup to 5 days"
    }
    
    event: done
    data: {}

  On any error:
    event: error
    data: { code: "SCHEMA_INVALID" | "S3_FETCH_FAILED" | "LLM_TIMEOUT", message: string }
```

---

## 🎨 Frontend UX Flow

### Entry Point on ProposalResult Page

The "Negotiate & Refine" button sits in the top-right action bar of the proposal view, next to "Export PDF". It has a subtle pulsing indicator on first load to draw attention (disappears after first click).

### Chat Sidebar Layout

The sidebar slides in from the right, taking up 380px width. The proposal view compresses to accommodate it. On mobile, the sidebar takes full screen.

The sidebar has three zones:

**Zone 1 — Header:** "Proposal Chat" title + current version indicator ("v2") + "Close" button

**Zone 2 — Message Thread:** Scrollable. User messages appear on the right with a neutral background. AI responses appear on the left with the Proplytics accent color as a left border strip — matching the Confidence Grid visual language. Mutation confirmations appear as full-width banners in green.

**Zone 3 — Input Bar:** Full-width textarea (grows to 3 lines max). Below it, a small intent chip auto-updates as the user types: "Question detected" or "Mutation detected — will update: Timeline". This real-time classification gives users confidence that the AI understood their intent before they hit send.

### Section Update Animation Flow

When a section mutation completes:

1. The relevant section in the main proposal view gets a golden pulsing border (Framer Motion `animate` prop cycling opacity)
2. After 500ms, Framer Motion plays an exit animation (cards slide out downward + fade)
3. New cards slide in upward + fade in
4. The golden border fades away
5. A small "Updated · v3" badge appears in the section header for 5 seconds then fades

---

## 📊 Prompt Engineering Strategy

### Context Injection (Critical for Quality)

The proposal JSON is large. Rather than dumping the entire JSON into the prompt, the backend performs a smart context injection:

For **question** mode: inject the full proposal JSON as a structured block, prefixed with a schema explanation so Gemini understands the data shape. Temperature: 0.3, narrative output.

For **mutate** mode: inject only the targeted section's current JSON + the overall proposal summary (project name, client, tech stack, total timeline). This keeps the context window lean and mutation output focused. Temperature: 0.2, JSON-only output, Zod-validated.

The system prompt persona for both modes: *"You are a senior technical architect and business analyst who helped create this proposal. You have deep knowledge of every decision made. Answer as an expert who can both explain reasoning and suggest improvements."*

### Conversation History Management

The full conversation history is passed with each request (same pattern as Narralytics' chat engine). The backend truncates history to the last 6 turns if it approaches token limits, keeping the most recent context.

---

## 🧩 Intent Classification Logic

### Client-Side (Instant, No API Call)

A keyword heuristic runs as the user types (debounced 300ms):

- If the message contains action verbs: "add", "remove", "reduce", "increase", "change", "rewrite", "update", "cut", "compress", "replace", "rebuild", "make it" → classify as **mutate**
- If the message contains question words: "why", "how", "what", "explain", "tell me", "describe", "what if" (without action verbs) → classify as **question**
- Default: **question**

The `targetSection` is extracted by a secondary keyword scan:
- "timeline", "phase", "week", "schedule", "deadline" → targetSection = "timeline"
- "feature", "requirement", "functionality", "scope" → targetSection = "features"
- "risk", "concern", "mitigation", "issue" → targetSection = "risks"
- "effort", "estimate", "hours", "budget", "cost" → targetSection = "effort"
- "summary", "introduction", "overview", "executive" → targetSection = "summary"

### Server-Side Fallback

If the backend receives intent="question" but the Gemini response starts with a JSON `{` character, it auto-reclassifies and routes through the mutation pipeline. This handles cases where the heuristic misclassified.

---

## ⚙️ AWS Infrastructure Changes

**Zero new services.** Everything runs on existing infra.

| Component | Change | Reason |
|:---|:---|:---|
| ECS Fargate task | Add new route handler to existing Node.js app | Same container, same SSE streaming capability |
| S3 | Use existing versioned bucket; chat mutations create vN+1.json | Zero config change |
| API Gateway | Add new route: POST /api/proposal/{id}/chat | 5-minute config change in console or Terraform |
| MongoDB | Add `chatHistory` array to proposal index document | Schema-flexible, no migration needed |
| CloudFront | No change | New API route passes through existing CloudFront origin |
| Secrets Manager | No change | GEMINI_API_KEY already there |
| CloudWatch | Add new metric filter for chat latency | Optional; 5 minutes in console |

---

## 📅 2-Day Implementation Plan

### Day 1 — Backend (Full Chat API)

**Morning (3–4 hours): Route + S3 Fetch + Prompt Builder**

1. Create `proposalChat.js` route handler — skeleton with SSE headers, error handling, auth middleware
2. Create `proposalChatService.js` — S3 fetch function that retrieves current proposal JSON by proposalId + userId
3. Write `chatSystemPrompt.js` — the elite consultant persona system prompt template
4. Write `mutationPrompt.js` — the JSON-only section mutation prompt template with Zod schema instructions

**Afternoon (3–4 hours): Gemini Streaming + Zod + S3 Write**

5. Wire Gemini streaming into the chat handler (reuse the same SSE pipe from /generate)
6. Create `sectionSchemas.js` — extract Zod sub-schemas for each section from the existing main schema
7. Create `sectionMutator.js` — merges validated new section into existing proposal JSON, writes vN+1.json to S3, updates MongoDB version counter
8. Wire both paths (question → stream text, mutate → stream JSON → validate → section_update event)
9. Register the new route in the main Node.js app

**End of Day 1 Gate:** Test with curl/Postman. Given a proposalId, the endpoint should: (a) answer a question about the proposal with a streamed narrative, (b) mutate a section and return a `section_update` SSE event with valid JSON.

---

### Day 2 — Frontend (Chat Sidebar + Section Animations)

**Morning (3–4 hours): Chat UI Components**

1. Create `ProposalChatSidebar.jsx` — slide-over panel using existing `Sheet.jsx` primitive. Wire open/close state in `ProposalResult.jsx`.
2. Create `ChatMessageThread.jsx` — message bubbles with user/AI differentiation. Match the Confidence Grid visual language (accent left borders for AI responses).
3. Create `ChatInputBar.jsx` — textarea + send button + real-time intent chip. Wire `useIntentClassifier.js` hook to the input.
4. Create `useProposalChat.js` hook — manages all chat state: message history, streaming buffer, SSE connection lifecycle, section update events.

**Afternoon (3–4 hours): Section Animation + Polish**

5. Create `SectionUpdateOverlay.jsx` — Framer Motion wrapper that triggers exit/enter animations on section cards when a `section_update` SSE event arrives.
6. Create `MutationConfirmBanner.jsx` — full-width green success banner with version number and mutation summary.
7. Wire `section_update` events to the proposal page state — each proposal section (FeaturesSection, TimelineSection, RiskMatrix, EffortEstimator) receives its data from a state object that can be patched by the chat hook.
8. Add "Negotiate & Refine" button to `ProposalResult.jsx` action bar.
9. Polish: Add loading states, error states, copy-to-clipboard on AI responses, scroll-to-bottom on new messages.

**End of Day 2 Gate:** Full user journey works: open proposal → click "Negotiate & Refine" → ask a question → get streamed answer → ask a mutation → watch the section on the left animate and update → see "v3 saved" confirmation.

---

## ✅ Success Criteria / Testing Checklist

- [ ] Given a valid proposalId, the chat endpoint returns an SSE stream
- [ ] A question query returns a coherent, contextually accurate narrative response
- [ ] A mutation query returns a `section_update` event with Zod-valid JSON
- [ ] The mutated section is saved as a new version to S3
- [ ] The MongoDB version counter increments correctly
- [ ] The frontend sidebar opens and closes without layout breakage
- [ ] Chat history persists across sidebar close/open within the same session
- [ ] Section animations play correctly on mutation without flashing or layout shift
- [ ] The intent chip correctly classifies "Why is this 4 weeks?" as a question
- [ ] The intent chip correctly classifies "Reduce the timeline by 2 weeks" as a mutation
- [ ] SSE errors are caught and displayed as non-blocking error messages in the chat
- [ ] The feature works on mobile (sidebar takes full screen)

---

## 🚀 Why This Feature Wins

| Competitive Impact | Detail |
|:---|:---|
| **No competitor has it** | Proposify, PandaDoc, Qwilr — all static documents. This is the first conversational proposal layer. |
| **Natural sales workflow** | Every proposal triggers 5–10 scope questions. This eliminates the back-and-forth entirely. |
| **Increases proposal stickiness** | Agencies will spend 10x more time inside Proplytics revising than generating. That's 10x more engagement. |
| **Premium tier justification** | "Unlimited chat + mutations" becomes the core Pro/Agency differentiator. Free tier gets 3 chat messages per proposal. |
| **Reinforces the Confidence Grid** | Users naturally ask "why is this Low confidence?" — and the chat answers it. The two features create a feedback loop. |
| **Shareable client link potential** | Future feature: share a read-only chat link with the client, letting them ask questions directly. This becomes a sales multiplier. |

---

## 🔒 Security Considerations

- All chat requests pass through existing JWT auth middleware — no unauthenticated access to proposal context
- The backend validates that the requesting userId matches the proposal's owner in MongoDB before fetching from S3
- Mutation outputs are Zod-validated before writing to S3 — no raw LLM JSON is ever persisted
- Conversation history is not stored in MongoDB by default (session-only) to keep the schema lean — this is a deliberate MVP choice. Full history persistence can be added in a later version as a Pro feature.
- Rate limiting: piggyback on existing API Gateway rate limits. Chat messages count toward the same usage counter as proposal generations.

---

## 📈 Future Extensions (Post-MVP, Not In Scope for 2 Days)

These are ideas that naturally grow from this feature but are explicitly out of scope for the 2-day build:

- **Shareable client chat link** — a public URL where the client can ask questions about the proposal without logging in
- **Mutation audit trail** — show a side-by-side diff of what changed between versions (leverages the already-planned S3 revision history)
- **Bulk what-if scenarios** — generate 3 alternative versions simultaneously with different budget/timeline assumptions
- **Chat history persistence** — store conversation history in MongoDB for Pro users, making it resumable across sessions
- **Proposal co-authoring** — two users from the same agency team can both have the chat sidebar open and see each other's messages in real time (WebSocket upgrade)

---

*Built to stay ahead. The fastest proposal wins the deal — and the smartest negotiation closes it.*
