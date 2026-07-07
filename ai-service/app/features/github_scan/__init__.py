"""GitHub onboarding scan (roles/01, 01a).

Deterministic-core, AI-at-the-edges design:
  - `client`      fetches facts from GitHub (no LLM).
  - `aggregate`   rolls raw repos into a compact, deterministic summary.
  - `agents`      three parallel segment agents (skills / projects / experience)
                  + a deterministic confidence agent. Only skills & projects
                  touch the LLM, and only for last-mile normalization/summaries.
  - `orchestrator` wires it together with asyncio, and supports streaming each
                  segment as it completes (progressive reveal).
"""
from .orchestrator import run_github_scan, stream_github_scan

__all__ = ["run_github_scan", "stream_github_scan"]
