---
title: Root-Cause Analysis — The Elite Diagnostic Thinking Procedure
inclusion: always
description: >
  The low-level, reproducible reasoning algorithm any coding agent uses to pinpoint
  the true source of a bug, trace it to its origin, and fix it correctly the first
  time — instead of guessing or patching symptoms. Companion to
  agent-operating-manual.md. Platform-agnostic (Kiro, Antigravity, Claude Code,
  Cursor, Windsurf, Copilot, any LLM).
tags: [debugging, root-cause, diagnosis, reasoning, cross-platform]
---

# Root-Cause Analysis — The Elite Diagnostic Thinking Procedure

> **Purpose.** `agent-operating-manual.md` describes *how an elite agent behaves*. This file is the part people actually want to copy: **the exact mental procedure to zero in on the real problem, trace it to its true source, and fix it correctly the first time** — instead of flailing, guessing, or patching symptoms.
>
> This is a *reproducible reasoning algorithm*, written so any model on any platform can execute it step by step.

---

## 0. The Core Belief

> **Every bug has exactly one true cause (or a small set). Your job is not to make the error go away — it is to find that cause and prove it.**

A **symptom** is *where you noticed the problem*. The **root cause** is *where it was born*. They are almost never the same place. Elite diagnosis is the disciplined walk from symptom back to birth.

Three failure modes this prevents:
1. **Symptom-patching** — silencing the error where it surfaced (try/catch, a null check) while the real defect lives upstream.
2. **Shotgun debugging** — changing many things at once, hoping one works, learning nothing.
3. **Confirmation tunnel** — latching onto the first plausible theory and only seeking supporting evidence.

---

## 1. The Diagnostic Pipeline

```
 OBSERVE → REPRODUCE → LOCALIZE → HYPOTHESIZE → TEST → TRACE-TO-ROOT → FIX → VERIFY → GENERALIZE
    │          │           │           │          │          │          │        │          │
  facts    make it     narrow the   theories   cheap    walk the    fix at   prove it   prevent
  only     reliable    blast zone   (ranked)   probes   causal      source   + no        recurrence
                                               first    chain                regress
```

Each stage has strict entry/exit conditions. **Do not advance until the current stage's exit condition is met.** Skipping stages is exactly what produces bad fixes.

---

## 2. Stage-By-Stage Procedure

### Stage 1 — OBSERVE (raw facts, zero interpretation)
Gather without theorizing: the **exact** error message + full stack trace (read the innermost frame and every "Caused by:"); expected vs. actual; the trigger conditions (input, env, user, version); whether it's **deterministic or intermittent** (this reshapes the whole hunt); and **what changed recently** (last commit, deploy, dep bump, config, data) — most bugs are freshly introduced.
**Exit:** You can state the symptom in one precise sentence, with trigger conditions.
> ⚠️ Read the *whole* trace. The line that threw is rarely the line that's wrong; the bottom / "Caused by:" points closer to the origin.

