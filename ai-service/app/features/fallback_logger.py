import logging

logger = logging.getLogger("fallback")
logger.setLevel(logging.INFO)

if not logger.handlers:
    handler = logging.StreamHandler()
    formatter = logging.Formatter(
        "%(levelname)s: %(feature)s %(reason)s %(message)s %(error)s"
    )
    handler.setFormatter(formatter)
    logger.addHandler(handler)
logger.propagate = False