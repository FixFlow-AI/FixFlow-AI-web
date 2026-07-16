import time
import logging

logger = logging.getLogger(__name__)


class CircuitBreaker:
    """Lightweight, thread-safe Circuit Breaker with Closed, Open, and Half-Open states."""

    def __init__(self, failure_threshold: int = 5, recovery_timeout_sec: float = 30.0):
        self.failure_threshold = failure_threshold
        self.recovery_timeout_sec = recovery_timeout_sec
        self.state = "Closed"  # Closed, Open, Half-Open
        self.failure_count = 0
        self.last_state_change = time.time()

    def is_allowed(self) -> bool:
        """Check if request is allowed to proceed to the primary system."""
        now = time.time()
        if self.state == "Open":
            if now - self.last_state_change > self.recovery_timeout_sec:
                self.state = "Half-Open"
                self.last_state_change = now
                logger.info("[Circuit Breaker] Transitioned to Half-Open state.")
                return True
            return False
        return True

    def record_success(self):
        """Record success to reset the failure counter and close the circuit."""
        self.failure_count = 0
        if self.state != "Closed":
            self.state = "Closed"
            self.last_state_change = time.time()
            logger.info("[Circuit Breaker] Transitioned to Closed state after success.")

    def record_failure(self):
        """Record failure to potentially trip the circuit breaker."""
        self.failure_count += 1
        now = time.time()
        if self.state == "Closed" and self.failure_count >= self.failure_threshold:
            self.state = "Open"
            self.last_state_change = now
            logger.warning(
                "[Circuit Breaker] Consecutives failures (%d) exceeded threshold (%d). Transitioned to Open.",
                self.failure_count,
                self.failure_threshold,
            )
        elif self.state == "Half-Open":
            self.state = "Open"
            self.last_state_change = now
            logger.warning("[Circuit Breaker] Trial request failed in Half-Open state. Transitioned back to Open.")


# Singleton circuit breaker for primary Gemini model
primary_breaker = CircuitBreaker()
