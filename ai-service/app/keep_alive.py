"""Background keep-alive pinger for the AI service.

Render free web services spin down after ~15 min with no inbound traffic. While
this service is awake it pings the other FixFlowAI services every 10 minutes so
the whole stack stays warm. This is redundant with (and complementary to) the
external GitHub Actions cron — the cron is what actually *wakes* a sleeping
service, while this keeps peers warm from inside the network.

Targets are configured via the comma-separated ``KEEP_ALIVE_TARGETS`` env var
(full URLs, including path, e.g. ".../api/health"). Disable with
``KEEP_ALIVE_ENABLED=false``.
"""
from __future__ import annotations

import asyncio
import logging
import os

import httpx

logger = logging.getLogger(__name__)

INTERVAL_SECONDS = 10 * 60  # 10 minutes — comfortably under Render's ~15 min sleep
_task: "asyncio.Task | None" = None


def _targets() -> list[str]:
    raw = os.getenv("KEEP_ALIVE_TARGETS", "")
    return [u.strip() for u in raw.split(",") if u.strip()]


async def _ping_once() -> None:
    targets = _targets()
    if not targets:
        return
    async with httpx.AsyncClient(
        timeout=90.0, headers={"User-Agent": "FixFlowAI-KeepAlive/1.0"}, follow_redirects=True
    ) as client:
        for url in targets:
            try:
                res = await client.get(url)
                logger.info("[KeepAlive] Pinged %s (%s)", url, res.status_code)
            except Exception as err:  # noqa: BLE001 — a failed ping still reset the peer's timer
                logger.warning("[KeepAlive] Ping failed for %s: %s", url, err)


async def _loop() -> None:
    # Small initial delay so app startup is never blocked by a slow peer.
    await asyncio.sleep(15)
    while True:
        await _ping_once()
        await asyncio.sleep(INTERVAL_SECONDS)


def start_keep_alive() -> None:
    """Launch the background pinger (idempotent). No-op when disabled or when no
    targets are configured."""
    global _task
    if _task is not None:
        return
    if os.getenv("KEEP_ALIVE_ENABLED", "true").lower() == "false":
        logger.info("[KeepAlive] Disabled via KEEP_ALIVE_ENABLED=false.")
        return
    if not _targets():
        logger.info("[KeepAlive] No KEEP_ALIVE_TARGETS configured; self-pinger idle.")
        return
    try:
        _task = asyncio.create_task(_loop())
        logger.info(
            "[KeepAlive] AI-service self-pinger started — every %d min to: %s",
            INTERVAL_SECONDS // 60,
            ", ".join(_targets()),
        )
    except RuntimeError as err:
        logger.warning("[KeepAlive] Could not start pinger (no running loop?): %s", err)


def stop_keep_alive() -> None:
    global _task
    if _task is not None:
        _task.cancel()
        _task = None
