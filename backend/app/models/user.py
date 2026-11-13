import random
from datetime import UTC, datetime

from beanie import Document, Indexed
from pydantic import Field

# Tinte scelte perché stanno bene sull'omino di pan di zenzero e si distinguono tra loro.
DEFAULT_COLORS = [
    "#C0392B",  # rosso bacca
    "#1E8449",  # verde abete
    "#D4A017",  # oro
    "#2E86C1",  # blu notte d'inverno
    "#8E44AD",  # prugna
    "#E67E22",  # mandarino
    "#16A085",  # verde acqua
    "#C2185B",  # lampone
    "#6D4C41",  # cannella
    "#5D6D7E",  # ardesia
    "#AF7AC5",  # lavanda
    "#F1948A",  # rosa zucchero
]


def random_color() -> str:
    return random.choice(DEFAULT_COLORS)


def utcnow() -> datetime:
    return datetime.now(UTC)


class User(Document):
    google_sub: Indexed(str, unique=True)  # type: ignore[valid-type]
    email: str
    name: str
    avatar_url: str | None = None
    bio: str = ""
    color: str = Field(default_factory=random_color)
    created_at: datetime = Field(default_factory=utcnow)

    class Settings:
        name = "users"
