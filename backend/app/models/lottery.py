from datetime import datetime
from enum import StrEnum

import pymongo
from beanie import Document, PydanticObjectId
from pydantic import BaseModel, Field
from pymongo import IndexModel

from app.models.accessories import Accessory
from app.models.user import utcnow


class LotteryStatus(StrEnum):
    # In bozza la vede solo l'admin; aperta, tutti possono prendere il biglietto.
    DRAFT = "draft"
    OPEN = "open"
    # Estratta: il vincitore è già deciso, ma si scopre solo a `reveal_at` (fine del countdown).
    DRAWN = "drawn"


class Ticket(BaseModel):
    user_id: PydanticObjectId
    number: str
    taken_at: datetime = Field(default_factory=utcnow)


class Lottery(Document):
    """La lotteria di una stanza: una sola per stanza, un biglietto a testa."""

    room_id: PydanticObjectId
    prize: Accessory = Accessory.FLOWER_TUNIC
    status: LotteryStatus = LotteryStatus.DRAFT
    tickets: list[Ticket] = Field(default_factory=list)
    created_at: datetime = Field(default_factory=utcnow)
    opened_at: datetime | None = None
    drawn_at: datetime | None = None
    reveal_at: datetime | None = None
    winner_user_id: PydanticObjectId | None = None
    winner_number: str | None = None

    class Settings:
        name = "lotteries"
        indexes = [IndexModel([("room_id", pymongo.ASCENDING)], unique=True)]
