import logging

logger = logging.getLogger("fallback")
logger.setLevel(logging.INFO)


class FallbackFieldsFilter(logging.Filter):
    """Log filter that ensures custom fields needed by the formatter are always present."""

    def filter(self, record: logging.LogRecord) -> bool:
        if not hasattr(record, "feature"):
            record.feature = "-"
        if not hasattr(record, "reason"):
            record.reason = "-"
        if not hasattr(record, "error"):
            record.error = ""
        return True


if not logger.handlers:
    handler = logging.StreamHandler()
    handler.addFilter(FallbackFieldsFilter())
    formatter = logging.Formatter(
        "%(levelname)s: %(feature)s %(reason)s %(message)s %(error)s"
    )
    handler.setFormatter(formatter)
    logger.addHandler(handler)
logger.propagate = False


def log_fallback(feature: str, reason: str, error: str) -> None:
    """Log structured fallback event safely."""
    logger.error(
        "ai.fallback",
        extra={
            "feature": feature,
            "reason": reason,
            "error": error,
        },
    )