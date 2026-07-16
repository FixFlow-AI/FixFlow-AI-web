import contextvars
import time
from typing import Dict, Any

# ContextVar to store request ID across the async task execution
request_id_var: contextvars.ContextVar[str] = contextvars.ContextVar("request_id", default="-")

# In-memory metrics store
metrics = {
    "total_calls": 0,
    "total_failures": 0,
    "total_input_tokens": 0,
    "total_output_tokens": 0,
    "cache_hits": 0,
    "cache_misses": 0,
    "latencies_seconds": [],
}


def get_request_id() -> str:
    """Retrieve the current request's unique ID."""
    return request_id_var.get()


def set_request_id(rid: str) -> None:
    """Set the current request's unique ID."""
    request_id_var.set(rid)


def record_call(latency_sec: float, input_tokens: int, output_tokens: int, success: bool):
    """Record LLM call metrics."""
    metrics["total_calls"] += 1
    if not success:
        metrics["total_failures"] += 1
    metrics["total_input_tokens"] += input_tokens
    metrics["total_output_tokens"] += output_tokens
    metrics["latencies_seconds"].append(latency_sec)
    # Keep only the last 1000 latencies
    if len(metrics["latencies_seconds"]) > 1000:
        metrics["latencies_seconds"] = metrics["latencies_seconds"][-1000:]


def record_cache(hit: bool):
    """Record cache hits vs misses."""
    if hit:
        metrics["cache_hits"] += 1
    else:
        metrics["cache_misses"] += 1


def get_metrics_summary() -> Dict[str, Any]:
    """Compile telemetry metrics report."""
    latencies = metrics["latencies_seconds"]
    avg_latency = sum(latencies) / len(latencies) if latencies else 0.0
    return {
        "totalCalls": metrics["total_calls"],
        "totalFailures": metrics["total_failures"],
        "totalInputTokens": metrics["total_input_tokens"],
        "totalOutputTokens": metrics["total_output_tokens"],
        "cacheHits": metrics["cache_hits"],
        "cacheMisses": metrics["cache_misses"],
        "averageLatencySeconds": round(avg_latency, 4),
    }
