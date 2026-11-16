import random
from datetime import UTC, datetime

from beanie import Document, Indexed
from pydantic import BaseModel, Field

from app.models.accessories import Accessory

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


class AccessoryUnlock(BaseModel):
    accessory: Accessory
    # Prima di questo momento lo sblocco non conta (e non si vede): così il premio della
    # lotteria non svela il vincitore mentre il countdown è ancora in corso.
    available_from: datetime


class User(Document):
    google_sub: Indexed(str, unique=True)  # type: ignore[valid-type]
    email: str
    name: str
    avatar_url: str | None = None
    bio: str = ""
    color: str = Field(default_factory=random_color)
    accessory: Accessory | None = None
    # Accessori speciali vinti (vedi SPECIAL_ACCESSORIES): valgono in tutte le stanze.
    unlocks: list[AccessoryUnlock] = Field(default_factory=list)
    created_at: datetime = Field(default_factory=utcnow)

    def unlocked_accessories(self, now: datetime | None = None) -> list[Accessory]:
        now = now or utcnow()
        unlocked: list[Accessory] = []
        for unlock in self.unlocks:
            if unlock.available_from <= now and unlock.accessory not in unlocked:
                unlocked.append(unlock.accessory)
        return unlocked

    class Settings:
        name = "users"
