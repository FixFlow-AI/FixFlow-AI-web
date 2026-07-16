# AGENTS.md — FixFlowAI Agent Entry Point

> **Cross-platform agent instructions.** This root-level file is the universal entry point recognized by most AI coding tools (Antigravity, Cursor, Windsurf, Codex/CLI agents, and others that follow the `AGENTS.md` convention). Kiro loads the same rules automatically from `.kiro/steering/`.
>
> **All agents, on all platforms, must follow the documents linked below.** They are the single source of truth for how to behave and think while working in this repository.

---

## Read These First (in order)

1. **How to behave** — [.kiro/steering/agent-operating-manual.md](.kiro/steering/agent-operating-manual.md)
   The universal elite-agent operating manual: identity, the core execution loop, decision policy (act vs. ask vs. analyze), the failure-loop protocol, code-quality standards, always-on security, tool discipline, and the definition of done.

2. **How to diagnose** — [.kiro/steering/root-cause-analysis.md](.kiro/steering/root-cause-analysis.md)
   The low-level, reproducible diagnostic procedure: the 9-stage pipeline (Observe → Reproduce → Localize → Hypothesize → Test → Trace-to-Root → Fix → Verify → Generalize), the cognitive rules, and special-case playbooks. Use this whenever you debug or investigate.

3. **Project facts & conventions** — [.agents/AGENTS.md](.agents/AGENTS.md)
   FixFlowAI-specific stack, naming, architecture principles, LLM integration patterns, and quality gates.

4. **Project context (Kiro steering)** —
   [.kiro/steering/product.md](.kiro/steering/product.md) · [.kiro/steering/tech.md](.kiro/steering/tech.md) · [.kiro/steering/structure.md](.kiro/steering/structure.md)

---

## The 60-Second Version

> Understand the real goal before touching anything. Read the code; never assume what you can verify. Make the smallest correct change, matching the codebase's own style. Fix root causes, not symptoms. Build, run, and test everything you ship — "should work" is not "works." Be secure by default and stop before destructive or irreversible actions. If an approach fails twice, stop and re-diagnose instead of patching. Act decisively on safe, reversible work; confirm on risky work. Communicate concisely and honestly, stating exactly what you verified and what you did not.

---

## Platform Discovery Notes

| Platform | How it finds these rules |
|----------|--------------------------|
| **Kiro** | Auto-loads `.kiro/steering/*.md` (both manuals have `inclusion: always`). |
| **Antigravity / Cursor / Windsurf / Codex-style** | Read this root `AGENTS.md`, then follow the links above. |
| **Claude Code** | Reads `CLAUDE.md` / `AGENTS.md` at root — this file plus the linked docs. |
| **Any other LLM / IDE** | Point the model at this file or at `.kiro/steering/agent-operating-manual.md` as a system prompt. |

The rules are model-agnostic by design: Claude, Gemini, GPT, Llama, or any future model should follow them identically. Elite output comes from the discipline the agent is held to — these files are that discipline.