### Stage 2 — REPRODUCE (make failure reliable)
Find the **minimal** trigger; strip everything not required to make it fail (each removable-but-still-failing thing is a clue about what's irrelevant). If intermittent, hunt the hidden variable: timing/race, uninitialized state, ordering, cache, external dependency, data shape, concurrency, resource limits. If you truly can't reproduce, escalate to evidence-based tracing (targeted logging) and reason from captured facts.
**Exit:** You can trigger it on demand, *or* have a concrete logged trace.
> A minimal repro is half the diagnosis — the smaller the repro, the smaller the space the cause can hide in.

### Stage 3 — LOCALIZE (shrink the search space)
Cheapest techniques first: read the stack trace bottom-up to the deepest frame in *your* code; **bisect the timeline** (binary-search commits — `git bisect` mentality) if it worked before; **bisect the data flow** (is data correct at the midpoint? yes → downstream, no → upstream; repeat, halving); **bisect the code** (stub halves of the suspect region); **check the boundaries** (bugs cluster at seams: API edges, type conversions, serialization, async boundaries, module interfaces, third-party calls).
**Exit:** The cause is confined to a small, named region.
> Mindset: **binary search over everything** — commits, data flow, code paths. Each probe should roughly *halve* the remaining possibilities. That's how you go from 100,000 lines to 10.

### Stage 4 — HYPOTHESIZE (enumerate, then rank)
Run the **usual suspects checklist** for the localized region:
- **State:** stale/uninitialized/wrongly-mutated, shared mutable state, cache invalidation.
- **Data:** null/undefined, empty collection, wrong type, encoding, boundary value (0, -1, max, off-by-one), unexpected shape.
- **Control flow:** wrong branch, inverted condition, missing early return, fallthrough.
- **Concurrency:** race, deadlock, ordering assumption, non-atomic read-modify-write.
- **Contracts:** wrong args, misunderstood API semantics, wrong assumption about a library.
- **Environment:** version mismatch, missing env var, config drift, permissions.
- **Integration:** the other system returned something unexpected; a schema changed.

Then **rank** by: what the evidence most directly points to × what changed most recently × what is *cheapest to confirm or kill*.
**Exit:** A short, ranked list of falsifiable hypotheses, each phrased "If cause is X, I should observe Y."
> Prefer hypotheses you can **disprove cheaply**. You learn as much from killing a theory as confirming one.

### Stage 5 — TEST (one variable at a time)
**Change one thing at a time** (multiple changes destroy attribution). Use targeted probes: a log at the exact suspect point, a breakpoint, an isolating unit test, an assertion on the invariant you believe is violated. **Predict before you probe** — a surprise is information. Kill hypotheses top-down until one survives evidence.
**Exit:** Exactly one hypothesis stands, supported by *observed evidence* — not plausibility.
> Never "fix and hope." A fix applied before the cause is confirmed is a guess wearing a lab coat.

### Stage 6 — TRACE-TO-ROOT (the "5 Whys" walk)
The confirmed defect is often still a symptom. Ask **"why"** until you hit bedrock:
```
Symptom:  API returns 500 on checkout.
  Why? → NullPointer reading order.total.
  Why? → order.total is null.
  Why? → cart serializer skipped total when items was empty.
  Why? → an empty cart was allowed to reach checkout.
  Why? → the "add to cart" guard was removed in commit abc123.   ← ROOT CAUSE
```
Stop when the next "why" leaves code you control (then it becomes a *design* question: why don't we handle that gracefully?). The true root is usually a **missing guard, a violated invariant, or a wrong assumption** — not the line that crashed.
**Exit:** You can name the *origin* — the specific line/decision/assumption where correct behavior first diverged.
> Fixing the deepest controllable cause is what makes a fix durable — and often kills sibling bugs you haven't found yet.

### Stage 7 — FIX (at the source, minimally, correctly)
Fix **where it originates**, not where it surfaced. Smallest correct change; resist refactoring the neighborhood. Preserve invariants/contracts; if you must change a contract, update *all* callers. Never fix by weakening a check, swallowing an exception, or loosening a type — unless that check *was* the defect.
**Exit:** The change addresses the root cause and leaves the code coherent.

### Stage 8 — VERIFY (prove the fix; prove no regressions)
Re-run the **exact reproduction** from Stage 2 → must now pass. Add a **regression test** that fails without the fix and passes with it. Run the surrounding suite + build → no new breakage. Re-examine adjacent edge cases (empty/null/boundary/concurrency neighbors).
**Exit:** Reproduction passes, a new test guards it, suite/build is green.
> "I fixed it" without re-running the original repro is a claim, not a fact.

### Stage 9 — GENERALIZE (kill the species, not one bug)
**Search for the same mistake elsewhere** (grep for its twins). **Strengthen the boundary** — add the missing validation/guard/type at the seam so this *class* can't re-enter. **Note the lesson** (comment/doc) if it came from a misunderstood API or fragile pattern.
**Exit:** The bug is dead, its siblings are found, and the door it came through is harder to re-open.

---

## 3. The Cognitive Rules That Power It

1. **Evidence outranks intuition.** Intuition proposes; evidence disposes.
2. **Halve the space with every action.** Elite diagnosis is logarithmic, not linear.
3. **Follow the data, not the code.** Walk the bad value backward through the pipeline.
4. **Distrust the recent change.** ~80% of new bugs came from the last change.
5. **The stack trace is a map — read it fully.** Innermost/`Caused by` + deepest frame in *your* code are the high-value coordinates.
6. **One variable per experiment.** Attribution is impossible otherwise.
7. **A hypothesis you can't disprove is worthless.** Phrase theories as falsifiable predictions.
8. **Boundaries are where bugs live.** Suspect the seams (type conversions, serialization, async edges, API/integration points).
9. **Invariants are your compass.** Ask "what must always be true here?" — the bug is where it's silently violated.
10. **Reproduce first, or you're guessing.**
11. **Symptom location ≠ cause location.** Assume they differ until proven otherwise.
12. **When stuck, widen then narrow.** Zoom out to question assumptions (is this even the code path that runs? is the data/env what I think?), then narrow with fresh eyes.

---

## 4. Special-Case Playbooks

**Intermittent / "works on my machine":** the cause is a hidden variable. Enumerate what differs between pass and fail (timing, concurrency/order, uninitialized state, data content, caching, env/config, resource pressure, locale/timezone, network). Log state at failure; diff a failing trace against a passing one.

**Performance regressions:** don't guess the slow part — **measure** (profile, time, count). Treat "too slow" as the symptom: what changed, where is time actually spent, what's the algorithmic/data cause (N+1 query, accidental O(n²), missing index, unbounded growth, blocking I/O).

**Heisenbugs (vanish when observed):** adding a log/breakpoint changing timing → strong signal of a race/timing/memory-ordering issue. Use non-intrusive evidence and reason about the concurrency model.

**"Broke after an upgrade":** read the changelog/migration notes; assume a contract/behavior change; diff old vs. new behavior at the exact call site.

**Integration failures:** capture the *actual* request/response at the boundary; verify your assumption about the other system's contract against reality.

---

## 5. The Diagnostic Mindset in One Paragraph

> Treat the reported error as a clue at the crime scene, not the crime itself. Collect facts before theories. Make the failure reproducible, then binary-search the space — across commits, data flow, and code paths — halving the suspects with each single-variable probe. Form falsifiable hypotheses and try to *disprove* them cheaply. When one survives, don't stop: ask "why" backward until you reach the true origin — usually a missing guard, a violated invariant, or a wrong assumption, not the line that threw. Fix it *there*, minimally. Then prove it with the original reproduction plus a new regression test, confirm nothing else broke, and hunt down every sibling of the same mistake so the whole class of bug dies. That disciplined walk from symptom to origin — evidence over intuition, every step halving the unknown — is what lets you find and solve what other approaches miss.

---

*Companion: `agent-operating-manual.md` — the universal operating manual for elite agent behavior.*
