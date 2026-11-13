import hashlib
import secrets
import time
from collections import defaultdict, deque

# Niente caratteri che si confondono quando il codice viene dettato o copiato a mano (0/O, 1/I/L).
ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"
CODE_LENGTH = 6


def generate_code() -> str:
    return "".join(secrets.choice(ALPHABET) for _ in range(CODE_LENGTH))


def normalize_code(code: str) -> str:
    return "".join(ch for ch in code.upper() if ch.isalnum())


def hash_code(code: str) -> str:
    return hashlib.sha256(normalize_code(code).encode()).hexdigest()


class FailedAttemptLimiter:
    """Limita i tentativi sbagliati di riscatto per utente.

    Vive in memoria: va bene finché l'app gira in una sola istanza. Con più repliche andrebbe
    spostato su Mongo o Redis.
    """

    def __init__(self, max_failures: int = 8, window_seconds: float = 600) -> None:
        self.max_failures = max_failures
        self.window_seconds = window_seconds
        self._failures: dict[str, deque[float]] = defaultdict(deque)

    def _prune(self, key: str, now: float) -> deque[float]:
        attempts = self._failures[key]
        while attempts and now - attempts[0] > self.window_seconds:
            attempts.popleft()
        return attempts

    def is_blocked(self, key: str) -> bool:
        return len(self._prune(key, time.monotonic())) >= self.max_failures

    def record_failure(self, key: str) -> None:
        now = time.monotonic()
        self._prune(key, now).append(now)

    def reset(self, key: str) -> None:
        self._failures.pop(key, None)


redeem_limiter = FailedAttemptLimiter()
